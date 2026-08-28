(() => {
  const canvas = document.querySelector("#field");
  const ctx = canvas.getContext("2d");

  const el = {
    m1type: document.querySelector("#m1type"),
    m2type: document.querySelector("#m2type"),
    s1: document.querySelector("#s1"),
    s2: document.querySelector("#s2"),
    s1out: document.querySelector("#s1out"),
    s2out: document.querySelector("#s2out"),
    flip1: document.querySelector("#flip1"),
    flip2: document.querySelector("#flip2"),
    effectToggle: document.querySelector("#effectToggle"),
    effectHint: document.querySelector("#effectHint"),
    predictionPanel: document.querySelector("#predictionPanel"),
    angleSlider: document.querySelector("#angleSlider"),
    angleOut: document.querySelector("#angleOut"),
    rotateLeft: document.querySelector("#rotateLeft"),
    rotateRight: document.querySelector("#rotateRight"),
    lineMode: document.querySelector("#lineMode"),
    allMode: document.querySelector("#allMode"),
    offMode: document.querySelector("#offMode"),
    readout: document.querySelector("#readout"),
  };

  const COLORS = {
    north: "#f04444",
    south: "#218c4b",
    field: "#3f759d",
  };

  const state = {
    mode: "line",
    magneticOn: true,
    flip1: false,
    flip2: false,
    manualAngle: 0,
    compass: { x: 0.5, y: 0.18 },
    drag: false,
  };

  let W = 720;
  let H = 450;
  let dpr = 1;

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  }

  function formatStrength(value) {
    return Number(value).toFixed(1).replace(".", ",") + "×";
  }

  function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
  }

  function updateUI() {
    el.s1out.textContent = formatStrength(el.s1.value);
    el.s2out.textContent = formatStrength(el.s2.value);

    const secondMagnetOn = el.m2type.value !== "off";
    el.s2.disabled = !secondMagnetOn;
    el.flip2.disabled = !secondMagnetOn;

    el.effectToggle.textContent = state.magneticOn
      ? "Magnetische Wirkung: AN"
      : "Magnetische Wirkung: AUS";

    el.effectToggle.setAttribute(
      "aria-pressed",
      state.magneticOn ? "true" : "false",
    );

    el.effectToggle.classList.toggle("effect-on", state.magneticOn);
    el.effectToggle.classList.toggle("effect-off", !state.magneticOn);

    el.effectHint.textContent = state.magneticOn
      ? "Die Kompassnadel richtet sich automatisch aus."
      : "Vorhersagemodus: Die Kompassnadel kann manuell gedreht werden.";

    el.predictionPanel.hidden = state.magneticOn;

    el.angleSlider.value = String(
      Math.round(normalizeDegrees(state.manualAngle)),
    );
    el.angleOut.textContent = String(
      Math.round(normalizeDegrees(state.manualAngle)),
    );

    el.lineMode.disabled = !state.magneticOn;
    el.allMode.disabled = !state.magneticOn;
    el.offMode.disabled = !state.magneticOn;
  }

  function magnets() {
    const twoMagnets = el.m2type.value !== "off";
    const cy = H * 0.57;

    return [
      {
        id: 1,
        type: el.m1type.value,
        strength: Number(el.s1.value),
        flip: state.flip1,
        cx: twoMagnets ? W * 0.29 : W * 0.5,
        cy,
      },
      ...(twoMagnets
        ? [
            {
              id: 2,
              type: el.m2type.value,
              strength: Number(el.s2.value),
              flip: state.flip2,
              cx: W * 0.71,
              cy,
            },
          ]
        : []),
    ];
  }

  function rectGeom(magnet) {
    const outerW = Math.min(178, W * 0.255);
    const outerH = Math.min(170, H * 0.39);
    const side = Math.max(34, outerW * 0.235);
    const bridge = Math.max(30, outerH * 0.2);

    return {
      left: magnet.cx - outerW / 2,
      right: magnet.cx + outerW / 2,
      top: magnet.cy - outerH / 2,
      bottom: magnet.cy + outerH / 2,
      side,
      bridge,
      gapL: magnet.cx - outerW / 2 + side,
      gapR: magnet.cx + outerW / 2 - side,
      gapT: magnet.cy - outerH / 2,
      gapB: magnet.cy + outerH / 2 - bridge,
    };
  }

  function pointSourcesFor(magnet) {
    if (magnet.type === "bar") {
      const half = Math.min(72, W * 0.105);
      const sign = magnet.flip ? -1 : 1;

      return [
        {
          x: magnet.cx - half,
          y: magnet.cy,
          q: sign * magnet.strength,
        },
        {
          x: magnet.cx + half,
          y: magnet.cy,
          q: -sign * magnet.strength,
        },
      ];
    }

    const g = rectGeom(magnet);
    const sign = magnet.flip ? -1 : 1;
    const sources = [];
    const n = 17;

    const leftQ = (sign * magnet.strength) / n;
    const rightQ = (-sign * magnet.strength) / n;

    const margin = 10;
    const span = Math.max(20, g.gapB - g.gapT - 2 * margin);

    for (let i = 0; i < n; i += 1) {
      const y = g.gapT + margin + (i / (n - 1)) * span;

      sources.push({
        x: g.gapL - 2,
        y,
        q: leftQ,
      });

      sources.push({
        x: g.gapR + 2,
        y,
        q: rightQ,
      });
    }

    return sources;
  }

  function allSources() {
    return magnets().flatMap(pointSourcesFor);
  }

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function rectUniformContribution(magnet, x, y) {
    if (magnet.type !== "rect") {
      return { x: 0, y: 0 };
    }

    const g = rectGeom(magnet);
    const sign = magnet.flip ? -1 : 1;
    const edge = 18;

    const wx =
      smoothstep(g.gapL - edge, g.gapL + edge, x) *
      (1 - smoothstep(g.gapR - edge, g.gapR + edge, x));

    const wy =
      smoothstep(g.gapT - 14, g.gapT + 18, y) *
      (1 - smoothstep(g.gapB - 20, g.gapB + 14, y));

    const weight = Math.max(0, wx * wy);

    return {
      x: (sign > 0 ? 1 : -1) * 0.0000105 * magnet.strength * weight,
      y: 0,
    };
  }

  function field(x, y) {
    let bx = 0;
    let by = 0;

    for (const source of allSources()) {
      const dx = x - source.x;
      const dy = y - source.y;
      const r2 = dx * dx + dy * dy + 115;
      const factor = source.q / (r2 * Math.sqrt(r2));

      bx += factor * dx;
      by += factor * dy;
    }

    for (const magnet of magnets()) {
      const uniform = rectUniformContribution(magnet, x, y);
      bx += uniform.x;
      by += uniform.y;
    }

    return {
      x: bx,
      y: by,
      m: Math.hypot(bx, by),
    };
  }

  function nearPole(x, y, wantedSign, radius = 9) {
    return allSources().some(
      (source) =>
        Math.sign(source.q) === wantedSign &&
        Math.hypot(x - source.x, y - source.y) < radius,
    );
  }

  function boundaryCross(px, py, nx, ny) {
    const candidates = [];
    const dx = nx - px;
    const dy = ny - py;

    if (nx < 0 && dx !== 0) {
      candidates.push({ t: (0 - px) / dx, edge: "left" });
    }

    if (nx > W && dx !== 0) {
      candidates.push({ t: (W - px) / dx, edge: "right" });
    }

    if (ny < 0 && dy !== 0) {
      candidates.push({ t: (0 - py) / dy, edge: "top" });
    }

    if (ny > H && dy !== 0) {
      candidates.push({ t: (H - py) / dy, edge: "bottom" });
    }

    const valid = candidates
      .filter((candidate) => candidate.t >= 0 && candidate.t <= 1)
      .sort((a, b) => a.t - b.t);

    if (!valid.length) {
      return null;
    }

    const hit = valid[0];
    const ix = px + dx * hit.t;
    const iy = py + dy * hit.t;

    if (hit.edge === "left") {
      const y = Math.max(0, Math.min(H, iy));
      return { exit: [0, y], enter: [W, y] };
    }

    if (hit.edge === "right") {
      const y = Math.max(0, Math.min(H, iy));
      return { exit: [W, y], enter: [0, y] };
    }

    if (hit.edge === "top") {
      const x = Math.max(0, Math.min(W, ix));
      return { exit: [x, 0], enter: [x, H] };
    }

    const x = Math.max(0, Math.min(W, ix));
    return { exit: [x, H], enter: [x, 0] };
  }

  function traceWrapped(
    x,
    y,
    sign,
    maxWraps = 8,
    maxSteps = 2600,
  ) {
    const segments = [];

    let segment = [[x, y]];
    let px = x;
    let py = y;
    let wraps = 0;

    for (let i = 0; i < maxSteps; i += 1) {
      const b = field(px, py);

      if (b.m < 1e-11) {
        break;
      }

      const step = 3;
      const nx = px + (sign * step * b.x) / b.m;
      const ny = py + (sign * step * b.y) / b.m;

      const cross = boundaryCross(px, py, nx, ny);

      if (cross) {
        segment.push(cross.exit);

        if (segment.length > 1) {
          segments.push(segment);
        }

        segment = [cross.enter];
        px = cross.enter[0];
        py = cross.enter[1];

        wraps += 1;

        if (wraps >= maxWraps) {
          break;
        }

        continue;
      }

      px = nx;
      py = ny;
      segment.push([px, py]);

      const targetSign = sign > 0 ? -1 : 1;

      if (i > 10 && nearPole(px, py, targetSign, 8)) {
        break;
      }
    }

    if (segment.length > 1) {
      segments.push(segment);
    }

    return segments;
  }

  function drawPolyline(points, width = 1.2, alpha = 0.7) {
    if (points.length < 2) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = cssVar("--field", COLORS.field);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1]);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawArrow(points, reverse = false) {
    if (points.length < 14) {
      return;
    }

    const ordered = reverse ? [...points].reverse() : points;
    const index = Math.min(
      ordered.length - 2,
      Math.floor(ordered.length * 0.55),
    );

    const a = ordered[index];
    const b = ordered[index + 1];
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);

    ctx.save();
    ctx.translate(a[0], a[1]);
    ctx.rotate(angle);
    ctx.fillStyle = cssVar("--field", COLORS.field);

    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawSegments(
    segments,
    width,
    alpha,
    reverse = false,
  ) {
    for (const segment of segments) {
      drawPolyline(segment, width, alpha);

      if (segment.length > 14) {
        drawArrow(segment, reverse);
      }
    }
  }

  function barSeeds(magnet) {
    const half = Math.min(72, W * 0.105);
    const sign = magnet.flip ? -1 : 1;
    const count = Math.round(10 + 8 * magnet.strength);
    const northX = sign > 0 ? magnet.cx - half : magnet.cx + half;
    const seeds = [];

    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;

      seeds.push([
        northX + Math.cos(angle) * 12,
        magnet.cy + Math.sin(angle) * 12,
      ]);
    }

    return seeds;
  }

  function rectSeeds(magnet) {
    const g = rectGeom(magnet);
    const sign = magnet.flip ? -1 : 1;
    const count = Math.round(10 + 8 * magnet.strength);
    const sourceX = sign > 0 ? g.gapL + 5 : g.gapR - 5;
    const seeds = [];
    const margin = 14;

    for (let i = 0; i < count; i += 1) {
      const y =
        g.gapT +
        margin +
        ((i + 0.5) / count) *
          (g.gapB - g.gapT - 2 * margin);

      seeds.push([sourceX, y]);
    }

    const outerCount = Math.max(
      5,
      Math.round(5 * magnet.strength),
    );

    const northOnLeft = sign > 0;
    const outerX = northOnLeft ? g.left - 5 : g.right + 5;

    for (let i = 0; i < outerCount; i += 1) {
      const y =
        g.top +
        12 +
        ((i + 0.5) / outerCount) *
          (g.bottom - g.top - 24);

      seeds.push([outerX, y]);
    }

    return seeds;
  }

  function drawSingleWrappedLine() {
    const x = state.compass.x * W;
    const y = state.compass.y * H;

    drawSegments(
      traceWrapped(x, y, -1, 8, 2600),
      2.2,
      0.98,
      true,
    );

    drawSegments(
      traceWrapped(x, y, 1, 8, 2600),
      2.2,
      0.98,
      false,
    );
  }

  function drawEntireField() {
    for (const magnet of magnets()) {
      const seeds =
        magnet.type === "bar"
          ? barSeeds(magnet)
          : rectSeeds(magnet);

      for (const seed of seeds) {
        const segments = traceWrapped(
          seed[0],
          seed[1],
          1,
          3,
          1800,
        );

        drawSegments(segments, 1.15, 0.64, false);
      }
    }
  }

  function drawFieldLines() {
    if (!state.magneticOn || state.mode === "off") {
      return;
    }

    if (state.mode === "line") {
      drawSingleWrappedLine();
      return;
    }

    if (state.mode === "all") {
      drawEntireField();
    }
  }

  function roundRectPath(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBarMagnet(magnet) {
    const w = Math.min(154, W * 0.225);
    const h = 52;
    const x = magnet.cx - w / 2;
    const y = magnet.cy - h / 2;

    const sign = magnet.flip ? -1 : 1;
    const leftColor =
      sign > 0 ? COLORS.north : COLORS.south;
    const rightColor =
      sign > 0 ? COLORS.south : COLORS.north;

    ctx.save();
    roundRectPath(x, y, w, h, 10);
    ctx.clip();

    ctx.fillStyle = leftColor;
    ctx.fillRect(x, y, w / 2, h);

    ctx.fillStyle = rightColor;
    ctx.fillRect(x + w / 2, y, w / 2, h);
    ctx.restore();

    ctx.strokeStyle = cssVar("--border", "#777");
    ctx.lineWidth = 1.5;
    roundRectPath(x, y, w, h, 10);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 16px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      sign > 0 ? "N" : "S",
      x + w * 0.25,
      magnet.cy,
    );

    ctx.fillText(
      sign > 0 ? "S" : "N",
      x + w * 0.75,
      magnet.cy,
    );
  }

  function drawRectMagnet(magnet) {
    const g = rectGeom(magnet);
    const sign = magnet.flip ? -1 : 1;

    const leftColor =
      sign > 0 ? COLORS.north : COLORS.south;
    const rightColor =
      sign > 0 ? COLORS.south : COLORS.north;

    const leftLabel = sign > 0 ? "N" : "S";
    const rightLabel = sign > 0 ? "S" : "N";
    const mid = (g.left + g.right) / 2;

    ctx.save();

    ctx.fillStyle = leftColor;
    ctx.fillRect(
      g.left,
      g.top,
      g.side,
      g.bottom - g.top,
    );

    ctx.fillStyle = rightColor;
    ctx.fillRect(
      g.right - g.side,
      g.top,
      g.side,
      g.bottom - g.top,
    );

    ctx.fillStyle = leftColor;
    ctx.fillRect(
      g.left,
      g.bottom - g.bridge,
      mid - g.left,
      g.bridge,
    );

    ctx.fillStyle = rightColor;
    ctx.fillRect(
      mid,
      g.bottom - g.bridge,
      g.right - mid,
      g.bridge,
    );

    ctx.strokeStyle = cssVar("--border", "#6f6f6f");
    ctx.lineWidth = 1.4;

    ctx.strokeRect(
      g.left,
      g.top,
      g.side,
      g.bottom - g.top,
    );

    ctx.strokeRect(
      g.right - g.side,
      g.top,
      g.side,
      g.bottom - g.top,
    );

    ctx.strokeRect(
      g.left,
      g.bottom - g.bridge,
      g.right - g.left,
      g.bridge,
    );

    ctx.fillStyle = cssVar("--text", "#111");
    ctx.font = "700 18px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    ctx.fillText(
      leftLabel,
      g.left + g.side / 2,
      g.top + 8,
    );

    ctx.fillText(
      rightLabel,
      g.right - g.side / 2,
      g.top + 8,
    );

    ctx.restore();
  }

  function drawMagnets() {
    for (const magnet of magnets()) {
      if (magnet.type === "bar") {
        drawBarMagnet(magnet);
      } else {
        drawRectMagnet(magnet);
      }
    }
  }

  function compassAngle() {
    if (!state.magneticOn) {
      return (
        (normalizeDegrees(state.manualAngle) * Math.PI) /
        180
      );
    }

    const b = field(
      state.compass.x * W,
      state.compass.y * H,
    );

    return b.m < 1e-12 ? 0 : Math.atan2(b.y, b.x);
  }

  function drawCompass() {
    const x = state.compass.x * W;
    const y = state.compass.y * H;
    const b = field(x, y);
    const angle = compassAngle();
    const r = 24;

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = cssVar("--canvas", "#fff");
    ctx.strokeStyle = cssVar("--text", "#222");
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.rotate(angle);

    ctx.fillStyle = COLORS.north;
    ctx.beginPath();
    ctx.moveTo(r - 4, 0);
    ctx.lineTo(-3, -7);
    ctx.lineTo(-3, 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.south;
    ctx.beginPath();
    ctx.moveTo(-r + 4, 0);
    ctx.lineTo(3, -7);
    ctx.lineTo(3, 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = cssVar("--text", "#222");
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (state.magneticOn) {
      const degrees = normalizeDegrees(
        (angle * 180) / Math.PI,
      );

      el.readout.textContent =
        `Automatische Ausrichtung: ${degrees.toFixed(0)}° · ` +
        `relative Feldstärke: ${(b.m * 1e6).toFixed(2)}`;
    } else {
      el.readout.textContent =
        `Deine Vorhersage: ${Math.round(
          normalizeDegrees(state.manualAngle),
        )}° · Kompass reagiert momentan nicht auf das Magnetfeld.`;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = cssVar("--canvas", "#fafafa");
    ctx.fillRect(0, 0, W, H);

    drawFieldLines();
    drawMagnets();
    drawCompass();
  }

  function setMode(mode) {
    if (!state.magneticOn) {
      return;
    }

    state.mode = mode;

    [
      [el.lineMode, "line"],
      [el.allMode, "all"],
      [el.offMode, "off"],
    ].forEach(([button, name]) => {
      button.classList.toggle("active", mode === name);
    });

    draw();
  }

  function setMagnetic(on) {
    state.magneticOn = on;

    if (!on) {
      const b = field(
        state.compass.x * W,
        state.compass.y * H,
      );

      if (b.m >= 1e-12) {
        state.manualAngle = normalizeDegrees(
          (Math.atan2(b.y, b.x) * 180) / Math.PI,
        );
      }

      state.mode = "off";

      [
        [el.lineMode, "line"],
        [el.allMode, "all"],
        [el.offMode, "off"],
      ].forEach(([button, name]) => {
        button.classList.toggle("active", name === "off");
      });
    }

    updateUI();
    draw();
  }

  function moveCompass(event) {
    const rect = canvas.getBoundingClientRect();

    state.compass.x = Math.max(
      0.025,
      Math.min(
        0.975,
        (event.clientX - rect.left) / rect.width,
      ),
    );

    state.compass.y = Math.max(
      0.035,
      Math.min(
        0.965,
        (event.clientY - rect.top) / rect.height,
      ),
    );

    draw();
  }

  function changeManualAngle(delta) {
    state.manualAngle = normalizeDegrees(
      state.manualAngle + delta,
    );

    updateUI();
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    state.drag = true;
    canvas.setPointerCapture?.(event.pointerId);
    moveCompass(event);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (state.drag) {
      moveCompass(event);
    }
  });

  canvas.addEventListener("pointerup", () => {
    state.drag = false;
  });

  canvas.addEventListener("pointercancel", () => {
    state.drag = false;
  });

  document.querySelectorAll(".nudge").forEach((button) => {
    button.addEventListener("click", () => {
      state.compass.x = Math.max(
        0.025,
        Math.min(
          0.975,
          state.compass.x +
            Number(button.dataset.dx) / W,
        ),
      );

      state.compass.y = Math.max(
        0.035,
        Math.min(
          0.965,
          state.compass.y +
            Number(button.dataset.dy) / H,
        ),
      );

      draw();
    });
  });

  [el.m1type, el.m2type, el.s1, el.s2].forEach(
    (control) => {
      control.addEventListener("input", () => {
        updateUI();
        draw();
      });
    },
  );

  el.flip1.addEventListener("click", () => {
    state.flip1 = !state.flip1;
    draw();
  });

  el.flip2.addEventListener("click", () => {
    if (el.m2type.value !== "off") {
      state.flip2 = !state.flip2;
      draw();
    }
  });

  el.effectToggle.addEventListener("click", () => {
    setMagnetic(!state.magneticOn);
  });

  el.angleSlider.addEventListener("input", () => {
    state.manualAngle = normalizeDegrees(
      Number(el.angleSlider.value),
    );

    updateUI();
    draw();
  });

  el.rotateLeft.addEventListener("click", () => {
    changeManualAngle(-10);
  });

  el.rotateRight.addEventListener("click", () => {
    changeManualAngle(10);
  });

  el.lineMode.addEventListener("click", () => {
    setMode("line");
  });

  el.allMode.addEventListener("click", () => {
    setMode("all");
  });

  el.offMode.addEventListener("click", () => {
    setMode("off");
  });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);

    W = Math.max(300, Math.round(rect.width));
    H = Math.max(300, Math.round(rect.height));

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  updateUI();

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  resize();
})();
