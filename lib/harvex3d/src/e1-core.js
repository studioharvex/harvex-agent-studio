/* Harvex Character Engine — core utilities, materials, geometry.
   Original procedural characters for Harvex Agent Studio. Requires THREE (r158 UMD). */
(function (G) {
'use strict';
const T = G.THREE;
const R = (G.HARVEX = G.HARVEX || {});
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = {
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
// smooth pseudo-noise (sum of sines, incommensurate)
const nz = (t, s = 0) => Math.sin(t + s) * 0.5 + Math.sin(t * 2.17 + s * 1.9) * 0.3 + Math.sin(t * 4.03 + s * 3.1) * 0.2;
// in/out envelope for one-shot motions
const env = (t, dur, a = 0.3, r = 0.35) => sstep(0, a, t) * (1 - sstep(dur - r, dur, t));
const angNorm = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
R.util = { TAU, clamp, lerp, sstep, ease, nz, env, angNorm };

/* ---------------- color helpers ---------------- */
function shade(hex, amt) { // amt -1..1  darken/lighten
  const c = new T.Color(hex); const hsl = {}; c.getHSL(hsl);
  hsl.l = clamp(hsl.l + amt * (amt < 0 ? hsl.l : 1 - hsl.l), 0, 1);
  c.setHSL(hsl.h, hsl.s, hsl.l); return '#' + c.getHexString();
}
R.shade = shade;

/* ---------------- materials ---------------- */
const TOP_INNER = { suit: '#f1f1ea', jacket: '#1d2521', coat: '#e6e2d6', bomber: '#20262a', armor: '#1b2220', spacesuit: '#d9dfdc' };
function roleColor(role, L) {
  switch (role) {
    case 'skin': return L.skin;
    case 'skinShade': return shade(L.skin, -0.12);
    case 'lip': return shade(L.skin, -0.32);
    case 'hair': return L.hair.color;
    case 'brow': return shade(L.hair.color, -0.25);
    case 'top': return L.top.color;
    case 'topDark': return shade(L.top.color, -0.3);
    case 'topAcc': return L.top.accent;
    case 'inner': return TOP_INNER[L.top.type] || shade(L.top.color, 0.5);
    case 'bottom': return L.bottom.color;
    case 'bottomDark': return shade(L.bottom.color, -0.3);
    case 'shoe': return L.shoes.color;
    case 'sole': return L.shoes.type === 'boot' ? '#2a2420' : '#f1f1ea';
    case 'glow': return L.glow;
    case 'iris': return L.eyes;
    case 'acc': return L.accColor || '#20262a';
    case 'screen': return '#0b1411';
    case 'body': return L.top.color;
    case 'body2': return L.top.accent;
    default: return null;
  }
}
const FIXED = {
  dark: '#2a1715', mouthIn: '#5b1d25', tongue: '#e0707a', eyeW: '#fbfbf6', black: '#0a0b0b', white: '#f2f2ec',
  metal: '#9aa4a1', grey: '#5d6663', lens: '#0e1416', teeth: '#fbfbf4', blush: '#ff7f86',
};
R.roleColor = (role, L) => roleColor(role, L) || FIXED[role] || null;
class Mats {
  constructor(look) { this.look = look; this.m = {}; }
  get(role) { return this.m[role] || (this.m[role] = this.make(role)); }
  make(role) {
    const L = this.look, gloss = L.finish === 'gloss';
    const col = roleColor(role, L) || FIXED[role] || '#ff00ff';
    let m;
    if (role === 'skin' || role === 'skinShade') {
      m = new T.MeshPhysicalMaterial({ color: col, roughness: 0.58, sheen: 0.5, sheenRoughness: 0.55, sheenColor: new T.Color('#ffb59a') });
    } else if (role === 'hair' || role === 'brow') {
      m = new T.MeshPhysicalMaterial({ color: col, roughness: 0.55, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new T.Color(shade(col, 0.45)) });
    } else if (role === 'glow') {
      m = new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2, roughness: 0.4 });
    } else if (role === 'eyeW' || role === 'teeth') {
      m = new T.MeshStandardMaterial({ color: col, roughness: 0.25 });
    } else if (role === 'iris') {
      m = new T.MeshPhysicalMaterial({ color: col, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
    } else if (role === 'black') {
      m = new T.MeshPhysicalMaterial({ color: col, roughness: 0.1, clearcoat: 1 });
    } else if (role === 'shine') {
      m = new T.MeshBasicMaterial({ color: '#ffffff' });
    } else if (role === 'blush') {
      m = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false });
    } else if (role === 'glass') {
      m = new T.MeshPhysicalMaterial({ color: '#d8f4ff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false, side: T.DoubleSide });
    } else if (role === 'lens') {
      m = new T.MeshPhysicalMaterial({ color: col, roughness: 0.08, clearcoat: 1, metalness: 0.3 });
    } else if (role === 'visor') {
      // a smoked lens: the eyes show through it (at opacity 0.6 with the glow in it, it lay over the eyes as an olive band
      // that read as a rendering fault). Drawn after the head, without writing depth.
      m = new T.MeshPhysicalMaterial({ color: '#141a1c', roughness: 0.05, metalness: 0.2, clearcoat: 1, emissive: L.glow, emissiveIntensity: 0.015, transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide });
    } else if (role === 'screen') {
      m = new T.MeshPhysicalMaterial({ color: col, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 });
    } else if (role === 'metal') {
      m = new T.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.85 });
    } else if (role === 'body' || role === 'body2') {
      m = new T.MeshPhysicalMaterial({ color: col, roughness: gloss ? 0.22 : 0.5, clearcoat: gloss ? 0.8 : 0.2, clearcoatRoughness: 0.3 });
    } else {
      const cloth = ['top', 'topDark', 'topAcc', 'inner', 'bottom', 'bottomDark', 'acc'].includes(role);
      m = new T.MeshPhysicalMaterial({
        color: col, roughness: cloth ? (gloss ? 0.32 : 0.82) : 0.6,
        sheen: cloth && !gloss ? 0.6 : 0, sheenRoughness: 0.7, sheenColor: new T.Color(shade(col, 0.35)),
        clearcoat: gloss && cloth ? 0.5 : 0,
      });
    }
    m.name = role;
    return m;
  }
  apply(look) {
    this.look = look;
    for (const role in this.m) {
      const col = roleColor(role, look); if (!col) continue;
      const m = this.m[role]; m.color.set(col);
      if (role === 'glow') m.emissive.set(col);
      if (m.sheenColor && role !== 'skin' && role !== 'skinShade') m.sheenColor.set(shade(col, 0.4));
    }
    if (this.m.visor) this.m.visor.emissive.set(look.glow);
  }
  dispose() { for (const k in this.m) this.m[k].dispose(); }
}
R.Mats = Mats;

/* ---------------- geometry ---------------- */
const GEO = new Map(); // cache by key
function cached(key, fn) { if (!GEO.has(key)) GEO.set(key, fn()); return GEO.get(key); }
function lathe(pts, seg = 28, phiStart = 0, phiLen = TAU, smooth = 0) {
  let v = pts.map(p => new T.Vector2(p[0], p[1]));
  if (smooth) v = new T.SplineCurve(v).getPoints(smooth);
  v.forEach(p => { p.x = Math.max(p.x, 0.0001); });
  return new T.LatheGeometry(v, seg, phiStart, phiLen);
}
// tapered capsule hanging DOWN from origin (joint) to y=-len
function taper(rTop, rBot, len, seg = 20) {
  return cached(`tp${rTop}|${rBot}|${len}`, () => {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push([rBot * Math.cos(a), -len + rBot * Math.sin(a)]); }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push([rTop * Math.cos(a), rTop * Math.sin(a)]); }
    return lathe(pts, seg);
  });
}
// open tube shell hanging down, radius r1->r2 (sleeves, cuffs, skirts)
function shell(r1, r2, len, seg = 22, phiStart = 0, phiLen = TAU) {
  return cached(`sh${r1}|${r2}|${len}|${phiStart}|${phiLen}`, () => lathe([[r2, -len], [lerp(r1, r2, 0.5) * 1.01, -len * 0.5], [r1, 0]], seg, phiStart, phiLen));
}
function sphere(r = 1, ws = 24, hs = 16, ps = 0, pl = TAU, ts = 0, tl = Math.PI) {
  return cached(`sp${r}|${ws}|${hs}|${ps}|${pl}|${ts}|${tl}`, () => new T.SphereGeometry(r, ws, hs, ps, pl, ts, tl));
}
function capsule(r, len, cs = 6, rs = 12) { return cached(`cp${r}|${len}`, () => new T.CapsuleGeometry(r, len, cs, rs)); }
function torus(r, tube, rs = 8, ts = 28, arc = TAU) { return cached(`to${r}|${tube}|${arc}`, () => new T.TorusGeometry(r, tube, rs, ts, arc)); }
function cyl(rt, rb, h, seg = 20, open = false, ts = 0, tl = TAU) { return cached(`cy${rt}|${rb}|${h}|${open}|${ts}|${tl}`, () => new T.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl)); }
function cone(r, h, seg = 12) { return cached(`co${r}|${h}`, () => new T.ConeGeometry(r, h, seg)); }
function rbox(w, h, d, r, s = 4) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  return cached(`rb${w}|${h}|${d}|${r}`, () => {
    const g = new T.BoxGeometry(w, h, d, s * 2, s * 2, s * 2);
    const p = g.attributes.position, n = g.attributes.normal;
    const inner = new T.Vector3(w / 2 - r, h / 2 - r, d / 2 - r), v = new T.Vector3(), c = new T.Vector3(), d3 = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.set(clamp(v.x, -inner.x, inner.x), clamp(v.y, -inner.y, inner.y), clamp(v.z, -inner.z, inner.z));
      d3.subVectors(v, c); if (d3.lengthSq() < 1e-12) d3.fromBufferAttribute(n, i);
      d3.normalize(); v.copy(c).addScaledVector(d3, r);
      p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, d3.x, d3.y, d3.z);
    }
    return g;
  });
}
function circle(r, seg = 24, ts = 0, tl = TAU) { return cached(`ci${r}|${ts}|${tl}`, () => new T.CircleGeometry(r, seg, ts, tl)); }
/* Lofted tube through elliptical cross-sections: the anatomical shapes (torso, limbs) and the clothes cut from them.
   A section is [y, rx, rzFront, rzBack?, cz?, d?, n?, rxNeg?]: half-width, half-depth in front of and behind the axis,
   z offset, lobe offset, exponent, half-width on the -x side. With d the section is two lobes centred at x = -d and +d
   joined by a flat front and back (the seat of a pair of trousers around both thighs); n overrides the exponent for
   that section; rxNeg makes one side fuller than the other (the inside of a thigh: mirror the mesh for the other leg).
   Sections are joined by a Catmull-Rom spline, so a handful of them gives a smooth silhouette (chest, waist, hips;
   deltoid, biceps, elbow; thigh, knee, calf, ankle). Options: seg (around), rings (along), n (superellipse exponent:
   2 = ellipse, above 2 = boxier), grow (push the surface outward: cloth over a body), phiStart / phiLen (open the
   tube; angle 0 is the front, +z), cap (true: close both ends, the default for a full tube; 'start' / 'end': only the
   first or the last section; false: open), u0 / u1 (build only a stretch of the tube, counted in sections: the hem
   of a sweater is the last stretch of its body, pushed out a little more). Not cached: wrap in cached(). */
function loft(sections, o = {}) {
  const S = sections.map(s => [s[0], s[1], s[2], s[3] ?? s[2], s[4] ?? 0, s[5] ?? 0, s[6] ?? (o.n || 2), s[7] ?? s[1]]);
  const seg = o.seg || 26, rings = o.rings || S.length * 5, grow = o.grow || 0;
  const phi0 = o.phiStart || 0, phiL = o.phiLen ?? TAU, closed = Math.abs(phiL - TAU) < 1e-6, cap = o.cap ?? closed;
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  const at = u => { const i = Math.min(S.length - 2, Math.floor(u)), t = u - i, p0 = S[Math.max(0, i - 1)], p1 = S[i], p2 = S[i + 1], p3 = S[Math.min(S.length - 1, i + 2)]; return p1.map((_, k) => cr(p0[k], p1[k], p2[k], p3[k], t)); };
  const cols = closed ? seg : seg + 1, pos = [], idx = [], up = S[S.length - 1][0] > S[0][0];
  const u0 = o.u0 ?? 0, uAt = r => u0 + (r / rings) * ((o.u1 ?? S.length - 1) - u0); // u0..u1: only a stretch of the tube (a hem, a waistband)
  for (let r = 0; r <= rings; r++) {
    const [y, rx, rf, rb, cz, d0, n, rn] = at(uAt(r));
    const e = 2 / Math.max(n, 1), w = Math.max(rx + grow, 1e-4), wn = Math.max(rn + grow, 1e-4), d = clamp(d0, 0, Math.min(w, wn) - 1e-4);
    for (let j = 0; j < cols; j++) {
      const a = phi0 + (j / seg) * phiL, sn = Math.sin(a), cs = Math.cos(a), side = Math.abs(sn) < 1e-9 ? 0 : Math.sign(sn);
      pos.push(side * (d + Math.pow(Math.abs(sn), e) * ((side < 0 ? wn : w) - d)), y, Math.sign(cs) * Math.pow(Math.abs(cs), e) * Math.max((cs >= 0 ? rf : rb) + grow, 1e-4) + cz);
    }
  }
  const tri = (a, b, c) => { if (up) idx.push(a, b, c); else idx.push(a, c, b); };
  for (let r = 0; r < rings; r++) for (let j = 0; j < seg; j++) {
    const a = r * cols + j, b = r * cols + (j + 1) % cols, c = (r + 1) * cols + j, d = (r + 1) * cols + (j + 1) % cols;
    tri(a, b, c); tri(b, d, c);
  }
  if (cap && closed) for (const end of [0, rings]) {
    if ((cap === 'start' && end) || (cap === 'end' && !end)) continue;
    const [y, , , , cz] = at(uAt(end)); const c = pos.length / 3; pos.push(0, y, cz);
    for (let j = 0; j < seg; j++) { const a = end * cols + j, b = end * cols + (j + 1) % cols; if (end === 0) tri(c, b, a); else tri(c, a, b); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** Front (+z) or back surface of a section table at height y: where a button, a tie or a backpack sits. */
function loftZ(sections, y, back = false) {
  const S = sections; let i = 0; while (i < S.length - 2 && (S[i + 1][0] - y) * (S[i + 1][0] - S[i][0]) < 0) i++;
  const a = S[i], b = S[i + 1], t = clamp((y - a[0]) / (b[0] - a[0] || 1), 0, 1), k = back ? 3 : 2;
  const v = lerp(a[k] ?? a[2], b[k] ?? b[2], t), cz = lerp(a[4] ?? 0, b[4] ?? 0, t);
  return back ? cz - v : cz + v;
}
R.geo = { lathe, taper, shell, sphere, capsule, torus, cyl, cone, rbox, circle, cached, loft, loftZ };

/* mesh helper */
function add(parent, geo, mat, pos, rot, scl, opts) {
  const m = new T.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ');
  if (scl) { if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(scl[0], scl[1], scl[2]); }
  m.castShadow = !(opts && opts.noShadow);
  m.receiveShadow = false;
  parent.add(m);
  return m;
}
function joint(parent, name, pos, J) {
  const o = new T.Object3D(); o.name = name;
  if (pos) o.position.set(pos[0], pos[1], pos[2]);
  parent.add(o); if (J) J[name] = o; return o;
}
R.add = add; R.joint = joint;

/* ---------------- spring bones (secondary motion) ---------------- */
const _v = new T.Vector3(), _q = new T.Quaternion(), _e = new T.Euler();
class Spring {
  constructor(bone, o = {}) {
    this.b = bone; this.rest = bone.quaternion.clone();
    this.k = o.k ?? 70; this.d = o.d ?? 7; this.g = o.g ?? 0.35; this.i = o.i ?? 0.012; this.lim = o.lim ?? 1.0;
    this.spin = o.spin ?? 0; // flare from yaw rate
    this.ax = 0; this.az = 0; this.vx = 0; this.vz = 0;
    this.prev = null; this.pv = new T.Vector3(); this.acc = new T.Vector3();
    this.d0 = new T.Vector3(0, -1, 0).applyQuaternion(this.rest);
  }
  reset() { this.prev = null; this.ax = this.az = this.vx = this.vz = 0; this.acc.set(0, 0, 0); }
  update(dt, yawRate) {
    const b = this.b; b.getWorldPosition(_v);
    if (!this.prev) { this.prev = _v.clone(); this.pv.set(0, 0, 0); return; }
    const vel = _v.clone().sub(this.prev).divideScalar(dt);
    const a = vel.clone().sub(this.pv).divideScalar(dt);
    if (a.length() > 40) a.setLength(40);
    this.acc.lerp(a, 0.5); this.prev.copy(_v); this.pv.copy(vel);
    b.parent.getWorldQuaternion(_q); _q.invert();
    const aL = this.acc.clone().applyQuaternion(_q);
    const gL = new T.Vector3(0, -1, 0).applyQuaternion(_q);
    const t = this.d0.clone().lerp(gL, this.g).normalize();
    let tx = -(t.z - this.d0.z) + aL.z * this.i;
    let tz = (t.x - this.d0.x) - aL.x * this.i;
    if (this.spin) { tx += -Math.abs(yawRate) * this.spin; }
    tx = clamp(tx, -this.lim, this.lim); tz = clamp(tz, -this.lim, this.lim);
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.vx += (this.k * (tx - this.ax) - this.d * this.vx) * h; this.ax += this.vx * h;
      this.vz += (this.k * (tz - this.az) - this.d * this.vz) * h; this.az += this.vz * h;
    }
    _e.set(this.ax, 0, this.az); _q.setFromEuler(_e);
    b.quaternion.copy(_q).multiply(this.rest);
  }
}
R.Spring = Spring;
})(window);
