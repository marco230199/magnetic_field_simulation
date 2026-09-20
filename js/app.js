(() => {
  const canvas = document.querySelector("#field");
  const ctx = canvas.getContext("2d");

  const el = {
    filingsToggle: document.querySelector("#toggle-filings"),
    coilToggle: document.querySelector("#coilToggle"),
    coilCurrent: document.querySelector("#coilCurrent"),
    coilCurrentOut: document.querySelector("#coilCurrentOut"),
    coilMode: document.querySelector("#coilMode"),
    m1type: document.querySelector("#m1type"),
    m2type: document.querySelector("#m2type"),
    s1: document.querySelector("#s1"),
    s2: document.querySelector("#s2"),
    s1out: document.querySelector("#s1out"),
    s2out: document.querySelector("#s2out"),
    flip1: document.querySelector("#flip1"),
    flip2: document.querySelector("#flip2"),
    reverseCurrent: document.querySelector("#reverseCurrent"),
    reverseCurrent2: document.querySelector("#reverseCurrent2"),
    current: document.querySelector("#current"),
    currentOut: document.querySelector("#currentOut"),
    conductorToggle: document.querySelector("#conductorToggle"),
    current2: document.querySelector("#current2"),
    current2Out: document.querySelector("#current2Out"),
    conductor2Toggle: document.querySelector("#conductor2Toggle"),
    effectToggle: document.querySelector("#effectToggle"),
    effectHint: document.querySelector("#effectHint"),
    predictionPanel: document.querySelector("#predictionPanel"),
    angleSlider: document.querySelector("#angleSlider"),
    angleOut: document.querySelector("#angleOut"),
    rotateLeft: document.querySelector("#rotateLeft"),
    rotateRight: document.querySelector("#rotateRight"),
    lineMode: document.querySelector("#lineMode"),
    magnet1Mode: document.querySelector("#magnet1Mode"),
    magnet2Mode: document.querySelector("#magnet2Mode"),
    magnetsMode: document.querySelector("#magnetsMode"),
    conductorMode: document.querySelector("#conductorMode"),
    conductor2Mode: document.querySelector("#conductor2Mode"),
    conductorsMode: document.querySelector("#conductorsMode"),
    conductorLegend: document.querySelector("#conductorLegend"),
    magnetLegend: document.querySelector("#magnetLegend"),
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
    mode: "off",
    magneticOn: false,
    flip1: false,
    flip2: false,
    coilOn: false,
    currentDirection: 1,
    current2Direction: -1,
    conductorOn: false,
    conductor2On: false,
    conductor2: { x: 0.72, y: 0.72 },
    manualAngle: 0,
    compass: { x: 0.5, y: 0.18 },
  };

  let W = 720;
  let H = 450;
  let dpr = 1;
  let activePointerId = null;
  let dragTarget = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let filings = [];
  let filingsActive = false;
  let filingsSignature = "";
  let filingsFrame = null;
  let filingsTime = 0;

  function generateFilings(seedX, seedY, count = 60) {
    filings = [];
    if (field(seedX, seedY).m < 1e-11) return;
    const points = traceConductorLine([seedX, seedY], magnets(), conductors());
    // Nur einen zusammenhängenden, sichtbaren Zweig verwenden.
    let branch = [];
    let longest = [];
    for (const point of points) {
      if (point[0] >= 8 && point[0] <= W - 8 && point[1] >= 8 && point[1] <= H - 8) {
        branch.push(point);
        if (branch.length > longest.length) longest = branch;
      } else {
        branch = [];
      }
    }
    if (longest.length < 2) return;
    const distances = [0];
    for (let i = 1; i < longest.length; i += 1) {
      distances.push(distances[i - 1] + Math.hypot(
        longest[i][0] - longest[i - 1][0], longest[i][1] - longest[i - 1][1],
      ));
    }
    const length = distances[distances.length - 1];
    // Auf kleinen Flächen weniger Späne, damit die Stäbchen getrennt bleiben.
    count = Math.min(count, Math.floor(length / 10));
    let segment = 1;
    for (let i = 0; i < count; i += 1) {
      const distance = (i + 0.5) * length / count;
      while (segment < distances.length - 1 && distances[segment] < distance) segment += 1;
      const a = longest[segment - 1];
      const b = longest[segment];
      const t = (distance - distances[segment - 1]) / (distances[segment] - distances[segment - 1]);
      const position = { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t };
      const vector = field(position.x, position.y);
      const targetAngle = Math.atan2(vector.y, vector.x);
      filings.push({ position, angle: targetAngle + (Math.random() - 0.5) * Math.PI, targetAngle });
    }
  }

  function updateFilings(dt) {
    let moving = false;
    const damping = 1 - Math.exp(-10 * dt);
    for (const filing of filings) {
      const b = field(filing.position.x, filing.position.y);
      if (b.m < 1e-11) continue;
      filing.targetAngle = Math.atan2(b.y, b.x);
      // Ein unmarkiertes Stäbchen besitzt dieselbe Achse nach einer halben Drehung.
      const difference = filing.targetAngle - filing.angle;
      const delta = Math.atan2(Math.sin(2 * difference), Math.cos(2 * difference)) / 2;
      filing.angle += delta * damping;
      if (Math.abs(delta) > 0.002) moving = true;
    }
    return moving;
  }

  function drawFilings(context) {
    context.save();
    context.fillStyle = cssVar("--filings", "#454950");
    for (const filing of filings) {
      context.save();
      context.translate(filing.position.x, filing.position.y);
      context.rotate(filing.angle);
      context.fillRect(-4, -1.25, 8, 2.5);
      context.restore();
    }
    context.restore();
  }

  function animateFilings(time) {
    filingsFrame = null;
    if (!filingsActive) return;
    const dt = Math.min(0.05, Math.max(0, (time - filingsTime) / 1000));
    filingsTime = time;
    const moving = updateFilings(dt);
    draw();
    if (moving && filingsFrame === null) filingsFrame = requestAnimationFrame(animateFilings);
  }

  function refreshFilings() {
    const sources = magnets();
    const wires = conductors();
    const signature = JSON.stringify([W, H, sources, wires]);
    if (signature === filingsSignature) return;
    filingsSignature = signature;
    const source = sources.find((item) => item.type !== "coil" || Math.abs(item.current) > 0.01);
    const wire = wires.find((item) => Math.abs(item.current) > 0.01);
    if (source) {
      const offset = source.type === "bar" ? Math.min(240, H * 0.4)
        : source.type === "rect" ? H * 0.24 : source.radius * 0.6;
      generateFilings(source.cx, source.cy - offset);
    } else if (wire) {
      generateFilings(wire.cx, wire.cy - Math.min(110, H * 0.25));
    } else {
      filings = [];
    }
    if (filings.length && filingsFrame === null) {
      filingsTime = performance.now();
      filingsFrame = requestAnimationFrame(animateFilings);
    }
  }

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

    const firstMagnetOn = el.m1type.value !== "off";
    const secondMagnetOn = el.m2type.value !== "off";
    const conductorOn = state.conductorOn;
    const conductor2On = state.conductor2On;
    el.s1.disabled = !firstMagnetOn;
    el.flip1.disabled = !firstMagnetOn;
    el.s2.disabled = !secondMagnetOn;
    el.flip2.disabled = !secondMagnetOn;

    if (
      !secondMagnetOn &&
      state.mode === "magnet2"
    ) {
      state.mode = "line";
    }

    if (!firstMagnetOn && state.mode === "magnet1") state.mode = "line";
    if ((!firstMagnetOn || !secondMagnetOn) && state.mode === "magnets") {
      state.mode = firstMagnetOn ? "magnet1" : secondMagnetOn ? "magnet2" : "line";
    }
    if (!conductorOn && state.mode === "conductor") state.mode = "line";
    if (!conductor2On && state.mode === "conductor2") state.mode = "line";

    if ((!conductorOn || !conductor2On) && state.mode === "conductors") {
      state.mode = conductorOn ? "conductor" : conductor2On ? "conductor2" : "line";
    }

    if (!state.coilOn && state.mode === "coil") state.mode = "line";
    el.coilCurrent.disabled = !state.coilOn;
    el.coilMode.disabled = !state.magneticOn || !state.coilOn;
    el.coilToggle.textContent = state.coilOn ? "Spule ausblenden" : "Spule anzeigen";
    el.coilToggle.setAttribute("aria-pressed", String(state.coilOn));
    el.coilToggle.classList.toggle("active", state.coilOn);
    const coilCurrent = Number(el.coilCurrent.value);
    el.coilCurrentOut.textContent = `${coilCurrent.toFixed(1).replace(".", ",")} A · ${
      coilCurrent === 0 ? "kein Feld" : coilCurrent > 0 ? "Nordpol rechts" : "Nordpol links"}`;

    updateConductorControl(1, conductorOn, conductorCurrent(1));
    updateConductorControl(2, conductor2On, conductorCurrent(2));

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

    el.lineMode.disabled = false;
    el.magnet1Mode.disabled = !state.magneticOn || !firstMagnetOn;
    el.magnet2Mode.disabled = !state.magneticOn || !secondMagnetOn;
    el.magnetsMode.disabled = !firstMagnetOn || !secondMagnetOn;
    el.conductorMode.disabled = !state.magneticOn || !conductorOn;
    el.conductor2Mode.disabled = !state.magneticOn || !conductor2On;
    el.conductorsMode.disabled = !state.magneticOn || !conductorOn || !conductor2On;
    el.conductorLegend.hidden = !state.magneticOn || state.mode !== "conductors";
    el.magnetLegend.hidden = state.mode !== "magnets";
    const sourceCount = Number(firstMagnetOn) + Number(secondMagnetOn) +
      Number(conductorOn) + Number(conductor2On) + Number(state.coilOn);
    el.allMode.disabled = sourceCount === 0;
    el.offMode.disabled = false;

    updateModeButtons();
  }

  function conductorCurrent(id) {
    const magnitude = Number((id === 1 ? el.current : el.current2).value);
    return magnitude * (id === 1 ? state.currentDirection : state.current2Direction);
  }

  function updateConductorControl(id, on, current) {
    const output = id === 1 ? el.currentOut : el.current2Out;
    const slider = id === 1 ? el.current : el.current2;
    const button = id === 1 ? el.conductorToggle : el.conductor2Toggle;
    const reverseButton = id === 1 ? el.reverseCurrent : el.reverseCurrent2;
    const selectedDirection = id === 1 ? state.currentDirection : state.current2Direction;
    reverseButton.disabled = !on;
    reverseButton.title = selectedDirection > 0
      ? "Aktuell: aus dem Bildschirm heraus (⊙)"
      : "Aktuell: in den Bildschirm hinein (⊗)";
    reverseButton.textContent = `Richtung tauschen (${selectedDirection > 0 ? "⊙ → ⊗" : "⊗ → ⊙"})`;
    const direction = current < 0
      ? "in den Bildschirm hinein (⊗)"
      : current > 0
        ? "aus dem Bildschirm heraus (⊙)"
        : "kein Strom";
    output.textContent = `${Math.abs(current).toFixed(1).replace(".", ",")} A · ${direction}`;
    slider.disabled = !on;
    button.textContent = on ? `Leiter ${id} ausblenden` : `Leiter ${id} anzeigen`;
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.classList.toggle("active", on);
  }

  function magnets() {
    const cy = H * 0.57;
    const configs = [
      { id: 1, type: el.m1type.value, strength: Number(el.s1.value), flip: state.flip1 },
      { id: 2, type: el.m2type.value, strength: Number(el.s2.value), flip: state.flip2 },
    ].filter((magnet) => magnet.type !== "off");
    const slots = configs.length + Number(state.conductorOn);
    const result = configs.map((magnet, index) => ({
      ...magnet,
      cx: W * (index + 1) / (slots + 1),
      cy,
    }));
    if (state.coilOn) result.push(coil());
    return result;
  }

  function coil() {
    const hasOthers = el.m1type.value !== "off" || el.m2type.value !== "off" ||
      state.conductorOn || state.conductor2On;
    return {
      id: "coil", type: "coil", cx: W * 0.5, cy: H * (hasOthers ? 0.27 : 0.52),
      half: Math.min(140, W * 0.29), radius: Math.min(43, H * 0.105),
      current: Number(el.coilCurrent.value), turns: 10,
    };
  }

  // Längsschnitt-Modell: Jede Windung trägt oben und unten mit einem
  // entgegengesetzten Leiterstrom bei. Die regelmäßige Summe verstärkt das
  // Innenfeld und erzeugt ohne künstliche Kurven ein geschlossenes Außenfeld.
  function coilContribution(coil, x, y) {
    let bx = 0;
    let by = 0;
    for (let i = 0; i < coil.turns; i += 1) {
      const dx = x - (coil.cx - coil.half + (i + 0.5) * 2 * coil.half / coil.turns);
      for (const side of [-1, 1]) {
        const dy = y - (coil.cy + side * coil.radius);
        const factor = -side * coil.current * 0.00135 / (dx * dx + dy * dy + 64);
        bx += dy * factor;
        by -= dx * factor;
      }
    }
    return { x: bx, y: by };
  }

  function conductors() {
    const result = [];
    if (state.conductorOn) {
      const magnetCount = Number(el.m1type.value !== "off") + Number(el.m2type.value !== "off");
      result.push({
        id: 1,
        cx: W * (magnetCount + 1) / (magnetCount + 2),
        cy: H * 0.57,
        current: conductorCurrent(1),
      });
    }
    if (state.conductor2On) {
      result.push({
        id: 2,
        cx: state.conductor2.x * W,
        cy: state.conductor2.y * H,
        current: conductorCurrent(2),
      });
    }
    return result;
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
    if (magnet.type === "coil") return [];
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

  function allSources(fieldMagnets = magnets()) {
    return fieldMagnets.flatMap(pointSourcesFor);
  }

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function rectUniformContribution(magnet, x, y) {
    if (magnet.type === "coil") return coilContribution(magnet, x, y);
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

  function field(x, y, fieldMagnets = magnets(), fieldConductors = conductors()) {
    let bx = 0;
    let by = 0;

    for (const source of allSources(fieldMagnets)) {
      const dx = x - source.x;
      const dy = y - source.y;
      const r2 = dx * dx + dy * dy + 115;
      const factor = source.q / (r2 * Math.sqrt(r2));

      bx += factor * dx;
      by += factor * dy;
    }

    for (const magnet of fieldMagnets) {
      const uniform = rectUniformContribution(magnet, x, y);
      bx += uniform.x;
      by += uniform.y;
    }

    for (const conductor of fieldConductors) {
      const dx = x - conductor.cx;
      const dy = y - conductor.cy;
      const r2 = dx * dx + dy * dy + 180;
      const factor = conductor.current * 0.00135 / r2;
      bx += dy * factor;
      by -= dx * factor;
    }

    return {
      x: bx,
      y: by,
      m: Math.hypot(bx, by),
    };
  }

  function nearPole(x, y, wantedSign, radius = 9, fieldMagnets = magnets()) {
    return allSources(fieldMagnets).some(
      (source) =>
        Math.sign(source.q) === wantedSign &&
        Math.hypot(x - source.x, y - source.y) < radius,
    );
  }

  function traceFieldLine(
    x,
    y,
    sign,
    maxSteps = 4000,
    fieldMagnets = magnets(),
    fieldConductors = conductors(),
    wrapFlatHorizontalLines = false,
  ) {
    const segments = [[[x, y]]];
    let points = segments[0];
    let px = x;
    let py = y;
    let horizontalWraps = 0;

    // Feldlinien werden auch außerhalb des sichtbaren Canvas weiterverfolgt.
    // Der Canvas schneidet diesen Teil beim Zeichnen automatisch ab. Eine oben
    // austretende Linie kann so an ihrer tatsächlichen Rückkehrposition wieder
    // sichtbar werden, statt künstlich an die untere Kante versetzt zu werden.
    const horizontalLimit = W * 5;
    const verticalLimit = H * 7;

    function unitDirection(atX, atY) {
      const b = field(atX, atY, fieldMagnets, fieldConductors);
      if (b.m < 1e-11) return null;
      return {
        x: sign * b.x / b.m,
        y: sign * b.y / b.m,
      };
    }

    for (let i = 0; i < maxSteps; i += 1) {
      const step = 3;
      const firstDirection = unitDirection(px, py);
      if (!firstDirection) break;

      // Mittelpunktverfahren statt eines einfachen Euler-Schritts. Dadurch
      // driften geschlossene Leiter-Feldlinien nicht mehr als enge Spiralen.
      const midX = px + firstDirection.x * step * 0.5;
      const midY = py + firstDirection.y * step * 0.5;
      const midDirection = unitDirection(midX, midY);
      if (!midDirection) break;

      const nx = px + midDirection.x * step;
      const ny = py + midDirection.y * step;

      px = nx;
      py = ny;
      points.push([px, py]);

      // Die axiale Feldlinie eines idealisierten Stabmagneten schließt sich
      // erst im Unendlichen. Beim alleinstehenden Stabmagneten setzen wir
      // deshalb nur nahezu waagerechte Linien am gegenüberliegenden Rand
      // fort. Getrennte Segmente verhindern eine Querlinie durch den Canvas.
      if (
        wrapFlatHorizontalLines &&
        horizontalWraps < 1 &&
        (px < 0 || px > W) &&
        Math.abs(midDirection.x) > 0.94
      ) {
        px = px < 0 ? W : 0;
        py = Math.max(0, Math.min(H, py));
        points = [[px, py]];
        segments.push(points);
        horizontalWraps += 1;
        continue;
      }

      // Eine geschlossene Feldlinie nach dem ersten vollständigen Umlauf
      // beenden, statt denselben Weg immer wieder zu überzeichnen.
      if (i > 50 && Math.hypot(px - x, py - y) < step * 1.5) {
        points.push([x, y]);
        break;
      }

      const targetSign = sign > 0 ? -1 : 1;

      if (i > 10 && nearPole(px, py, targetSign, 8, fieldMagnets)) {
        break;
      }

      if (
        px < -horizontalLimit ||
        px > W + horizontalLimit ||
        py < -verticalLimit ||
        py > H + verticalLimit
      ) {
        break;
      }
    }

    return segments;
  }

  function drawPolyline(
    points,
    width = 1.2,
    alpha = 0.7,
    color = cssVar("--field", COLORS.field),
    lineDash = [],
  ) {
    if (points.length < 2) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash(lineDash);

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1]);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawArrow(
    points,
    reverse = false,
    color = cssVar("--field", COLORS.field),
    alpha = 1,
  ) {
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
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;

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
    color = cssVar("--field", COLORS.field),
    lineDash = [],
  ) {
    for (const segment of segments) {
      drawPolyline(segment, width, alpha, color, lineDash);

      if (segment.length > 14) {
        drawArrow(segment, reverse, color, alpha);
      }
    }
  }

  function barSeeds(magnet, excludeAxial = false) {
    const half = Math.min(72, W * 0.105);
    const sign = magnet.flip ? -1 : 1;
    const count = Math.round(10 + 8 * magnet.strength);
    const northX = sign > 0 ? magnet.cx - half : magnet.cx + half;
    const seeds = [];

    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;

      if (excludeAxial && Math.abs(Math.sin(angle)) < 1e-10) {
        continue;
      }

      seeds.push([
        northX + Math.cos(angle) * 12,
        magnet.cy + Math.sin(angle) * 12,
      ]);
    }

    return seeds;
  }

  function barAxialSegments(magnet) {
    const half = Math.min(72, W * 0.105);
    const sign = magnet.flip ? -1 : 1;
    const northX = sign > 0 ? magnet.cx - half : magnet.cx + half;
    const southX = sign > 0 ? magnet.cx + half : magnet.cx - half;
    const northOutsideX = northX - sign * 12;
    const southOutsideX = southX + sign * 12;

    function straightSegment(fromX, toX) {
      const count = Math.max(2, Math.ceil(Math.abs(toX - fromX) / 3));
      return Array.from({ length: count + 1 }, (_, index) => [
        fromX + (toX - fromX) * index / count,
        magnet.cy,
      ]);
    }

    return sign > 0
      ? [straightSegment(northOutsideX, 0), straightSegment(W, southOutsideX)]
      : [straightSegment(northOutsideX, W), straightSegment(0, southOutsideX)];
  }

  function rectSeeds(magnet) {
    const g = rectGeom(magnet);
    const sign = magnet.flip ? -1 : 1;
    const count = Math.round(3 + 3 * magnet.strength);
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

  function conductorSeeds(conductor, countOverride = null, fieldConductors = []) {
    if (Math.abs(conductor.current) < 0.01) return [];
    const maxRadius = Math.min(145, W * 0.2);
    const count = countOverride ?? Math.max(
      1,
      Math.round(1 + 2.5 * Math.abs(conductor.current)),
    );
    // Im gemeinsamen Feld nach außen entlang der Verbindungsachse starten.
    // So liegen die Startpunkte auch beim Verschieben der Leiter symmetrisch
    // und geraten nicht über die Mitte in die Schleifen des anderen Leiters.
    const other = fieldConductors.find(
      (item) => item.id !== conductor.id && Math.abs(item.current) >= 0.01,
    );
    const dx = other ? conductor.cx - other.cx : 1;
    const dy = other ? conductor.cy - other.cy : 0;
    const distance = Math.hypot(dx, dy);
    const directionX = distance > 0 ? dx / distance : 1;
    const directionY = distance > 0 ? dy / distance : 0;
    const seeds = [];
    for (let i = 0; i < count; i += 1) {
      const radius = count === 1 ? 70 : 38 + i * (maxRadius - 38) / (count - 1);
      seeds.push([
        conductor.cx + directionX * radius,
        conductor.cy + directionY * radius,
      ]);
    }
    // Große äußere Schleifen zeigen bei Gegenströmen die fast geraden
    // Abschnitte nahe der Mitte. Ihre Größe folgt dem Leiterabstand.
    if (other && conductor.current * other.current < 0 && distance > 0) {
      const outerRadius = Math.max(maxRadius, distance);
      for (const scale of [2, 4]) {
        seeds.push([
          conductor.cx + directionX * outerRadius * scale,
          conductor.cy + directionY * outerRadius * scale,
        ]);
      }
    }
    return seeds;
  }

  function drawConductorField(conductor, color = cssVar("--field", COLORS.field), lineDash = []) {
    for (const seed of conductorSeeds(conductor)) {
      const radius = seed[0] - conductor.cx;
      const direction = conductor.current > 0 ? -1 : 1;
      const points = [];
      for (let i = 0; i <= 100; i += 1) {
        const angle = direction * i / 100 * Math.PI * 2;
        points.push([
          conductor.cx + Math.cos(angle) * radius,
          conductor.cy + Math.sin(angle) * radius,
        ]);
      }
      drawSegments([points], 1.3, 0.85, false, color, lineDash);
    }
  }

  function traceConductorLine(seed, fieldMagnets, fieldConductors) {
    const forward = traceFieldLine(
      seed[0], seed[1], 1, 2200, fieldMagnets, fieldConductors,
    )[0];

    const forwardEnd = forward[forward.length - 1];
    if (
      forward.length > 50 &&
      forwardEnd[0] === seed[0] && forwardEnd[1] === seed[1]
    ) {
      return forward;
    }

    const backward = traceFieldLine(
      seed[0], seed[1], -1, 2200, fieldMagnets, fieldConductors,
    )[0].reverse();
    return [...backward.slice(0, -1), ...forward];
  }

  function drawSingleFieldLine() {
    const x = state.compass.x * W;
    const y = state.compass.y * H;

    drawSegments(
      traceFieldLine(x, y, -1, 4000),
      2.2,
      0.98,
      true,
    );

    drawSegments(
      traceFieldLine(x, y, 1, 4000),
      2.2,
      0.98,
      false,
    );
  }

  function drawEntireField(
    fieldMagnets = magnets(),
    seedMagnets = fieldMagnets,
    style = {},
    fieldConductors = conductors(),
    seedConductors = fieldConductors,
  ) {
    const wrapSingleBarMagnet =
      fieldMagnets.length === 1 &&
      fieldMagnets[0].type === "bar" &&
      fieldConductors.length === 0;

    for (const magnet of seedMagnets) {
      if (magnet.type === "coil") {
        drawCoilField(magnet, fieldMagnets, fieldConductors);
        continue;
      }
      const seeds =
        magnet.type === "bar"
          ? barSeeds(magnet, wrapSingleBarMagnet)
          : rectSeeds(magnet);

      for (const seed of seeds) {
        const segments = traceFieldLine(
          seed[0],
          seed[1],
          1,
          3000,
          fieldMagnets,
          fieldConductors,
          wrapSingleBarMagnet,
        );

        drawSegments(
          segments,
          style.width ?? 1.15,
          style.alpha ?? 0.64,
          false,
          style.color ?? cssVar("--field", COLORS.field),
          style.lineDash ?? [],
        );
      }

      if (magnet.type === "bar" && wrapSingleBarMagnet) {
        drawSegments(
          barAxialSegments(magnet),
          style.width ?? 1.15,
          style.alpha ?? 0.64,
          false,
          style.color ?? cssVar("--field", COLORS.field),
          style.lineDash ?? [],
        );
      }
    }

    const activeSeedConductors = seedConductors.filter(
      (conductor) => Math.abs(conductor.current) >= 0.01,
    );
    const maxCurrent = Math.max(
      0,
      ...activeSeedConductors.map((conductor) => Math.abs(conductor.current)),
    );
    // Im gemeinsamen Feld genügen wenige repräsentative Linien:
    // ca. 6 bei 1 A und ca. 10 bei 2 A für zwei aktive Leiter,
    // ergänzt um äußere Schleifen bei entgegengesetzten Strömen.
    const combinedTotal = Math.round(2 + 4 * maxCurrent);
    const seedsPerConductor = activeSeedConductors.length > 1
      ? Math.max(1, Math.ceil(combinedTotal / activeSeedConductors.length))
      : null;

    for (const conductor of activeSeedConductors) {
      for (const seed of conductorSeeds(conductor, seedsPerConductor, fieldConductors)) {
        const points = traceConductorLine(seed, fieldMagnets, fieldConductors);
        drawSegments(
          [points],
          style.width ?? 1.3,
          style.alpha ?? 0.72,
          false,
          style.color ?? cssVar("--field", COLORS.field),
          style.lineDash ?? [],
        );
      }
    }
  }

  function drawFieldLines() {
    if (state.mode === "off") {
      return;
    }

    if (state.mode === "line") {
      drawSingleFieldLine();
      return;
    }

    if (state.mode === "conductors") {
      for (const conductor of conductors()) {
        drawConductorField(conductor,
          cssVar(conductor.id === 1 ? "--conductor1-field" : "--conductor2-field",
            conductor.id === 1 ? "#2563eb" : "#b45309"),
          conductor.id === 1 ? [] : [7, 4]);
      }
      return;
    }

    if (state.mode === "magnets") {
      for (const magnet of magnets().filter((item) => item.type !== "coil")) {
        const isFirst = magnet.id === 1;
        drawEntireField(
          [magnet],
          [magnet],
          {
            color: cssVar(
              isFirst ? "--magnet1-field" : "--magnet2-field",
              isFirst ? "#2563eb" : "#b45309",
            ),
            lineDash: isFirst ? [] : [7, 4],
            alpha: 0.8,
          },
          [],
          [],
        );
      }
      return;
    }

    if (state.mode === "coil") {
      drawCoilField(coil(), [coil()], []);
      return;
    }

    if (state.mode === "all") {
      const fieldMagnets = magnets();
      const fieldConductors = conductors();
      if (fieldMagnets.length === 0 && fieldConductors.length === 1) {
        drawConductorField(fieldConductors[0]);
        return;
      }
      drawEntireField();
      return;
    }

    const fieldMagnets = magnets();

    if (state.mode === "magnet1") {
      const magnet = fieldMagnets.find((item) => item.id === 1);
      if (magnet) drawEntireField([magnet], [magnet], {}, [], []);
      return;
    }

    if (state.mode === "magnet2") {
      const magnet = fieldMagnets.find((item) => item.id === 2);
      if (magnet) drawEntireField([magnet], [magnet], {}, [], []);
      return;
    }

    if (state.mode === "conductor" || state.mode === "conductor2") {
      const wantedId = state.mode === "conductor" ? 1 : 2;
      const conductor = conductors().find((item) => item.id === wantedId);
      if (conductor) drawConductorField(conductor);
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

  function drawCoilField(source, fieldMagnets, fieldConductors) {
    if (Math.abs(source.current) < 0.01) return;
    const count = 3 + Math.round(Math.abs(source.current));
    const color = "#479ddd";
    for (let i = 0; i < count; i += 1) {
      // Spiegelbildliche Startpunkte im Innenraum; kein Start auf der
      // Achse, deren Rückkehrbogen im idealisierten Modell unendlich groß ist.
      const offset = source.radius * (0.23 + 0.57 * i / (count - 1));
      for (const side of [-1, 1]) {
        const seed = [source.cx, source.cy + side * offset];
        const points = traceConductorLine(seed, fieldMagnets, fieldConductors);
        drawSegments([points], 1.35, 0.52, false, color);
        // Derselbe berechnete Verlauf wird im Inneren kräftiger betont.
        ctx.save();
        ctx.beginPath();
        ctx.rect(source.cx - source.half * 0.9, source.cy - source.radius * 0.86,
          source.half * 1.8, source.radius * 1.72);
        ctx.clip();
        drawPolyline(points, 2.25, 0.95, color);
        ctx.restore();
        // Ein zusätzlicher Pfeil direkt im Innenraum zeigt die lokale Richtung.
        const b = field(seed[0], seed[1], fieldMagnets, fieldConductors);
        if (b.m > 1e-11) {
          const arrow = Array.from({ length: 17 }, (_, j) => [
            seed[0] + (j - 9) * b.x / b.m,
            seed[1] + (j - 9) * b.y / b.m,
          ]);
          drawArrow(arrow, false, color, 1);
        }
      }
    }
  }

  function drawCoil(source) {
    ctx.save();
    // Kreisförmige Windungen erscheinen in der Seitenansicht als Ellipsen.
    const spacing = source.half * 2 / source.turns;
    ctx.strokeStyle = "#bd803e";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < source.turns; i += 1) {
      const x = source.cx - source.half + (i + 0.5) * spacing;
      ctx.beginPath();
      ctx.ellipse(x, source.cy, spacing * 0.48, source.radius, 0, 0, Math.PI * 2);
      ctx.globalAlpha = 0.65;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 18px system-ui";
    if (Math.abs(source.current) >= 0.01) {
      for (const side of [-1, 1]) {
        const north = side * source.current > 0;
        ctx.fillStyle = north ? COLORS.north : COLORS.south;
        ctx.fillText(north ? "N" : "S", source.cx + side * (source.half + 15), source.cy);
      }
      ctx.fillStyle = cssVar("--text", "#222");
      ctx.font = "600 14px system-ui";
      ctx.fillText(source.current > 0 ? "⊙" : "⊗", source.cx, source.cy - source.radius - 12);
      ctx.fillText(source.current > 0 ? "⊗" : "⊙", source.cx, source.cy + source.radius + 12);
    }
    ctx.fillStyle = cssVar("--muted", "#667085");
    ctx.font = "600 12px system-ui";
    ctx.fillText("Spule · 10 Windungen", source.cx, source.cy + source.radius + 32);
    ctx.restore();
  }

  function drawMagnets() {
    for (const magnet of magnets()) {
      if (magnet.type === "coil") {
        drawCoil(magnet);
      } else if (magnet.type === "bar") {
        drawBarMagnet(magnet);
      } else {
        drawRectMagnet(magnet);
      }
    }
  }

  function drawConductors() {
    for (const conductor of conductors()) {
      const r = 29;
      ctx.save();
      ctx.fillStyle = cssVar("--panel", "#fff");
      ctx.strokeStyle = cssVar("--text", "#222");
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(conductor.cx, conductor.cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = cssVar("--text", "#222");
      if (conductor.current > 0.01) {
        ctx.beginPath();
        ctx.arc(conductor.cx, conductor.cy, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (conductor.current < -0.01) {
        const d = 9;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(conductor.cx - d, conductor.cy - d);
        ctx.lineTo(conductor.cx + d, conductor.cy + d);
        ctx.moveTo(conductor.cx + d, conductor.cy - d);
        ctx.lineTo(conductor.cx - d, conductor.cy + d);
        ctx.stroke();
      } else {
        ctx.font = "700 16px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("0", conductor.cx, conductor.cy);
      }

      ctx.fillStyle = cssVar("--muted", "#667085");
      ctx.font = "700 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`Leiter ${conductor.id}`, conductor.cx, conductor.cy + r + 7);
      ctx.restore();
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
    if (filingsActive) {
      refreshFilings();
      drawFilings(ctx);
    }
    drawMagnets();
    drawConductors();
    drawCompass();
  }

  function updateModeButtons() {
    [
      [el.coilMode, "coil"],
      [el.lineMode, "line"],
      [el.magnet1Mode, "magnet1"],
      [el.magnet2Mode, "magnet2"],
      [el.magnetsMode, "magnets"],
      [el.conductorMode, "conductor"],
      [el.conductor2Mode, "conductor2"],
      [el.conductorsMode, "conductors"],
      [el.allMode, "all"],
      [el.offMode, "off"],
    ].forEach(([button, name]) => {
      button.classList.toggle("active", state.mode === name);
      button.setAttribute("aria-pressed", String(state.mode === name));
    });
  }

  function setMode(mode) {
    const availableWithoutMagneticEffect = ["line", "magnets", "all", "off"];
    if (!state.magneticOn && !availableWithoutMagneticEffect.includes(mode)) {
      return;
    }

    if (
      mode === "magnet2" && el.m2type.value === "off"
    ) {
      return;
    }
    if (mode === "coil" && !state.coilOn) return;
    if (mode === "magnet1" && el.m1type.value === "off") return;
    if (
      mode === "magnets" &&
      (el.m1type.value === "off" || el.m2type.value === "off")
    ) return;
    if (mode === "conductor" && !state.conductorOn) return;
    if (mode === "conductor2" && !state.conductor2On) return;
    if (mode === "conductors" && (!state.conductorOn || !state.conductor2On)) return;
    if (mode === "all" && magnets().length === 0 && conductors().length === 0) return;

    state.mode = mode;

    updateUI();

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

      if (
        state.mode !== "line" &&
        state.mode !== "magnets" &&
        state.mode !== "all"
      ) {
        state.mode = "off";
      }

      updateModeButtons();
    }

    updateUI();
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
    if (activePointerId !== null) return;

    const rect = canvas.getBoundingClientRect();
    const px =
      ((event.clientX - rect.left) / rect.width) * W;
    const py =
      ((event.clientY - rect.top) / rect.height) * H;
    const cx = state.compass.x * W;
    const cy = state.compass.y * H;

    const conductor2 = conductors().find((item) => item.id === 2);
    if (conductor2 && Math.hypot(px - conductor2.cx, py - conductor2.cy) <= 42) {
      dragTarget = "conductor2";
      dragOffsetX = px - conductor2.cx;
      dragOffsetY = py - conductor2.cy;
    } else if (Math.hypot(px - cx, py - cy) <= 40) {
      dragTarget = "compass";
      dragOffsetX = px - cx;
      dragOffsetY = py - cy;
    } else {
      return;
    }

    activePointerId = event.pointerId;

    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;

    const rect = canvas.getBoundingClientRect();
    const px =
      ((event.clientX - rect.left) / rect.width) * W;
    const py =
      ((event.clientY - rect.top) / rect.height) * H;

    const target = dragTarget === "conductor2" ? state.conductor2 : state.compass;
    target.x = Math.max(0.045, Math.min(0.955, (px - dragOffsetX) / W));
    target.y = Math.max(0.065, Math.min(0.935, (py - dragOffsetY) / H));

    draw();
  });

  function endDrag(event) {
    if (event.pointerId !== activePointerId) return;

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    activePointerId = null;
    dragTarget = null;
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("lostpointercapture", () => {
    activePointerId = null;
    dragTarget = null;
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

  [el.m1type, el.m2type, el.s1, el.s2, el.current, el.current2, el.coilCurrent].forEach(
    (control) => {
      control.addEventListener("input", () => {
        updateUI();
        draw();
      });
    },
  );

  el.filingsToggle.addEventListener("click", () => {
    filingsActive = !filingsActive;
    el.filingsToggle.classList.toggle("active", filingsActive);
    el.filingsToggle.setAttribute("aria-pressed", String(filingsActive));
    filingsSignature = "";
    if (filingsFrame !== null) cancelAnimationFrame(filingsFrame);
    filingsFrame = null;
    if (!filingsActive) filings = [];
    draw();
  });

  el.coilToggle.addEventListener("click", () => {
    state.coilOn = !state.coilOn;
    if (state.coilOn && state.magneticOn) state.mode = "coil";
    updateUI();
    draw();
  });
  el.coilMode.addEventListener("click", () => setMode("coil"));

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

  [el.reverseCurrent, el.reverseCurrent2].forEach((button, index) => {
    button.addEventListener("click", () => {
      const key = index === 0 ? "currentDirection" : "current2Direction";
      state[key] *= -1;
      updateUI();
      draw();
    });
  });

  el.conductorToggle.addEventListener("click", () => {
    state.conductorOn = !state.conductorOn;
    updateUI();
    draw();
  });

  el.conductor2Toggle.addEventListener("click", () => {
    state.conductor2On = !state.conductor2On;
    updateUI();
    draw();
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

  el.magnet1Mode.addEventListener("click", () => {
    setMode("magnet1");
  });

  el.magnet2Mode.addEventListener("click", () => {
    setMode("magnet2");
  });

  el.magnetsMode.addEventListener("click", () => setMode("magnets"));

  el.conductorMode.addEventListener("click", () => {
    setMode("conductor");
  });

  el.conductor2Mode.addEventListener("click", () => {
    setMode("conductor2");
  });

  el.conductorsMode.addEventListener("click", () => setMode("conductors"));

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
