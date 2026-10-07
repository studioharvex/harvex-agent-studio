/* Harvex — procedural motion library + layered animator (blending, idle life, expressions). */
(function (G) {
'use strict';
const T = G.THREE, R = G.HARVEX;
const { TAU, clamp, lerp, sstep, ease, nz, env, angNorm } = R.util;
const PI = Math.PI;

// open: how far each hand is opened out of its resting curl ([left, right], 0..1): a hand that waves is flat
function P0() { return { r: {}, p: [0, 0, 0], ry: 0, sc: [1, 1, 1], expr: { mouth: 'soft', eyes: 'open', brow: 0, raise: 0 }, look: 1, fx: null, open: [0, 0] }; }
function get(P, j) { return P.r[j] || (P.r[j] = [0, 0, 0]); }
function mix(P, j, v, w = 1) { const a = get(P, j); a[0] = lerp(a[0], v[0], w); a[1] = lerp(a[1], v[1], w); a[2] = lerp(a[2], v[2], w); }
function addR(P, j, v, w = 1) { const a = get(P, j); a[0] += v[0] * w; a[1] += v[1] * w; a[2] += v[2] * w; }
// mirrored arm/leg helper: values given for the LEFT side (outward = +z, outward yaw = +y)
const SIDES = [['L', 1], ['R', -1]];
function mx(v, s) { return [v[0], v[1] * s, v[2] * s]; }
function arm(P, sd, w, ua, fa, ha, cl) {
  const s = sd === 'L' ? 1 : -1;
  if (ua) mix(P, 'ua' + sd, mx(ua, s), w);
  if (fa) mix(P, 'fa' + sd, mx(fa, s), w);
  if (ha) mix(P, 'ha' + sd, mx(ha, s), w);
  if (cl) mix(P, 'cl' + sd, mx(cl, s), w);
}
function leg(P, sd, w, th, sh, ft) {
  const s = sd === 'L' ? 1 : -1;
  if (th) mix(P, 'th' + sd, mx(th, s), w);
  if (sh) mix(P, 'shin' + sd, mx(sh, s), w);
  if (ft) mix(P, 'ft' + sd, mx(ft, s), w);
}
// keyframe track: [[t, v], ...] with smooth interpolation
function kf(t, keys, fn = ease.inOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; const u = fn((t - t0) / (t1 - t0)); return lerp(v0, v1, u); }
  }
  return keys[keys.length - 1][1];
}
function bend(P, dip) { // knee bend keeping feet planted
  for (const [sd] of SIDES) { addR(P, 'th' + sd, [-0.45 * dip, 0, 0]); addR(P, 'shin' + sd, [0.9 * dip, 0, 0]); addR(P, 'ft' + sd, [-0.45 * dip, 0, 0]); }
  P.p[1] -= dip * 0.085;
}

/* ---------- IDLE: always-on life layer ---------- */
function IDLE(t, P, seed = 0) {
  const br = Math.sin(t * TAU / 3.9);
  const sw = nz(t * 0.42, 1.3 + seed);
  P.p[0] = sw * 0.013; P.p[1] = br * 0.0025;
  mix(P, 'hips', [0, nz(t * 0.23, 4 + seed) * 0.06, sw * 0.03]);
  mix(P, 'spine', [0.025 + br * 0.012, nz(t * 0.21, 9) * 0.03, -sw * 0.02]);
  mix(P, 'chest', [-br * 0.02, nz(t * 0.3, 7 + seed) * 0.035, -sw * 0.012]);
  mix(P, 'neck', [0.02, 0, 0]);
  mix(P, 'head', [nz(t * 0.37, 2 + seed) * 0.04, nz(t * 0.31, 5 + seed) * 0.08, nz(t * 0.27, 8) * 0.04 - sw * 0.02]);
  for (const [sd, s] of SIDES) {
    const n = nz(t * 0.5, s * 3 + seed);
    arm(P, sd, 1, [0.04 + n * 0.03, -0.18, 0.12 + br * 0.014], [-0.3 - n * 0.05, 0.1, 0], [0.05, 0, 0.04 + n * 0.02], [0, 0, br * 0.012]);
    const load = s > 0 ? Math.max(0, sw) : Math.max(0, -sw);
    leg(P, sd, 1, [-0.02 - load * 0.02, 0, -sw * 0.03 * s * s - sw * 0.016 * s], [0.04 + (1 - load) * 0.02 + (s > 0 ? Math.max(0, -sw) : Math.max(0, sw)) * 0.07, 0, 0], [-0.02, 0, 0]);
    // keep z of thigh countering hip roll
    const th = get(P, 'th' + sd); th[2] = -sw * 0.03 - sw * 0.017;
  }
}

/* ---------- MOTIONS ---------- */
const M = {};
const def = (name, o) => { M[name] = Object.assign({ name, loop: false, dur: 2, blend: 0.35 }, o); };

// Idle on a parametric human (the stage sets anim.relaxed) is a relaxed stance, not a body standing to attention:
// weight on one leg, the other knee soft, hips and shoulders tilted against each other, arms close with soft elbows.
// Which leg follows from the animator's seed, so a character keeps its side.
// It is not held still either (user, 6 Oct 2026: "fix the idle in the Studio so it is not stiff"): about every seven
// seconds the weight goes over to the other leg (through standing even, in about a second), the arms swing a
// little from the shoulder, out of step with each other, and the chest and the head turn slowly with it.
def('Idle', { loop: true, fn(t, P, g, A) { if (!A || !A.relaxed) return;
  const w = clamp(Math.sin(g * TAU / 15 + A.seed * 2.1) * 3.2, -1, 1);
  stance(P, w < 0 ? -1 : 1, 0.85 * ease.inOut(Math.abs(w)));
  EASE(P, 'L'); EASE(P, 'R');
  const a = Math.sin(g * 0.71), b = Math.sin(g * 0.53 + 1.3);
  addR(P, 'uaL', [0.04 * a, 0, 0.012 * b]); addR(P, 'uaR', [0.04 * b, 0, -0.012 * a]); addR(P, 'faL', [-0.05 * (0.5 + 0.5 * b), 0, 0]); addR(P, 'faR', [-0.05 * (0.5 + 0.5 * a), 0, 0]);
  addR(P, 'chest', [0, 0.035 * Math.sin(g * 0.31), 0]); addR(P, 'head', [0.015 * Math.sin(g * 0.43), 0.06 * Math.sin(g * 0.23 + 0.6), 0]);
} });

def('Wave', { dur: 2.8, fn(t, P) {
  const w = env(t, 2.8, 0.42, 0.5), wv = Math.sin((t - 0.3) * TAU * 1.9) * sstep(0.25, 0.6, t);
  arm(P, 'R', w, [-0.2, 0.15, 2.3], [-0.2, 0, 0.55 + 0.38 * wv], [0, 0, -0.25 * wv], [0, 0, 0.12]); P.open[1] = w;
  addR(P, 'chest', [0, -0.08, 0.07], w); addR(P, 'head', [-0.04, -0.12, 0.1], w); addR(P, 'hips', [0, 0, -0.03], w);
  P.expr = { mouth: t < 0.3 ? 'soft' : 'grin', eyes: 'open', brow: 0.2, raise: 0.8 };
} });

def('Nod', { dur: 1.7, fn(t, P) {
  const w = env(t, 1.7, 0.2, 0.3), n = Math.max(0, Math.sin((t - 0.15) * TAU * 1.35)) * sstep(0.1, 0.3, t);
  addR(P, 'head', [0.26 * n, 0, 0], w); addR(P, 'neck', [0.1 * n, 0, 0], w); addR(P, 'chest', [0.04 * n, 0, 0], w);
  P.expr = { mouth: 'smile', eyes: n > 0.6 ? 'squint' : 'open', brow: 0, raise: 0.3 };
} });

def('Shrug', { dur: 2.1, fn(t, P) {
  const w = env(t, 2.1, 0.35, 0.5);
  for (const [sd] of SIDES) arm(P, sd, w, [-0.15, 0.1, 0.34], [-1.3, 0.75, 0], [0.4, 0, 0.3], [0, 0, 0.26]);
  addR(P, 'head', [0.04, 0, 0.16], w); addR(P, 'chest', [-0.05, 0, 0], w);
  P.expr = { mouth: 'flat', eyes: 'open', brow: 0.6, raise: 1 };
} });

def('Think', { loop: true, fn(t, P) {
  const w = sstep(0, 0.5, t), r = Math.sin(t * 0.9);
  arm(P, 'R', w, [-0.62, 0.35, 0.22], [-2.35, -0.35, 0], [0.35, 0, 0.1 + 0.08 * Math.max(0, Math.sin(t * 7))]);
  arm(P, 'L', w, [-0.3, -0.3, 0.1], [-1.45, -1.0, 0], [0.1, 0, 0.1]);
  addR(P, 'head', [0.08, -0.18 + 0.12 * r, 0.14], w); addR(P, 'spine', [0.04, 0.05, 0.02], w);
  P.expr = { mouth: 'flat', eyes: 'open', brow: -0.25, raise: 0.4, eyesUp: true }; P.look = 0.3;
} });

def('Point', { dur: 2.3, fn(t, P) {
  const w = env(t, 2.3, 0.3, 0.45), b = Math.sin(clamp((t - 0.3) / 0.25, 0, 1) * PI) * 0.12;
  arm(P, 'R', w, [-1.45 - b, 0.25, 0.14], [-0.12, 0, 0], [0, 0, 0]);
  addR(P, 'chest', [0, -0.18, 0], w); addR(P, 'head', [0.05, -0.12, 0], w); addR(P, 'spine', [0.05, 0, 0], w);
  P.expr = { mouth: 'grin', eyes: 'open', brow: 0, raise: 1 };
} });

def('Clap', { dur: 2.6, fn(t, P) {
  const w = env(t, 2.6, 0.3, 0.4), c = 0.5 + 0.5 * Math.cos(Math.max(0, t - 0.3) * TAU * 2.4);
  for (const [sd] of SIDES) arm(P, sd, w, [-0.72, -0.25, 0.28 + 0.12 * c], [-1.05, -0.95 + 0.38 * c, 0], [0, -0.2, 0]);
  bend(P, 0.06 * (1 - c) * w);
  addR(P, 'head', [0.04, 0, 0], w);
  P.expr = { mouth: 'grin', eyes: 'happy', brow: 0.2, raise: 0.7 };
} });

def('Cheer', { dur: 2.5, fn(t, P) {
  const w = env(t, 2.5, 0.28, 0.45), pump = Math.sin(t * TAU * 2), hop = Math.max(0, Math.sin(Math.max(0, t - 0.25) * TAU * 1.6));
  for (const [sd, s] of SIDES) arm(P, sd, w, [-0.25, 0, 2.55 + 0.12 * pump * s], [0, 0, 0.35], [0, 0, 0.2]);
  P.p[1] += hop * 0.07 * w; bend(P, (1 - hop) * 0.05 * w);
  addR(P, 'head', [-0.15, 0, 0], w); addR(P, 'chest', [-0.08, 0, 0], w);
  P.expr = { mouth: 'open', eyes: 'happy', brow: 0.3, raise: 1 };
} });

def('Laugh', { dur: 2.6, fn(t, P) {
  const w = env(t, 2.6, 0.3, 0.5), q = Math.sin(t * TAU * 6.5) * sstep(0.2, 0.5, t);
  addR(P, 'chest', [-0.2 + 0.05 * q, 0, 0], w); addR(P, 'head', [-0.22 + 0.04 * q, 0, 0.08], w); addR(P, 'spine', [-0.05, 0, 0], w);
  arm(P, 'L', w, [-0.35, -0.2, 0.12], [-1.55, -0.85, 0], [0.2, 0, 0]);
  arm(P, 'R', w, [-0.2, 0, 0.3 + 0.05 * q], [-0.6, 0, 0], null, [0, 0, 0.05 * q]);
  P.p[1] += 0.008 * q * w;
  P.expr = { mouth: 'grin', eyes: 'happy', brow: 0.4, raise: 0.8 };
} });

def('Bow', { dur: 2.7, fn(t, P) {
  const w = env(t, 2.7, 0.55, 0.65);
  addR(P, 'hips', [0.22, 0, 0], w); addR(P, 'spine', [0.28, 0, 0], w); addR(P, 'chest', [0.22, 0, 0], w); addR(P, 'head', [0.12, 0, 0], w);
  for (const [sd] of SIDES) leg(P, sd, w, [-0.22, 0, 0], null, null);
  arm(P, 'R', w, [-0.55, -0.2, 0.08], [-1.95, -0.9, 0], [0.1, 0, 0]);
  arm(P, 'L', w, [0.4, 0.3, 0.12], [-1.25, -1.1, 0], null);
  P.expr = { mouth: 'smile', eyes: t > 0.4 && t < 2.2 ? 'closed' : 'open', brow: 0.1 };
} });

def('Salute', { dur: 2.4, fn(t, P) {
  const w = env(t, 2.4, 0.35, 0.45);
  arm(P, 'R', w, [-0.55, 0.55, 1.2], [-0.05, 0, 2.15], [0, 0.3, 0.3]);
  addR(P, 'spine', [-0.04, 0, 0], w); addR(P, 'head', [-0.05, 0, 0], w);
  P.expr = { mouth: 'smile', eyes: 'open', brow: -0.15, raise: 0 };
} });

def('Stretch', { dur: 3.4, fn(t, P) {
  const w = env(t, 3.4, 0.6, 0.6), side = Math.sin(clamp((t - 0.8) / 2, 0, 1) * TAU) * 0.18;
  for (const [sd] of SIDES) arm(P, sd, w, [-0.1, 0, 2.9], [0, 0, 0.5], [0, 0, 0.2], [0, 0, 0.1]);
  addR(P, 'spine', [-0.1, 0, side], w); addR(P, 'chest', [-0.08, 0, side * 0.6], w); addR(P, 'head', [-0.2, 0, side * 0.5], w);
  P.p[1] += 0.02 * w; for (const [sd] of SIDES) leg(P, sd, w * 0.6, null, null, [0.3, 0, 0]);
  P.expr = { mouth: t > 0.5 && t < 2.6 ? 'o' : 'soft', eyes: t > 0.5 && t < 2.8 ? 'closed' : 'open', brow: 0.3 };
} });

def('Typing', { loop: true, fn(t, P) {
  const w = sstep(0, 0.45, t), glance = sstep(0.8, 1, Math.sin(t * 0.7)) * 0.35;
  for (const [sd, s] of SIDES) arm(P, sd, w, [-0.45, -0.1, 0.16], [-1.25, -0.4, 0], [0.25 + 0.14 * Math.max(0, Math.sin(t * TAU * 5.5 + s * 1.9)), 0, 0]);
  addR(P, 'head', [0.24 - glance * 0.5, glance * 0.8, 0], w); addR(P, 'spine', [0.07, 0, 0], w); addR(P, 'chest', [0.05, 0, 0], w);
  P.expr = { mouth: glance > 0.2 ? 'smile' : 'flat', eyes: 'open', brow: -0.3, raise: 0.2 }; P.look = 0.25 + glance; P.fx = 'holo';
} });

function locomote(t, P, o) {
  const w = sstep(0, 0.4, t), c = t * TAU / o.cycle, sn = Math.sin(c), cs = Math.cos(c);
  for (const [sd, s] of SIDES) {
    const ph = s > 0 ? 0 : PI, a = Math.sin(c + ph), ca = Math.cos(c + ph);
    leg(P, sd, w, [-o.th * a, 0, 0], [o.kneeBase + o.knee * Math.pow(Math.max(0, ca), 1.4), 0, 0], [-0.1 * a + 0.15 * Math.max(0, -ca) * o.th, 0, 0]);
    arm(P, sd, w, [o.arm * a, -0.1, 0.12], [o.elbow - 0.2 * Math.max(0, -a), 0, 0], [0.1, 0, 0]);
  }
  P.p[1] += (-o.bob * Math.cos(2 * c) - o.bob * 0.4) * w;
  addR(P, 'hips', [0, 0.1 * sn, 0.04 * cs], w); addR(P, 'chest', [0, -0.14 * sn, 0], w); addR(P, 'head', [0, 0.05 * sn, 0], w);
  addR(P, 'spine', [o.lean, 0, 0], w);
  // path: circle through origin
  const Rr = o.radius, sp = o.speed;
  const d = sp * Math.max(0, t - 0.2) + sp * 0.2 * sstep(0, 0.2, t) * 0.5;
  const th = d / Rr;
  P.p[0] += Rr * Math.sin(th); P.p[2] += -Rr + Rr * Math.cos(th);
  P.ry = Math.atan2(Math.cos(th), -Math.sin(th)) * sstep(0, 0.35, t) + 0;
  P.look = 0.5;
}
def('Walk', { loop: true, blend: 0.45, fn(t, P) {
  locomote(t, P, { cycle: 1.05, th: 0.42, knee: 0.8, kneeBase: 0.06, arm: 0.36, elbow: -0.35, bob: 0.014, lean: 0.04, radius: 0.55, speed: 0.62 });
  P.expr = { mouth: 'smile', eyes: 'open', brow: 0, raise: 0.2 };
} });
def('Run', { loop: true, blend: 0.4, fn(t, P) {
  locomote(t, P, { cycle: 0.64, th: 0.78, knee: 1.5, kneeBase: 0.2, arm: 0.75, elbow: -1.45, bob: 0.03, lean: 0.2, radius: 0.62, speed: 1.55 });
  P.p[1] += 0.03;
  P.expr = { mouth: 'open', eyes: 'open', brow: -0.1, raise: 0.3 };
} });

def('Jump', { dur: 1.7, blend: 0.25, fn(t, P) {
  const crouch = kf(t, [[0, 0], [0.36, 1], [0.46, 0], [0.62, 0.35], [0.98, 0.25], [1.04, 0.1], [1.12, 0.95], [1.45, 0.05], [1.7, 0]]);
  const u = clamp((t - 0.44) / 0.58, 0, 1), air = 4 * 0.42 * u * (1 - u);
  P.p[1] += air;
  bend(P, crouch * 0.95); P.p[1] += crouch * 0.03;
  const armsUp = kf(t, [[0, 0], [0.36, -0.6], [0.5, 1], [0.95, 0.8], [1.12, -0.2], [1.5, 0], [1.7, 0]]);
  for (const [sd] of SIDES) arm(P, sd, 1, [-0.35 * Math.max(0, armsUp) + 0.7 * Math.max(0, -armsUp), 0, 0.15 + 2.25 * Math.max(0, armsUp)], [-0.3, 0, 0.3 * Math.max(0, armsUp)], null);
  addR(P, 'spine', [0.25 * crouch, 0, 0]); addR(P, 'head', [-0.1 * Math.max(0, armsUp), 0, 0]);
  const st = kf(t, [[0.38, 0], [0.48, 1], [0.7, 0], [1.02, 0], [1.1, -1], [1.3, 0]]);
  P.sc = [1 - st * 0.04, 1 + st * 0.07, 1 - st * 0.04];
  P.expr = t < 0.4 ? { mouth: 'flat', eyes: 'squint', brow: -0.3 } : t < 1.05 ? { mouth: 'open', eyes: 'wide', brow: 0.4, raise: 1 } : { mouth: 'grin', eyes: 'happy', brow: 0.3, raise: 0.6 };
  P.look = 0.4;
} });

def('Spin', { dur: 1.9, blend: 0.3, fn(t, P) {
  P.ry = kf(t, [[0, 0], [0.35, -0.5], [1.3, TAU], [1.9, TAU]], ease.inOut);
  const w = env(t, 1.9, 0.3, 0.45), o = sstep(0.35, 0.6, t) * (1 - sstep(1.2, 1.5, t));
  for (const [sd] of SIDES) arm(P, sd, w, [-0.2, 0, 0.35 + 0.95 * o], [-0.3 * (1 - o), 0, 0.2 * o], null);
  leg(P, 'L', o, [-0.55, 0, 0.1], [1.15, 0, 0], [0.4, 0, 0]);
  P.p[1] += 0.03 * o; addR(P, 'head', [-0.08 * o, 0, 0], 1);
  P.expr = { mouth: o > 0.3 ? 'grin' : 'smile', eyes: o > 0.4 ? 'happy' : 'open', brow: 0.3 }; P.look = 1 - o;
} });

function beat(t, bpm) { return t * bpm / 60; }
def('Dance', { loop: true, blend: 0.4, fn(t, P) {
  const w = sstep(0, 0.5, t), b = beat(t, 112), dip = (1 - Math.cos(b * TAU)) / 2, side = Math.sin(b * PI / 2);
  bend(P, dip * 0.28 * w);
  P.p[0] += side * 0.07 * w; addR(P, 'hips', [0, side * 0.18, -side * 0.08], w);
  for (const [sd, s] of SIDES) {
    const pump = Math.sin(b * PI + (s > 0 ? 0 : PI));
    arm(P, sd, w, [-0.55 + 0.45 * pump, -0.2, 0.3 + 0.1 * dip], [-1.45 + 0.25 * pump, -0.2, 0], [0.2, 0, 0]);
    addR(P, 'th' + sd, [0, 0, side * 0.08 * -1 * s * s], w);
  }
  addR(P, 'chest', [0.05 * dip, -side * 0.24, Math.sin(b * PI) * 0.06], w); addR(P, 'head', [0.1 * dip, side * 0.15, -Math.sin(b * PI) * 0.1], w);
  const bar = Math.floor(b / 4) % 2;
  P.expr = { mouth: bar ? 'grin' : 'smile', eyes: bar ? 'happy' : 'open', brow: 0.3, raise: 0.5 }; P.look = 0.35;
} });

def('Disco', { loop: true, blend: 0.4, fn(t, P) {
  const w = sstep(0, 0.5, t), b = beat(t, 104), ph = Math.floor(b) % 2, fr = b - Math.floor(b), k = ease.out(clamp(fr / 0.35, 0, 1)), up = ph === 0 ? k : 1 - k;
  arm(P, 'R', w, [lerp(-0.75, -0.55, up), lerp(-0.6, 0.25, up), lerp(-0.25, 2.6, up)], [lerp(-0.3, 0, up), 0, 0], [0, 0, 0]);
  arm(P, 'L', w, [0.2, 0.25, 0.62], [-1.5, -1.05, 0], [0.3, 0, 0]);
  const sway = Math.sin(b * PI);
  P.p[0] += sway * 0.05 * w; addR(P, 'hips', [0, 0, -sway * 0.1], w); addR(P, 'chest', [0, 0, sway * 0.07], w);
  addR(P, 'head', [lerp(0.15, -0.2, up), lerp(-0.15, -0.3, up), 0.05], w);
  bend(P, (1 - Math.cos(b * TAU)) * 0.05 * w);
  leg(P, 'R', w, [-0.1 * up, 0, -0.08], [0.15 * up, 0, 0], null);
  P.expr = { mouth: 'grin', eyes: 'open', brow: 0.2, raise: 0.8 }; P.look = 0.3;
} });

def('Victory', { dur: 2.3, fn(t, P) {
  const w = env(t, 2.3, 0.3, 0.45), pump = Math.max(0, Math.sin(Math.max(0, t - 0.3) * TAU * 2.1));
  arm(P, 'R', w, [-2.75 + 0.3 * pump, 0, 0.25], [-0.2 - 1.0 * pump, 0, 0], [0.2, 0, 0]);
  arm(P, 'L', w, [0.1, 0, 0.3], [-1.9, -0.3, 0], null);
  bend(P, 0.08 * pump * w); addR(P, 'chest', [-0.05, 0.1, 0], w); addR(P, 'head', [-0.12, 0, 0], w);
  P.expr = { mouth: 'open', eyes: 'happy', brow: 0.3, raise: 1 };
} });

/* emotes: short one-shot poses for a reaction (client, 4 Oct 2026) */
def('Flex', { dur: 2.8, fn(t, P) {
  const w = env(t, 2.8, 0.35, 0.5), pump = Math.max(0, Math.sin(Math.max(0, t - 0.4) * TAU * 1.3));
  for (const [sd] of SIDES) arm(P, sd, w, [0, 0.1, 1.5 + 0.06 * pump], [-0.15, 0, 1.75 + 0.3 * pump], [0, 0, 0.5]);
  bend(P, 0.1 * w); addR(P, 'chest', [-0.1 - 0.04 * pump, 0, 0], w); addR(P, 'head', [0.05, 0.25 * Math.sin(t * 2.2), 0], w);
  P.expr = { mouth: 'grin', eyes: 'squint', brow: -0.4, raise: 0.3 };
} });

def('Heart', { dur: 3.0, fn(t, P) {
  const w = env(t, 3.0, 0.45, 0.55), sway = Math.sin((t - 0.4) * TAU * 0.7) * sstep(0.4, 0.8, t);
  for (const [sd] of SIDES) arm(P, sd, w, [-0.15, 0, 2.35], [-0.2, 0, 1.55], [0, 0, 0.9]);
  addR(P, 'spine', [0, 0, 0.1 * sway], w); addR(P, 'chest', [-0.06, 0, 0.08 * sway], w); addR(P, 'head', [-0.1, 0, 0.14 * sway], w);
  P.p[0] += 0.03 * sway * w;
  P.expr = { mouth: 'grin', eyes: 'happy', brow: 0.3, raise: 0.8 };
} });

def('Dab', { dur: 2.2, blend: 0.2, fn(t, P) {
  const w = env(t, 2.2, 0.18, 0.4);
  arm(P, 'L', w, [-0.2, 0, 2.05], [0, 0, 0.1], [0, 0, 0]);
  arm(P, 'R', w, [-1.2, -0.9, 1.3], [-2.2, 0, 0.4], [0, 0, 0]);
  addR(P, 'head', [0.35, 0.5, 0.2], w); addR(P, 'chest', [0.1, 0.25, -0.12], w); addR(P, 'spine', [0.05, 0.1, -0.1], w);
  bend(P, 0.1 * w);
  P.expr = { mouth: 'smile', eyes: 'closed', brow: 0 }; P.look = 0;
} });

def('Facepalm', { dur: 3.0, fn(t, P) {
  const w = env(t, 3.0, 0.45, 0.6), shake = Math.sin((t - 0.9) * TAU * 1.1) * sstep(0.8, 1.1, t) * (1 - sstep(2.1, 2.4, t));
  arm(P, 'R', w, [-0.95, 0.5, 0.3], [-2.45, -0.45, 0], [0.5, 0, 0.2]);
  addR(P, 'head', [0.32, 0.14 * shake, 0], w); addR(P, 'neck', [0.12, 0, 0], w); addR(P, 'chest', [0.1, 0, 0], w); addR(P, 'spine', [0.06, 0, 0], w);
  P.expr = { mouth: 'flat', eyes: 'closed', brow: 0.5 }; P.look = 0;
} });

def('Kick', { dur: 1.8, blend: 0.2, fn(t, P) {
  const k = kf(t, [[0, 0], [0.3, -0.25], [0.55, 1], [0.8, 1], [1.2, 0], [1.8, 0]]), w = env(t, 1.8, 0.2, 0.4), up = Math.max(0, k), back = Math.max(0, -k);
  leg(P, 'R', 1, [-1.4 * up + 0.4 * back, 0, 0], [1.6 * back + 0.1 * up, 0, 0], [-0.4 * up, 0, 0]);
  leg(P, 'L', w, [0.15 * up, 0, 0], [0.2, 0, 0], null);
  addR(P, 'hips', [-0.22 * up, 0, 0]); addR(P, 'spine', [-0.1 * up, 0, 0]);
  for (const [sd] of SIDES) arm(P, sd, w, [-0.6, -0.2, 0.5], [-1.6, -0.4, 0], [0, 0, 0]);
  P.expr = { mouth: k > 0.5 ? 'open' : 'flat', eyes: 'open', brow: -0.5 }; P.look = 0.4;
} });

def('Backflip', { dur: 2.0, blend: 0.2, fn(t, P) {
  const crouch = kf(t, [[0, 0], [0.35, 1], [0.48, 0], [1.25, 0], [1.38, 0.9], [1.75, 0.1], [2.0, 0]]);
  const u = clamp((t - 0.45) / 0.8, 0, 1), air = 4 * 0.62 * u * (1 - u), tuck = Math.sin(u * PI);
  P.p[1] += air; bend(P, crouch * 0.9);
  addR(P, 'hips', [-TAU * ease.inOut(u), 0, 0]);                       // the whole body turns over backwards around the hips
  for (const [sd] of SIDES) { leg(P, sd, tuck, [-1.5, 0, 0.1], [1.9, 0, 0], null); arm(P, sd, 1, [lerp(0.5 * crouch, -1.1, tuck), 0, 0.2], [-0.4 - 0.9 * tuck, 0, 0], null); }
  addR(P, 'spine', [0.2 * crouch - 0.2 * tuck, 0, 0]);
  P.expr = t < 0.45 ? { mouth: 'flat', eyes: 'squint', brow: -0.3 } : t < 1.3 ? { mouth: 'open', eyes: 'wide', brow: 0.4, raise: 1 } : { mouth: 'grin', eyes: 'happy', brow: 0.3, raise: 0.6 };
  P.look = 0.1;
} });

/* skill motions (triggered by powers) */
def('Cast', { dur: 1.9, blend: 0.25, hidden: true, fn(t, P) {
  const w = env(t, 1.9, 0.25, 0.4), push = sstep(0.9, 1.05, t) * (1 - sstep(1.4, 1.7, t));
  for (const [sd] of SIDES) arm(P, sd, w, [lerp(-0.85, -1.45, push), lerp(-0.35, 0.1, push), lerp(0.2, 0.1, push)], [lerp(-1.25, -0.1, push), lerp(-0.7, 0, push), 0], [lerp(0.2, -0.6, push), 0, 0]);
  bend(P, 0.12 * w); addR(P, 'spine', [0.08 + push * 0.12, 0, 0], w); addR(P, 'head', [0.08 - push * 0.08, 0, 0], w);
  P.expr = push > 0.3 ? { mouth: 'open', eyes: 'wide', brow: -0.5 } : { mouth: 'flat', eyes: 'squint', brow: -0.6 }; P.look = 0.2;
} });
def('Guard', { dur: 1.8, blend: 0.2, hidden: true, fn(t, P) {
  const w = env(t, 1.8, 0.2, 0.45), open = sstep(0.45, 0.7, t);
  for (const [sd] of SIDES) arm(P, sd, w, [lerp(-1.2, -0.35, open), lerp(-0.6, 0.2, open), lerp(-0.1, 1.25, open)], [lerp(-1.4, -0.1, open), lerp(-0.5, 0, open), lerp(0, 0.2, open)], [0, 0, lerp(0, -0.5, open)]);
  bend(P, 0.15 * w); for (const [sd] of SIDES) addR(P, 'th' + sd, [0, 0, 0.1 * open * (sd === 'L' ? 1 : -1)], w);
  P.expr = { mouth: open > 0.5 ? 'grin' : 'flat', eyes: 'open', brow: -0.5 }; P.look = 0.5;
} });
def('Blink', { dur: 1.2, blend: 0.15, hidden: true, fn(t, P) {
  const w = env(t, 1.2, 0.15, 0.35);
  bend(P, 0.35 * w); for (const [sd] of SIDES) arm(P, sd, w, [0.3, 0, 0.25], [-0.6, 0, 0], null);
  addR(P, 'spine', [0.25, 0, 0], w); P.expr = { mouth: 'flat', eyes: 'squint', brow: -0.4 };
} });
def('Float', { loop: true, blend: 0.5, hidden: true, fn(t, P) {
  const w = sstep(0, 0.6, t), s1 = Math.sin(t * 1.3);
  leg(P, 'L', w, [-0.25 + 0.05 * s1, 0, 0.05], [0.55, 0, 0], [0.5, 0, 0]);
  leg(P, 'R', w, [-0.08 - 0.05 * s1, 0, -0.03], [0.35, 0, 0], [0.45, 0, 0]);
  for (const [sd, s] of SIDES) arm(P, sd, w, [-0.1, 0, 0.55 + 0.06 * Math.sin(t * 1.6 + s)], [-0.2, 0, 0.25], [0, 0, -0.2]);
  addR(P, 'head', [-0.06, 0, 0.05 * s1], w);
  P.expr = { mouth: 'soft', eyes: 'closed', brow: 0.2 }; P.look = 0.2;
} });
def('Scan', { dur: 2.6, blend: 0.25, hidden: true, fn(t, P) {
  const w = env(t, 2.6, 0.3, 0.45), sweep = Math.sin((t - 0.3) * 2.4) * sstep(0.3, 0.6, t);
  arm(P, 'R', w, [-0.7, 0.5, 1.0], [-0.1, 0, 2.2], [0, 0.4, 0.2]);
  arm(P, 'L', w, [-1.35, 0.25 * sweep, 0.25], [-0.15, 0, 0], [-0.8, 0, 0]);
  addR(P, 'head', [0, 0.4 * sweep, 0], w); addR(P, 'chest', [0, 0.25 * sweep, 0], w);
  P.expr = { mouth: 'flat', eyes: 'wide', brow: -0.3, raise: 0.3 }; P.look = 0;
} });

/* everyday life (user, 6 Oct 2026: "animations like in The Sims"). On the parametric bodies these play recorded clips
   (CLIP in e2c-sim.js; so do Idle, Walk, Run, Dance and Jump). What is written here is the face that goes with them
   and, for a body without clips, a quiet stand-in pose. A one-shot's length is its clip's length. */
def('Chat', { loop: true, fn(t, P) {
  const beat = Math.sin(t * 5.2);
  addR(P, 'head', [0.04 * Math.sin(t * 2.1), 0.1 * Math.sin(t * 1.3), 0], 1); arm(P, 'R', 0.5 + 0.2 * beat, [-0.5, 0.1, 0.3], [-0.2, 0, 1.2], [0, 0, 0.2]);
  P.expr = { mouth: Math.sin(t * 9.5) > 0.15 ? 'open' : 'soft', eyes: 'open', brow: 0.15 + 0.15 * beat, raise: 0.3 };
} });
def('Sit', { loop: true, blend: 0.45, fn(t, P) { bend(P, 0.25); P.expr = { mouth: 'soft', eyes: 'open', brow: 0.1, raise: 0.1 }; } });
def('Crouch', { loop: true, blend: 0.45, fn(t, P) { bend(P, 0.45); P.expr = { mouth: 'flat', eyes: 'squint', brow: -0.2, raise: 0 }; } });
def('Pickup', { dur: 1.1, blend: 0.25, fn(t, P) { bend(P, 0.3 * env(t, 1.1, 0.3, 0.3)); P.expr = { mouth: 'soft', eyes: 'open', brow: 0, raise: 0.2 }; P.look = 0; } });
def('Use', { dur: 2.0, fn(t, P) { arm(P, 'R', env(t, 2.0, 0.4, 0.4), [-0.9, 0.1, 0.2], [-0.2, 0, 0.6], [0, 0, 0]); P.expr = { mouth: 'flat', eyes: 'open', brow: -0.1, raise: 0 }; P.look = 0.3; } });
def('Tinker', { dur: 5.2, blend: 0.45, fn(t, P) { bend(P, 0.4 * env(t, 5.2, 0.6, 0.6)); P.expr = { mouth: 'flat', eyes: 'squint', brow: -0.3, raise: 0 }; P.look = 0; } });
def('Cast', { dur: 3.7, fn(t, P) {
  const w = env(t, 3.7, 0.5, 0.4); for (const [sd] of SIDES) arm(P, sd, w, [-1.1, 0.1, 0.4], [-0.2, 0, 0.7], [0, 0, 0]);
  P.expr = { mouth: t > 2.6 && t < 3.2 ? 'open' : 'flat', eyes: t > 2.6 ? 'wide' : 'squint', brow: -0.2, raise: 0.2 }; P.look = 0.4;
} });

/* A still pose for pictures (user, 6 Oct 2026: "the character looks stiff"). Standing straight with the arms hanging
   reads as a mannequin, so a picture is taken in a relaxed stance: weight on one leg, hips and shoulders tilted
   against each other, the head a little turned, and something to do with the hands. R.portrait picks one of the
   PORTRAITS; odd numbers lean the other way. Not in the motion lists: only R.renderThumb plays it. */
// weight on one leg (s = which way the hips go), by the amount k
function stance(P, s, k) {
  addR(P, 'hips', [0, 0.05 * s * k, 0.065 * s * k]); addR(P, 'spine', [0, -0.02 * s * k, -0.04 * s * k]); addR(P, 'chest', [0, -0.05 * s * k, -0.035 * s * k]);
  addR(P, 'neck', [0, 0.03 * s * k, 0.015 * s * k]); addR(P, 'head', [0.02 * k, 0.06 * s * k, 0.045 * s * k]);
  // the free leg: knee soft, heel a little off the line
  const free = s > 0 ? 'R' : 'L';
  addR(P, 'th' + free, [-0.13 * k, 0.1 * s * k, 0]); addR(P, 'shin' + free, [0.27 * k, 0, 0]); addR(P, 'ft' + free, [-0.12 * k, 0, 0]);
}
const EASE = (P, sd) => arm(P, sd, 1, [0.07, -0.14, 0.05], [-0.5, 0.2, 0], [0.1, 0, 0.08]);
const HIP = (P, sd) => arm(P, sd, 1, [0.55, -0.3, 0.5], [-0.9, 0, -1.15], [0.1, 0, -0.2]);
// (tried on these bodies and dropped: folded arms (elbows fly out), a hand at the pocket (lands on the stomach), a
// forearm held out (reads as pointing), a hand raised overhead)
// Two things only, each with either hand and leaning either way: at ease, or a small hello.
// Taken out on 6 Oct 2026 (user, about the pictures on the X banner: "do not use the ones with a hand behind them, it
// looks like a sore back"): a hand on the hip (right, left, both), where the hand lands behind the waist on these
// bodies, and "thinking" (a hand at the chin, the other arm across), where the forearm goes into the body and the
// arm looks cut off. Do not bring them back without looking at all 25 pictures.
const HELLO = (P, sd) => { arm(P, sd, 1, [0.3, -0.55, 0.6], [-1.7, 1.15, 0], [0.25, 0, 0.35]); EASE(P, sd === 'R' ? 'L' : 'R'); P.open[sd === 'R' ? 1 : 0] = 0.9; };
const PORTRAITS = [
  // at ease: arms close to the body, elbows soft
  P => { EASE(P, 'L'); EASE(P, 'R'); },
  // a small hello: the right hand up beside the shoulder
  P => HELLO(P, 'R'),
  // at ease again, so that half the cast stands quietly
  P => { EASE(P, 'L'); EASE(P, 'R'); },
  // the hello with the left hand
  P => HELLO(P, 'L'),
];
R.portrait = 0; R.PORTRAITS = PORTRAITS.length;
// Also the stance of the live character on the home page: there the stage's animator carries the number
// (`anim.portrait`), so a picture rendered meanwhile cannot change the pose of a character that is standing.
def('Portrait', { loop: true, blend: 0.01, fn(t, P, g, A) {
  const v = Math.abs((A && A.portrait != null ? A.portrait : R.portrait) | 0), s = (v / PORTRAITS.length | 0) % 2 ? -1 : 1;
  stance(P, s, 1);
  PORTRAITS[v % PORTRAITS.length](P);
  P.expr = { mouth: 'smile', eyes: 'open', brow: 0.1, raise: 0.3 }; P.look = 1;
} });
// The greeting of the home page's live character: it keeps the picture's stance and lifts the right hand beside the
// shoulder for a small wave. (The big Wave reaches above the head and out of that stage's frame.) Not in the lists.
def('Hello', { dur: 2.6, blend: 0.3, fn(t, P, g, A) {
  M.Portrait.fn(t, P, g, A);
  const w = env(t, 2.6, 0.4, 0.5), wv = Math.sin((t - 0.3) * TAU * 1.8) * sstep(0.3, 0.6, t);
  arm(P, 'R', w, [0.3, -0.55, 0.6], [-1.7, 1.15 + 0.25 * wv, 0], [0.25, 0, 0.35 + 0.2 * wv]); P.open[1] = Math.max(P.open[1], 0.9 * w);
  P.expr = { mouth: 'grin', eyes: 'open', brow: 0.2, raise: 0.6 };
} });
R.MOTIONS = M;
R.MOTION_LIST = Object.values(M).filter(m => !m.hidden).map(m => m.name);

/* ---------- Animator ---------- */
const _e = new T.Euler(0, 0, 0, 'YXZ');
function toQ(v, q = new T.Quaternion()) { _e.set(v[0], v[1], v[2], 'YXZ'); return q.setFromEuler(_e); }
class Animator {
  constructor(seed = 0) { this.stance = 'Idle'; this.cur = 'Idle'; this.t = 0; this.g = Math.random() * 10; this.blend = 1; this.bd = 0.35; this.prev = null; this.out = null; this.speed = 1; this.paused = false; this.tempDur = 0; this.seed = seed; this.listeners = []; }
  play(name, o = {}) {
    const d = M[name]; if (!d) return;
    if (d.loop && !o.temp) this.stance = name;
    this.prev = this.out ? this.clone(this.out) : null;
    this.cur = name; this.t = 0; this.blend = this.prev ? 0 : 1; this.bd = o.blend ?? d.blend ?? 0.35; this.tempDur = o.temp ? (o.dur || 2) : 0;
    this.listeners.forEach(f => f(name));
  }
  clone(o) { const Q = {}; for (const k in o.Q) Q[k] = o.Q[k].clone(); return { Q, p: o.p.clone(), ry: o.ry, sc: o.sc.clone(), expr: o.expr, look: o.look }; }
  update(dt) {
    if (this.paused) dt = 0; dt *= this.speed;
    this.g += dt; this.t += dt; this.blend = Math.min(1, this.blend + dt / this.bd);
    const d = M[this.cur];
    if ((!d.loop && this.t >= d.dur) || (this.tempDur && this.t >= this.tempDur)) { this.tempDur = 0; this.play(this.stance, { blend: 0.45 }); return this.update(0); }
    const P = P0(); IDLE(this.g, P, this.seed); d.fn(this.t, P, this.g, this);
    const Q = {}; for (const j in P.r) Q[j] = toQ(P.r[j]);
    let out = { Q, p: new T.Vector3(P.p[0], P.p[1], P.p[2]), ry: P.ry, sc: new T.Vector3(P.sc[0], P.sc[1], P.sc[2]), expr: P.expr, look: P.look, fx: P.fx, open: P.open, name: this.cur, t: this.t };
    if (this.prev && this.blend < 1) {
      const w = ease.inOut(this.blend), pv = this.prev;
      for (const j in pv.Q) { if (!Q[j]) Q[j] = new T.Quaternion(); }
      for (const j in Q) { const a = pv.Q[j] || new T.Quaternion(); Q[j] = a.clone().slerp(Q[j], w); }
      out.p = pv.p.clone().lerp(out.p, w);
      out.ry = pv.ry + angNorm(out.ry - pv.ry) * w;
      out.sc = pv.sc.clone().lerp(out.sc, w);
      out.look = lerp(pv.look, out.look, w);
      if (w < 0.5) out.expr = pv.expr;
    }
    out.ry = angNorm(out.ry);
    this.out = out; return out;
  }
}
R.Animator = Animator;
R.poseTools = { P0, IDLE, toQ };
})(window);
