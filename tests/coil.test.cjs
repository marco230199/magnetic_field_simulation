// Run with: node --test magnetfeld-simulation/tests/coil.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function simulation(turns = 10) {
  let source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  source = source.slice(0, source.indexOf('  canvas.addEventListener("pointerdown"')) +
    'globalThis.api = { coil, field, traceConductorLine, state };})();';
  const context = { document: { querySelector: (id) => ({
    value: id.includes('type') ? 'off' : id === '#coilTurns' ? String(turns) : '1',
    getContext: () => ({}),
  }) } };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.api.state.conductorOn = false;
  return context.api;
}

test('more turns strengthen the central field at constant current and length', () => {
  let previousStrength = 0;
  for (const turns of [2, 5, 10, 20]) {
    const api = simulation(turns);
    const coil = api.coil();
    assert.equal(coil.turns, turns);
    const b = api.field(coil.cx, coil.cy, [coil], []);
    assert.ok(Number.isFinite(b.m) && b.m > previousStrength);
    assert.ok(b.x > 0);
    previousStrength = b.m;
  }
});

test('coil interior is approximately uniform and reverses with current', () => {
  const api = simulation();
  const coil = api.coil();
  const strengths = [];
  for (const x of [-0.5, 0, 0.5]) for (const y of [-0.5, 0, 0.5]) {
    const px = coil.cx + x * coil.half, py = coil.cy + y * coil.radius;
    const b = api.field(px, py, [coil], []);
    strengths.push(b.m);
    assert.ok(Math.abs(Math.atan2(b.y, b.x)) < Math.PI / 18);
    const reversed = api.field(px, py, [{ ...coil, current: -1 }], []);
    assert.ok(Math.hypot(b.x + reversed.x, b.y + reversed.y) < 1e-15);
    assert.equal(api.field(px, py, [{ ...coil, current: 0 }], []).m, 0);
  }
  assert.ok(Math.max(...strengths) / Math.min(...strengths) < 1.3);
  const inside = api.field(coil.cx, coil.cy, [coil], []);
  const outside = api.field(coil.cx, coil.cy + 2 * coil.radius, [coil], []);
  assert.ok(outside.x < 0 && outside.m < inside.m);
});

test('representative coil lines return in closed loops above and below', () => {
  const api = simulation();
  const coil = api.coil();
  for (const offset of [0.23, 0.42, 0.61, 0.8]) for (const side of [-1, 1]) {
    const seed = [coil.cx, coil.cy + side * offset * coil.radius];
    const points = api.traceConductorLine(seed, [coil], []);
    assert.ok(points.flat().every(Number.isFinite));
    assert.deepEqual(points[0], points.at(-1));
    assert.ok(points.some(p => Math.abs(p[1] - coil.cy) > coil.radius));
  }
});
