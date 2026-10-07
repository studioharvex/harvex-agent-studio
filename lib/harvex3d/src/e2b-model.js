/* Harvex — modelled humans: a rigged, textured body from public/kit, dressed by the studio.
   The body, its skeleton, the hair pieces and their pictures are files (made by scripts/build-kit-assets.mjs from a
   CC0 kit). Everything else comes from the look, here: the body is reshaped for the build; clothes are thin shells
   lifted off the body and painted on the graphics card by rules written in the body's own space, so a new colour or
   a new garment shows at once; shoes, skirts and coat tails are lofted; hats, glasses and backpacks are the ones the
   first characters wear. The stage's own motions drive the model through a light rig with the same joint names.
   Androids and companions stay as they were, and so does any human whose files cannot be loaded. */
(function (G) {
'use strict';
const T = G.THREE, R = G.HARVEX, X = G.X || {};
const { TAU, clamp, lerp, sstep } = R.util;
const { loft, sphere, capsule, torus, cyl, rbox } = R.geo;
const add = R.add, joint = R.joint, PI = Math.PI;

/* ---------------- files ---------------- */
const M = R.models = { base: '/kit/', enabled: true, failed: false, store: new Map() };
// one request per file; its result is kept on the promise so a later look can be built without waiting
function once(key, make) {
  let p = M.store.get(key);
  if (!p) { p = make(); M.store.set(key, p); p.then(v => { p.value = v; }, () => { M.store.delete(key); }); }
  return p;
}
const got = key => { const p = M.store.get(key); return p && p.value; };
const LOAD = {
  m: () => once('m', () => fetch(M.base + 'manifest.json').then(r => { if (!r.ok) throw new Error('kit manifest ' + r.status); return r.json(); })),
  g: name => once('g:' + name, () => new Promise((res, rej) => new X.GLTFLoader().load(M.base + name, g => res(g.scene), undefined, rej))),
  i: name => once('i:' + name, () => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('kit picture ' + name)); i.src = M.base + name; })),
};
// A picture as a texture. `lite` (small pictures, phones): half the size, a quarter of the memory.
const small = () => typeof window !== 'undefined' && (Math.min(window.screen.width, window.screen.height) < 700 || (navigator.deviceMemory || 8) <= 3);
const TEX = new Map();
function picture(name, srgb, lite) {
  const key = name + (lite ? '|l' : ''); let t = TEX.get(key); if (t) return t;
  const img = got('i:' + name);
  if (lite && img.width > 1024) { const c = document.createElement('canvas'); c.width = c.height = 1024; c.getContext('2d').drawImage(img, 0, 0, 1024, 1024); t = new T.CanvasTexture(c); }
  else { t = new T.Texture(img); t.needsUpdate = true; }
  t.flipY = false; t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.anisotropy = 8;
  TEX.set(key, t); return t;
}

/* ---------------- which files a look needs ---------------- */
// a build is taken from the body type that suits it best, among the types the kit folder held
const TYPES = { slim: ['regular', 'superhero'], regular: ['regular', 'superhero'], curvy: ['regular', 'superhero'], broad: ['superhero', 'regular'] };
function bodyFor(L, man) {
  const sex = L.body === 'feminine' ? 'f' : 'm', all = Object.entries(man.bodies);
  for (const t of TYPES[L.build] || TYPES.regular) { const hit = all.find(([, b]) => b.sex === sex && b.type === t); if (hit) return hit[0]; }
  return (all.find(([, b]) => b.sex === sex) || all[0])[0];
}
// A hair style is a piece of the kit when there is one (first match wins; flip / lift / cut make a second style out of
// one piece), else it is built here as for the first characters.
const STYLES = {
  buzz: [[['Buzzed', 'BuzzedFemale']]],
  short: [[['Short', 'SimpleParted']]],
  swept: [[['SweptBack', 'Swept']], [['SimpleParted'], { flip: true, lift: 1.13 }]],
  bob: [[['Bob']], [['Long'], { cut: 0.098 }]],
  long: [[['Long']]],
  bun: [[['Bun', 'Buns']]],
  twintails: [[['Pigtails', 'Twintails']]], ponytail: [[['Ponytail']]], curly: [[['Curly']]], afro: [[['Afro']]], spiky: [[['Spiky']]], mohawk: [[['Mohawk']]],
};
function hairFor(L, man, body) {
  for (const [names, o] of STYLES[L.hair.style] || []) {
    const have = names.filter(n => man.hair[n]); if (!have.length) continue;
    const name = have.find(n => man.hair[n].on === body) || have[0];
    return Object.assign({ name }, man.hair[name], o);
  }
  return null;
}
function plan(L, man) {
  const body = bodyFor(L, man), b = man.bodies[body], tone = b.tones.light ? 'light' : Object.keys(b.tones)[0];
  const hair = hairFor(L, man, body), beard = L.facial === 'beard' && man.hair.Beard ? Object.assign({ name: 'Beard' }, man.hair.Beard) : null;
  const files = [['g', b.file], ['i', b.tones[tone]], ['i', man.textures.eye]];
  const strand = n => { for (const k of ['hair' + n, 'hair' + n + 'n']) if (man.textures[k]) files.push(['i', man.textures[k]]); };
  for (const k of [b.normal, b.rough]) if (k) files.push(['i', k]);
  if (b.brows) strand(b.brows);
  for (const h of [hair, beard]) if (h) { files.push(['g', h.file]); strand(h.tex); }
  return { body, b, tone, hair, beard, files };
}
M.wants = (L, renderer) => M.enabled && !M.failed && !!X.GLTFLoader && L.kind === 'human' && L.headStyle !== 'screen' && (!renderer || renderer.capabilities.isWebGL2);
M.ready = L => { const man = got('m'); return !!man && plan(L, man).files.every(([k, n]) => got(k + ':' + n)); };
M.ensure = L => LOAD.m().then(man => Promise.all(plan(L, man).files.map(([k, n]) => LOAD[k](n))));

/* ---------------- a body, measured once ---------------- */
const TPL = new Map();
function template(id, entry) {
  let t = TPL.get(id); if (t) return t;
  const scene = got('g:' + entry.file); scene.updateMatrixWorld(true);
  const bones = {}, meshes = [];
  scene.traverse(n => { if (n.isBone) bones[n.name] = n; if (n.isSkinnedMesh) meshes.push(n); });
  const body = meshes.slice().sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
  const eyes = meshes.find(m => /^eyes/i.test(m.name)), brows = meshes.find(m => /^eyebrows/i.test(m.name));
  const g = body.geometry, P = g.attributes.position, n = P.count, cp = P.array, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const names = body.skeleton.bones.map(b => b.name), at = name => bones[name].getWorldPosition(new T.Vector3());
  // how much of each vertex belongs to which part of the body
  const part = name => /^upperarm/.test(name) ? 'ua' : /^lowerarm/.test(name) ? 'fa' : /^(hand|index|middle|ring|pinky|thumb)/.test(name) ? 'hand' : /^thigh/.test(name) ? 'thigh' : /^calf/.test(name) ? 'calf'
    : /^(foot|ball)/.test(name) ? 'foot' : /^head$/i.test(name) ? 'head' : /^neck/.test(name) ? 'neck' : /^clavicle/.test(name) ? 'clav' : 'torso';
  const W = {}; for (const k of ['ua', 'fa', 'hand', 'thigh', 'calf', 'foot', 'head', 'neck', 'clav', 'torso', 'arm', 'leg']) W[k] = new Float32Array(n);
  const comp = (a, i, k) => k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : k === 2 ? a.getZ(i) : a.getW(i);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) { const w = comp(sw, i, k); if (w > 0) W[part(names[comp(si, i, k)])][i] += w; }
    W.arm[i] = W.ua[i] + W.fa[i] + W.hand[i]; W.leg[i] = W.thigh[i] + W.calf[i] + W.foot[i];
  }
  const aPart = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { aPart[i * 4] = W.arm[i]; aPart[i * 4 + 1] = W.leg[i]; aPart[i * 4 + 2] = W.head[i] + W.neck[i]; aPart[i * 4 + 3] = W.hand[i]; }
  // landmarks of the rest pose (T pose, metres, feet on the ground)
  const sh = at('upperarm_l'), elb = at('lowerarm_l'), wr = at('hand_l'), th = at('thigh_l'), knee = at('calf_l'), ank = at('foot_l'), s1 = at('spine_01'), s3 = at('spine_03'), nk = at('neck_01'), hd = at('Head');
  let crotch = th.y, ex = 0, ey = 0, ez = -9, en = 0;
  for (let i = 0; i < n; i++) { const x = cp[i * 3], y = cp[i * 3 + 1]; if (Math.abs(x) < 0.012 && y < th.y + 0.02 && y > knee.y) crotch = Math.min(crotch, y); }
  if (eyes) { const E = eyes.geometry.attributes.position; for (let i = 0; i < E.count; i++) if (E.getX(i) > 0) { ex += E.getX(i); ey += E.getY(i); ez = Math.max(ez, E.getZ(i)); en++; } }
  const eye = en ? new T.Vector3(ex / en, ey / en, ez) : new T.Vector3(0.032, hd.y + 0.08, 0.08);
  // the skull above the eyes (without the ears), the chin, the foot
  const sk = { rx: 0, top: 0, zf: -9, zb: 9 }, foot = { z0: 9, z1: -9, x0: 9, x1: -9 }; let chin = eye.y;
  for (let i = 0; i < n; i++) {
    const x = cp[i * 3], y = cp[i * 3 + 1], z = cp[i * 3 + 2];
    if (W.head[i] > 0.7) { sk.top = Math.max(sk.top, y); if (y > eye.y + 0.03) sk.rx = Math.max(sk.rx, Math.abs(x)); if (y > eye.y) sk.zf = Math.max(sk.zf, z); if (y > eye.y - 0.02) sk.zb = Math.min(sk.zb, z); if (Math.abs(x) < 0.015 && z > eye.z - 0.04) chin = Math.min(chin, y); }
    if (W.foot[i] > 0.5 && x > 0) { foot.z0 = Math.min(foot.z0, z); foot.z1 = Math.max(foot.z1, z); foot.x0 = Math.min(foot.x0, x); foot.x1 = Math.max(foot.x1, x); }
  }
  const K = { sh, elb, wr, th, knee, ank, s1, s3, nk, hd, eye, chin, sk, foot, crown: sk.top,
    hipY: th.y, kneeY: knee.y, ankleY: ank.y, crotchY: crotch, beltY: s1.y - 0.004, waistY: s1.y + 0.035, chestY: s3.y, neckY: nk.y + 0.012, neckZ: nk.z,
    shX: sh.x + 0.012, wristX: wr.x, armY: elb.y, armZ: elb.z, legX: th.x, legZ: (th.z + knee.z) / 2, torsoZ: (s1.z + s3.z) / 2 };
  // points that share a place are one point of the surface (the picture's seams split them): shells are built on those
  const ids = new Map(), weld = new Uint32Array(n), rep = [];
  for (let i = 0; i < n; i++) { const k = Math.round(cp[i * 3] * 2e4) + ',' + Math.round(cp[i * 3 + 1] * 2e4) + ',' + Math.round(cp[i * 3 + 2] * 2e4); let w = ids.get(k); if (w === undefined) { w = rep.length; ids.set(k, w); rep.push(i); } weld[i] = w; }
  const tri = g.index.array, nW = rep.length, sets = Array.from({ length: nW }, () => new Set());
  for (let i = 0; i < tri.length; i += 3) { const a = weld[tri[i]], b = weld[tri[i + 1]], c = weld[tri[i + 2]]; sets[a].add(b).add(c); sets[b].add(a).add(c); sets[c].add(a).add(b); }
  // the two eyes share one picture, mirrored: each gets its own material so both can look the same way
  let eyeGeo = null;
  if (eyes) { const eg = eyes.geometry, ix = eg.index.array, ep = eg.attributes.position, left = [], right = [];
    for (let i = 0; i < ix.length; i += 3) (ep.getX(ix[i]) > 0 ? left : right).push(ix[i], ix[i + 1], ix[i + 2]);
    eyeGeo = new T.BufferGeometry(); for (const k in eg.attributes) eyeGeo.setAttribute(k, eg.attributes[k]);
    eyeGeo.setIndex(left.concat(right)); eyeGeo.addGroup(0, left.length, 0); eyeGeo.addGroup(left.length, right.length, 1); }
  const bake = new T.BufferGeometry(); bake.setAttribute('position', P); bake.setAttribute('uv', g.attributes.uv); bake.setAttribute('aPart', new T.BufferAttribute(aPart, 4)); bake.setIndex(g.index);
  t = { id, entry, scene, g, n, cp, W, K, weld, rep, nW, tri, nb: sets.map(s => [...s]), bake, eyeGeo, names: { body: body.name, eyes: eyes && eyes.name, brows: brows && brows.name }, shapes: new Map() };
  TPL.set(id, t); return t;
}
// the axis of the left leg at a height, and of the left arm at a distance from the middle
const legAxis = (K, y) => { const up = y > K.knee.y, a = up ? K.th : K.knee, b = up ? K.knee : K.ank, u = clamp((a.y - y) / (a.y - b.y || 1), -0.3, 1.3); return [lerp(a.x, b.x, u), lerp(a.z, b.z, u)]; };
const armAxis = (K, ax) => { const up = ax < K.elb.x, a = up ? K.sh : K.elb, b = up ? K.elb : K.wr, u = clamp((ax - a.x) / (b.x - a.x || 1), -0.3, 1.3); return [lerp(a.y, b.y, u), lerp(a.z, b.z, u)]; };

/* ---------------- the build: the same body, fuller or slighter ---------------- */
// [chest, waist, hips, arms, thighs, calves]: girth against the model as it comes. The free bodies are a superhero's.
const FIT = {
  superhero: {
    f: { slim: [0.94, 0.93, 0.9, 0.88, 0.84, 0.9], regular: [0.97, 0.97, 0.94, 0.93, 0.9, 0.94], curvy: [1, 0.97, 1.02, 0.97, 1, 0.98], broad: [1.06, 1.08, 1.04, 1.08, 1.03, 1.02] },
    m: { slim: [0.85, 0.89, 0.93, 0.72, 0.86, 0.9], regular: [0.9, 0.94, 0.97, 0.8, 0.92, 0.94], curvy: [0.92, 0.95, 1.04, 0.82, 1, 0.97], broad: [0.98, 1.01, 1.02, 0.92, 1, 1] },
  },
  other: { slim: [0.94, 0.93, 0.94, 0.9, 0.92, 0.94], regular: [1, 1, 1, 1, 1, 1], curvy: [1, 0.96, 1.07, 0.96, 1.06, 1], broad: [1.1, 1.1, 1.05, 1.14, 1.08, 1.04] },
};
// how far the muscle definition of a body type is smoothed away for a build (rounds of smoothing; 0 = as modelled)
const SOFT = { superhero: { f: { slim: 6, regular: 5, curvy: 4, broad: 3 }, m: { slim: 16, regular: 14, curvy: 14, broad: 7 } } };
function shaped(tpl, build) {
  let S = tpl.shapes.get(build); if (S) return S;
  const { n, cp, W, K, weld, nW, tri, entry } = tpl, f = ((FIT[entry.type] || {})[entry.sex] || FIT.other)[build] || FIT.other.regular;
  const pos = new Float32Array(cp), [fc, fw, fh, fa, ft, fk] = f;
  const girthK = y => y > K.chestY ? lerp(fc, 1, sstep(K.chestY + 0.06, K.neckY, y)) : y > K.waistY ? lerp(fw, fc, sstep(K.waistY, K.chestY, y)) : lerp(fh, fw, sstep(K.hipY - 0.02, K.waistY, y));
  for (let i = 0; i < n; i++) {
    const a = i * 3, x = cp[a], y = cp[a + 1], z = cp[a + 2], s = x < 0 ? -1 : 1;
    const wt = W.torso[i] + W.clav[i], wa = W.ua[i] + W.fa[i], wl = W.thigh[i] + W.calf[i];
    let dx = 0, dy = 0, dz = 0;
    if (wt > 0) { const k = girthK(y) - 1; dx += x * k * wt; dz += (z - K.torsoZ) * k * wt; }
    if (wa > 0) { const [cy, cz] = armAxis(K, Math.abs(x)), k = (fa - 1) * wa; dy += (y - cy) * k; dz += (z - cz) * k; }
    if (wl > 0) { const [cx, cz] = legAxis(K, y), k = (ft - 1) * W.thigh[i] + (fk - 1) * W.calf[i]; dx += (x - s * cx) * k; dz += (z - cz) * k; }
    pos[a] = x + dx; pos[a + 1] = y + dy; pos[a + 2] = z + dz;
    if (wl > 0.5 && s * pos[a] < 0.001) pos[a] = s * 0.001;           // thighs meet, they do not cross
  }
  // the surface point by point, with the way it faces
  const wp = new Float32Array(nW * 3), wn = new Float32Array(nW * 3);
  for (let i = 0; i < n; i++) { const w = weld[i] * 3; wp[w] = pos[i * 3]; wp[w + 1] = pos[i * 3 + 1]; wp[w + 2] = pos[i * 3 + 2]; }
  // a softer body: trunk, shoulders and thighs smoothed without shrinking (a step in, a step out), so an athlete's
  // model also serves a slighter build
  const soft = ((SOFT[entry.type] || {})[entry.sex] || {})[build] || 0;
  if (soft) {
    // points move in and out only, never along the surface: what is painted by place (a hem, an opening) stays straight
    const wg = new Float32Array(nW), tmp = new Float32Array(nW * 3), n0 = new Float32Array(nW * 3); faceNormals(wp, n0, weld, tri, null);
    for (let i = 0; i < n; i++) wg[weld[i]] = Math.min(1, W.torso[i] + W.clav[i] + W.ua[i] * 0.8 + W.fa[i] * 0.4 + W.thigh[i] * 0.6);
    const pass = k => { for (let w = 0; w < nW; w++) { const a = w * 3, nbs = tpl.nb[w]; let x = 0, y = 0, z = 0; for (const v of nbs) { x += wp[v * 3]; y += wp[v * 3 + 1]; z += wp[v * 3 + 2]; }
      const c = nbs.length || 1, h = ((x / c - wp[a]) * n0[a] + (y / c - wp[a + 1]) * n0[a + 1] + (z / c - wp[a + 2]) * n0[a + 2]) * wg[w] * k;
      tmp[a] = wp[a] + n0[a] * h; tmp[a + 1] = wp[a + 1] + n0[a + 1] * h; tmp[a + 2] = wp[a + 2] + n0[a + 2] * h; } wp.set(tmp); };
    for (let it = 0; it < soft; it++) { pass(0.55); pass(-0.57); }
    for (let i = 0; i < n; i++) { const w = weld[i] * 3; pos[i * 3] = wp[w]; pos[i * 3 + 1] = wp[w + 1]; pos[i * 3 + 2] = wp[w + 2]; }
  }
  faceNormals(wp, wn, weld, tri, null);
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  for (const k of ['normal', 'uv', 'skinIndex', 'skinWeight']) geo.setAttribute(k, tpl.g.attributes[k]); geo.setIndex(tpl.g.index);
  if (soft) {                                                           // the smoothed surface faces its own way; the head keeps the modelled one
    const src = tpl.g.attributes.normal, nor = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const w = weld[i] * 3, k = Math.min(1, (W.head[i] + W.neck[i] + W.hand[i] + W.foot[i]) * 2);
      nor[i * 3] = lerp(wn[w], src.getX(i), k); nor[i * 3 + 1] = lerp(wn[w + 1], src.getY(i), k); nor[i * 3 + 2] = lerp(wn[w + 2], src.getZ(i), k); }
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.normalizeNormals();
  }
  // measures of this build: radius of a limb around its axis, girth of the trunk at a height
  const radius = (leg, t) => { let s = 0, c = 0;
    for (let i = 0; i < n; i++) { const a = i * 3, x = pos[a]; if (x < 0) continue;
      if (leg) { if (W.thigh[i] + W.calf[i] < 0.6 || Math.abs((K.hipY - pos[a + 1]) / (K.hipY - K.ankleY) - t) > 0.035) continue; const [cx, cz] = legAxis(K, pos[a + 1]); s += Math.hypot(x - cx, pos[a + 2] - cz); c++; }
      else { if (W.ua[i] + W.fa[i] < 0.6 || Math.abs((x - K.shX) / (K.wristX - K.shX) - t) > 0.05) continue; const [cy, cz] = armAxis(K, x); s += Math.hypot(pos[a + 1] - cy, pos[a + 2] - cz); c++; } }
    return c ? s / c : leg ? 0.07 : 0.04; };
  const girth = y => { const o = { rx: 0, zf: -9, zb: 9 };
    for (let i = 0; i < n; i++) { const a = i * 3; if (W.arm[i] > 0.3 || Math.abs(pos[a + 1] - y) > 0.014) continue; o.rx = Math.max(o.rx, Math.abs(pos[a])); o.zf = Math.max(o.zf, pos[a + 2]); o.zb = Math.min(o.zb, pos[a + 2]); }
    if (!o.rx) return { rx: 0.15, zf: 0.1, zb: -0.1 }; return o; };
  S = { pos, wp, wn, geo, girth, soft, m: { arm: radius(0, 0.3), fore: radius(0, 0.62), wrist: radius(0, 0.93), thigh: radius(1, 0.25), knee: radius(1, 0.5), calf: radius(1, 0.66), ankle: radius(1, 0.95) } };
  tpl.shapes.set(build, S); return S;
}
// the way a surface faces at each of its points, from the triangles around the point (list: only these triangles)
function faceNormals(wp, wn, weld, tri, list) {
  const run = t => { const a = weld[tri[t]] * 3, b = weld[tri[t + 1]] * 3, c = weld[tri[t + 2]] * 3;
    const ux = wp[b] - wp[a], uy = wp[b + 1] - wp[a + 1], uz = wp[b + 2] - wp[a + 2], vx = wp[c] - wp[a], vy = wp[c + 1] - wp[a + 1], vz = wp[c + 2] - wp[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { wn[k] += nx; wn[k + 1] += ny; wn[k + 2] += nz; } };
  if (list) for (const t of list) run(t); else for (let t = 0; t < tri.length; t += 3) run(t);
  for (let a = 0; a < wn.length; a += 3) { const l = Math.hypot(wn[a], wn[a + 1], wn[a + 2]) || 1; wn[a] /= l; wn[a + 1] /= l; wn[a + 2] /= l; }
}

/* ---------------- clothes: what each garment covers ---------------- */
/* One table per garment, read twice: by the painter (which texel is cloth, what colour) and by the shell builder (how
   thick, how loose). Heights are metres in the body's rest pose; `sleeve` runs 0 (shoulder) .. 1 (wrist), `end` of a
   trouser leg 0 (hip) .. 1 (ankle). kind picks the details the painter draws (collar, cuffs, zip, pockets...). */
const prof = pts => t => { if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])); return pts[pts.length - 1][1]; };
function garments(L, K, m) {
  const t = L.top.type, b = L.bottom.type, hip = K.hipY, belt = K.beltY, suit = t === 'spacesuit';
  const sleeve = (a, w) => prof([[0, m.arm * a], [0.45, lerp(m.arm * a, m.wrist * w, 0.5)], [1, m.wrist * w]]);
  const TOP = {
    tee: { drape: 0.4, kind: 1, neck: 0.082, sleeve: 0.3, hem: hip - 0.04, thick: 0.007, smooth: 20, arm: sleeve(1.14, 2.4), form: 0.1 },
    tank: { kind: 2, neck: 0.1, sleeve: 0, armhole: 0.088, hem: hip - 0.025, thick: 0.005, smooth: 3, form: 0.3 },
    sweater: { drape: 0.8, kind: 3, neck: 0.078, sleeve: 0.97, cuff: 0.045, band: 0.045, hem: hip - 0.045, thick: 0.013, smooth: 60, arm: sleeve(1.16, 1.8), form: 0 },
    hoodie: { drape: 1, kind: 4, collar: 0.016, sleeve: 0.97, cuff: 0.045, band: 0.05, hem: hip - 0.055, thick: 0.015, smooth: 70, arm: sleeve(1.2, 1.9), form: 0 },
    tracksuit: { drape: 0.7, kind: 5, collar: 0.03, sleeve: 0.97, cuff: 0.035, band: 0.04, hem: hip - 0.035, thick: 0.011, smooth: 60, arm: sleeve(1.14, 1.7), form: 0 },
    robe: { drape: 0.85, kind: 10, neck: 0.08, vee: 0.2, sleeve: 0.94, cuff: 0.035, hem: belt - 0.09, thick: 0.013, smooth: 70, arm: sleeve(1.25, 3.1), form: 0 },
    spacesuit: { drape: 1, kind: 13, collar: 0.03, sleeve: 1.6, hem: hip - 0.035, thick: 0.018, smooth: 80, arm: sleeve(1.36, 2.3), form: 0 },
    armor: { kind: 11, collar: 0.03, sleeve: 0.97, hem: hip - 0.02, thick: 0.0045, smooth: 1, form: 0.35 },
  };
  const OUT = {
    bomber: { drape: 0.95, kind: 6, neck: 0.09, open: 0.032, vee: 0.13, sleeve: 0.97, cuff: 0.04, band: 0.045, hem: belt - 0.05, thick: 0.017, smooth: 70, arm: sleeve(1.3, 1.95), form: 0 },
    jacket: { drape: 0.9, kind: 7, neck: 0.09, open: 0.046, vee: 0.17, sleeve: 0.97, cuff: 0.03, hem: hip - 0.075, thick: 0.014, smooth: 60, arm: sleeve(1.22, 1.85), form: 0 },
    suit: { drape: 0.8, kind: 8, neck: 0.088, open: 0, vee: 0.25, sleeve: 0.93, hem: Math.max(K.crotchY + 0.04, hip - 0.06), thick: 0.013, smooth: 60, arm: sleeve(1.18, 1.8), form: 0 },
    coat: { drape: 0.95, kind: 9, neck: 0.09, open: 0, vee: 0.2, sleeve: 0.97, cuff: 0.035, hem: hip - 0.03, thick: 0.016, smooth: 70, arm: sleeve(1.24, 1.95), form: 0 },
    armor: { drape: 0.6, kind: 12, neck: 0.096, sleeve: 0, armhole: 0.1, hem: K.waistY - 0.005, thick: 0.012, smooth: 8, form: 0.15 },
  };
  // a trouser leg hangs straight from the thigh: at least this wide around the leg's axis (0 = as wide as the leg)
  const leg = (a, k2, c, h) => prof([[0.14, 0], [0.3, m.thigh * a], [0.5, Math.max(m.knee * 1.25, m.thigh * k2)], [0.72, Math.max(m.calf * 1.14, m.thigh * c)], [1, Math.max(m.ankle * 1.4, m.thigh * h)]]);
  const BOT = {
    pants: { kind: 1, end: 0.975, band: 0.03, thick: 0.007, smooth: 24, leg: leg(1.0, 0.94, 0.88, 0.84), form: 0.04 },
    joggers: { kind: 2, end: 0.93, band: 0.035, cuff: 0.035, thick: 0.008, smooth: 24, leg: leg(1.02, 0.94, 0.82, 0.56), form: 0.03 },
    cargo: { kind: 3, end: 0.97, band: 0.03, thick: 0.009, smooth: 30, leg: leg(1.1, 1.06, 1.0, 0.96), form: 0 },
    shorts: { kind: 4, end: 0.42, band: 0.03, cuff: 0.016, thick: 0.008, smooth: 14, leg: prof([[0.06, 0], [0.42, m.thigh * 1.16]]), form: 0.04 },
    skirt: { kind: 5, end: 0.36, band: 0, thick: 0.004, smooth: 1, form: 0.2 },    // shorts in the skirt's colour under it
    suit: { kind: 1, end: 0.9, band: 0, thick: 0.016, smooth: 40, leg: leg(1.12, 1.02, 0.96, 0.7), form: 0 },
  };
  // under a jacket: a shirt in the jacket's lining colour (a suit: a shirt with long sleeves and a tie)
  const top = Object.assign({ on: 1 }, OUT[t] && t !== 'armor' ? { kind: t === 'suit' ? 15 : 14, neck: 0.078, sleeve: t === 'suit' ? 0.975 : 0.2, hem: hip - 0.03, thick: 0.0045, smooth: 1, form: 0.3 } : TOP[t] || TOP.tee);
  const out = OUT[t] ? Object.assign({ on: 1 }, OUT[t]) : { on: 0 };
  const bot = Object.assign({ on: 1, waist: belt, stripe: b === 'joggers' || t === 'tracksuit' ? 1 : 0 }, suit ? BOT.suit : BOT[b] || BOT.pants);
  // a skirt is worn over the top: what hangs below its waist is tucked in
  if (b === 'skirt' && !suit && t !== 'robe') for (const g of [top, out]) if (g.on && t !== 'coat') { g.hem = Math.max(g.hem, belt - 0.04); g.band = 0; g.tuck = 1; }
  return { top, out, bot };
}

/* ---------------- the painter: clothes and skin, drawn into the body's picture on the graphics card ---------------- */
/* Every triangle of the body is drawn at its place in the picture while carrying its position on the body, so a rule
   written for the body ("from the waist to below the knee, a stripe down the outside") lands on the right texels
   whatever the picture's layout is. One picture per layer: the skin (with holes where cloth covers it), the trousers,
   the top, the jacket. Colours are numbers given to the program: a new colour is a repaint, not a rebuild. */
const PAINT_VS = `
attribute vec4 aPart;
uniform vec2 uShift;
varying vec3 vP; varying vec4 vW; varying vec2 vUv;
void main() { vP = position; vW = aPart; vUv = uv; gl_Position = vec4(uv * 2.0 - 1.0 + uShift, 0.0, 1.0); }`;
const PAINT_FS = `
struct Up { float on, kind, neck, vee, collar, sleeve, armhole, hem, open, cuff, band; vec3 c0, c1, c2, c3; };
struct Low { float on, kind, waist, end, cuff, band, stripe; vec3 c0, c1, c2; };
uniform sampler2D uSkin;
uniform int uPass;
uniform vec3 uTone, uRef, uUnder, uTights, uHair;
uniform vec4 uOver;                 // above this height the trousers take the colour of the coat or robe that hangs over them
uniform vec4 uOpt;                  // tights, stubble, how far above the ankle a shoe hides the foot, the body's own shading under cloth
uniform vec4 uA, uB, uC, uD, uE, uF, uG, uH;    // landmarks
uniform Up uTop, uOut; uniform Low uBot;
varying vec3 vP; varying vec4 vW; varying vec2 vUv;
#define hipY uA.x
#define ankleY uA.z
#define crotchY uA.w
#define waistY uB.x
#define chestY uB.y
#define neckY uB.z
#define neckZ uB.w
#define shX uC.x
#define wristX uC.z
#define armY uC.w
#define armZ uD.x
#define legX uD.y
#define legZ uD.z
#define torsoZ uD.w
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
// a line of width w (metres) where v, a distance in metres, is zero
float line(float v, float w) { return 1.0 - smoothstep(w * 0.5 - 0.0005, w * 0.5 + 0.0005, abs(v)); }
float disc(vec2 v, float r) { return 1.0 - smoothstep(r - 0.0006, r + 0.0006, length(v)); }
float rib(float v) { return 0.9 + 0.1 * sin(v * 1300.0); }
// x and z of the leg's axis at a height (hip joint, knee, ankle)
vec2 legAxis(float y) { return y > uG.z ? mix(uF.zw, uF.xy, clamp((y - uG.z) / (hipY - uG.z), 0.0, 1.3)) : mix(uG.xy, uF.zw, clamp((y - ankleY) / (uG.z - ankleY), -0.3, 1.0)); }

// Tops and jackets. Returns how deep (metres) the point lies inside the cloth, below zero outside; col: its colour.
float upper(Up g, vec3 p, vec4 w, out vec3 col) {
  col = g.c0;
  if (g.on < 0.5) return -1.0;
  int k = int(g.kind + 0.5);
  float ax = abs(p.x), al = wristX - shX, ta = (ax - shX) / al, d;
  bool front = p.z > torsoZ;
  if (w.x > 0.5) {                                                   // an arm, stretched out sideways
    if (k == 12) {                                                   // armour: a bracer on the forearm
      d = min(ta - 0.56, 0.93 - ta) * al; col = g.c2;
      col *= 1.0 - 0.3 * line((ta - 0.6) * al, 0.004) - 0.3 * line((ta - 0.89) * al, 0.004);
      return d;
    }
    if (g.sleeve <= 0.0) return -1.0;
    float m = (g.sleeve - ta) * al; d = m;                           // metres up from the end of the sleeve
    bool outside = p.y > armY;                                       // faces away from the body once the arm hangs
    if (g.cuff > 0.0 && m < g.cuff) { col = (k == 7 || k == 9) ? g.c1 : g.c2; if (k != 7 && k != 9 && k != 10) col *= rib(p.z + p.y); }
    else if (k == 1) col *= 1.0 - 0.2 * line(m - 0.022, 0.0022);
    else if (k == 5 && outside && abs(abs(p.z - armZ) - 0.012) < 0.0048) col = g.c2;
    else if (k == 11) col = mix(col, g.c1, line(p.z - armZ, 0.02) * (outside ? 1.0 : 0.0));
    else if (k == 13) {
      if (ta > 0.26 && ta < 0.33) col = g.c2;
      else if (ta > 0.44 && ta < 0.6) col *= 0.86 + 0.14 * sin(ta * al * 420.0);
      else if (ta > 0.9 && ta < 0.98) col = g.c1;
    }
    else if (k == 15 && m < 0.035) col *= 1.0 - 0.25 * line(m - 0.03, 0.002);
    return d;
  }
  // the trunk
  d = min(p.y - g.hem, neckY + 0.03 + g.collar - p.y);
  float nb = p.z - neckZ, dn = length(vec3(p.x, (p.y - neckY) * 0.9, nb < 0.0 ? nb * 1.8 : nb)) - g.neck;     // a neckline sits higher at the back
  if (g.collar <= 0.0) d = min(d, dn);
  float yv = p.y - (neckY - g.vee), gap = max(g.open, g.vee > 0.0 ? yv * 0.42 : 0.0), edge = ax - gap;
  if (front && gap > 0.0) d = min(d, edge);
  float hole = length(vec3(ax - shX + 0.012, p.y - armY, p.z - armZ)) - g.armhole;
  if (g.sleeve <= 0.0) d = min(d, hole);
  float up = p.y - g.hem;                                            // metres above the hem
  if (k == 1) { if (dn < 0.012) col = g.c1 * rib(p.x - p.z); col *= 1.0 - 0.2 * line(up - 0.02, 0.0022); }
  else if (k == 2) { if (dn < 0.009 || hole < 0.009) col = g.c1; }
  else if (k == 3) { if (dn < 0.022) col = g.c1 * rib(p.x - p.z); else if (up < g.band) col = g.c1 * rib(p.x + p.z); else col *= 0.955 + 0.045 * sin(p.x * 700.0) * sin(p.y * 520.0); }
  else if (k == 4) {
    if (up < g.band) col = g.c1 * rib(p.x + p.z);
    else if (front) {                                                // the pouch on the belly
      vec2 q = vec2(ax, p.y - (waistY - 0.018)); float box = max(q.x - 0.092 + q.y * 0.35, abs(q.y) - 0.045);
      col *= 1.0 - 0.3 * line(box, 0.003) - (box < 0.0 ? 0.04 : 0.0);
    }
  }
  else if (k == 5) {
    if (up < g.band) col = g.c1 * rib(p.x + p.z);
    else if (front && ax < 0.0034) col = g.c2;
    else if (front && ax < 0.011) col *= 0.84;
    else if (p.y > neckY + 0.012) col = mix(col, g.c2, step(neckY + 0.045, p.y));
    else col = mix(col, g.c2, line(p.y - (chestY + 0.07), 0.009) * step(0.012, ax));
  }
  else if (k == 6) {
    if (dn < 0.024) col = g.c2 * rib(p.x - p.z); else if (up < g.band) col = g.c2 * rib(p.x + p.z);
    else if (front && edge < 0.007) col = g.c1;
    else if (front && p.x < -0.05 && p.x > -0.1) col = mix(col, g.c3, line(p.y - (chestY + 0.025), 0.012));
  }
  else if (k == 7) {
    if (dn < 0.022 || (front && edge < 0.017 && yv > -0.02)) col = g.c1;
    else if (front) { col *= 1.0 - 0.25 * line(edge - 0.008, 0.002); if (ax > 0.06 && ax < 0.135) col *= 1.0 - 0.3 * line(p.y - (waistY - 0.035), 0.003); }
    col *= 1.0 - 0.2 * line(up - 0.018, 0.0022);
  }
  else if (k == 8 || k == 9) {
    float lap = (k == 9 ? 0.044 : 0.034) * smoothstep(-0.02, 0.07, yv);
    if (dn < 0.02 || (front && edge < lap)) col = g.c1;
    else if (front && k == 8) {
      col = mix(col, g.c1, max(disc(vec2(p.x - 0.013, yv + 0.035), 0.008), disc(vec2(p.x - 0.013, yv + 0.095), 0.008)));
      if (p.x < -0.045 && p.x > -0.1) { col *= 1.0 - 0.3 * line(p.y - (chestY + 0.03), 0.003); if (p.x < -0.058 && p.x > -0.088 && p.y > chestY + 0.031 && p.y < chestY + 0.045) col = g.c3; }
    }
    else if (k == 9) {
      if (abs(p.y - (waistY + 0.004)) < 0.017) col = g.c1;
      else if (front) col = mix(col, g.c1, max(disc(vec2(ax - 0.04, yv + 0.05), 0.0085), disc(vec2(ax - 0.04, yv + 0.12), 0.0085)));
    }
  }
  else if (k == 10) { if ((front && edge < 0.02 && gap > 0.0) || abs(p.y - (waistY + 0.012)) < 0.024) col = g.c2; }
  else if (k == 11) { col = mix(col, g.c1, max(line(abs(p.z - torsoZ) - 0.0, 0.03), line(p.y - (waistY + 0.05), 0.006))); }
  else if (k == 12) {                                                // armour: breast and back plate
    col = g.c2;
    float seam = max(line(ax, 0.004), max(line(p.y - (chestY + 0.012), 0.004), line(dn - 0.028, 0.004)));
    col *= 1.0 - 0.32 * seam; if (dn < 0.026 || up < 0.022 || hole < 0.016) col = g.c1;
  }
  else if (k == 13) {
    col *= 1.0 - 0.14 * max(line(ax, 0.004) * (front ? 1.0 : 0.0), line(p.y - (waistY + 0.085), 0.004));
    if (p.y > neckY + 0.012) col = g.c1; else col = mix(col, g.c2, line(p.y - (chestY + 0.095), 0.014) * step(0.045, ax));
  }
  else if (k == 14) { if (dn < 0.011) col *= 0.82; }
  else if (k == 15) {                                                // shirt and tie
    float tie = 0.013 + (neckY - p.y) * 0.035;
    if (front && p.y > neckY - 0.3 && ax < (p.y > neckY - 0.045 ? 0.019 : tie)) col = g.c2 * (p.y > neckY - 0.045 ? 0.82 : 1.0);
    else if (dn < 0.02) col = g.c3;
    else if (front) col *= 1.0 - 0.14 * line(ax - 0.02, 0.0018);
  }
  return d;
}
// Trousers, shorts and what is worn under a skirt.
float lower(Low g, vec3 p, vec4 w, out vec3 col) {
  col = g.c0;
  if (g.on < 0.5 || w.x > 0.5) return -1.0;
  int k = int(g.kind + 0.5);
  float ll = hipY - ankleY, tl = (hipY - p.y) / ll, ax = abs(p.x), m = (g.end - tl) * ll;
  float d = min(g.waist - p.y, m);
  vec2 lc = legAxis(p.y); float lz = p.z - lc.y;                      // in front of or behind the middle of the leg
  bool front = lz > 0.0, outer = ax > lc.x, seat = p.y > crotchY + 0.012;
  if (g.band > 0.0 && p.y > g.waist - g.band) { col = g.c1; if (k == 2 || k == 4) { col *= rib(p.x + p.z); if (front && abs(ax - 0.014) < 0.0032 && p.y < g.waist - 0.008) col = g.c2; } return d; }
  if (g.cuff > 0.0 && m < g.cuff) { col = g.c1 * (k == 2 ? rib(p.x + p.z) : 1.0); return d; }
  if (g.stripe > 0.5 && outer && abs(lz) < 0.0115) { col = g.c2; return d; }
  if (k == 1 || k == 3) {
    if (front && seat) col *= 1.0 - 0.22 * line(p.x - 0.013, 0.0024) * step(crotchY + 0.045, p.y);                        // fly
    if (seat) col *= 1.0 - 0.22 * line(length(vec2(ax - legX - 0.075, p.y - g.waist + g.band)) - 0.078, 0.0024) * (front ? 1.0 : 0.0); // pocket
    col *= 1.0 - 0.14 * line(lz, 0.002) * (outer ? 1.0 : 0.0) - 0.2 * line(m - 0.02, 0.0022);
  }
  if (k == 2 && front && seat && abs(ax - 0.014) < 0.0032 && p.y > g.waist - g.band - 0.07) col = g.c2;                   // cords
  if (k == 3) {                                                      // pockets on the thighs, a seam over the knee
    vec2 q = vec2(lz, (tl - 0.4) * ll);
    if (outer && abs(q.x) < 0.062 && abs(q.y) < 0.075) { col = g.c1; col *= 1.0 - 0.3 * line(q.y - 0.045, 0.003); }
    col *= 1.0 - 0.18 * line((tl - 0.52) * ll, 0.0025);
  }
  if (k == 4) col *= 1.0 - 0.14 * line(lz, 0.002) * (outer ? 1.0 : 0.0);
  return d;
}
void main() {
  vec3 p = vP; vec4 w = vW;
  vec3 s = texture2D(uSkin, vUv).rgb, cb, ct, co, col;
  float lum = dot(s, vec3(0.2126, 0.7152, 0.0722)), form = clamp(lum / dot(uRef, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.3);
  float db = lower(uBot, p, w, cb), dt = upper(uTop, p, w, ct), dq = upper(uOut, p, w, co), d;
  float weave = 0.972 + 0.028 * sin(p.x * 1500.0) * sin(p.y * 1500.0 + p.z * 900.0);
  if (uPass == 0) {
    col = uTone * min(s / uRef, vec3(1.12)) * 0.97;                 // the picture's own light and shade on the chosen tone; its brightest spots held back so a pale skin keeps its colour
    // the underwear painted into the kit's picture: grey, on the trunk
    float mx = max(s.r, max(s.g, s.b)), mn = min(s.r, min(s.g, s.b)), sat = (mx - mn) / max(mx, 0.0001);
    float trunk = step(w.x, 0.5) * step(w.z, 0.5) * step(crotchY - 0.14, p.y) * step(p.y, neckY - 0.03);
    col = mix(col, uUnder * clamp(lum * 2.1, 0.5, 1.25), (1.0 - smoothstep(0.32, 0.5, sat)) * trunk);
    if (uOpt.x > 0.5 && w.x < 0.5 && p.y < waistY - 0.03) col = mix(col, uTights * mix(0.9, 1.05, form) * weave, 0.965);
    if (uOpt.y > 0.0 && w.z > 0.5) {                                 // stubble: under the nose, over the jaw, not on the lips
      float nose = mix(uE.x, uE.y, 0.44), lim = nose + smoothstep(0.03, 0.065, abs(p.x)) * (uE.x - nose) * 0.75;
      float mask = (1.0 - smoothstep(lim - 0.014, lim + 0.004, p.y)) * smoothstep(uE.y - 0.07, uE.y - 0.025, p.y) * smoothstep(uE.z - 0.115, uE.z - 0.09, p.z);
      mask *= smoothstep(0.26, 0.36, s.g / max(s.r, 0.0001));
      col = mix(col, uHair, mask * uOpt.y * (0.72 + 0.28 * noise(p * 1700.0)));
    }
    if (uH.z > 0.0 && w.z > 0.5) {                                   // the scalp under the hair, from the hair line up and back
      float top = uE.w - uE.x, line = uE.x + top * mix(-0.5, 0.56, smoothstep(uH.x - 0.035, uH.y - 0.03, p.z));
      col = mix(col, uHair * (0.85 + 0.3 * noise(p * 900.0)), uH.z * smoothstep(line - 0.004, line + 0.012, p.y));
    }
    float cover = max(db, max(dt, dq));
    col *= 1.0 - 0.3 * smoothstep(-0.028, 0.0, cover);               // the shade a hem throws on the skin beside it
    float a = clamp(0.5 - (cover - 0.022) / 0.006, 0.0, 1.0);
    if (w.y > 0.5) a = min(a, clamp(0.5 + (p.y - ankleY - uOpt.z) / 0.006, 0.0, 1.0));
    gl_FragColor = vec4(col, a);
    return;
  }
  if (uPass == 1) { col = p.y > uOver.w ? uOver.rgb : cb; d = db; col *= 1.0 - 0.34 * smoothstep(-0.024, 0.004, max(dt, dq)); }
  else if (uPass == 2) { col = ct; d = dt; col *= 1.0 - 0.3 * smoothstep(-0.024, 0.004, dq); }
  else { col = co; d = dq; }
  col *= weave * mix(1.0, clamp(0.45 + 0.55 * form, 0.8, 1.06), uOpt.w);
  // the edge is stored as a slope across it (not a step), so the cut comes out smooth between texels
  gl_FragColor = vec4(col, clamp(0.5 + d / 0.006, 0.0, 1.0));
}`;
const UP = () => ({ on: 0, kind: 0, neck: 0, vee: 0, collar: 0, sleeve: 0, armhole: 0, hem: 0, open: 0, cuff: 0, band: 0, c0: new T.Color(), c1: new T.Color(), c2: new T.Color(), c3: new T.Color() });
const LOW = () => ({ on: 0, kind: 0, waist: 0, end: 0, cuff: 0, band: 0, stripe: 0, c0: new T.Color(), c1: new T.Color(), c2: new T.Color() });
function painter(renderer) {
  if (renderer.__harvexPaint) return renderer.__harvexPaint;
  const v4 = () => ({ value: new T.Vector4() }), c = () => ({ value: new T.Color() });
  const mat = new T.ShaderMaterial({
    uniforms: { uSkin: { value: null }, uPass: { value: 0 }, uShift: { value: new T.Vector2() }, uTone: c(), uRef: c(), uUnder: c(), uTights: c(), uHair: c(), uOpt: v4(), uOver: v4(), uA: v4(), uB: v4(), uC: v4(), uD: v4(), uE: v4(), uF: v4(), uG: v4(), uH: v4(),
      uTop: { value: UP() }, uOut: { value: UP() }, uBot: { value: LOW() } },
    vertexShader: PAINT_VS, fragmentShader: PAINT_FS, depthTest: false, depthWrite: false, side: T.DoubleSide });
  const mesh = new T.Mesh(new T.BufferGeometry(), mat); mesh.frustumCulled = false;
  const scene = new T.Scene(); scene.add(mesh);
  return renderer.__harvexPaint = { mat, mesh, scene, cam: new T.Camera() };
}
// The triangles are drawn nine times, eight of them nudged by a texel and a half: the picture's islands grow a rim of
// their own colour, so no seam shows where two islands meet on the body.
const NUDGE = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7], [0, 0]];
function paint(renderer, P, geo, target, pass, clear) {
  const u = P.mat.uniforms, was = renderer.getRenderTarget(), auto = renderer.autoClear, col = renderer.getClearColor(new T.Color()), al = renderer.getClearAlpha();
  u.uPass.value = pass; P.mesh.geometry = geo;
  renderer.setRenderTarget(target); renderer.setClearColor(clear, 0); renderer.autoClear = false; renderer.clear(true, false, false);
  const e = 3 / target.width;
  for (const [x, y] of NUDGE) { u.uShift.value.set(x * e, y * e); renderer.render(P.scene, P.cam); }
  renderer.setRenderTarget(was); renderer.autoClear = auto; renderer.setClearColor(col, al);
}

/* ---------------- a shell of cloth over the body ---------------- */
/* The cloth is the body's own surface lifted off it: by its thickness, out to a tube around a limb where the garment
   hangs straight (a trouser leg, a wide sleeve), and smoothed so it bridges hollows the way cloth does. It keeps the
   body's skinning, so it moves with it. U is the outermost surface so far: a jacket goes over the shirt under it. */
function shell(tpl, S, U, spec) {
  const { n, weld, rep, nW, tri, nb, g } = tpl, N = S.wn;
  const cov = new Uint8Array(nW), inS = new Uint8Array(nW), keep = [], list = [];
  for (let i = 0; i < n; i++) if (!cov[weld[i]] && spec.covers(i)) cov[weld[i]] = 1;
  for (let t = 0; t < tri.length; t += 3) { const a = weld[tri[t]], b = weld[tri[t + 1]], c = weld[tri[t + 2]]; if (cov[a] || cov[b] || cov[c]) { keep.push(t); inS[a] = inS[b] = inS[c] = 1; } }
  if (!keep.length) return null;
  const P = new Float32Array(nW * 3), Q = new Float32Array(nW * 3), off = new Float32Array(nW), fix = new Uint8Array(nW);
  for (let w = 0; w < nW; w++) if (inS[w]) {
    list.push(w); const a = w * 3, i = rep[w], o = off[w] = spec.thick(i); fix[w] = spec.fix && spec.fix(i) ? 1 : 0;
    P[a] = U[a] + N[a] * o; P[a + 1] = U[a + 1] + N[a + 1] * o; P[a + 2] = U[a + 2] + N[a + 2] * o;
    if (spec.tube) spec.tube(i, P, a);
  }
  for (let it = 0; it < (spec.smooth || 0); it++) {
    for (const w of list) {
      const a = w * 3; let x = 0, y = 0, z = 0, c = 0;
      if (!fix[w]) for (const v of nb[w]) if (inS[v]) { x += P[v * 3]; y += P[v * 3 + 1]; z += P[v * 3 + 2]; c++; }
      if (!c) { Q[a] = P[a]; Q[a + 1] = P[a + 1]; Q[a + 2] = P[a + 2]; continue; }
      // toward the middle of its neighbours, but only in and out: a point never slides along the body, so the picture
      // stays where it was painted; and never through what is under it
      let h = ((x / c - P[a]) * N[a] + (y / c - P[a + 1]) * N[a + 1] + (z / c - P[a + 2]) * N[a + 2]) * 0.5;
      const dn = (P[a] - U[a]) * N[a] + (P[a + 1] - U[a + 1]) * N[a + 1] + (P[a + 2] - U[a + 2]) * N[a + 2];
      if (dn + h < off[w]) h = off[w] - dn;
      Q[a] = P[a] + N[a] * h; Q[a + 1] = P[a + 1] + N[a + 1] * h; Q[a + 2] = P[a + 2] + N[a + 2] * h;
    }
    for (const w of list) { const a = w * 3; P[a] = Q[a]; P[a + 1] = Q[a + 1]; P[a + 2] = Q[a + 2]; }
  }
  if (spec.after) for (const w of list) spec.after(rep[w], P, w * 3, U);
  for (const w of list) if (cov[w]) { const a = w * 3; U[a] = P[a]; U[a + 1] = P[a + 1]; U[a + 2] = P[a + 2]; }
  const WN = new Float32Array(nW * 3); faceNormals(P, WN, weld, tri, keep);
  const map = new Int32Array(n).fill(-1), vs = [], index = [];
  for (const t of keep) for (let k = 0; k < 3; k++) { const i = tri[t + k]; if (map[i] < 0) { map[i] = vs.length; vs.push(i); } index.push(map[i]); }
  const m = vs.length, pos = new Float32Array(m * 3), nor = new Float32Array(m * 3), uv = new Float32Array(m * 2), sI = new Uint16Array(m * 4), sW = new Float32Array(m * 4);
  const UV = g.attributes.uv.array, SI = g.attributes.skinIndex.array, SW = g.attributes.skinWeight.array;
  vs.forEach((i, j) => {
    const a = weld[i] * 3;
    for (let k = 0; k < 3; k++) { pos[j * 3 + k] = P[a + k]; nor[j * 3 + k] = WN[a + k]; }
    uv[j * 2] = UV[i * 2]; uv[j * 2 + 1] = UV[i * 2 + 1];
    for (let k = 0; k < 4; k++) { sI[j * 4 + k] = SI[i * 4 + k]; sW[j * 4 + k] = SW[i * 4 + k]; }
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new T.BufferAttribute(sI, 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(sW, 4)); geo.setIndex(index);
  return geo;
}
function shellSpecs(tpl, S, gm) {
  const { cp, W, K } = tpl, al = K.wristX - K.shX, ll = K.hipY - K.ankleY;
  const armTube = fn => (i, P, a) => {
    const wa = W.ua[i] + W.fa[i]; if (wa < 0.05) return;
    const ax = Math.abs(P[a]), R = fn((ax - K.shX) / al); if (!(R > 0)) return;
    const [cy, cz] = armAxis(K, ax), dy = P[a + 1] - cy, dz = P[a + 2] - cz, rho = Math.hypot(dy, dz) || 1e-6;
    if (rho < R) { const k = lerp(1, R / rho, Math.min(1, wa)); P[a + 1] = cy + dy * k; P[a + 2] = cz + dz * k; }
  };
  const legTube = fn => (i, P, a) => {
    const wl = W.thigh[i] + W.calf[i]; if (wl < 0.05) return;
    const s = cp[i * 3] < 0 ? -1 : 1, R = fn((K.hipY - P[a + 1]) / ll); if (!(R > 0)) return;
    const [cx, cz] = legAxis(K, P[a + 1]), dx = P[a] - s * cx, dz = P[a + 2] - cz, rho = Math.hypot(dx, dz) || 1e-6;
    if (rho < R) { const k = lerp(1, R / rho, Math.min(1, wl)); P[a] = s * cx + dx * k; P[a + 2] = cz + dz * k; }
  };
  /* Cloth that hangs: in front from the fullest point of the chest straight down to the hem and up to the collar bones,
     behind from the shoulder blades down to the hem. Laid on after the smoothing, which would pull it back in. */
  const drape = g => {
    const pos = S.pos, top = K.neckY - 0.035, yh = Math.max(g.hem, K.crotchY), F = { z: -9, y: 0 }, B = { z: 9, y: 0 };
    for (let i = 0; i < tpl.n; i++) { const a = i * 3, y = pos[a + 1]; if (W.torso[i] + W.clav[i] < 0.6 || Math.abs(pos[a]) > 0.13 || y < K.waistY + 0.04 || y > top - 0.03) continue;
      if (pos[a + 2] > F.z) { F.z = pos[a + 2]; F.y = y; } if (pos[a + 2] < B.z) { B.z = pos[a + 2]; B.y = y; } }
    const low = S.girth(yh + 0.03), high = S.girth(top - 0.01), hw = S.girth(F.y).rx;
    // below the hip joints the cloth goes around both hips as one tube: no dent between the legs or the buttocks
    const hip = { rx: 0, zf: -9, zb: 9 }; for (let y = yh; y < K.hipY + 0.07; y += 0.015) { const q = S.girth(y); hip.rx = Math.max(hip.rx, q.rx); hip.zf = Math.max(hip.zf, q.zf); hip.zb = Math.min(hip.zb, q.zb); }
    const over = g.thick + (gm.bot.thick || 0), hc = (hip.zf + hip.zb) / 2, hrz = (hip.zf - hip.zb) / 2 + over, hrx = hip.rx + over;      // around the trousers' cloth as well
    return (i, P, a) => {
      if (W.arm[i] > 0.4) return;
      if (yh < K.hipY + 0.04 && P[a + 1] < K.hipY + 0.07 && P[a + 1] > yh - 0.04) {
        const e = Math.hypot(P[a] / hrx, (P[a + 2] - hc) / hrz), k = (1 - sstep(K.hipY + 0.01, K.hipY + 0.07, P[a + 1])) * g.drape * sstep(0.15, 0.4, e);   // not what lies deep between the legs: it would be flung to the front or the back, a torn notch in the hem
        if (e < 1 && e > 1e-4) { const q = lerp(1, 1 / e, k); P[a] *= q; P[a + 2] = hc + (P[a + 2] - hc) * q; }
      } const y = P[a + 1], zc = cp[i * 3 + 2] - K.torsoZ; if (y > top || y < yh || Math.abs(zc) < 0.02) return;
      const wx = (1 - sstep(0.62, 1, Math.abs(P[a]) / hw)) * g.drape * (g.tuck ? sstep(yh + 0.01, yh + 0.15, y) : 1), at = (q, z0, z1) => y < q.y ? lerp(q.z, z0, (q.y - y) / (q.y - yh)) : lerp(q.z, z1, (y - q.y) / (top - q.y));
      if (zc > 0) { const z = at(F, low.zf, high.zf) + g.thick; if (z > P[a + 2]) P[a + 2] = lerp(P[a + 2], z, wx); }
      else { const z = at(B, low.zb, high.zb) - g.thick; if (z < P[a + 2]) P[a + 2] = lerp(P[a + 2], z, wx * 0.85); }
    };
  };
  const front = (i, P, a, U) => {
    if (W.torso[i] + W.clav[i] < 0.5 || cp[i * 3 + 2] < K.torsoZ) return;
    const k = 1 - sstep(0.075, 0.12, Math.abs(cp[i * 3])); if (k > 0) P[a] = lerp(P[a], U[a], k);
  };
  const seat = g => {
    const hip = { rx: 0, zf: -9, zb: 9 }; for (let y = K.crotchY; y < K.hipY + 0.05; y += 0.015) { const q = S.girth(y); hip.rx = Math.max(hip.rx, q.rx); hip.zf = Math.max(hip.zf, q.zf); hip.zb = Math.min(hip.zb, q.zb); }
    const hc = (hip.zf + hip.zb) / 2, hrz = (hip.zf - hip.zb) / 2 + g.thick, hrx = hip.rx + g.thick;
    return (i, P, a) => {
      const y = P[a + 1]; if (W.arm[i] > 0.4 || y < K.crotchY - 0.01 || y > K.hipY + 0.07) return;
      const e = Math.hypot(P[a] / hrx, (P[a + 2] - hc) / hrz), k = sstep(K.crotchY - 0.01, K.crotchY + 0.045, y) * (1 - sstep(K.hipY + 0.02, K.hipY + 0.07, y)) * sstep(0.15, 0.4, e);
      // only the middle is bridged (between the thighs, between the buttocks): the sides keep the shape of the hips
      const wx = 1 - sstep(0.35, 0.8, Math.abs(P[a]) / hrx);
      if (e < 1 && e > 1e-4) { const q = lerp(1, 1 / e, k * wx); P[a + 2] = hc + (P[a + 2] - hc) * q; }
    };
  };
  const mid = (i, P, a) => { if (W.leg[i] > 0.5) { const s = cp[i * 3] < 0 ? -1 : 1; if (s * P[a] < 0.0025) P[a] = s * 0.0025; } };  // the two legs of a pair of trousers meet in a seam
  const up = g => ({
    covers: i => { const y = cp[i * 3 + 1], ta = (Math.abs(cp[i * 3]) - K.shX) / al;
      if (W.arm[i] > 0.5) return g.kind === 12 ? ta > 0.5 && ta < 1 : g.sleeve > 0 && ta < g.sleeve + 0.07;
      return y > g.hem - 0.03 && y < K.neckY + 0.06 + (g.collar || 0); },
    thick: i => W.hand[i] > 0.5 ? Math.min(g.thick, 0.005) : g.thick, fix: i => W.hand[i] > 0.4, smooth: g.smooth, tube: g.arm && armTube(g.arm), after: (dr => (i, P, a, U) => { if (dr) dr(i, P, a); front(i, P, a, U); })(g.drape && drape(g)),
  });
  const g = gm.bot;
  return {
    bot: { covers: i => W.arm[i] < 0.5 && cp[i * 3 + 1] < g.waist + 0.03 && (K.hipY - cp[i * 3 + 1]) / ll < g.end + 0.05, thick: () => g.thick, smooth: g.smooth, tube: g.leg && legTube(g.leg), after: (st => (i, P, a) => { if (st) st(i, P, a); mid(i, P, a); })(g.kind !== 5 && seat(g)) },
    top: up(gm.top), out: gm.out.on ? up(gm.out) : null,
  };
}

/* ---------------- the rig: the stage's joints, laid over the model's bones ---------------- */
const RIG = [['hips', 'pelvis', null], ['spine', 'spine_01', 'hips'], ['chest', 'spine_03', 'spine'], ['neck', 'neck_01', 'chest'], ['head', 'Head', 'neck'],
  ['clL', 'clavicle_l', 'chest'], ['uaL', 'upperarm_l', 'clL'], ['faL', 'lowerarm_l', 'uaL'], ['haL', 'hand_l', 'faL'],
  ['clR', 'clavicle_r', 'chest'], ['uaR', 'upperarm_r', 'clR'], ['faR', 'lowerarm_r', 'uaR'], ['haR', 'hand_r', 'faR'],
  ['thL', 'thigh_l', 'hips'], ['shinL', 'calf_l', 'thL'], ['ftL', 'foot_l', 'shinL'], ['thR', 'thigh_r', 'hips'], ['shinR', 'calf_r', 'thR'], ['ftR', 'foot_r', 'shinR']];
const DOWN = /^(upperarm|lowerarm|hand)_/, Z = new T.Vector3(0, 0, 1);
/* In the stage's rig "no joint is turned" means standing with the arms hanging; the model rests in a T pose. So a
   joint's turn (seen from the character's root) is laid over the matching bone's rest direction, the arms first
   brought down. Joints are placed where the bones are, so what hangs on a joint (a hat, a backpack) sits on the model. */
function buildRig(unit, model, bones, J) {
  model.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(unit.matrixWorld).invert(), rootQ = model.getWorldQuaternion(new T.Quaternion()).invert();
  const at = b => b.getWorldPosition(new T.Vector3()).applyMatrix4(inv), turn = b => b.getWorldQuaternion(new T.Quaternion()).premultiply(rootQ);
  const restW = {}, rest = {}, between = {}, pos = {}, boneOf = {};
  for (const [jn, bn, pj] of RIG) {
    const b = bones[bn], side = bn.endsWith('_l') ? -1 : 1, down = DOWN.test(bn);
    restW[bn] = turn(b); rest[bn] = down ? new T.Quaternion().setFromAxisAngle(Z, side * PI / 2).multiply(restW[bn]) : restW[bn].clone(); boneOf[jn] = bn;
    // a bone between two mapped ones keeps its own rest turn
    const anc = pj ? bones[boneOf[pj]] : null; between[bn] = pj ? (b.parent === anc ? null : restW[boneOf[pj]].clone().invert().multiply(turn(b.parent))) : turn(b.parent);
    // where the joint is: at the bone, the forearm and the hand below the shoulder
    const p = at(b);
    if (down && pj && DOWN.test(boneOf[pj])) { const d = p.sub(at(bones[boneOf[pj]])); pos[jn] = pos[pj].clone().add(new T.Vector3(side < 0 ? d.y : -d.y, side < 0 ? -d.x : d.x, d.z)); } else pos[jn] = p;
    const j = joint(pj ? J[pj] : unit, jn, null, J); j.position.copy(pos[jn]); if (pj) j.position.sub(pos[pj]);
  }
  const Wr = {}, Wb = {}, q = new T.Quaternion(); for (const [jn, bn] of RIG) { Wr[jn] = new T.Quaternion(); Wb[bn] = new T.Quaternion(); }
  const follow = () => {
    for (const [jn, bn, pj] of RIG) {
      const wr = Wr[jn]; if (pj) wr.copy(Wr[pj]).multiply(J[jn].quaternion); else wr.copy(J[jn].quaternion);
      Wb[bn].copy(wr).multiply(rest[bn]);
      if (pj) { q.copy(Wb[boneOf[pj]]); if (between[bn]) q.multiply(between[bn]); } else q.copy(between[bn]);
      bones[bn].quaternion.copy(q.invert()).multiply(Wb[bn]);
    }
  };
  return { pos, follow };
}
// a copy of a rigged model with a skeleton of its own
function cloneSkinned(src) {
  const dst = src.clone(true), byName = {}, from = [], made = new Map();
  dst.traverse(n => { if (n.isBone) byName[n.name] = n; });
  src.traverse(n => { if (n.isSkinnedMesh) from.push(n); });
  let i = 0;
  dst.traverse(n => { if (!n.isSkinnedMesh) return; const s = from[i++]; let sk = made.get(s.skeleton);
    if (!sk) { sk = new T.Skeleton(s.skeleton.bones.map(b => byName[b.name]), s.skeleton.boneInverses); made.set(s.skeleton, sk); }
    n.bind(sk, s.bindMatrix); });
  return dst;
}

/* ---------------- pieces built here ---------------- */
const hexBytes = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
// the kit's eye picture with its brown iris in the look's eye colour
function eyeCanvas(img, hex) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data, [tr, tg, tb] = hexBytes(hex), W = c.width, H = c.height;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, r = a[i], gg = a[i + 1], b = a[i + 2], mx = Math.max(r, gg, b);
    if (mx < 28 || Math.hypot(x / W - 0.5, y / H - 0.5) > 0.17) continue;
    const k = clamp(((gg - b) / mx - 0.1) / 0.14, 0, 1); if (!k) continue;                       // brown: more green than blue; the lid around it is pink
    const l = (r * 0.3 + gg * 0.59 + b * 0.11) / 78;
    a[i] = lerp(r, Math.min(255, tr * l), k); a[i + 1] = lerp(gg, Math.min(255, tg * l), k); a[i + 2] = lerp(b, Math.min(255, tb * l), k);
  }
  g.putImageData(d, 0, 0); return c;
}
/* A shoe lofted along the foot (the loft runs along y: laid forward, its "front" is the underside). Built in the
   model's own space for the left foot at x = F.x; kind: sneaker, boot or loafer. */
function buildShoe(grp, s, F, kind, M, suit, own) {
  const len = F.z1 - F.z0 + 0.016, wd = (F.x1 - F.x0) / 2 + 0.002, x = (F.x0 + F.x1) / 2 * s, z0 = F.z0 - 0.008, k = wd / 0.05;
  const mU = suit ? M.get('white') : M.get('shoe'), mS = kind === 'loafer' ? M.get('black') : M.get('sole'), mA = suit ? M.get('glow') : M.get('topAcc');
  const part = (rows, o, mat, h) => add(grp, own(loft(rows.map(r => [r[0], r[1] * k, r[2], r[3]]), o)), mat, [x, h, z0], [PI / 2, 0, 0]);
  const hi = kind === 'boot' ? 1.25 : kind === 'loafer' ? 0.72 : 1;          // how high the upper stands
  const upper = [[-0.006, 0.006, 0.006, 0.008], [-0.001, 0.022, 0.016, 0.03 * hi], [0.014, 0.034, 0.02, 0.06 * hi], [0.06, 0.04, 0.02, 0.066 * hi], [0.115, 0.045, 0.02, 0.05 * hi], [len * 0.72, 0.048, 0.02, 0.036],
    [len - 0.034, 0.045, 0.02, 0.031], [len - 0.014, 0.037, 0.019, 0.026], [len - 0.004, 0.024, 0.015, 0.017], [len + 0.001, 0.006, 0.005, 0.005]];
  part(upper, { n: 2.5, seg: 26, rings: 60 }, mU, 0.03);
  const soleH = kind === 'boot' ? 0.019 : kind === 'loafer' ? 0.011 : 0.017;
  part([[-0.012, 0.008, 0.006, 0.003], [-0.008, 0.026, soleH - 0.004, 0.004], [0.02, 0.041, soleH - 0.004, 0.005], [0.12, 0.05, soleH - 0.004, 0.005], [len - 0.03, 0.049, soleH - 0.004, 0.007], [len + 0.002, 0.03, soleH - 0.005, 0.009], [len + 0.009, 0.008, 0.006, 0.005]], { n: 3, seg: 26, rings: 44 }, mS, soleH);
  if (kind === 'sneaker') {
    part(upper, { n: 2.5, seg: 26, grow: 0.0025, u0: 5.3, u1: 9, rings: 26 }, mA, 0.03);                                // toe cap
    part(upper, { n: 2.5, seg: 26, grow: 0.002, u0: 0, u1: 2.2, rings: 16 }, mA, 0.03);                                 // heel counter
    for (let i = 0; i < 3; i++) add(grp, rbox(0.05 * k, 0.006, 0.008, 0.003, 2), M.get('sole'), [x, 0.073 - i * 0.008, z0 + 0.105 + i * 0.022], [-0.5, 0, 0]);
  }
  if (kind === 'loafer') add(grp, rbox(0.052 * k, 0.008, 0.02, 0.003, 2), M.get('topAcc'), [x, 0.058, z0 + 0.118], [-0.42, 0, 0]);
  if (kind !== 'loafer') add(grp, torus(0.041 * k, 0.006, 6, 20), kind === 'boot' ? mU : mA, [x, 0.03 + 0.064 * hi, z0 + 0.056], [PI / 2 + 0.08, 0, 0], [1, 1.15, 1]);
}

/* ---------------- the character ---------------- */
const HEIGHT = { f: 1.66, m: 1.74 };
function buildModelHuman(L, mats, renderer, o = {}) {
  const man = got('m'), pl = plan(L, man), tpl = template(pl.body, pl.b), S = shaped(tpl, L.build in R.BUILDS ? L.build : 'regular'), K = tpl.K;
  const lite = !!o.lite || small(), size = Math.min(lite ? 1024 : 2048, renderer.capabilities.maxTextureSize);
  const root = new T.Group(); root.name = 'root';
  const J = { root }, springs = [], extras = { flare: [], float: [] }, trash = [], own = g => { trash.push(g); return g; };   // trash: let go with the character
  const scaleG = new T.Group(); root.add(scaleG); J.scale = scaleG;
  const unit = new T.Group(); scaleG.add(unit); const scale = HEIGHT[pl.b.sex] / K.crown; unit.scale.setScalar(scale);
  const model = cloneSkinned(tpl.scene); unit.add(model);
  const bones = {}, meshes = {};
  model.traverse(n => { if (n.isBone) bones[n.name] = n; if (n.isSkinnedMesh) { meshes[n.name] = n; n.frustumCulled = false; n.castShadow = true; } });
  root.updateMatrixWorld(true);
  const rig = buildRig(unit, model, bones, J), body = meshes[tpl.names.body], eyes = meshes[tpl.names.eyes], brows = meshes[tpl.names.brows];
  const gloss = L.finish === 'gloss', suit = L.top.type === 'spacesuit';
  const col = (role, look) => R.roleColor(role, look);

  /* layers: pictures painted for this look, and the meshes that wear them */
  const P = painter(renderer), U = P.mat.uniforms, gm = garments(L, K, S.m);
  const target = () => { const t = new T.WebGLRenderTarget(size, size, { depthBuffer: false, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, colorSpace: T.SRGBColorSpace, anisotropy: 8 }); trash.push(t); return t; };
  const skinPic = picture(pl.b.tones[pl.tone], true, lite), ref = pl.b.ref[pl.tone];
  const rt = { skin: target(), bot: target(), top: target(), out: gm.out.on ? target() : null };
  const ns = S.soft > 8 ? 0.3 : S.soft ? 0.45 : 0.75;                 // the picture of the muscles follows the build
  body.geometry = S.geo;
  body.material = new T.MeshPhysicalMaterial({ map: rt.skin.texture, normalMap: pl.b.normal ? picture(pl.b.normal, false, lite) : null, roughnessMap: pl.b.rough ? picture(pl.b.rough, false, lite) : null,
    roughness: pl.b.rough ? 1 : 0.6, metalness: 0, alphaTest: 0.5, sheen: 0.4, sheenRoughness: 0.55, sheenColor: new T.Color('#ffb59a'), normalScale: new T.Vector2(ns, -ns) });
  const cloth = t => new T.MeshPhysicalMaterial({ map: t.texture, alphaTest: 0.5, side: T.DoubleSide, roughness: gloss ? 0.34 : 0.84, metalness: 0, sheen: gloss ? 0 : 0.5, sheenRoughness: 0.7, sheenColor: new T.Color('#8a8a8a'), clearcoat: gloss ? 0.5 : 0 });
  const under = new Float32Array(S.wp), specs = shellSpecs(tpl, S, gm);
  for (const k of ['bot', 'top', 'out']) {
    if (!specs[k] || !rt[k]) continue;
    const geo = shell(tpl, S, under, specs[k]); if (!geo) continue;
    const m = new T.SkinnedMesh(geo, cloth(rt[k])); m.name = k; m.castShadow = true; m.frustumCulled = false;
    body.parent.add(m); m.bind(body.skeleton, body.bindMatrix); trash.push(geo); meshes[k] = m;
  }
  /* eyes, brows, hair: the kit's own pieces, in the look's colours */
  const strands = n => new T.MeshStandardMaterial({ map: picture(man.textures['hair' + n], true, lite), normalMap: man.textures['hair' + n + 'n'] ? picture(man.textures['hair' + n + 'n'], false, lite) : null,
    normalScale: new T.Vector2(1, -1), roughness: 0.58, metalness: 0, side: T.DoubleSide });
  const eyeTex = new T.CanvasTexture(document.createElement('canvas')); eyeTex.flipY = false; eyeTex.colorSpace = T.SRGBColorSpace; trash.push(eyeTex);
  const eyeR = eyeTex.clone(); trash.push(eyeR); const eyeMat = t => new T.MeshPhysicalMaterial({ map: t, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 });
  if (eyes) { eyes.geometry = tpl.eyeGeo; eyes.material = [eyeMat(eyeTex), eyeMat(eyeR)]; eyes.castShadow = false; }
  const lidMat = new T.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
  const hairMat = pl.hair ? strands(pl.hair.tex) : null, browMat = brows && pl.b.brows ? strands(pl.b.brows) : null, beardMat = pl.beard ? strands(pl.beard.tex) : null;
  if (brows) { brows.material = browMat || mats.get('brow'); brows.castShadow = false; }
  // a piece modelled on one head, fitted to this one by the top of the head and the eyes
  const sk = K.sk, skC = new T.Vector3(0, K.eye.y, (sk.zf + sk.zb) / 2), skR = new T.Vector3(sk.rx, sk.top - K.eye.y, (sk.zf - sk.zb) / 2);    // the skull above the eyes
  const hatLine = { cap: 0.2, beanie: 0.22, hat: 0.5 }[L.head];        // from here up a hat presses the hair to the head
  const piece = (h, cut, lift = 1, flip = false) => {
    const src = man.bodies[h.on] || pl.b, s = (pl.b.crown - pl.b.eye[1]) / (src.crown - src.eye[1]), g = new T.Group(), obj = got('g:' + h.file).clone(true);
    g.add(obj); g.scale.set(flip ? -s : s, s * lift, s);
    g.position.set(0, pl.b.eye[1] - src.eye[1] * s * lift, pl.b.eye[2] - src.eye[2] * s);               // the model's own space
    if (cut || hatLine !== undefined) { g.updateMatrixWorld(true); obj.traverse(n => {
      if (!n.isMesh) return; const geo = n.geometry.clone(), p = geo.attributes.position, v = new T.Vector3(), back = new T.Matrix4().copy(n.matrixWorld).invert(); trash.push(geo);
      const low = K.eye.y - (cut || 0), up = K.eye.y + skR.y * (hatLine || 0);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld);
        if (cut && v.y < low) v.y = low - (low - v.y) * 0.12;                                           // a bob: the lengths end at the jaw
        if (hatLine !== undefined && v.y > up) { const e = Math.hypot((v.x - skC.x) / skR.x, (v.y - skC.y) / skR.y, (v.z - skC.z) / skR.z); if (e > 1.1) v.sub(skC).multiplyScalar(1.1 / e).add(skC); }
        v.applyMatrix4(back); p.setXYZ(i, v.x, v.y, v.z);
      }
      n.geometry = geo; }); }
    g.position.sub(rig.pos.head); J.head.add(g); return g;
  };
  const wear = (g, mat) => g.traverse(n => { if (n.isMesh) { n.material = mat; n.castShadow = true; } });
  // the head as the first characters' accessories know it: their skull, laid over this one
  const H = { c: new T.Vector3(0, 0.14, 0.012), r: new T.Vector3(0.138, 0.168, 0.156), jaw: { slim: -0.08, curvy: -0.14, broad: 0.3 }[L.build] || 0.04 };
  const sock = new T.Group(), fit = 1.05; J.head.add(sock);
  sock.scale.set(sk.rx / H.r.x * fit, (sk.top - K.eye.y) / H.r.y * fit, (sk.zf - sk.zb) / 2 / H.r.z * fit);
  sock.position.set(-rig.pos.head.x, K.eye.y - rig.pos.head.y - H.c.y * sock.scale.y, (sk.zf + sk.zb) / 2 - rig.pos.head.z - H.c.z * sock.scale.z);
  if (pl.hair) wear(piece(pl.hair, pl.hair.cut, pl.hair.lift, pl.hair.flip), hairMat);
  else if (L.hair.style !== 'none') R.human.buildHair(sock, H, mats, hatLine !== undefined && /spiky|mohawk/.test(L.hair.style) ? 'buzz' : L.hair.style, springs, L);   // spikes do not go through a hat
  if (pl.beard) wear(piece(pl.beard), beardMat);
  R.human.buildHeadAcc(sock, H, mats, L.head, springs);
  // glasses, shades and a visor sit on the model's own eyes
  if (L.face !== 'none') {
    const fg = new T.Group(); fg.position.copy(rig.pos.head).negate(); J.head.add(fg); const e = K.eye;
    if (L.face === 'visor') {
      const v = add(fg, sphere(1, 36, 10, PI / 2 - 1.35, 2.7, PI / 2 - 0.3, 0.5), mats.get('visor'), [0, e.y + 0.004, (sk.zf + sk.zb) / 2 + 0.004], null, [sk.rx * 1.2, (sk.top - e.y) * 1.2, (sk.zf - sk.zb) / 2 * 1.16], { noShadow: true }); v.renderOrder = 2;
    } else for (const s of [1, -1]) {
      const frame = L.face === 'glasses' ? mats.get('acc') : mats.get('black'), hold = new T.Group(); hold.position.set(e.x * s, e.y - 0.001, e.z + 0.014); hold.rotation.y = 0.1 * s; fg.add(hold);
      if (L.face === 'glasses') { add(hold, torus(0.0225, 0.0024, 6, 26), frame, null, null, [1.12, 0.92, 1], { noShadow: true }); add(hold, R.geo.circle(0.0215, 24), mats.get('glass'), null, null, [1.12, 0.92, 1], { noShadow: true }); }
      else add(hold, rbox(0.052, 0.036, 0.006, 0.013, 3), mats.get('lens'), null, null, null, { noShadow: true });
      add(fg, rbox(0.0026, 0.0036, 0.1, 0.001, 1), frame, [(e.x + 0.03) * s, e.y + 0.004, e.z - 0.04], [0, -0.12 * s, 0], null, { noShadow: true });
      if (s > 0) add(fg, rbox(Math.max(0.006, e.x * 2 - 0.048), 0.003, 0.003, 0.001, 1), frame, [0, e.y + 0.004, e.z + 0.016], null, null, { noShadow: true });
    }
  }

  /* shoes; a boot's shaft goes with the shin */
  // the foot is not drawn inside the shoe: up to a little under the shoe's collar (a boot's shaft reaches higher)
  const shoeKind = suit ? 'boot' : L.shoes.type, hide = shoeKind === 'boot' ? 0.085 : 0.03 + 0.066 * (shoeKind === 'loafer' ? 0.72 : 1) - 0.014 - K.ankleY;
  for (const s of [1, -1]) {
    const sd = s > 0 ? 'L' : 'R', g = new T.Group(); g.position.copy(rig.pos['ft' + sd]).negate(); J['ft' + sd].add(g); J['shoe' + sd] = g;
    buildShoe(g, s, K.foot, shoeKind, mats, suit, own);
    if (shoeKind === 'boot') {
      const sg = new T.Group(); sg.position.copy(rig.pos['shin' + sd]).negate(); J['shin' + sd].add(sg);
      const rows = [0.02, 0.05, 0.085, 0.115].map(h => { const y = K.ankleY + h, r = lerp(S.m.ankle, S.m.calf, h / 0.2) + 0.011; return [y, r, r * 1.05, r * 1.12, 0, 0, 2, r]; });
      const [cx, cz] = legAxis(K, K.ankleY + 0.06);
      add(sg, own(loft(rows, { seg: 22, cap: false })), suit ? mats.get('white') : mats.get('shoe'), [cx * s, 0, cz]).material.side = T.DoubleSide;
      add(sg, torus(rows[3][1] + 0.002, 0.006, 6, 22), suit ? mats.get('glow') : mats.get('sole'), [cx * s, rows[3][0], cz], [PI / 2, 0, 0], [1, 1.08, 1]);
    }
  }
  /* cloth that hangs free: a skirt, the skirt of a robe, coat tails */
  const hipG = new T.Group(); hipG.position.copy(rig.pos.hips).negate(); J.hips.add(hipG);                         // the model's own space, moving with the hips
  const ringAt = (y, k, add0) => { const q = S.girth(y), zc = (q.zf + q.zb) / 2; return [y, q.rx * k + add0, (q.zf - zc) * k + add0, (zc - q.zb) * k + add0, zc]; };
  const hang = (name, rows, mat, spring, o2) => { const y0 = rows[0][0], b = joint(hipG, name, [0, y0, 0]); const m = add(b, own(loft(rows.map(r => [r[0] - y0, ...r.slice(1)]), Object.assign({ cap: false, seg: 40, n: 2.1 }, o2))), mat); m.material.side = T.DoubleSide; springs.push(new R.Spring(b, spring)); return b; };
  const hipMax = (() => { const o = { rx: 0, zf: -9, zb: 9 }; for (let y = K.hipY - 0.14; y < K.hipY + 0.03; y += 0.02) { const q = S.girth(y); o.rx = Math.max(o.rx, q.rx); o.zf = Math.max(o.zf, q.zf); o.zb = Math.min(o.zb, q.zb); } return o; })();
  const wide = (y, k, e) => { const zc = (hipMax.zf + hipMax.zb) / 2; return [y, hipMax.rx * k + e, (hipMax.zf - zc) * k + e, (zc - hipMax.zb) * k + e, zc]; };       // around the widest of hips and thighs
  if (L.bottom.type === 'skirt' && !suit && L.top.type !== 'robe') {
    const end = lerp(K.hipY, K.ankleY, 0.4);
    const pd = (gm.out.on ? gm.out.thick : gm.top.thick) * 2 + 0.01;      // the top is tucked in: the skirt's waist goes around its cloth
    extras.flare.push(hang('skirt', [ringAt(K.beltY + 0.012, 1, pd), ringAt(K.beltY - 0.03, 1, pd + 0.002), wide(K.hipY - 0.04, 1, pd + 0.004), wide(lerp(K.hipY, end, 0.5), 1.1, pd + 0.012), wide(end, 1.22, pd + 0.02)], mats.get('bottom'), { k: 80, d: 8, g: 0.05, i: 0.004, lim: 0.25 }));
  }
  if (L.top.type === 'robe') {
    const b = hang('robe', [ringAt(K.beltY - 0.07, 1, 0.022), wide(K.hipY - 0.04, 1, 0.024), wide(lerp(K.hipY, K.ankleY, 0.45), 1.2, 0.03), wide(K.ankleY + 0.05, 1.55, 0.04)], mats.get('top'), { k: 70, d: 8, g: 0.1, i: 0.005, lim: 0.3 });
    const q = wide(K.ankleY + 0.05, 1.55, 0.04); add(b, torus(q[1], 0.011, 8, 40), mats.get('glow'), [0, K.ankleY + 0.054 - (K.beltY - 0.07), q[4]], [PI / 2, 0, 0], [1, (q[2] + q[3]) / 2 / q[1], 1], { noShadow: true });
    extras.flare.push(b);
  }
  if (L.top.type === 'coat') for (const s of [1, -1]) {
    // the skirt of the coat comes out from under its belt
    const pd = gm.out.thick + (L.bottom.type === 'skirt' ? 0.05 : 0.016), rows = [ringAt(K.waistY - 0.012, 1, pd), ringAt(lerp(K.waistY, K.hipY, 0.5), 1, pd + 0.004), wide(K.hipY - 0.04, 1, pd + 0.004), wide(lerp(K.hipY, K.kneeY, 0.5), 1.06, pd + 0.012), wide(K.kneeY - 0.02, 1.12, pd + 0.02)];
    hang('tail' + s, rows, mats.get('top'), { k: 60, d: 7, g: 0.2, i: 0.006, lim: 0.45, spin: 0.05 }, { phiStart: s > 0 ? 0.07 : PI, phiLen: PI - 0.07, seg: 24 });
  }
  /* details that stand off the cloth, and what is carried on the back: built on the chest joint in the first characters' measure */
  const ck = (K.nk.y - K.s3.y) / 0.215, chestG = new T.Group(); chestG.scale.setScalar(ck); J.chest.add(chestG);
  const pad = gm.out.on ? gm.out.thick + 0.006 : gm.top.thick + 0.003;
  const fz = y => (S.girth(K.s3.y + y * ck).zf + pad - K.s3.z) / ck, bz = y => (S.girth(K.s3.y + y * ck).zb - pad - K.s3.z) / ck;
  R.human.buildBack(chestG, L, mats, J, springs, fz, bz, Math.min(-0.05, bz(0.2) + 0.03));       // a cape hangs outside the cloth of the back
  if (L.top.type === 'hoodie') {
    const hood = add(chestG, sphere(0.14, 24, 14, 0, TAU, PI / 2 - 0.2, PI / 2 + 0.2), mats.get('top'), [0, 0.21, bz(0.2) + 0.04], [-0.5, 0, 0], [0.95, 0.72, 0.72]); hood.material.side = T.DoubleSide;
    for (const s of [1, -1]) { const st = joint(chestG, 'str' + s, [0.03 * s, 0.19, fz(0.19) + 0.004]); add(st, capsule(0.004, 0.09, 3, 6), mats.get('topAcc'), [0, -0.05, 0]); add(st, sphere(0.008), mats.get('metal'), [0, -0.1, 0]); springs.push(new R.Spring(st, { k: 90, d: 5, g: 0.8, i: 0.01, lim: 0.8 })); }
  }
  if (L.top.type === 'armor') {
    add(chestG, rbox(0.05, 0.05, 0.02, 0.012, 2), mats.get('glow'), [0, 0.09, fz(0.09) + 0.004], [-0.04, 0, 0], null, { noShadow: true });
    for (const s of [1, -1]) { const sd = s > 0 ? 'L' : 'R', r = S.m.arm * 1.5;
      add(J['ua' + sd], sphere(r, 22, 12, 0, TAU, 0, PI / 2), mats.get('topAcc'), [0.012 * s, 0.004, 0], [0, 0, -0.42 * s], [1.12, 0.74, 1.12]);
      add(J['ua' + sd], torus(r * 0.86, 0.005, 6, 20), mats.get('glow'), [0.03 * s, -0.012, 0], [PI / 2, -0.42 * s, 0], [1, 1.1, 1], { noShadow: true }); }
  }
  if (suit) {
    add(chestG, rbox(0.12, 0.08, 0.04, 0.014, 3), mats.get('white'), [0, 0.08, fz(0.08) + 0.004], [-0.02, 0, 0]);
    for (let i = 0; i < 3; i++) add(chestG, rbox(0.016, 0.03, 0.01, 0.004, 2), mats.get('glow'), [-0.03 + i * 0.03, 0.08, fz(0.08) + 0.026], null, null, { noShadow: true });
    add(chestG, rbox(0.26, 0.3, 0.12, 0.05, 3), mats.get('white'), [0, 0.07, bz(0.07) - 0.045]);
    add(chestG, cyl(0.02, 0.02, 0.2, 10), mats.get('grey'), [0.09, 0.1, bz(0.1) - 0.11]);
    const q = ringAt(K.beltY + 0.01, 1, 0.022); add(hipG, torus(q[1], 0.013, 8, 40), mats.get('glow'), [0, q[0], q[4]], [PI / 2, 0, 0], [1, (q[2] + q[3]) / 2 / q[1], 1], { noShadow: true });
  }
  /* relaxed hands */
  if (man.fist) for (const n in man.fist) if (bones[n]) bones[n].quaternion.slerp(new T.Quaternion().fromArray(man.fist[n]), n.startsWith('thumb') ? 0.17 : 0.34);

  /* colours: everything a new colour of the same outfit changes */
  const lin = (hex, k = 1) => new T.Color(hex).multiplyScalar(k);
  const apply = look => {
    const set = (u, g2, cols) => { const v = u.value; for (const k in v) if (!v[k].isColor) v[k] = g2[k] || 0; cols.forEach((c, i) => v['c' + i].set(c)); };
    const t = look.top.type, jk = gm.out.on && t !== 'armor';
    set(U.uTop, gm.top, jk ? [col('inner', look), R.shade(col('inner', look), -0.25), look.top.accent, '#f4f4ee'] : [look.top.color, col('topDark', look), look.top.accent, suit ? '#f2f2ec' : col('inner', look)]);
    set(U.uOut, gm.out, [look.top.color, col('topDark', look), look.top.accent, t === 'suit' ? '#f4f4ee' : look.glow]);
    set(U.uBot, gm.bot, [suit ? look.top.color : look.bottom.color, suit ? col('topDark', look) : col('bottomDark', look), look.top.accent]);
    U.uSkin.value = skinPic; U.uTone.value.set(look.skin); U.uRef.value.setRGB(ref[0], ref[1], ref[2], T.SRGBColorSpace);
    U.uUnder.value.set(R.shade(look.bottom.color, -0.45)); U.uTights.value.set(col('bottomDark', look)); U.uHair.value.set(R.shade(look.hair.color, -0.2));
    { const c = new T.Color(look.top.color); U.uOver.value.set(c.r, c.g, c.b, t === 'coat' ? K.kneeY - 0.03 : t === 'robe' ? K.ankleY + 0.04 : 99); }
    U.uOpt.value.set(look.legwear === 'tights' ? 1 : 0, look.facial === 'stubble' ? 0.5 : look.facial === 'beard' ? 0.62 : 0, hide, 0);
    U.uA.value.set(K.hipY, K.kneeY, K.ankleY, K.crotchY); U.uB.value.set(K.waistY, K.chestY, K.neckY, K.neckZ); U.uC.value.set(K.shX, K.elb.x, K.wristX, K.armY);
    U.uD.value.set(K.armZ, K.legX, K.legZ, K.torsoZ); U.uE.value.set(K.eye.y, K.chin, K.eye.z, K.crown);
    U.uH.value.set((K.sk.zf + K.sk.zb) / 2, K.sk.zf, look.hair.style === 'none' ? 0 : look.hair.style === 'buzz' ? 0.55 : 0.9, 0);
    U.uF.value.set(K.th.x, K.th.z, K.knee.x, K.knee.z); U.uG.value.set(K.ank.x, K.ank.z, K.knee.y, 0);
    paint(renderer, P, tpl.bake, rt.skin, 0, lin(look.skin));
    for (const [k, pass] of [['bot', 1], ['top', 2], ['out', 3]]) if (rt[k]) { U.uOpt.value.w = gm[k].form || 0; paint(renderer, P, tpl.bake, rt[k], pass, k === 'bot' ? U.uBot.value.c0 : k === 'top' ? U.uTop.value.c0 : U.uOut.value.c0); }
    // strands are painted light grey, to be tinted
    for (const [m, role, k] of [[hairMat, 'hair', 1.5], [beardMat, 'hair', 1.4], [browMat, 'brow', 1.3]]) if (m) m.color.set(col(role, look)).multiplyScalar(k);
    if (eyes) { eyeTex.image = eyeR.image = eyeCanvas(got('i:' + man.textures.eye), look.eyes); eyeTex.needsUpdate = eyeR.needsUpdate = true; lidMat.color.set(R.shade(look.skin, -0.16)); }
  };
  apply(L);
  // (the skeleton holds a texture of its bones: it goes with the character too)
  const dispose = () => { for (const t of trash) t.dispose(); body.skeleton.dispose(); for (const m of [body.material, eyes && eyes.material[0], eyes && eyes.material[1], lidMat, hairMat, browMat, beardMat, meshes.bot && meshes.bot.material, meshes.top && meshes.top.material, meshes.out && meshes.out.material]) if (m && m.dispose) m.dispose(); };
  /* The face: the mouth and brows of the model are still; the eyes look where the stage says (their picture slides on
     the eyeball) and blink (a lid of skin comes down over each). */
  const lids = [], lh = 0.0085;
  for (const s of [1, -1]) { const lid = add(J.head, sphere(1, 16, 10), lidMat, null, null, [0.0172, lh, 0.0075], { noShadow: true }); lid.userData.at = new T.Vector3(K.eye.x * s, K.eye.y + 0.0005, K.eye.z - 0.0045).sub(rig.pos.head); lid.visible = false; lids.push(lid); }
  const face = { eyes: [], want: {}, gaze: new T.Vector2(), sacc: new T.Vector2(), saccT: 1, blinkT: 2 + Math.random() * 2, blink: 0, shut: 0,
    set(e) { this.want = e || {}; },
    rest() { this.shut = 0; this.blink = 0; this.gaze.set(0, 0); this.show(); },
    show() {
      eyeTex.offset.set(-this.gaze.x, this.gaze.y); eyeR.offset.set(this.gaze.x, this.gaze.y);
      for (const lid of lids) { const k = this.shut; lid.visible = k > 0.05; lid.scale.y = lh * Math.max(k, 0.05); lid.position.copy(lid.userData.at); lid.position.y += lh * (1 - k) * 0.9; }
    },
    update(dt, lx, ly) {
      const e = this.want, k = 1 - Math.exp(-dt * 20);
      this.saccT -= dt; if (this.saccT <= 0) { this.sacc.set((Math.random() - 0.5) * 0.016, (Math.random() - 0.5) * 0.01); this.saccT = 0.5 + Math.random() * 1.8; }
      this.gaze.x = lerp(this.gaze.x, clamp(lx, -1, 1) * 0.036 + this.sacc.x, k); this.gaze.y = lerp(this.gaze.y, clamp(ly, -1, 1) * 0.024 + this.sacc.y + (e.eyesUp ? 0.03 : 0), k);
      this.blinkT -= dt; if (this.blinkT <= 0) { this.blink = 0.16; this.blinkT = Math.random() < 0.18 ? 0.25 : 2.2 + Math.random() * 3.2; }
      let lid = 0; if (this.blink > 0) { this.blink -= dt; lid = 1 - Math.abs((1 - this.blink / 0.16) * 2 - 1); }
      const held = e.eyes === 'closed' || e.eyes === 'happy' ? 1 : e.eyes === 'squint' ? 0.45 : 0;
      this.shut = Math.max(lid, lerp(this.shut, held, 1 - Math.exp(-dt * 16))); this.show();
    } };
  return { root, J, springs, extras, kind: 'human', H, face, model: true, apply, dispose, afterPose: rig.follow, stride: K.hipY * scale / 0.855, bones, meshes, layers: rt };
}
R.buildModelHuman = buildModelHuman;
})(window);
