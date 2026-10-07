/* Harvex — humanoid rig builder: soft stylized body, expressive face, outfits. */
(function (G) {
'use strict';
const T = G.THREE, R = G.HARVEX;
const { TAU, clamp, lerp } = R.util;
const { lathe, taper, shell, sphere, capsule, torus, cyl, cone, rbox, circle, cached, loft, loftZ } = R.geo;
const add = R.add, joint = R.joint;
const PI = Math.PI;

// Body measurements per build: half-widths and half-depths in metres for a figure about 1.65 tall, following adult
// proportions (close to 7 heads tall, shoulders about two heads wide, waist narrower than chest and hips).
// sh shoulder joint · cw/cd chest · ww/wd waist · hw/hd hips · arm thickness · leg length · thigh thickness · h height
const BUILDS = {
  slim:    { sh: 0.170, cw: 0.146, cd: 0.100, ww: 0.116, wd: 0.088, hw: 0.142, hd: 0.098, arm: 0.92, leg: 0.96, thigh: 0.95, h: 0.97, bust: 0 },
  regular: { sh: 0.186, cw: 0.160, cd: 0.110, ww: 0.130, wd: 0.098, hw: 0.152, hd: 0.104, arm: 1.00, leg: 1.00, thigh: 1.00, h: 1.00, bust: 0 },
  curvy:   { sh: 0.166, cw: 0.144, cd: 0.104, ww: 0.110, wd: 0.088, hw: 0.166, hd: 0.112, arm: 0.90, leg: 1.02, thigh: 1.06, h: 0.98, bust: 1 },
  broad:   { sh: 0.200, cw: 0.180, cd: 0.124, ww: 0.150, wd: 0.112, hw: 0.164, hd: 0.112, arm: 1.16, leg: 1.06, thigh: 1.10, h: 1.04, bust: 0 },
};
R.BUILDS = BUILDS;
// The head (face, hair, hats, glasses: everything on the head joint) is scaled as one piece, so every style keeps its
// shape while the figure stands close to seven heads tall.
const HEAD_SCALE = 0.74;

/* ---------------- HEAD SURFACE ---------------- */
/* A skull, not a ball: an ellipsoid (radii H.r around H.c) with a face in its lower half. At height t (-1 under the
   chin, 0 the eye line, 1 the crown) a row gives multipliers of that ellipsoid: width, depth in front, depth behind,
   a forward shift (the chin sits in front of the neck and the base of the skull runs in to it) and how flat the front
   is (2 = round, more = a flatter face that turns at the cheekbones). Everything on the head is placed on this
   surface with headPt, and hair and beards are cut out of it with headShell, so they follow the same shape.
   H.jaw widens (above 0) or narrows the lower face. */
const FACE = [
  //  t    width  front  back  shift  flat
  [-1.00, 0.80, 1.20, 0.90, 0.42, 2.0],
  [-0.90, 0.80, 1.20, 0.90, 0.38, 2.1],
  [-0.75, 0.83, 1.05, 0.90, 0.26, 2.2],
  [-0.55, 0.89, 1.00, 0.92, 0.13, 2.35],
  [-0.35, 0.95, 1.00, 0.96, 0.05, 2.4],
  [-0.15, 0.985, 1.00, 0.99, 0.01, 2.4],
  [0.10, 1.00, 1.00, 1.02, 0.00, 2.3],
  [0.40, 1.00, 1.00, 1.02, 0.00, 2.15],
  [0.70, 1.00, 1.00, 1.00, 0.00, 2.0],
  [1.00, 1.00, 1.00, 1.00, 0.00, 2.0],
];
function faceRow(t) {
  let i = 0; while (i < FACE.length - 2 && FACE[i + 1][0] < t) i++;
  const a = FACE[Math.max(0, i - 1)], b = FACE[i], c = FACE[i + 1], d = FACE[Math.min(FACE.length - 1, i + 2)];
  const h = c[0] - b[0], u = clamp((t - b[0]) / h, 0, 1), u2 = u * u, u3 = u2 * u, out = [];
  for (let k = 1; k < 6; k++) {
    const m0 = (c[k] - a[k]) / (c[0] - a[0]) * h, m1 = (d[k] - b[k]) / (d[0] - b[0]) * h;
    out.push((2 * u3 - 3 * u2 + 1) * b[k] + (u3 - 2 * u2 + u) * m0 + (3 * u2 - 2 * u3) * c[k] + (u3 - u2) * m1);
  }
  return out;
}
// point of the head on the unit ellipsoid's scale: lon 0 = straight ahead, lat 0 = the eye line
function headUnit(lon, lat, jaw = 0) {
  const t = Math.sin(lat), c = Math.cos(lat), [w, f, b, sh, flat] = faceRow(t), s = Math.sin(lon), k = Math.cos(lon), e = k >= 0 ? 2 / flat : 1;
  return [Math.sign(s) * Math.pow(Math.abs(s), e) * c * (w + jaw * (1 - w)), t, Math.sign(k) * Math.pow(Math.abs(k), e) * c * (k >= 0 ? f : b) + sh];
}
function meshOf(pos, idx) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
function headGeo(jaw = 0) {
  return cached('headGeo' + jaw, () => {
    const W = 56, N = 44, pos = [], idx = [];
    for (let i = 1; i < N; i++) { const lat = -PI / 2 + (i / N) * PI; for (let j = 0; j < W; j++) pos.push(...headUnit((j / W) * TAU - PI, lat, jaw)); }
    const under = pos.length / 3; pos.push(...headUnit(0, -PI / 2, jaw)); const crown = under + 1; pos.push(...headUnit(0, PI / 2, jaw));
    for (let i = 0; i < N - 2; i++) for (let j = 0; j < W; j++) { const a = i * W + j, b = i * W + (j + 1) % W, c = (i + 1) * W + j, d = (i + 1) * W + (j + 1) % W; idx.push(a, b, c, b, d, c); }
    for (let j = 0; j < W; j++) { idx.push(under, (j + 1) % W, j); idx.push(crown, (N - 2) * W + j, (N - 2) * W + (j + 1) % W); }
    return meshOf(pos, idx);
  });
}
/* A piece of the head's surface around a pole that is tilted back by `tilt`: the hair line of a cap of hair, a beard.
   th0..th1 are measured down from that pole, ph0 + phl go around it as in a sphere geometry (PI / 2 = the front). */
function headShell(jaw, tilt, th0, th1, ph0 = 0, phl = TAU) {
  return cached(`hsh${jaw}|${tilt}|${th0}|${th1}|${ph0}|${phl}`, () => {
    const W = 44, N = 24, closed = Math.abs(phl - TAU) < 1e-6, cols = closed ? W : W + 1, pos = [], idx = [], ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let i = 0; i <= N; i++) {
      const th = th0 + (i / N) * (th1 - th0);
      for (let j = 0; j < cols; j++) {
        const ph = ph0 + (j / W) * phl, x = -Math.cos(ph) * Math.sin(th), y0 = Math.cos(th), z0 = Math.sin(ph) * Math.sin(th);
        const y = y0 * ct - z0 * st, z = y0 * st + z0 * ct;
        pos.push(...headUnit(Math.atan2(x, z), Math.asin(clamp(y, -1, 1)), jaw));
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < W; j++) { const a = i * cols + j, b = i * cols + (j + 1) % cols, c = (i + 1) * cols + j, d = (i + 1) * cols + (j + 1) % cols; idx.push(a, c, b, b, c, d); }
    return meshOf(pos, idx);
  });
}
/* Hair lying on the skull: the head's own surface above a hair line. line = [forehead, sideburn, ear, nape]: how far
   down (t, as in FACE) the hair reaches on the forehead, in front of the ear, over the ear and at the nape. */
function hairCap(jaw, line) {
  const [f, b, e, n] = line;
  const pts = [[0, f], [0.6, f - 0.02], [0.98, f - 0.14], [1.14, b], [1.3, b], [1.52, e], [1.95, e - 0.04], [2.45, n + 0.1], [PI, n]];
  const edge = lon => { const a = Math.abs(lon); let i = 0; while (i < pts.length - 2 && pts[i + 1][0] < a) i++; const u = clamp((a - pts[i][0]) / (pts[i + 1][0] - pts[i][0]), 0, 1); return lerp(pts[i][1], pts[i + 1][1], u * u * (3 - 2 * u)); };
  return cached(`hcap${jaw}|${line}`, () => {
    const W = 96, N = 18, pos = [], idx = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j < W; j++) { const lon = (j / W) * TAU - PI; pos.push(...headUnit(lon, Math.asin(Math.min(1, lerp(edge(lon), 1, Math.sin((i / N) * PI / 2)))), jaw)); }
    for (let i = 0; i < N; i++) for (let j = 0; j < W; j++) { const a = i * W + j, b2 = i * W + (j + 1) % W, c = (i + 1) * W + j, d = (i + 1) * W + (j + 1) % W; idx.push(a, b2, c, b2, d, c); }
    return meshOf(pos, idx);
  });
}
// a point on the head and the direction it faces; `out` lifts it off the surface
function headPt(H, lon, lat, out = 0) {
  const at = (lo, la) => { const u = headUnit(lo, clamp(la, -PI / 2, PI / 2), H.jaw || 0); return new T.Vector3(u[0] * H.r.x, u[1] * H.r.y, u[2] * H.r.z); };
  const e = 0.012, p = at(lon, lat), n = at(lon + e, lat).sub(at(lon - e, lat)).cross(at(lon, lat + e).sub(at(lon, lat - e)));
  if (n.lengthSq() < 1e-14) n.set(0, lat < 0 ? -1 : 1, 0);
  n.normalize();
  return { p: p.add(H.c).addScaledVector(n, out), n };
}
function orient(o, n) { o.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n); }
function placeOn(parent, H, lon, lat, out) { const { p, n } = headPt(H, lon, lat, out); const g = new T.Group(); g.position.copy(p); orient(g, n); parent.add(g); return g; }

/* ---------------- FACE ---------------- */
function buildFace(head, H, M, look) {
  const F = { eyes: [], irises: [], happy: [], closed: [], brows: [], mouths: {}, mouthS: {}, cur: {}, blinkT: 2 + Math.random() * 2, blink: 0, sacc: new T.Vector2(), saccT: 1, look: new T.Vector2(), screen: false, irisY: 0.0035 };
  // eyes: set a little into the face, about one eye apart
  for (const s of [1, -1]) {
    const g = placeOn(head, H, 0.34 * s, -0.02, -0.006);
    const eye = new T.Group(); g.add(eye);
    add(eye, sphere(0.03), M.get('eyeW'), [0, 0, 0], null, [1, 0.78, 0.3], { noShadow: true });
    // the iris hangs from the upper lid, as in a relaxed eye: no white above it
    const ir = new T.Group(); ir.position.set(0, F.irisY, 0.0062); eye.add(ir);
    add(ir, sphere(0.0185), M.get('iris'), [0, 0, 0], null, [1, 1, 0.3], { noShadow: true });
    add(ir, sphere(0.0095), M.get('black'), [0, 0, 0.0042], null, [1, 1, 0.3], { noShadow: true });
    add(ir, sphere(0.0046), M.get('shine'), [0.006 * s, 0.0074, 0.0068], null, null, { noShadow: true });
    add(ir, sphere(0.0024), M.get('shine'), [-0.0048 * s, -0.0062, 0.0068], null, null, { noShadow: true });
    // upper lash line
    add(eye, torus(0.03, 0.0046, 6, 18, PI), M.get('dark'), [0, 0.001, 0.0045], [0, 0, 0], [1.02, 0.8, 1], { noShadow: true });
    const hp = add(g, torus(0.021, 0.0054, 6, 16, PI), M.get('dark'), [0, -0.0035, 0.005], null, null, { noShadow: true });
    const cl = add(g, torus(0.021, 0.0048, 6, 16, PI), M.get('dark'), [0, 0.005, 0.005], [0, 0, PI], [1, 0.55, 1], { noShadow: true });
    hp.visible = cl.visible = false;
    F.eyes.push(eye); F.irises.push(ir); F.happy.push(hp); F.closed.push(cl);
    // brow
    const bg = placeOn(head, H, 0.34 * s, 0.2, 0.002);
    const bw = new T.Group(); bg.add(bw);
    add(bw, capsule(0.006, 0.034, 4, 8), M.get('brow'), [0, 0, 0], [0, 0, PI / 2 + 0.08 * s], [1, 1, 0.7], { noShadow: true });
    bw.userData.s = s; F.brows.push(bw);
    // cheek blush
    const ck = placeOn(head, H, 0.56 * s, -0.3, 0.001);
    add(ck, circle(0.026, 18), M.get('blush'), [0, 0, 0], null, [1, 0.65, 1], { noShadow: true });
    // ear: from the brow line down to the tip of the nose, turned a little outward
    const ep = headPt(H, 1.5 * s, -0.14, -0.008);
    add(head, sphere(0.036), M.get('skin'), [ep.p.x, ep.p.y, ep.p.z], [0, 0.4 * s, 0], [0.4, 1.08, 0.74]);
    add(head, sphere(0.021), M.get('skinShade'), [ep.p.x + 0.0075 * s, ep.p.y - 0.003, ep.p.z + 0.006], [0, 0.4 * s, 0], [0.3, 0.95, 0.62], { noShadow: true });
  }
  // nose: a bridge running down from between the eyes into a rounded tip
  const nr = headPt(H, 0, -0.1, -0.007), nt = headPt(H, 0, -0.37, 0.004), nd = nt.p.clone().sub(nr.p);
  const nb = add(head, sphere(1, 14, 12), M.get('skin'), [(nr.p.x + nt.p.x) / 2, (nr.p.y + nt.p.y) / 2, (nr.p.z + nt.p.z) / 2], null, [0.0078, nd.length() * 0.56, 0.0095], { noShadow: true });
  nb.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), nd.normalize());
  add(head, sphere(0.0165, 16, 12), M.get('skin'), [nt.p.x, nt.p.y, nt.p.z], null, [1.08, 0.84, 1], { noShadow: true });
  // mouth
  const mg = placeOn(head, H, 0, -0.62, look.facial === 'beard' ? 0.016 : 0.001);
  const mk = (k, build) => { const g = new T.Group(); build(g); mg.add(g); F.mouths[k] = g; F.mouthS[k] = 0; g.scale.setScalar(0.001); g.visible = false; };
  mk('smile', g => add(g, torus(0.03, 0.0056, 6, 22, PI), M.get('lip'), [0, 0.014, 0], [0, 0, PI], [1, 0.8, 1], { noShadow: true }));
  mk('soft', g => add(g, torus(0.024, 0.0052, 6, 20, PI), M.get('lip'), [0, 0.008, 0], [0, 0, PI], [1, 0.45, 1], { noShadow: true }));
  mk('flat', g => add(g, capsule(0.0052, 0.024, 4, 8), M.get('lip'), [0, 0, 0], [0, 0, PI / 2], null, { noShadow: true }));
  mk('open', g => { add(g, sphere(0.026), M.get('mouthIn'), [0, -0.004, -0.004], null, [1.15, 0.85, 0.3], { noShadow: true }); add(g, sphere(0.014), M.get('tongue'), [0, -0.014, 0.001], null, [1.2, 0.6, 0.3], { noShadow: true }); });
  mk('grin', g => { add(g, circle(0.036, 22, PI, PI), M.get('mouthIn'), [0, 0.006, 0.004], null, [1, 0.85, 1], { noShadow: true }); add(g, rbox(0.052, 0.009, 0.004, 0.0019, 2), M.get('teeth'), [0, 0.001, 0.0065], null, null, { noShadow: true }); });
  mk('o', g => add(g, sphere(0.016), M.get('mouthIn'), [0, -0.004, -0.002], null, [0.9, 1.1, 0.3], { noShadow: true }));
  F.set = function (e) { this.target = e; };
  F.target = { mouth: 'soft', eyes: 'open', brow: 0 };
  F.update = function (dt, lookX, lookY) {
    const e = this.target;
    for (const k in this.mouths) {
      const want = e.mouth === k ? 1 : 0; this.mouthS[k] = lerp(this.mouthS[k], want, 1 - Math.exp(-dt * 18));
      const g = this.mouths[k], s = this.mouthS[k]; g.visible = s > 0.02; g.scale.setScalar(Math.max(0.001, s));
    }
    // blink
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.16; this.blinkT = Math.random() < 0.18 ? 0.25 : 2.2 + Math.random() * 3.2; }
    let lid = 1;
    if (this.blink > 0) { this.blink -= dt; const p = 1 - this.blink / 0.16; lid = Math.abs(p * 2 - 1); lid = Math.max(0.06, lid); }
    const mode = e.eyes;
    this.eyes.forEach((ey, i) => {
      ey.visible = mode === 'open' || mode === 'wide' || mode === 'squint';
      const base = mode === 'wide' ? 1.12 : mode === 'squint' ? 0.55 : 1;
      ey.scale.set(1, base * lid, 1);
      this.happy[i].visible = mode === 'happy'; this.closed[i].visible = mode === 'closed';
    });
    // saccades + look
    this.saccT -= dt;
    if (this.saccT <= 0) { this.sacc.set((Math.random() - 0.5) * 0.006, (Math.random() - 0.5) * 0.004); this.saccT = 0.5 + Math.random() * 1.8; }
    this.look.x = lerp(this.look.x, clamp(lookX, -1, 1) * 0.009 + this.sacc.x, 1 - Math.exp(-dt * 20));
    this.look.y = lerp(this.look.y, clamp(lookY, -1, 1) * 0.007 + this.sacc.y + (e.eyesUp ? 0.008 : 0), 1 - Math.exp(-dt * 20));
    this.irises.forEach(ir => { ir.position.x = this.look.x; ir.position.y = this.irisY + clamp(this.look.y, -0.008, 0.002); });
    // brows
    const b = e.brow || 0, raise = (e.raise || 0);
    this.brows.forEach(bw => {
      const s = bw.userData.s;
      const tgtY = raise * 0.012 + (b < 0 ? b * 0.004 : b * 0.006);
      const tgtR = b < 0 ? s * -b * 0.35 : -s * b * 0.25; // furrow(-) inner down, sad(+) inner up
      bw.position.y = lerp(bw.position.y, tgtY + (1 - lid) * -0.004, 1 - Math.exp(-dt * 14));
      bw.rotation.z = lerp(bw.rotation.z, tgtR, 1 - Math.exp(-dt * 14));
    });
  };
  return F;
}

/* screen face used by androids & companions */
function buildScreenFace(parent, M, o) {
  const F = { eyes: [], happy: [], closed: [], mouths: {}, mouthS: {}, blinkT: 2, blink: 0, look: new T.Vector2(), screen: true, target: { mouth: 'soft', eyes: 'open', brow: 0 } };
  const glow = M.get('glow');
  const eg = new T.Group(); eg.position.set(o.x || 0, o.y || 0, o.z); parent.add(eg); F.group = eg;
  const sp = o.sp || 0.05, er = o.er || 0.017;
  for (const s of [1, -1]) {
    const e = add(eg, capsule(er, er * 1.2, 4, 10), glow, [sp * s, 0.006, 0], null, [1, 1, 0.35], { noShadow: true });
    const hp = add(eg, torus(er * 1.3, er * 0.35, 6, 14, PI), glow, [sp * s, 0, 0], null, [1, 1, 0.5], { noShadow: true });
    const cl = add(eg, torus(er * 1.3, er * 0.35, 6, 14, PI), glow, [sp * s, 0.008, 0], [0, 0, PI], [1, 0.6, 0.5], { noShadow: true });
    hp.visible = cl.visible = false; F.eyes.push(e); F.happy.push(hp); F.closed.push(cl);
  }
  const mk = (k, build) => { const g = new T.Group(); g.position.y = -(o.my || 0.045); build(g); eg.add(g); F.mouths[k] = g; F.mouthS[k] = 0; g.visible = false; };
  mk('smile', g => add(g, torus(0.022, 0.0055, 6, 16, PI), glow, [0, 0.01, 0], [0, 0, PI], [1, 0.7, 0.5], { noShadow: true }));
  mk('soft', g => add(g, torus(0.016, 0.005, 6, 16, PI), glow, [0, 0.006, 0], [0, 0, PI], [1, 0.45, 0.5], { noShadow: true }));
  mk('flat', g => add(g, capsule(0.005, 0.022, 4, 8), glow, [0, 0, 0], [0, 0, PI / 2], null, { noShadow: true }));
  mk('open', g => add(g, sphere(0.018), glow, [0, 0, 0], null, [1.2, 0.8, 0.25], { noShadow: true }));
  mk('grin', g => add(g, circle(0.024, 18, PI, PI), glow, [0, 0.006, 0], null, null, { noShadow: true }));
  mk('o', g => add(g, torus(0.011, 0.004, 6, 14), glow, [0, 0, 0], null, null, { noShadow: true }));
  F.set = function (e) { this.target = e; };
  F.update = function (dt, lx, ly) {
    const e = this.target;
    for (const k in this.mouths) { const w = e.mouth === k ? 1 : 0; this.mouthS[k] = lerp(this.mouthS[k], w, 1 - Math.exp(-dt * 18)); const g = this.mouths[k]; g.visible = this.mouthS[k] > 0.02; g.scale.setScalar(Math.max(0.001, this.mouthS[k])); }
    this.blinkT -= dt; if (this.blinkT <= 0) { this.blink = 0.14; this.blinkT = 2 + Math.random() * 3.5; }
    let lid = 1; if (this.blink > 0) { this.blink -= dt; lid = Math.max(0.1, Math.abs((1 - this.blink / 0.14) * 2 - 1)); }
    this.eyes.forEach((ey, i) => {
      const m = e.eyes; ey.visible = m !== 'happy' && m !== 'closed';
      ey.scale.set(1, (m === 'wide' ? 1.25 : m === 'squint' ? 0.5 : 1) * lid, 0.35);
      this.happy[i].visible = m === 'happy'; this.closed[i].visible = m === 'closed';
    });
    this.look.x = lerp(this.look.x, clamp(lx, -1, 1) * 0.018, 1 - Math.exp(-dt * 12));
    this.look.y = lerp(this.look.y, clamp(ly, -1, 1) * 0.012 + (e.eyesUp ? 0.01 : 0), 1 - Math.exp(-dt * 12));
    this.group.position.x = (o.x || 0) + this.look.x; this.group.position.y = (o.y || 0) + this.look.y;
  };
  return F;
}
R.buildScreenFace = buildScreenFace;

/* ---------------- HAIR ---------------- */
function buildHair(head, H, M, style, springs, look) {
  const hm = M.get('hair');
  if (style === 'none' || look.head === 'helmet' && style !== 'buzz' && false) return;
  // hair lying on the skull: the head's own surface, a little larger, down to a hair line (forehead, sideburn, ear, nape)
  const cap = (scale = 1.07, line = [0.5, -0.1, 0.08, -0.5]) => add(head, hairCap(H.jaw || 0, line), hm, [H.c.x, H.c.y + 0.004, H.c.z - 0.004], null, [H.r.x * scale, H.r.y * scale, H.r.z * scale]);
  const under = ['beanie', 'cap', 'hat'].includes(look.head) ? 0.14 : 0; // under a hat the fringe shows below its edge
  const fringe = (n, lat, spread, side = 0, r = 0.05) => {
    for (let i = 0; i < n; i++) {
      const lon = (i - (n - 1) / 2) * spread + side;
      const { p, n: nn } = headPt(H, lon, lat - under, 0.004);
      const m = add(head, sphere(r, 16, 12), hm, [p.x, p.y, p.z], null, [1.15, 0.7, 0.5]);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), nn); m.rotateZ((i - (n - 1) / 2) * -0.25 + side * 0.6);
    }
  };
  const sides = (len = 1.9, open = 1.9, sc = 1.12) => add(head, sphere(1, 36, 18, PI / 2 + open / 2, TAU - open, 0.25, len), hm, [H.c.x, H.c.y - 0.015, H.c.z - 0.006], null, [H.r.x * sc, H.r.y * sc, H.r.z * (sc - 0.01)]).material.side = T.DoubleSide;
  const chain = (parent, pos, n, r0, seg, opts = {}) => {
    let par = parent, r = r0; const out = [];
    for (let i = 0; i < n; i++) {
      const b = joint(par, 'hair' + i, i === 0 ? pos : [0, -seg, 0]);
      if (i === 0 && opts.rot) b.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
      add(b, sphere(r, 18, 14), hm, [0, -seg * 0.5, 0], null, opts.scl || [1, 1.35, 0.9]);
      springs.push(new R.Spring(b, { k: opts.k || 55 - i * 8, d: 5, g: 0.45 + i * 0.1, i: 0.016 + i * 0.006, lim: 1.2 }));
      par = b; r *= opts.taper || 0.84; out.push(b);
    }
    return out;
  };
  switch (style) {
    case 'buzz': cap(1.03, [0.52, -0.08, 0.1, -0.46]); break;
    case 'short': cap(); fringe(5, 0.5, 0.26, 0.12, 0.052); break;
    case 'swept': cap(1.08); fringe(4, 0.56, 0.24, 0.35, 0.058); break;
    case 'spiky': {
      cap(1.06);
      const spikes = [[0, 0.95], [0.5, 0.75], [-0.5, 0.75], [0.25, 0.55], [-0.25, 0.55], [1.2, 0.5], [-1.2, 0.5], [2.4, 0.6], [-2.4, 0.6], [PI, 0.7], [0, 0.45]];
      for (const [lon, lat] of spikes) { const { p, n } = headPt(H, lon, lat, -0.01); const m = add(head, cone(0.045, 0.13, 10), hm, [p.x, p.y, p.z]); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n.clone().add(new T.Vector3(0, 0.6, -0.5)).normalize()); m.translateY(0.05); }
      break;
    }
    case 'curly': case 'afro': {
      const big = style === 'afro' ? 1.35 : 1.0;
      cap(1.06 + (big - 1) * 0.2, [0.46, -0.12, 0.05, -0.5]);
      let k = 0;
      for (let lat = 0.05; lat < 1.5; lat += 0.28) {
        const ring = Math.max(1, Math.round(10 * Math.cos(lat)));
        for (let i = 0; i < ring; i++) {
          const lon = (i / ring) * TAU + lat * 1.7;
          const front = Math.cos(lon);
          if (front > 0.35 && lat < 0.5) continue;
          const { p } = headPt(H, lon, lat, 0.01 * big);
          const r = (0.052 + ((k++ * 37) % 10) * 0.0022) * big;
          add(head, sphere(r, 14, 10), hm, [p.x, p.y, p.z], null, null);
        }
      }
      break;
    }
    case 'bob': cap(1.08, [0.46, -0.2, -0.1, -0.6]); sides(1.75, 1.95); fringe(5, 0.52, 0.24, -0.05, 0.055); break;
    case 'long': {
      cap(1.08, [0.46, -0.2, -0.1, -0.6]); sides(1.9, 1.9, 1.11); fringe(4, 0.54, 0.26, 0.15, 0.056);
      const b = joint(head, 'hairBack', [H.c.x, H.c.y - 0.03, H.c.z - 0.09]);
      add(b, sphere(0.16, 22, 16), hm, [0, -0.14, -0.012], null, [1.0, 1.35, 0.42]);
      springs.push(new R.Spring(b, { k: 45, d: 6, g: 0.35, i: 0.012, lim: 0.8 }));
      const b2 = joint(b, 'hairBack2', [0, -0.26, -0.01]);
      add(b2, sphere(0.13, 20, 14), hm, [0, -0.07, 0], null, [1.02, 1.1, 0.38]);
      springs.push(new R.Spring(b2, { k: 38, d: 5, g: 0.5, i: 0.02, lim: 1 }));
      break;
    }
    case 'ponytail': {
      cap(1.07, [0.52, -0.08, 0.1, -0.5]); fringe(3, 0.56, 0.3, 0.2, 0.05);
      const { p } = headPt(H, PI, 0.42, 0.01);
      add(head, torus(0.03, 0.012, 6, 14), M.get('topAcc'), [p.x, p.y, p.z - 0.01], [0.9, 0, 0]);
      chain(head, [p.x, p.y, p.z - 0.02], 4, 0.056, 0.09, { rot: [-0.8, 0, 0], taper: 0.86 });
      break;
    }
    case 'twintails': {
      cap(1.07, [0.48, -0.1, 0.08, -0.5]); fringe(5, 0.52, 0.24, 0, 0.052);
      for (const s of [1, -1]) {
        const { p } = headPt(H, 1.75 * s, 0.4, 0.01);
        add(head, sphere(0.03, 12, 10), M.get('topAcc'), [p.x, p.y, p.z]);
        chain(head, [p.x + 0.015 * s, p.y, p.z], 4, 0.05, 0.095, { rot: [0.1, 0, 0.3 * s], taper: 0.88 });
      }
      break;
    }
    case 'bun': {
      cap(1.07, [0.52, -0.08, 0.1, -0.5]); fringe(4, 0.54, 0.26, -0.1, 0.05);
      const { p } = headPt(H, PI * 0.95, 0.75, 0.03);
      const b = joint(head, 'bun', [p.x, p.y, p.z]);
      add(b, sphere(0.072, 20, 14), hm, [0, 0.02, -0.01]);
      add(b, torus(0.052, 0.011, 6, 16), M.get('topAcc'), [0, -0.018, 0.0], [PI / 2 - 0.5, 0, 0]);
      springs.push(new R.Spring(b, { k: 120, d: 9, g: 0.05, i: 0.004, lim: 0.25 }));
      break;
    }
    case 'mohawk': {
      cap(1.03, [0.52, -0.08, 0.1, -0.46]);
      // a crest from the hair line over the crown to the back of the head
      for (const [lon, la] of [[0, 0.62], [0, 0.88], [0, 1.14], [0, 1.4], [PI, 1.3], [PI, 1.02], [PI, 0.74], [PI, 0.46]]) { const { p, n } = headPt(H, lon, la, -0.01); const m = add(head, cone(0.04, 0.12, 8), hm, [p.x, p.y, p.z], null, [0.6, 1, 1]); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n); m.translateY(0.045); }
      break;
    }
  }
}

/* ---------------- HEAD ACCESSORIES ---------------- */
function buildHeadAcc(head, H, M, kind, springs) {
  const acc = M.get('acc'), topAcc = M.get('topAcc'), glow = M.get('glow');
  switch (kind) {
    case 'cap': {
      add(head, sphere(1, 32, 14, 0, TAU, 0, PI / 2), acc, [H.c.x, H.c.y + 0.04, H.c.z - 0.005], [-0.2, 0, 0], [H.r.x * 1.13, H.r.y * 1.0, H.r.z * 1.13]);
      add(head, cyl(0.2, 0.2, 0.012, 28, false, -PI / 2, PI), acc, [H.c.x, H.c.y + 0.092, H.c.z + 0.07], [0.22, 0, 0], [0.8, 1, 1.02]);
      add(head, sphere(0.018, 10, 8), topAcc, [H.c.x, H.c.y + 0.04 + H.r.y * 0.98, H.c.z - 0.038]);
      break;
    }
    case 'beanie': {
      add(head, sphere(1, 32, 16, 0, TAU, 0, 1.45), acc, [H.c.x, H.c.y + 0.02, H.c.z], [-0.2, 0, 0], [H.r.x * 1.14, H.r.y * 1.2, H.r.z * 1.14]);
      add(head, torus(H.r.x * 1.13, 0.028, 10, 30), acc, [H.c.x, H.c.y + 0.044, H.c.z - 0.005], [PI / 2 - 0.2, 0, 0], [1, H.r.z / H.r.x, 1]);
      const b = joint(head, 'pom', [H.c.x, H.c.y + H.r.y * 1.2 + 0.02, H.c.z - 0.02]);
      add(b, sphere(0.04, 14, 10), topAcc, [0, 0.03, 0]);
      springs.push(new R.Spring(b, { k: 90, d: 6, g: 0.0, i: 0.012, lim: 0.6 }));
      break;
    }
    case 'hat': {
      add(head, cyl(0.135, 0.155, 0.14, 26), acc, [H.c.x, H.c.y + 0.16, H.c.z - 0.012], [-0.12, 0, 0]);
      add(head, sphere(0.136, 26, 10, 0, TAU, 0, PI / 2), acc, [H.c.x, H.c.y + 0.22, H.c.z - 0.02], [-0.12, 0, 0], [1, 0.3, 1]);
      add(head, cyl(0.29, 0.29, 0.014, 32), acc, [H.c.x, H.c.y + 0.095, H.c.z - 0.002], [-0.12, 0, 0]);
      add(head, cyl(0.157, 0.157, 0.03, 26, true), topAcc, [H.c.x, H.c.y + 0.115, H.c.z - 0.005], [-0.12, 0, 0]).material.side = T.DoubleSide;
      break;
    }
    case 'headphones': {
      add(head, torus(H.r.x * 1.18, 0.014, 8, 30, PI), acc, [H.c.x, H.c.y + 0.01, H.c.z], null, [1, 1.08, 1]);
      for (const s of [1, -1]) {
        add(head, cyl(0.055, 0.055, 0.045, 22), acc, [H.c.x + H.r.x * 1.1 * s, H.c.y - 0.01, H.c.z], [0, 0, PI / 2]);
        add(head, torus(0.04, 0.007, 6, 20), glow, [H.c.x + H.r.x * 1.1 * s + 0.024 * s, H.c.y - 0.01, H.c.z], [0, PI / 2, 0], null, { noShadow: true });
      }
      break;
    }
    case 'halo': {
      const b = joint(head, 'halo', [H.c.x, H.c.y + H.r.y + 0.12, H.c.z - 0.02]);
      add(b, torus(0.12, 0.013, 8, 36), glow, [0, 0, 0], [PI / 2 - 0.2, 0, 0], null, { noShadow: true });
      b.userData.bob = true; break;
    }
    case 'ears': {
      add(head, torus(H.r.x * 1.08, 0.009, 6, 26, PI), acc, [H.c.x, H.c.y + 0.02, H.c.z + 0.02], [0.2, 0, 0]);
      for (const s of [1, -1]) {
        const { p, n } = headPt(H, 0.62 * s, 0.9, 0.0);
        const e = add(head, cone(0.052, 0.1, 4), M.get('hair'), [p.x, p.y + 0.02, p.z], null, [1, 1, 0.45]);
        e.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n.clone().add(new T.Vector3(0.1 * s, 0.9, 0)).normalize()); e.translateY(0.035);
        const i = add(head, cone(0.03, 0.06, 4), M.get('blush'), [0, 0, 0], null, [1, 1, 0.3], { noShadow: true }); i.position.copy(e.position); i.quaternion.copy(e.quaternion); i.translateZ(0.012); i.translateY(-0.008);
      }
      break;
    }
    case 'helmet': {
      // the collar ring rests on the shoulders: the helmet sits a little low around the head
      add(head, sphere(0.265, 36, 24), M.get('glass'), [H.c.x, H.c.y - 0.045, H.c.z + 0.01], null, null, { noShadow: true });
      add(head, torus(0.2, 0.03, 10, 30), M.get('white'), [H.c.x, H.c.y - 0.255, H.c.z], [PI / 2, 0, 0]);
      add(head, torus(0.2, 0.008, 6, 30), glow, [H.c.x, H.c.y - 0.23, H.c.z], [PI / 2, 0, 0], null, { noShadow: true });
      break;
    }
  }
}
function buildFaceAcc(head, H, M, kind) {
  if (kind === 'none') return;
  const ep = s => headPt(H, 0.34 * s, -0.02, 0.022);
  if (kind === 'glasses' || kind === 'shades') {
    const frame = kind === 'glasses' ? M.get('acc') : M.get('black');
    for (const s of [1, -1]) {
      const { p, n } = ep(s); const g = new T.Group(); g.position.copy(p); orient(g, n); head.add(g);
      if (kind === 'glasses') add(g, torus(0.038, 0.005, 6, 24), frame, [0, 0, 0], null, [1, 0.9, 1], { noShadow: true });
      else add(g, rbox(0.076, 0.05, 0.01, 0.018, 3), M.get('lens'), [0, 0, 0], null, null, { noShadow: true });
      const arm = headPt(H, 1.35 * s, 0.0, 0.012);
      const a = add(head, capsule(0.0045, 0.1, 3, 6), frame, [(p.x + arm.p.x) / 2, (p.y + arm.p.y) / 2 + 0.005, (p.z + arm.p.z) / 2], null, null, { noShadow: true });
      a.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), arm.p.clone().sub(p).normalize());
    }
    const b = headPt(H, 0, 0.0, 0.03);
    add(head, capsule(0.005, 0.03, 3, 6), frame, [b.p.x, b.p.y, b.p.z], [0, 0, PI / 2], null, { noShadow: true });
  } else if (kind === 'visor') {
    add(head, sphere(1, 36, 10, PI / 2 - 1.35, 2.7, PI / 2 - 0.28, 0.46), M.get('visor'), [H.c.x, H.c.y + 0.0, H.c.z + 0.005], null, [H.r.x * 1.18, H.r.y * 1.1, H.r.z * 1.2], { noShadow: true });
    add(head, torus(H.r.x * 1.17, 0.006, 6, 30, 2.7), M.get('glow'), [H.c.x, H.c.y + 0.058, H.c.z + 0.005], [PI / 2, 0, -PI / 2 + 1.35 - 2.7 + PI], [1, H.r.z / H.r.x * 1.02, 1], { noShadow: true });
  }
}

/* ---------------- BACK ACCESSORIES ---------------- */
// an elliptical band around the body
const ring = (parent, mat, y, rx, rz, tube, opts) => add(parent, torus(rx, tube, 8, 30), mat, [0, y, 0], [PI / 2, 0, 0], [1, rz / rx, 1], opts);
const both = m => { m.material.side = T.DoubleSide; return m; };
/* Backpack, jetpack, cape or scarf on the chest joint. fz(y) / bz(y): where the front and the back of the chest lie at
   height y above that joint, so the piece sits on whatever body is under it. capeZ: where a cape hangs from. */
function buildBack(chest, look, M, J, springs, fz, bz, capeZ = -0.05) {
  if (look.back === 'backpack') {
    add(chest, rbox(0.24, 0.28, 0.12, 0.05, 3), M.get('acc'), [0, 0.06, bz(0.06) - 0.05]);
    add(chest, rbox(0.18, 0.1, 0.03, 0.02, 2), M.get('topAcc'), [0, -0.01, bz(0.0) - 0.115]);
    for (const s of [1, -1]) add(chest, torus(0.105, 0.012, 6, 16, PI), M.get('acc'), [0.085 * s, 0.1, -0.01], [0, PI / 2, PI / 2], [1.45, 1, 1]);
  } else if (look.back === 'jetpack') {
    for (const s of [1, -1]) {
      add(chest, cyl(0.055, 0.055, 0.26, 16), M.get('metal'), [0.07 * s, 0.07, bz(0.07) - 0.055]);
      add(chest, sphere(0.055, 16, 8, 0, TAU, 0, PI / 2), M.get('metal'), [0.07 * s, 0.2, bz(0.07) - 0.055]);
      add(chest, cyl(0.045, 0.03, 0.05, 14), M.get('glow'), [0.07 * s, -0.08, bz(0.07) - 0.055]);
      joint(chest, 'nozzle' + (s > 0 ? 'L' : 'R'), [0.07 * s, -0.11, bz(0.07) - 0.055], J);
    }
  } else if (look.back === 'cape') {
    const cb = joint(chest, 'cape', [0, 0.2, capeZ]);
    const g = cached('cape', () => lathe([[0.36, -0.95], [0.26, -0.5], [0.19, -0.1], [0.14, 0]], 30, PI - 1.25, 2.5, 16));
    both(add(cb, g, M.get('acc'), [0, 0, 0.04], null, [1, 1, 0.55]));
    springs.push(new R.Spring(cb, { k: 40, d: 5, g: 0.25, i: 0.02, lim: 0.9, spin: 0.08 }));
    ring(chest, M.get('topAcc'), 0.214, 0.09, 0.078, 0.015).rotation.x = PI / 2 + 0.16;
  } else if (look.back === 'scarf') {
    ring(chest, M.get('acc'), 0.226, 0.076, 0.07, 0.034).rotation.x = PI / 2 + 0.16;
    const sz = fz(0.2) + 0.03, dz = fz(0.1) + 0.016 - sz;              // the tail hangs in front of the chest, not inside it
    const t1 = joint(chest, 'scarf1', [0.05, 0.2, sz]);
    add(t1, rbox(0.06, 0.2, 0.02, 0.01, 2), M.get('acc'), [0, -0.1, dz], [-0.12, 0, 0]);
    add(t1, rbox(0.062, 0.02, 0.022, 0.006, 2), M.get('topAcc'), [0, -0.17, dz + 0.01], [-0.12, 0, 0]);
    springs.push(new R.Spring(t1, { k: 50, d: 5, g: 0.6, i: 0.02, lim: 1.0 }));
  }
}
// the parts a modelled character (e2b-model.js) wears as they are
R.human = { buildHair, buildHeadAcc, buildFaceAcc, buildBack, headPt, HEAD_SCALE };

/* ---------------- BUILD HUMAN ---------------- */
/* The body is lofted from anatomical cross-sections (R.geo.loft): chest, waist and hips with their own width and
   depth, a trapezius slope into the neck, deltoid / biceps / forearm, thigh / knee / calf / ankle, and a hand with
   fingers. Clothes are cut from the same sections pushed outward (`grow`), so a jacket or a trouser leg always
   follows the body under it. Joints and their names are unchanged: every motion still drives the same rig. */
function buildHuman(look, M) {
  const B = BUILDS[look.build] || BUILDS.regular, bk = look.build in BUILDS ? look.build : 'regular';
  const J = {}, springs = [], extras = { flare: [], float: [] };
  const root = new T.Group(); root.name = 'root'; J.root = root;
  const scaleG = new T.Group(); root.add(scaleG); J.scale = scaleG; scaleG.scale.setScalar(B.h);
  const top = look.top.type, bot = look.bottom.type;
  const isSuit = top === 'spacesuit', isAndroid = look.headStyle === 'screen';
  const mTop = M.get('top'), mBot = M.get('bottom'), mSkin = isAndroid ? M.get('body2') : M.get('skin');
  const legLen = 0.4 * B.leg, shinLen = 0.405 * B.leg;
  const hipY = 0.05 + legLen + shinLen + 0.05;
  const hips = joint(scaleG, 'hips', [0, hipY, 0], J);
  const spine = joint(hips, 'spine', [0, 0.07, 0], J);
  const chest = joint(spine, 'chest', [0, 0.17, 0], J);
  const neck = joint(chest, 'neck', [0, 0.215, -0.004], J);
  const head = joint(neck, 'head', [0, 0.094, 0.006], J);
  head.scale.setScalar(isAndroid ? 0.8 : HEAD_SCALE);
  // head: narrower than it is deep, as a skull is; the jaw follows the build. An android keeps its box.
  const H = { c: new T.Vector3(0, 0.14, 0.012), r: isAndroid ? new T.Vector3(0.158, 0.168, 0.152) : new T.Vector3(0.138, 0.168, 0.156), jaw: { slim: -0.08, curvy: -0.14, broad: 0.3 }[bk] || 0.04 };
  J.H = H;

  /* ----- torso: three overlapping pieces (they rotate against each other), one continuous silhouette ----- */
  const { sh, cw, cd, ww, wd, hw, hd } = B, bust = B.bust || 0;
  // Where two pieces overlap, the outer one stays a hair outside its neighbour and then turns in steeply, and every
  // piece of the torso has the same number of facets (TS): the line where two of them meet is thin and clean.
  const TN = 2.25, TS = 40; // cross-section a little boxier than an ellipse (rib cage, flat back) · facets around
  // one ring of a section table at height y
  const secAt = (S, y) => { let i = 0; while (i < S.length - 2 && (S[i + 1][0] - y) * (S[i + 1][0] - S[i][0]) < 0) i++; const p = S[i], q = S[i + 1], u = clamp((y - p[0]) / (q[0] - p[0] || 1), 0, 1); return [y, lerp(p[1], q[1], u), lerp(p[2], q[2], u), lerp(p[3] ?? p[2], q[3] ?? q[2], u), 0, lerp(p[5] || 0, q[5] || 0, u), lerp(p[6] || TN, q[6] || TN, u)]; };
  // pelvis (hips joint): crotch, glutes, iliac crest up into the waist
  const pelvisS = [[0.13, ww * 0.93, wd * 0.93, wd * 0.92], [0.092, lerp(hw, ww, 0.72), lerp(hd, wd, 0.7), lerp(hd, wd, 0.6)], [0.04, hw * 0.97, hd * 0.96, hd * 1.02],
    [-0.02, hw, hd * 0.94, hd * 1.1], [-0.062, hw * 0.94, hd * 0.86, hd * 1.08], [-0.1, hw * 0.6, hd * 0.6, hd * 0.8], [-0.12, 0.035, 0.03, 0.035]];
  // abdomen (spine joint): from inside the pelvis over the waist (hollow of the back) to the lower ribs
  const absS = [[0.232, cw * 0.9, cd * 0.86, cd * 0.86], [0.185, cw * 0.95, cd * 0.93, cd * 0.92], [0.115, lerp(ww, cw, 0.5), lerp(wd, cd, 0.42), lerp(wd, cd, 0.5)],
    [0.045, ww, wd * 0.97, wd * 0.9], [-0.012, lerp(ww, hw, 0.4) * 0.96, lerp(wd, hd, 0.4) * 0.92, lerp(wd, hd, 0.3) * 0.94], [-0.078, hw * 0.86, hd * 0.8, hd * 0.84]];
  // rib cage (chest joint): pectoral line, the shoulder girdle reaching out over the arms (rounder than the ribs), the
  // trapezius slope up to the neck. Its lower edge follows the abdomen under it and lies at the height of the chest
  // joint, where bending does not shift it.
  const under = (y, off) => { const r = secAt(absS, y + 0.17); return [y, r[1] + off, r[2] + off, r[3] + off]; };
  const chestS = [[0.25, 0.048, 0.048, 0.05, 0, 0, 2], [0.229, 0.064, 0.058, 0.062, 0, 0, 2], [0.218, sh * 0.48, cd * 0.5, cd * 0.66, 0, 0, 2], [0.205, sh * 0.76, cd * 0.57, cd * 0.8, 0, 0, 2],
    [0.19, sh * 0.93, cd * 0.66, cd * 0.9, 0, 0, 2], [0.158, lerp(cw, sh, 0.8), cd * 0.84, cd * 1.01, 0, 0, 2.1], [0.105, cw, cd * (1.05 + bust * 0.07), cd * 1.05], [0.05, cw * 0.99, cd * (1.03 + bust * 0.15), cd * 1.0],
    under(0.014, 0.0015), under(0, 0), under(-0.012, -0.011)];
  // half a ball over a joint, so a limb turns in its neighbour without a gap: rows between the pole and the rim
  const dome = (y0, rx, rf, rb, dir, hf = 1) => { const h = Math.max(rx, rf) * hf, rows = [[0.985, 0.174], [0.866, 0.5], [0.643, 0.766], [0.342, 0.94]].map(([sn, cs]) => [y0 + dir * sn * h, rx * cs, rf * cs, (rb ?? rf) * cs]); return dir > 0 ? rows : rows.reverse(); };
  // a stretch of cloth with open ends: a loft of its own, or a part of one (hem, waistband, ribbing)
  const strip = (parent, mat, key, rows, o) => both(add(parent, cached(`strip${bk}${key}`, () => loft(rows, Object.assign({ n: TN, seg: TS, cap: false, rings: 4 }, o))), mat));
  const pelvisMat = top === 'robe' || isSuit ? mTop : mBot;
  const pants = ['pants', 'cargo', 'joggers'].includes(bot) || isSuit;
  const legR = 0.082 * (B.thigh || 1), loose = bot === 'cargo' ? 1.1 : 1;
  // cloth over the hips: trousers and shorts run from the waist over the widest point of the thighs in one line. Lower
  // down the seat becomes two lobes around the thighs (the leg joints sit at x = ±0.088), a hair outside the trouser
  // legs; where it ends it meets them exactly (no edge at rest), turns in under them and closes as the panel between the legs.
  const cut = pants ? 1.07 * loose : bot === 'shorts' ? 1.12 : 0, tc = legR * cut, hipOut = 0.088 + tc, seat = cut ? 0.002 : 0;
  const seatB = Math.max(hd * 1.1, tc * 1.08);
  const seatS = [[0.13, ww * 0.93, wd * 0.93, wd * 0.92, 0, 0, TN], [0.092, lerp(hw, ww, 0.72), lerp(hd, wd, 0.7), lerp(hd, wd, 0.6), 0, 0, TN], [0.04, lerp(hw * 0.97, hipOut, 0.4), hd * 0.96, hd * 1.02, 0, 0.03, TN],
    [-0.02, lerp(hw, hipOut, 0.85), lerp(hd, tc, 0.55), hd * 1.1, 0, 0.066, 2.1], [-0.06, hipOut, tc, seatB, 0, 0.088, 2], [-0.097, 0.088 + tc * 1.014 - seat, tc * 1.006 - seat, tc * 1.029 - seat, 0, 0.088, 2],
    [-0.107, hipOut - 0.012, tc - 0.008, tc * 1.029 - 0.012, 0, 0.088, 2], [-0.13, 0.075, tc * 0.78, tc * 0.8, 0, 0.045, 2], [-0.15, 0.04, tc * 0.55, tc * 0.6, 0, 0.02, 2], [-0.162, 0.012, tc * 0.25, tc * 0.25, 0, 0, 2]];
  const hipS = cut ? seatS : pelvisS, hipR = (cut ? lerp(hw, hipOut, 0.85) : hw) + seat; // what the hips measure in their cloth
  // a skirt hangs from the waist and flares over the hips (heights in the space of the hips)
  const skirtS = [[0.122, ww + 0.004, wd * 0.97 + 0.004, wd * 0.9 + 0.004, 0, 0, TN], [0.1, ww + 0.006, wd * 0.97 + 0.006, wd * 0.92 + 0.006, 0, 0, TN], [0.04, hw * 1.08 + 0.012, hd * 0.98 + 0.012, hd * 1.06 + 0.012, 0, 0, 2.1],
    [-0.03, hw * 1.2, hd * 1.2, hd * 1.3, 0, 0, 2.1], [-0.13, hw * 1.34, hd * 1.46, hd * 1.54, 0, 0, 2.1], [-0.26, hw * 1.5, hd * 1.74, hd * 1.8, 0, 0, 2.1]];
  const wrapS = bot === 'skirt' ? skirtS : hipS;                      // the outermost cloth around the hips
  add(hips, cached(`pel${bk}${cut}`, () => loft(hipS, { n: TN, grow: seat, seg: TS, rings: (hipS.length - 1) * 7 })), pelvisMat);
  const torsoMat = top === 'tank' || top === 'tee' || top === 'sweater' || top === 'hoodie' || top === 'tracksuit' || isSuit || top === 'robe' ? mTop : M.get('inner');
  const knit = top === 'sweater' || top === 'hoodie' ? 0.008 : top === 'tracksuit' || isSuit ? 0.006 : 0; // thicker cloth
  // the wider of the abdomen and the cloth over the hips at one height: what a waistband, a hem or a short jacket has
  // to go around. y in the space of the hips; dy moves the row into the space of the spine (0.07 above); dk scales the
  // two lobes (an open jacket hangs straighter than the seat under it); off pushes the ring in or out.
  const girth = (y, dy = 0, dk = 1, off = 0) => { const h = secAt(wrapS, y), b = secAt(absS, y - 0.07); return [y + dy, Math.max(h[1] + seat, b[1]) + off, Math.max(h[2] + seat, b[2]) + off, Math.max(h[3] + seat, b[3]) + off, 0, h[5] * dk, h[6]]; };
  // knitwear and track jackets hang over the waistband: their body runs on over the hips and ends in an open, ribbed hem
  const overHip = top === 'sweater' || top === 'hoodie' || top === 'tracksuit';
  const bodyS = overHip ? [absS[0], absS[1], absS[2], girth(0.115, -0.07), girth(0.07, -0.07), girth(0.03, -0.07)] : absS;
  const body = add(spine, cached(`abs${bk}${knit}${overHip ? cut : ''}`, () => loft(bodyS, { n: TN, grow: knit, seg: TS, cap: overHip ? 'start' : true })), torsoMat);
  if (overHip) { both(body); strip(spine, M.get('topDark'), `hem${cut}${knit}`, bodyS, { grow: knit + 0.003, u0: 4.4, u1: 5 }); }
  add(chest, cached(`che${bk}${knit}`, () => loft(chestS, { n: TN, grow: knit, rings: 50, seg: TS })), torsoMat);
  const fz = y => loftZ(chestS, y) + knit, bz = y => loftZ(chestS, y, true) - knit;         // chest front / back surface
  const wz = y => loftZ(absS, y) + knit;                                                    // abdomen front surface
  // neck: wider at the base, running up into the skull; thicker on a heavier build
  const nk = lerp(1, B.arm, 0.6);
  add(neck, cached(`neck${nk}`, () => loft([[0.14, 0.04 * nk, 0.04 * nk, 0.042 * nk], [0.112, 0.048 * nk, 0.05 * nk, 0.052 * nk], [0.06, 0.047 * nk, 0.049 * nk, 0.052 * nk], [0.012, 0.054 * nk, 0.053 * nk, 0.057 * nk], [-0.03, 0.068 * nk, 0.06 * nk, 0.066 * nk]], { seg: TS })), mSkin);

  /* head */
  if (isAndroid) {
    add(head, rbox(0.3, 0.31, 0.29, 0.1, 5), M.get('body'), [H.c.x, H.c.y, H.c.z - 0.005]);
    add(head, rbox(0.25, 0.19, 0.03, 0.06, 4), M.get('screen'), [H.c.x, H.c.y - 0.005, H.c.z + 0.135]);
    for (const s of [1, -1]) add(head, cyl(0.035, 0.035, 0.03, 16), M.get('glow'), [H.c.x + 0.155 * s, H.c.y, H.c.z], [0, 0, PI / 2]);
    const ant = joint(head, 'ant', [H.c.x + 0.06, H.c.y + 0.15, H.c.z - 0.03]);
    add(ant, cyl(0.005, 0.005, 0.08, 6), M.get('metal'), [0, 0.04, 0]); add(ant, sphere(0.018), M.get('glow'), [0, 0.085, 0]);
    springs.push(new R.Spring(ant, { k: 70, d: 3, g: 0, i: 0.02, lim: 0.7 }));
    J.face = buildScreenFace(head, M, { z: H.c.z + 0.153, y: H.c.y + 0.0, sp: 0.058, er: 0.018, my: 0.05 });
  } else {
    add(head, headGeo(H.jaw), mSkin, [H.c.x, H.c.y, H.c.z], null, [H.r.x, H.r.y, H.r.z]);
    J.face = buildFace(head, H, M, look);
    if (look.facial === 'beard' || look.facial === 'stubble') {
      // the lower face, from under the nose round to the ears: the same surface, a little thicker for a full beard
      const full = look.facial === 'beard', bm = full ? M.get('hair') : M.get('brow');
      both(add(head, headShell(H.jaw, 0, 2.04, 2.92, PI / 2 - 1.45, 2.9), bm, [H.c.x, H.c.y - 0.004, H.c.z + 0.002], null, [H.r.x * (full ? 1.06 : 1.012), H.r.y * (full ? 1.03 : 1.008), H.r.z * (full ? 1.07 : 1.012)]));
      if (full) { const cp = headPt(H, 0, -1.12, 0.004); add(head, sphere(0.04, 16, 10), bm, [cp.p.x, cp.p.y, cp.p.z], null, [1.3, 0.85, 0.8]); }
      const mp = headPt(H, 0, -0.5, full ? 0.013 : 0.004);
      add(head, capsule(0.008, 0.036, 4, 8), bm, [mp.p.x, mp.p.y, mp.p.z], [0, 0, PI / 2], [1, 1, 0.7], { noShadow: true });
    }
    buildHair(head, H, M, look.hair.style, springs, look);
  }
  buildHeadAcc(head, H, M, look.head, springs);
  if (!isAndroid) buildFaceAcc(head, H, M, look.face);
  else if (look.face === 'visor') buildFaceAcc(head, { c: H.c, r: new T.Vector3(0.16, 0.16, 0.16) }, M, 'visor');

  /* ----- arms ----- */
  const a = 0.05 * B.arm;                                             // bare upper-arm radius
  const sleeveFull = !['tee', 'tank'].includes(top), sleeveShort = top === 'tee';
  const thick = ['suit', 'coat', 'jacket', 'bomber'].includes(top) ? 1.1 : top === 'sweater' || top === 'hoodie' || isSuit ? 1.08 : 1; // cloth weight
  // The shoulder is the upper half of an egg: its top sits just under the shoulder line, its widest point a few
  // centimetres below the joint (deltoid). cap(drop, r, top) = that half egg, r wide at `drop` below the joint.
  const cap = (drop, r, top) => dome(-drop, r, r, r, 1, (drop + top) / r);
  // skin: deltoid, biceps, elbow; forearm fullest below the elbow, flat at the wrist
  const upperS = [...cap(0.04, a * 1.1, a * 0.93), [-0.04, a * 1.1, a * 1.1], [-0.125, a * 1.0, a * 1.03], [-0.205, a * 0.87, a * 0.91],
    [-0.27, a * 0.78, a * 0.8], ...dome(-0.27, a * 0.78, a * 0.8, a * 0.8, -1)];
  const foreS = [...dome(0, a * 0.78, a * 0.8, a * 0.8, 1), [0, a * 0.78, a * 0.8], [-0.05, a * 0.86, a * 0.88], [-0.125, a * 0.72, a * 0.78], [-0.2, a * 0.44, a * 0.62],
    [-0.245, a * 0.34, a * 0.58], ...dome(-0.245, a * 0.34, a * 0.58, a * 0.58, -1, 0.3)];
  // cloth: a sleeve hangs straighter than the arm inside it
  const t = a * thick;
  const sleeveUS = [...cap(0.045, t * 1.13, t * 0.95), [-0.045, t * 1.13, t * 1.13], [-0.19, t * 1.07, t * 1.07], [-0.27, t * 1.02, t * 1.02], ...dome(-0.27, t * 1.02, t * 1.02, t * 1.02, -1)];
  const te = t * 0.96;                                                // the forearm sleeve comes out of the upper one: a clean fold at the elbow
  const sleeveFS = [...dome(0, te, te, te, 1), [0, te, te], [-0.1, t * 0.95, t * 0.95], [-0.2, t * 0.86, t * 0.88], [-0.232, t * 0.84, t * 0.86]];
  const shortS = [...cap(0.04, a * 1.18, a * 1.0), [-0.04, a * 1.18, a * 1.18], [-0.125, a * 1.13, a * 1.14]];
  for (const s of [1, -1]) {
    const sd = s > 0 ? 'L' : 'R';
    // the shoulder joint sits under the shoulder line, so the deltoid rounds off the trapezius slope instead of rising above it
    const cl = joint(chest, 'cl' + sd, [0.05 * s, 0.154, -0.012], J);
    const ua = joint(cl, 'ua' + sd, [(sh - 0.054) * s, -0.01, 0], J);
    const fa = joint(ua, 'fa' + sd, [0, -0.27, 0], J);
    const ha = joint(fa, 'ha' + sd, [0, -0.245, 0], J);
    if (sleeveFull) {
      add(ua, cached(`slU${a}|${thick}`, () => loft(sleeveUS, { seg: 40 })), mTop);
      both(add(fa, cached(`slF${a}|${thick}`, () => loft(sleeveFS, { seg: 40, cap: false })), top === 'armor-tee' ? mSkin : mTop));
      add(fa, cached(`wr${a}`, () => loft([[-0.19, a * 0.44, a * 0.62], [-0.24, a * 0.34, a * 0.58], [-0.256, a * 0.26, a * 0.4]], { seg: 18 })), isSuit ? M.get('white') : mSkin); // wrist inside the cuff
      const cuffMat = ['tracksuit', 'bomber', 'hoodie', 'sweater'].includes(top) ? M.get('topAcc') : top === 'suit' ? M.get('inner') : M.get('topDark');
      both(add(fa, cached(`cuff${a}|${thick}`, () => loft([[-0.205, t * 0.87, t * 0.89], [-0.236, t * 0.85, t * 0.87]], { seg: 40, cap: false, grow: 0.0025, rings: 2 })), cuffMat));
      if (top === 'tracksuit') add(ua, rbox(0.012, 0.23, 0.014, 0.005, 2), M.get('topAcc'), [(t * 1.1 + 0.001) * s, -0.138, 0], [0, 0, -0.025 * s]); // stripe lying on the sleeve
    } else {
      add(ua, cached(`armU${a}`, () => loft(upperS, { seg: 28 })), mSkin);
      add(fa, cached(`armF${a}`, () => loft(foreS, { seg: 28 })), mSkin);
      if (sleeveShort) both(add(ua, cached(`slS${a}`, () => loft(shortS, { seg: 28, cap: 'start' })), mTop));
    }
    // hand: palm facing the thigh, four fingers with a relaxed curl, thumb in front
    const hm = isSuit ? M.get('white') : mSkin;
    const hand = new T.Group(); ha.add(hand); J['hand' + sd] = hand; hand.scale.setScalar((isSuit ? 1.18 : 1) * (0.94 + 0.06 * B.arm));
    add(hand, cached('palm', () => loft([[0.012, 0.0165, 0.028], [-0.012, 0.0158, 0.033], [-0.05, 0.0158, 0.039], [-0.084, 0.0138, 0.0375], [-0.092, 0.009, 0.031]], { n: 3, seg: 18 })), hm, [0, 0, 0.002]); // palm widening out of the wrist
    const fl = [0.068, 0.076, 0.07, 0.056];
    for (let i = 0; i < 4; i++) {
      const z = 0.03 - i * 0.0188, r = 0.0093 - i * 0.0004, l = fl[i];
      const k1 = joint(hand, 'fg', [-0.002 * s, -0.086, z]); k1.rotation.z = -0.22 * s;
      add(k1, capsule(r, l * 0.5, 3, 8), hm, [0, -l * 0.27, 0]);
      const k2 = joint(k1, 'fg2', [0, -l * 0.54, 0]); k2.rotation.z = -0.42 * s;
      add(k2, capsule(r * 0.94, l * 0.42, 3, 8), hm, [0, -l * 0.23, 0]);
    }
    const tb = joint(hand, 'th', [-0.004 * s, -0.03, 0.036]); tb.rotation.set(-0.62, 0, -0.18 * s);
    add(tb, capsule(0.0115, 0.034, 3, 8), hm, [0, -0.026, 0]);
    const tb2 = joint(tb, 'th2', [0, -0.05, 0]); tb2.rotation.x = 0.35;
    add(tb2, capsule(0.0105, 0.026, 3, 8), hm, [0, -0.02, 0]);
    // armor pauldron
    if (top === 'armor') {
      add(ua, sphere(0.072, 22, 12, 0, TAU, 0, PI / 2), M.get('topAcc'), [0.012 * s, 0.002, 0], [0, 0, -0.42 * s], [1.12, 0.7, 1.08]);
      add(ua, torus(0.06, 0.005, 6, 20), M.get('glow'), [0.03 * s, -0.012, 0], [PI / 2, -0.42 * s, 0], [1, 1.1, 1], { noShadow: true });
      add(fa, cyl(t * 1.04, t * 0.95, 0.11, 18), M.get('topAcc'), [0, -0.15, 0]);
    }
    if (isSuit) add(fa, cyl(t * 1.02, t * 0.96, 0.04, 18), M.get('glow'), [0, -0.2, 0], null, null, { noShadow: true });
  }

  /* ----- legs ----- */
  const L = legR;
  // skin: full upper thigh, knee, calf muscle behind the shin, narrow ankle
  const kn = [L * 0.7, L * 0.74, L * 0.69];                           // knee: the thigh ends and the shin starts on the same ring
  // The upper thighs are fuller on the inside and touch each other, as legs do: no deep gap under the crotch.
  // inner(rows, k): k times as wide on the inner side (built for the left leg; the right one is the same mesh mirrored).
  const inner = (rows, k) => rows.map(r => [r[0], r[1], r[2], r[3] ?? r[2], 0, 0, 2, r[1] * k]);
  const thighS = [...inner([...dome(0, L * 1.0, L * 1.0, L * 1.05, 1, 0.6), [0, L * 1.0, L * 1.0, L * 1.06]], 1.3), ...inner([[-0.07, L * 1.03, L * 1.03, L * 1.05]], 1.2), [-0.18 * B.leg, L * 0.93, L * 0.97, L * 0.9],
    [-0.3 * B.leg, L * 0.78, L * 0.8, L * 0.78], [-legLen, ...kn], ...dome(-legLen, ...kn, -1)];
  const shinS = [...dome(0, ...kn, 1), [0, ...kn], [-0.07 * B.leg, L * 0.7, L * 0.66, L * 0.8], [-0.135 * B.leg, L * 0.68, L * 0.62, L * 0.82],
    [-0.245 * B.leg, L * 0.52, L * 0.52, L * 0.6], [-shinLen + 0.05, L * 0.43, L * 0.46, L * 0.47], [-shinLen, L * 0.44, L * 0.5, L * 0.46], ...dome(-shinLen, L * 0.44, L * 0.5, L * 0.46, -1, 0.5)];
  // cloth: trousers fall straight from the seat; joggers narrow to the cuff, cargo pants are cut loose
  const hem = bot === 'joggers' ? 0.66 : bot === 'cargo' ? 0.9 : 0.8, tk = L * 0.93 * loose;
  const legTop = [...inner([...dome(0, tc, tc, tc * 1.03, 1, 0.6), [0, tc, tc, tc * 1.04]], 1.5), ...inner([[-0.08, tc * 1.01, tc, tc * 1.01]], 1.3)];
  const trouserTS = [...legTop, [-0.2 * B.leg, L * 1.01 * loose, L * 1.02 * loose],
    [-legLen, tk, tk * 1.03, tk], ...dome(-legLen, tk, tk * 1.03, tk, -1)];
  const ts = tk * 0.975;                                              // the lower leg comes out of the upper one: a clean fold at the knee
  const trouserSS = [...dome(0, ts, ts * 1.03, ts, 1), [0, ts, ts * 1.03, ts], [-0.15 * B.leg, L * lerp(0.93 * loose, hem, 0.45), L * lerp(0.95 * loose, hem, 0.42)],
    [-shinLen + 0.06, L * hem * 1.02, L * hem * 1.04], [-shinLen + 0.012, L * hem, L * hem * 1.03]];
  // shorts: the top of a trouser leg, cut off above the knee and open at the hem
  const shortsS = [...legTop, [-legLen * 0.46, L * 1.15, L * 1.15, L * 1.15]];
  for (const s of [1, -1]) {
    const sd = s > 0 ? 'L' : 'R';
    const th = joint(hips, 'th' + sd, [0.088 * s, -0.05, 0], J);
    const shn = joint(th, 'shin' + sd, [0, -legLen, 0], J);
    const ft = joint(shn, 'ft' + sd, [0, -shinLen, 0], J);
    const bare = look.legwear === 'tights' ? M.get('bottomDark') : mSkin;
    if (pants) {
      const m = isSuit ? mTop : mBot;
      add(th, cached(`trT${bk}${bot}${L}`, () => loft(trouserTS, { seg: TS })), m, null, null, [s, 1, 1]);
      both(add(shn, cached(`trS${bk}${bot}${L}`, () => loft(trouserSS, { seg: TS, cap: false })), m));
      add(shn, cached(`ank${bk}${L}`, () => loft([[-shinLen + 0.1, L * 0.5, L * 0.5, L * 0.56], [-shinLen + 0.05, L * 0.43, L * 0.46, L * 0.47], [-shinLen, L * 0.44, L * 0.5, L * 0.46], [-shinLen - 0.015, L * 0.3, L * 0.3]], { seg: 18 })), isSuit ? M.get('white') : bare);
    } else {
      add(th, cached(`thS${bk}${L}`, () => loft(thighS, { seg: 24 })), bare, null, null, [s, 1, 1]);
      add(shn, cached(`shS${bk}${L}`, () => loft(shinS, { seg: 24 })), bare);
      if (bot === 'shorts') both(add(th, cached(`sho${bk}${L}`, () => loft(shortsS, { seg: TS, cap: 'start' })), mBot, null, null, [s, 1, 1]));
    }
    if (bot === 'cargo') { add(th, rbox(0.035, 0.09, 0.075, 0.012, 2), M.get('bottomDark'), [L * 1.16 * s, -legLen * 0.52, 0.005]); add(shn, sphere(L * 1.0, 16, 10), M.get('bottomDark'), [0, 0.0, 0.016], null, [1, 0.8, 1]); }
    if ((bot === 'joggers' || top === 'tracksuit') && pants) { // side stripe lying on the trouser leg
      add(th, rbox(0.012, legLen * 0.9, 0.014, 0.005, 2), M.get('topAcc'), [(L * 1.0 * loose + 0.0015) * s, -legLen * 0.5, 0], [0, 0, -Math.atan((tc - tk) / legLen) * s]);
      add(shn, rbox(0.012, (shinLen - 0.07) * 0.94, 0.014, 0.005, 2), M.get('topAcc'), [(L * lerp(0.93 * loose, hem, 0.5) + 0.0015) * s, -(shinLen - 0.07) * 0.5, 0], [0, 0, -Math.atan(L * (0.93 * loose - hem) / (shinLen - 0.06)) * s]);
    }
    if (bot === 'joggers') both(add(shn, cyl(L * 0.69, L * 0.69, 0.034, 18, true), M.get('bottomDark'), [0, -shinLen + 0.03, 0]));
    // shoes
    const shoe = new T.Group(); ft.add(shoe); J['shoe' + sd] = shoe; shoe.scale.setScalar(1.12); shoe.position.y = 0.006;
    const shT = isSuit ? 'boot' : look.shoes.type;
    const mS = isSuit ? M.get('white') : M.get('shoe');
    if (shT === 'boot') {
      add(shoe, cyl(L * 0.62, L * 0.68, 0.1, 18), mS, [0, 0.02, 0]);
      add(shoe, sphere(0.058, 18, 12), mS, [0, -0.02, 0.04], null, [0.95, 0.72, 1.7]);
      add(shoe, rbox(0.11, 0.026, 0.21, 0.012, 2), M.get('sole'), [0, -0.048, 0.035]);
    } else if (shT === 'loafer') {
      add(shoe, sphere(0.055, 18, 12), mS, [0, -0.022, 0.04], null, [0.9, 0.6, 1.8]);
      add(shoe, rbox(0.1, 0.016, 0.2, 0.008, 2), M.get('black'), [0, -0.048, 0.035]);
    } else {
      add(shoe, sphere(0.058, 18, 12), mS, [0, -0.018, 0.042], null, [0.95, 0.7, 1.75]);
      add(shoe, rbox(0.112, 0.024, 0.212, 0.011, 2), M.get('sole'), [0, -0.046, 0.038]);
      add(shoe, torus(0.035, 0.006, 6, 14, PI), M.get('topAcc'), [0.05 * s, -0.022, 0.03], [0, PI / 2, 0], [1, 0.6, 1.6], { noShadow: true });
    }
  }

  /* ----- top-specific details ----- */
  if (top === 'tee' || top === 'tank' || top === 'sweater' || top === 'hoodie' || top === 'tracksuit') {
    ring(chest, top === 'tracksuit' ? M.get('topAcc') : M.get('topDark'), 0.222, 0.068 + knit, 0.064 + knit, 0.0105).rotation.x = PI / 2 + 0.16;
  }
  if (top === 'tracksuit') add(chest, rbox(0.008, 0.2, 0.012, 0.003, 2), M.get('topAcc'), [0, 0.085, fz(0.085) + 0.002], [-0.04, 0, 0]);
  if (top === 'hoodie') {
    both(add(chest, sphere(0.14, 24, 14, 0, TAU, PI / 2 - 0.2, PI / 2 + 0.2), mTop, [0, 0.205, -0.085], [-0.5, 0, 0], [1, 0.75, 0.75]));
    add(spine, rbox(0.17, 0.07, 0.014, 0.0065, 3), mTop, [0, 0.036, wz(0.036) + 0.0035], [-0.03, 0, 0]); // front pocket, in the cloth of the hoodie
    for (const s of [1, -1]) {
      const st = joint(chest, 'str' + s, [0.03 * s, 0.2, fz(0.2) + 0.012]);
      add(st, capsule(0.004, 0.09, 3, 6), M.get('topAcc'), [0, -0.05, 0]);
      add(st, sphere(0.008), M.get('metal'), [0, -0.1, 0]);
      springs.push(new R.Spring(st, { k: 90, d: 5, g: 0.8, i: 0.01, lim: 0.8 }));
    }
  }
  const jacketLike = ['jacket', 'suit', 'coat', 'bomber'].includes(top);
  if (jacketLike) {
    const gap = top === 'suit' ? 0.5 : top === 'coat' ? 0.5 : 0.56, jg = 0.013; // opening at the front, cloth thickness
    const open = { n: TN, phiStart: gap / 2, phiLen: TAU - gap, cap: false, seg: TS };
    both(add(chest, cached(`jc${bk}${gap}`, () => loft(chestS.slice(2, 10), { ...open, grow: jg, rings: 40 })), mTop));
    // The jacket is three shells, like the body under it: chest, waist (they turn with the spine) and a skirt over the
    // hips that stays with the trousers. Each one meets the next on a shared ring and then turns in under it.
    // The waist and the skirt meet at the height of the spine joint: the one ring that does not shift when the spine bends.
    const jaS = [absS[0], absS[1], absS[2], girth(0.115, -0.07, 0.5), girth(0.07, -0.07, 0.5), girth(0.058, -0.07, 0.5, -0.006)];
    both(add(spine, cached(`ja${bk}${gap}${cut}`, () => loft(jaS, { ...open, grow: jg })), mTop));
    const end = top === 'bomber' ? 0.03 : -0.03;                         // a flight jacket ends on the hips, in a ribbed band
    const skS = [girth(0.082, 0, 0.5, -0.006), girth(0.07, 0, 0.5), girth(0.06, 0, 0.5), girth(lerp(0.06, end, 0.5), 0, 0.5), girth(end, 0, 0.5)];
    both(add(hips, cached(`jh${bk}${gap}${cut}${end}`, () => loft(skS, { ...open, grow: jg })), mTop));
    if (top === 'bomber') strip(hips, M.get('topAcc'), `rib${cut}${gap}`, skS, { ...open, grow: jg + 0.003, u0: 3.3, u1: 4 });
    // lapels / collar
    for (const s of [1, -1]) {
      if (top === 'suit' || top === 'coat') add(chest, rbox(0.045, 0.15, 0.012, 0.005, 2), M.get('topDark'), [0.05 * s, 0.125, fz(0.125) + jg + 0.002], [-0.2, 0.3 * s, 0.36 * s]);
      else add(chest, rbox(0.06, 0.05, 0.014, 0.008, 2), top === 'bomber' ? M.get('topAcc') : M.get('topDark'), [0.062 * s, 0.2, fz(0.2) + jg], [-0.5, 0.3 * s, 0.4 * s]);
    }
    if (top === 'suit') {
      add(chest, rbox(0.024, 0.02, 0.012, 0.005, 2), M.get('topAcc'), [0, 0.196, fz(0.196) + 0.006]);
      add(chest, rbox(0.03, 0.17, 0.008, 0.004, 2), M.get('topAcc'), [0, 0.1, fz(0.1) + 0.004], [-0.06, 0, 0]);
      add(chest, rbox(0.03, 0.012, 0.01, 0.003, 2), M.get('white'), [-0.09, 0.105, fz(0.105) + jg + 0.001], [-0.05, -0.38, 0]);
    }
    if (top === 'bomber') add(chest, rbox(0.04, 0.012, 0.01, 0.004, 2), M.get('glow'), [-0.09, 0.12, fz(0.12) + jg], [0, -0.4, 0]);
    if (top === 'coat') {
      ring(spine, M.get('topDark'), 0.045, ww + jg + 0.004, wd + jg + 0.004, 0.011);
      for (const s of [1, -1]) {
        const tb = joint(hips, 'tail' + s, [0, 0.0, 0]);
        const g = cached(`tail${bk}${s}${cut}`, () => loft([[-0.01, hipR + jg + 0.006, hd * 0.97 + 0.02, hd * 1.1 + 0.02, 0, 0.033], [-0.16, hipR * 1.1 + 0.02, hd * 1.2, hd * 1.4, 0, 0.033], [-0.34, hipR * 1.26 + 0.02, hd * 1.5, hd * 1.75, 0, 0.03], [-0.5, hipR * 1.42 + 0.02, hd * 1.75, hd * 2.05, 0, 0.026]],
          { n: 2.1, phiStart: s > 0 ? 0.26 : PI, phiLen: PI - 0.26, cap: false, seg: 22 }));
        both(add(tb, g, mTop));
        springs.push(new R.Spring(tb, { k: 60, d: 7, g: 0.2, i: 0.006, lim: 0.45, spin: 0.05 }));
      }
    }
  }
  if (top === 'robe') {
    const tb = joint(hips, 'robe', [0, 0.06, 0]);
    const g = cached(`robe${bk}${cut}`, () => loft([[0.07, ww + 0.014, wd + 0.014], [0.0, lerp(ww, hipR, 0.8) + 0.02, hd * 0.96 + 0.02, hd * 1.02 + 0.02], [-0.1, hipR * 1.08 + 0.014, hd * 1.2, hd * 1.3], [-0.36, hipR * 1.4, hd * 1.75, hd * 1.85], [-0.66, hipR * 1.8, hd * 2.35, hd * 2.45]], { n: 2.1, cap: false, seg: 34 }));
    both(add(tb, g, mTop));
    ring(tb, M.get('glow'), -0.655, hipR * 1.8, hd * 2.4, 0.012, { noShadow: true });
    ring(spine, M.get('topAcc'), 0.045, ww + 0.012, wd + 0.012, 0.014);
    springs.push(new R.Spring(tb, { k: 70, d: 8, g: 0.1, i: 0.005, lim: 0.3 }));
    extras.flare.push(tb);
  }
  if (top === 'armor') {
    both(add(chest, cached(`arm${bk}`, () => loft(chestS.slice(4, 10), { n: TN, grow: 0.014, phiStart: -1.3, phiLen: 2.6, cap: false, seg: 26 })), M.get('topAcc')));
    add(chest, rbox(0.05, 0.05, 0.02, 0.012, 2), M.get('glow'), [0, 0.09, fz(0.09) + 0.012], [-0.04, 0, 0], null, { noShadow: true });
    ring(spine, M.get('topAcc'), -0.03, lerp(ww, hw, 0.45) + 0.012, lerp(wd, hd, 0.45) + 0.012, 0.02);
  }
  if (isSuit) {
    add(chest, rbox(0.12, 0.08, 0.04, 0.014, 3), M.get('white'), [0, 0.08, fz(0.08) + 0.006], [-0.02, 0, 0]);
    for (let i = 0; i < 3; i++) add(chest, rbox(0.016, 0.03, 0.01, 0.004, 2), M.get('glow'), [-0.03 + i * 0.03, 0.08, fz(0.08) + 0.028], null, null, { noShadow: true });
    add(chest, rbox(0.26, 0.3, 0.12, 0.05, 3), M.get('white'), [0, 0.07, bz(0.07) - 0.045]);
    add(chest, cyl(0.02, 0.02, 0.2, 10), M.get('grey'), [0.09, 0.1, bz(0.1) - 0.11]);
    ring(spine, M.get('glow'), 0.045, ww + knit + 0.01, wd + knit + 0.01, 0.016, { noShadow: true });
  }
  if (isAndroid) {
    add(chest, rbox(0.2, 0.16, 0.03, 0.03, 3), M.get('grey'), [0, 0.085, fz(0.085) - 0.006]);
    add(chest, cyl(0.045, 0.045, 0.02, 20), M.get('glow'), [0, 0.09, fz(0.09) + 0.012], [PI / 2, 0, 0], null, { noShadow: true });
  }

  /* ----- bottoms ----- */
  if (bot === 'skirt') {
    const sb = joint(hips, 'skirt', [0, 0.04, 0]);
    const g = cached(`sk${bk}`, () => loft(skirtS.map(r => [r[0] - 0.04, ...r.slice(1)]), { cap: false, seg: TS }));
    both(add(sb, g, mBot));
    springs.push(new R.Spring(sb, { k: 80, d: 8, g: 0.05, i: 0.004, lim: 0.25 }));
    extras.flare.push(sb);
  }
  // waistband (a jacket, coat or robe hangs over it)
  if ((pants || bot === 'shorts') && !jacketLike && top !== 'robe' && !overHip && !isSuit) strip(hips, M.get('bottomDark'), `waist${cut}`, [girth(0.126), girth(0.111), girth(0.096)], { grow: 0.004 });

  buildBack(chest, look, M, J, springs, fz, bz);

  return { root, J, springs, extras, kind: 'human', H, face: J.face };
}
R.buildHuman = buildHuman;
})(window);
