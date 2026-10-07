/* Harvex — parametric humans ("sims"): one base body shaped by morph targets, with fitted hair, clothes and shoes.
   The files are in public/sim (made by scripts/build-sim-assets.mjs from the CC0 MakeHuman base mesh, targets, game
   rig and system assets). For a look this module
     - mixes the morph targets into the base mesh (sex, age, muscle, weight, height, ancestry, then the detail
       sliders of body and face): shape();
     - places the bones at the joints of that shape and binds the skin to them;
     - fits every worn piece to the shaped body (each of its vertices hangs on three body vertices), hides the skin
       a piece covers, and gives the pieces the body's bone weights;
     - keeps a few expression units as morphs on the graphics card (blink, smile, open mouth, brows), on the skin
       and on the pieces that sit on the face;
     - lays the stage's joints over the bones, so every motion of the stage drives the body (the rest pose has the
       arms out; "no joint turned" on the stage means arms hanging);
     - plays recorded clips (public/sim/clips.*, made by scripts/build-sim-clips.mjs from a CC0 animation library)
       for the motions listed in CLIP: standing, walking, talking, sitting down and so on are an animator's work, not
       a formula. A clip holds, per frame and bone, how far the bone is turned from its rest; it is laid over this
       body's bone after the bone is brought to where the library's bone points at rest. Motions without a clip
       keep the stage's own pose, and one fades into the other.
   On by default (R.sim.enabled); ?sim=0 in the address switches back to the earlier bodies in this browser, ?sim=1
   returns here.
   Androids and companions are not built here, and a human falls back to the earlier bodies when files fail. */
(function (G) {
'use strict';
const T = G.THREE, R = G.HARVEX;
const { clamp, lerp } = R.util;
const { sphere, torus, rbox } = R.geo;
const joint = R.joint, add = R.add, PI = Math.PI;

const S = R.sim = { base: '/sim/', enabled: true, failed: false, store: new Map() };
try {
  const q = typeof location !== 'undefined' ? location.search : '';
  if (/[?&]sim=0\b/.test(q)) localStorage.setItem('harvex-sim', '0'); else if (/[?&]sim=1\b/.test(q)) localStorage.removeItem('harvex-sim');
  S.enabled = localStorage.getItem('harvex-sim') !== '0';
} catch (e) { /* no storage: stays on */ }

/* ---------------- files ---------------- */
/* TWO PACKS of the same kind of files: the whole one under /sim/ and a light one under /sim/lite/ (user, 6 Oct
   2026: a live character on the home page, at a quarter of the weight). A look with `sim.lite` reads the light
   pack: only the pieces of the home page's cast, pictures at half size, no teeth and no normal maps, three clips,
   numbers stored as 16-bit integers (`q` in a file's meta gives the scale; unpack() turns them back), and NO shape
   targets: the body of each cast member is a finished shape of its own (`sim.baked` = its id, lite/shape/<id>),
   laid over the base mesh in one step. So a light character cannot be reshaped; the Studio never asks for one.
   Made by scripts/build-sim-lite.mjs. PK is the pack a call works in ('' or 'lite/'): it is part of every key and
   address, set at each way in (ready, ensure, build, apply), because both packs can be loaded in one visit. */
let PK = '';
const packOf = L => (L && L.sim && L.sim.lite ? 'lite/' : '');
function once(key, make) {
  key = PK + key;
  let p = S.store.get(key);
  if (!p) { p = make(); S.store.set(key, p); p.then(v => { p.value = v; }, () => { S.store.delete(key); }); }
  return p;
}
const got = key => { const p = S.store.get(PK + key); return p && p.value; };
const getJson = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
// .bin files are gzip streams
const inflate = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); });
const VIEW = { Float32: Float32Array, Uint16: Uint16Array, Uint8: Uint8Array, Int16: Int16Array };
function unpack(meta, buf) {
  const o = { meta }; for (const k in meta.sections) { const [t, off, len] = meta.sections[k]; o[k] = new VIEW[t](buf, off, len); }
  // the light pack stores some lists as steps from the entry `stride` places before (they pack far better): summed back here
  if (meta.dz) for (const k in meta.dz) if (o[k]) { const a = o[k], st = meta.dz[k]; for (let i = st; i < a.length; i++) a[i] += a[i - st]; }
  // the light pack stores these as integers: back to numbers once, here
  if (meta.q) for (const k in meta.q) if (o[k]) { const a = o[k], s = meta.q[k], f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] * s; o[k] = f; }
  return o;
}
const LOAD = {
  core: () => once('core', () => Promise.all([getJson(S.base + PK + 'core.json'), inflate(S.base + PK + 'core.bin'), getJson(S.base + PK + 'index.json')]).then(([m, b, ix]) => {
    const c = unpack(m, b); c.index = ix; c.target = {}; m.targets.forEach((t, i) => { c.target[t[0]] = i; }); return c; })),
  p: id => once('p:' + id, () => Promise.all([getJson(S.base + PK + 'p/' + id + '.json'), inflate(S.base + PK + 'p/' + id + '.bin')]).then(([m, b]) => unpack(m, b))),
  shape: id => once('shape:' + id, () => Promise.all([getJson(S.base + PK + 'shape/' + id + '.json'), inflate(S.base + PK + 'shape/' + id + '.bin')]).then(([m, b]) => unpack(m, b))),
  clips: () => once('clips', () => Promise.all([getJson(S.base + PK + 'clips.json'), inflate(S.base + PK + 'clips.bin')]).then(([m, b]) => { const c = unpack(m, b); c.bone = {}; m.bones.forEach((n, i) => { c.bone[n] = i; }); return c; })),
  i: name => once('i:' + name, () => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('sim picture ' + name)); i.src = S.base + PK + 'tex/' + name; })),
};
const TEX = new Map();
function picture(name, srgb) {
  let t = TEX.get(PK + name); if (t) return t;
  t = new T.Texture(got('i:' + name)); t.needsUpdate = true; t.flipY = false; t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.anisotropy = 8;
  TEX.set(PK + name, t); return t;
}
// the average colour of the opaque part of a picture (linear), to tint a hair picture to any colour
const AVG = new Map();
function average(name) {
  let a = AVG.get(PK + name); if (a) return a;
  const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(got('i:' + name), 0, 0, 24, 24);
  const d = g.getImageData(0, 0, 24, 24).data; let r = 0, gg = 0, b = 0, k = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; k++; }
  a = new T.Color().setRGB(r / (k || 1) / 255, gg / (k || 1) / 255, b / (k || 1) / 255, T.SRGBColorSpace); AVG.set(PK + name, a); return a;
}

/* ---------------- a look, as files and numbers ---------------- */
// build: [muscle, weight, cup]
const BUILD = { slim: [0.4, 0.36, 0.35], regular: [0.5, 0.5, 0.5], curvy: [0.42, 0.66, 0.72], broad: [0.86, 0.56, 0.5] };
const HAIR = { short: 'short02', swept: 'short04', buzz: 'short01', spiky: 'short01', curly: 'afro01', afro: 'afro01', bob: 'long01', long: 'long01', ponytail: 'ponytail01', twintails: 'braid01', bun: 'ponytail01', mohawk: 'short04' };
const OUTFIT = {
  m: { tee: 'male_casualsuit04', tank: 'male_casualsuit06', sweater: 'male_casualsuit02', hoodie: 'male_casualsuit02', tracksuit: 'male_casualsuit02', bomber: 'male_casualsuit05', jacket: 'male_casualsuit05', suit: 'male_elegantsuit01', coat: 'male_casualsuit05', robe: 'male_casualsuit03', armor: 'male_worksuit01', spacesuit: 'male_worksuit01' },
  f: { tee: 'female_casualsuit01', tank: 'female_sportsuit01', sweater: 'female_casualsuit01', hoodie: 'female_casualsuit01', tracksuit: 'female_sportsuit01', bomber: 'female_casualsuit01', jacket: 'female_elegantsuit01', suit: 'female_elegantsuit01', coat: 'female_elegantsuit01', robe: 'female_elegantsuit01', armor: 'female_sportsuit01', spacesuit: 'female_sportsuit01' },
};
const SHOES = { m: { sneaker: 'shoes06', boot: 'shoes03', loafer: 'shoes01' }, f: { sneaker: 'shoes05', boot: 'shoes03', loafer: 'shoes04' } };
const EYES = { brown: '#5a3a22', brownlight: '#8a6a3a', blue: '#3a6ea8', lightblue: '#7fb2e0', deepblue: '#1f3f7a', bluegreen: '#3a8a8a', green: '#3f7a4a', grey: '#7a8088', ice: '#b0c4d0' };
// The house style: the base mesh is a realistic adult; the studio's people are drawn like game characters. So every
// face starts with a larger head on a slimmer neck, larger and more open eyes, a smaller nose, fuller lips and a
// softer jaw. A look's own sliders are added on top, so 0 in the editor means "as the studio draws it".
// (user, 6 Oct 2026, with a picture of a life-sim game's character: "make the 3D character like this": a big head,
// big eyes, a young smooth face, simple features. So the face is also made younger (headAge) and rounder, and the
// whole head is drawn larger than the body it stands on: HEAD_SCALE, on the head bone.)
const STYLE = { headWidth: 0.35, headHeight: 0.3, headDepth: 0.3, headAge: -0.7, faceFat: 0.12, neck: -0.3, eyeSize: 1.3, eyeOpen: 0.08, eyeSpace: 0.1, noseWidth: -0.3, noseLength: -0.25, noseDepth: -0.15,
  lipUpper: 0.25, lipLower: 0.25, mouthWidth: -0.1, jaw: -0.25, chinWidth: -0.15, cheeks: 0.2, shoulders: -0.15 };
const STYLE_SHAPES = { round: 0.2 }, HEAD_SCALE = 1.15;
// a hat presses the hair to the head from this share of the skull's height up (the eyes = 0, the crown = 1)
const HAT_LINE = { cap: 0.2, beanie: 0.22, hat: 0.5, helmet: 0.1 };
// The clip a motion of the stage plays on these bodies: one clip, or a way in followed by a loop.
// (Idle has no clip any more: the library's idle is a game's ready stance, and on these bodies it leaned the torso back
// and held the arms out, which read as stiff. Idle is the stage's own relaxed stance, see e4-motion.js.)
const CLIP = { Walk: ['walk'], Run: ['jog'], Dance: ['dance'], Jump: ['jump'], Chat: ['chat'], Sit: ['sitDown', 'sit'], Crouch: ['crouch'], Pickup: ['pickup'], Use: ['use'], Tinker: ['tinker'], Cast: ['cast'] };
S.CLIP = CLIP;
// How much of a clip each part of the body takes (1 where nothing is said). The library's standing clips are a
// game's ready stance: feet wide, fists closed. A person standing around keeps the stage's own relaxed legs and open
// hands, and only part of the raised arms; the breathing, the sway and the talking hands come from the clip.
const CLIP_PART = { Chat: { legs: 0 } };
const CLOTH_LO = new T.Color('#1c1f24'), CLOTH_HI = new T.Color('#e9ecef');
// fingers at rest are a little closed, more towards the little finger (the mesh's own rest is a flat, spread hand)
const CURL = { index: 0.22, middle: 0.27, ring: 0.32, pinky: 0.36, thumb: 0.1 }, CURL_AT = [0.9, 1.25, 0.85];
const partOf = n => /^(pelvis|thigh|calf|foot|ball)/.test(n) ? 'legs' : /^(index|middle|ring|pinky|thumb)/.test(n) ? 'fingers' : /^(clavicle|upperarm|lowerarm|hand)/.test(n) ? 'arms' : 'body';
const UNITS = ['eye-left-closure', 'eye-right-closure', 'eye-left-slit', 'eye-right-slit', 'eye-left-opened-up', 'eye-right-opened-up', 'mouth-corner-puller', 'mouth-open', 'eyebrows-left-up', 'eyebrows-right-up', 'eyebrows-left-down', 'eyebrows-right-down'];
const U = {}; UNITS.forEach((n, i) => { U[n] = i; });
const near = (hex, table) => { const c = new T.Color(hex); let best = null, d = 9; for (const k in table) { const t = new T.Color(table[k]), x = (c.r - t.r) ** 2 + (c.g - t.g) ** 2 + (c.b - t.b) ** 2; if (x < d) { d = x; best = k; } } return best; };

function plan(L, core) {
  const male = L.body !== 'feminine', sx = male ? 'm' : 'f', b = BUILD[L.build] || BUILD.regular, sim = L.sim || {}, ix = core.index;
  const num = (v, d) => typeof v === 'number' && isFinite(v) ? clamp(v, 0, 1) : d;
  // the skin picture closest to the tone (same sex, young), and the ancestry that goes with it
  const tone = new T.Color(L.skin), lum = c => c.r * 0.3 + c.g * 0.59 + c.b * 0.11; let skin = null, sd = 9;
  for (const eth of ['caucasian', 'asian', 'african']) { const n = `young_${eth}_${male ? 'male' : 'female'}`, s = ix.skins[n]; if (!s) continue;
    const d = Math.abs(lum(new T.Color().setRGB(s.ref[0], s.ref[1], s.ref[2], T.SRGBColorSpace)) - lum(tone)); if (d < sd) { sd = d; skin = { name: n, eth, file: s.file, ref: s.ref }; } }
  const anc = { african: 0.2, asian: 0.2, caucasian: 0.2 }; if (skin) anc[skin.eth] = 0.6;
  const params = { sex: num(sim.sex, male ? 1 : 0), age: num(sim.age, 0), muscle: num(sim.muscle, b[0]), weight: num(sim.weight, b[1]), cup: num(sim.cup, b[2]), height: num(sim.height, 0.5), ancestry: sim.ancestry || anc, sliders: sim.sliders || {}, shapes: sim.shapes || {}, baked: sim.lite && typeof sim.baked === 'string' ? sim.baked : '' };
  const has = (kind, n) => !!(n && ix.pieces[kind] && ix.pieces[kind][n]);
  const pieces = []; const wear = (slot, kind, n) => { if (has(kind, n)) pieces.push({ slot, kind, name: n, id: kind + '/' + n }); };
  wear('eyes', 'eyes', 'high'); wear('teeth', 'teeth', 'base');
  wear('brows', 'brows', sim.brows || (male ? 'eyebrow009' : 'eyebrow006')); wear('lashes', 'lashes', sim.lashes || 'eyelashes01');   // women: a thin arched brow and light lashes (the heavy pair, 008 + 02, drew a stern stare)
  if (L.hair.style !== 'none') wear('hair', 'hair', sim.hair || HAIR[L.hair.style] || 'short02');
  wear('outfit', 'outfit', sim.outfit || (L.bottom.type === 'shorts' && !male ? 'female_casualsuit02' : OUTFIT[sx][L.top.type]) || OUTFIT[sx].tee);
  wear('shoes', 'shoes', sim.shoes || SHOES[sx][L.shoes.type] || SHOES[sx].sneaker);
  if (L.head === 'hat') wear('hat', 'hat', 'fedora01');
  const eye = ix.eyes[near(L.eyes, EYES)] || ix.eyes.brown;
  return { params, skin, eye, pieces, male };
}
S.wants = (L, renderer) => S.enabled && !S.failed && typeof DecompressionStream !== 'undefined' && L.kind === 'human' && L.headStyle !== 'screen' && (!renderer || renderer.capabilities.isWebGL2);
S.ready = L => { PK = packOf(L); const core = got('core'); if (!core) return false; const pl = plan(L, core);
  if (pl.params.baked && !got('shape:' + pl.params.baked)) return false;
  return pl.pieces.every(p => { const m = got('p:' + p.id); return m && Object.values(m.meta.tex).every(t => !t || got('i:' + t)); }) && !!got('i:' + pl.skin.file) && !!got('i:' + pl.eye); };
// (the clips are asked for with the first body; a body is built without them when they cannot be read)
S.ensure = L => { const pk = PK = packOf(L); return LOAD.core().then(core => { PK = pk; const pl = plan(L, core);
  return Promise.all([LOAD.clips().catch(() => null), pl.params.baked ? LOAD.shape(pl.params.baked) : null, LOAD.i(pl.skin.file), LOAD.i(pl.eye),
    ...pl.pieces.map(p => LOAD.p(p.id).then(m => { PK = pk; return Promise.all(Object.values(m.meta.tex).filter(Boolean).map(t => LOAD.i(t))); }))]); }); };
/** The finished shape of a look as the light pack stores it: every vertex's distance from the base mesh (whole pack
    only; scripts/build-sim-lite.mjs asks for it through the page), and the files the look needs. */
S.bake = L => { PK = ''; const core = got('core'); if (!core) throw new Error('load the look first (R.sim.ensure)'); const pl = plan(L, core), P = shape(core, pl.params), d = new Float32Array(P.length);
  for (let i = 0; i < P.length; i++) d[i] = P[i] - core.pos[i];
  return { delta: d, pieces: pl.pieces.map(p => p.id), skin: pl.skin.name, eye: pl.eye }; };

/* ---------------- shape ---------------- */
function shape(core, p) {
  const P = new Float32Array(core.pos), I = core.tIdx, D = core.tDel, TG = core.meta.targets;
  if (p.baked) { const b = got('shape:' + p.baked); if (b) { const d = b.d; for (let i = 0; i < P.length; i++) P[i] += d[i]; return P; } }   // the light pack: a finished shape (already standing on the ground)
  const put = (ti, w) => { const t = TG[ti], k = t[3] * w; for (let i = t[1], e = t[1] + t[2]; i < e; i++) { const v = I[i] * 3, d = i * 3; P[v] += D[d] * k; P[v + 1] += D[d + 1] * k; P[v + 2] += D[d + 2] * k; } };
  const tri = v => [Math.max(0, 1 - 2 * v), Math.max(0, 2 * v - 1)], m = tri(p.muscle), w = tri(p.weight), h = tri(p.height), c = tri(p.cup), a = p.ancestry, as = (a.african + a.asian + a.caucasian) || 1;
  const f = { female: 1 - p.sex, male: p.sex, young: 1 - p.age, old: p.age, minmuscle: m[0], maxmuscle: m[1], averagemuscle: 1 - m[0] - m[1], minweight: w[0], maxweight: w[1], averageweight: 1 - w[0] - w[1],
    minheight: h[0], maxheight: h[1], mincup: c[0], maxcup: c[1], african: a.african / as, asian: a.asian / as, caucasian: a.caucasian / as };
  for (const mc of core.meta.macro) { let x = 1; for (const n of mc.f) x *= f[n]; if (x > 1e-4) put(mc.t, x); }
  for (const s of core.meta.sliders) { const v = clamp((STYLE[s.id] || 0) + (+p.sliders[s.id] || 0), -1.5, 1.5); if (v < 0) s.neg.forEach(t => put(t, -v)); else if (v > 0) s.pos.forEach(t => put(t, v)); }
  for (const k in core.meta.shapes) { const v = clamp((STYLE_SHAPES[k] || 0) + (+p.shapes[k] || 0), 0, 1); if (v > 0) put(core.meta.shapes[k], v); }
  // stand on the ground
  const g = core.meta.joints['joint-ground']; let gy = 0; for (const v of g) gy += P[v * 3 + 1]; gy /= g.length;
  for (let i = 1; i < P.length; i += 3) P[i] -= gy;
  return P;
}
const mean = (P, list, out) => { let x = 0, y = 0, z = 0; for (const v of list) { x += P[v * 3]; y += P[v * 3 + 1]; z += P[v * 3 + 2]; } return out.set(x / list.length, y / list.length, z / list.length); };
// one expression unit laid on the shape and taken off again around `fn`
function withUnit(core, P, name, fn) {
  const t = core.meta.targets[core.meta.units[name]], I = core.tIdx, D = core.tDel;
  const go = k => { for (let i = t[1], e = t[1] + t[2]; i < e; i++) { const v = I[i] * 3, d = i * 3; P[v] += D[d] * k; P[v + 1] += D[d + 1] * k; P[v + 2] += D[d + 2] * k; } };
  go(t[3]); fn(); go(-t[3]);
}
// where a piece's vertices are on a shape (the .mhclo rule: three body vertices, weights, an offset in the piece's own scale)
function fit(pc, P, out) {
  const { ref, w, off } = pc, n = pc.meta.n, sc = pc.meta.scale, k = [0.1, 0.1, 0.1];
  ['x', 'y', 'z'].forEach((ax, i) => { const s = sc[ax]; if (s) k[i] = Math.abs(P[s[0] * 3 + i] - P[s[1] * 3 + i]) / s[2]; });
  for (let i = 0; i < n; i++) {
    const j = i * 3, a = ref[j] * 3, b = ref[j + 1] * 3, c = ref[j + 2] * 3, wa = w[j], wb = w[j + 1], wc = w[j + 2];
    out[j] = P[a] * wa + P[b] * wb + P[c] * wc + off[j] * k[0];
    out[j + 1] = P[a + 1] * wa + P[b + 1] * wb + P[c + 1] * wc + off[j + 1] * k[1];
    out[j + 2] = P[a + 2] * wa + P[b + 2] * wb + P[c + 2] * wc + off[j + 2] * k[2];
  }
  return out;
}
// smooth normals: summed per base vertex (so a UV seam does not show), then handed to the render vertices
function normals(V, rv, idx, out) {
  const N = new Float32Array(V.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = rv[idx[i]] * 3, b = rv[idx[i + 1]] * 3, c = rv[idx[i + 2]] * 3;
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    N[a] += nx; N[a + 1] += ny; N[a + 2] += nz; N[b] += nx; N[b + 1] += ny; N[b + 2] += nz; N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
  }
  for (let i = 0; i < rv.length; i++) { const s = rv[i] * 3, l = Math.hypot(N[s], N[s + 1], N[s + 2]) || 1; out[i * 3] = N[s] / l; out[i * 3 + 1] = N[s + 1] / l; out[i * 3 + 2] = N[s + 2] / l; }
  return out;
}
const spread = (V, rv, out) => { for (let i = 0; i < rv.length; i++) { const s = rv[i] * 3; out[i * 3] = V[s]; out[i * 3 + 1] = V[s + 1]; out[i * 3 + 2] = V[s + 2]; } return out; };
// bone weights of a piece: those of the body vertices each of its vertices hangs on (worked out once per piece)
function pieceSkin(pc, core) {
  if (pc.skin) return pc.skin;
  const n = pc.meta.n, I = new Uint16Array(n * 4), W = new Float32Array(n * 4), acc = new Map();
  for (let i = 0; i < n; i++) {
    acc.clear();
    for (let k = 0; k < 3; k++) { const r = pc.ref[i * 3 + k] * 4, wk = Math.max(0, pc.w[i * 3 + k]); if (!wk) continue; for (let j = 0; j < 4; j++) { const x = core.skinW[r + j] * wk; if (x > 0) acc.set(core.skinI[r + j], (acc.get(core.skinI[r + j]) || 0) + x); } }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((s, x) => s + x[1], 0) || 1;
    top.forEach(([b, x], k) => { I[i * 4 + k] = b; W[i * 4 + k] = x / sum; });
  }
  const rv = pc.v, ri = new Uint16Array(rv.length * 4), rw = new Float32Array(rv.length * 4);
  for (let i = 0; i < rv.length; i++) for (let k = 0; k < 4; k++) { ri[i * 4 + k] = I[rv[i] * 4 + k]; rw[i * 4 + k] = W[rv[i] * 4 + k]; }
  return pc.skin = { i: ri, w: rw };
}

/* ---------------- the rig: the stage's joints, laid over the bones ---------------- */
const RIG = [['hips', 'pelvis', null], ['spine', 'spine_01', 'hips'], ['chest', 'spine_03', 'spine'], ['neck', 'neck_01', 'chest'], ['head', 'head', 'neck'],
  ['clL', 'clavicle_l', 'chest'], ['uaL', 'upperarm_l', 'clL'], ['faL', 'lowerarm_l', 'uaL'], ['haL', 'hand_l', 'faL'],
  ['clR', 'clavicle_r', 'chest'], ['uaR', 'upperarm_r', 'clR'], ['faR', 'lowerarm_r', 'uaR'], ['haR', 'hand_r', 'faR'],
  ['thL', 'thigh_l', 'hips'], ['shinL', 'calf_l', 'thL'], ['ftL', 'foot_l', 'shinL'], ['thR', 'thigh_r', 'hips'], ['shinR', 'calf_r', 'thR'], ['ftR', 'foot_r', 'shinR']];
// limbs that hang straight down when no joint of the stage is turned (the model rests with arms out and legs apart)
const HANG = /^(upperarm|lowerarm|hand|thigh|calf|foot)_(l|r)$/, DOWN = new T.Vector3(0, -1, 0);

/* ---------------- one character ---------------- */
function buildSimHuman(L, mats, renderer, o = {}) {
  const pk = PK = packOf(L);
  const core = got('core'), pl = plan(L, core), meta = core.meta;
  const root = new T.Group(); root.name = 'root';
  const J = { root }, trash = [], own = x => { trash.push(x); return x; };
  const scaleG = new T.Group(); root.add(scaleG); J.scale = scaleG;
  const unit = new T.Group(); scaleG.add(unit);
  const model = new T.Group(); unit.add(model);

  // bones: one per rig bone, unturned at rest, placed by reshape()
  const bones = meta.bones.map(b => { const x = new T.Bone(); x.name = b.name; return x; }), byName = {};
  meta.bones.forEach((b, i) => { byName[b.name] = bones[i]; if (b.parent >= 0) bones[b.parent].add(bones[i]); else model.add(bones[i]); });
  const heads = bones.map(() => new T.Vector3()), skeleton = new T.Skeleton(bones, bones.map(() => new T.Matrix4()));
  const ID = new T.Matrix4();
  const skinned = (geo, mat, name) => { const m = new T.SkinnedMesh(geo, mat); m.name = name; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = !/^(brows|lashes|teeth)$/.test(name); model.add(m); m.bind(skeleton, ID); return m; };

  /* the skin */
  const nR = core.bodyV.length, bodyGeo = own(new T.BufferGeometry());
  const bPos = new T.BufferAttribute(new Float32Array(nR * 3), 3), bNor = new T.BufferAttribute(new Float32Array(nR * 3), 3);
  bodyGeo.setAttribute('position', bPos); bodyGeo.setAttribute('normal', bNor); bodyGeo.setAttribute('uv', new T.BufferAttribute(core.bodyUV, 2));
  { const si = new Uint16Array(nR * 4), sw = new Float32Array(nR * 4); for (let i = 0; i < nR; i++) for (let k = 0; k < 4; k++) { si[i * 4 + k] = core.skinI[core.bodyV[i] * 4 + k]; sw[i * 4 + k] = core.skinW[core.bodyV[i] * 4 + k] / 255; }
    bodyGeo.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); bodyGeo.setAttribute('skinWeight', new T.BufferAttribute(sw, 4)); }
  bodyGeo.morphTargetsRelative = true; bodyGeo.morphAttributes.position = UNITS.map(() => new T.BufferAttribute(new Float32Array(nR * 3), 3));
  // skin a worn piece covers is not drawn (a triangle goes when all its corners are covered)
  { const hide = new Uint8Array(meta.nV); for (const p of pl.pieces) for (const [a, b] of got('p:' + p.id).meta.del) hide.fill(1, a, b + 1);
    const src = core.bodyIdx, keep = []; for (let i = 0; i < src.length; i += 3) { if (hide[core.bodyV[src[i]]] && hide[core.bodyV[src[i + 1]]] && hide[core.bodyV[src[i + 2]]]) continue; keep.push(src[i], src[i + 1], src[i + 2]); }
    bodyGeo.setIndex(new T.BufferAttribute(new Uint16Array(keep), 1)); }
  const skinMat = own(new T.MeshPhysicalMaterial({ map: picture(pl.skin.file, true), roughness: 0.64, metalness: 0, sheen: 0.4, sheenRoughness: 0.55, sheenColor: new T.Color('#ffb59a'), emissive: new T.Color('#000000') }));
  const body = skinned(bodyGeo, skinMat, 'skin'); body.morphTargetInfluences = UNITS.map(() => 0);
  const faceMeshes = [body];

  /* the pieces */
  const meshes = { skin: body }, worn = [];
  for (const p of pl.pieces) {
    const pc = got('p:' + p.id), n = pc.meta.n, nr = pc.v.length, geo = own(new T.BufferGeometry());
    const w = { p, pc, V: new Float32Array(n * 3), tmp: new Float32Array(n * 3), pos: new T.BufferAttribute(new Float32Array(nr * 3), 3), nor: new T.BufferAttribute(new Float32Array(nr * 3), 3), geo, onFace: /^(brows|lashes|teeth)$/.test(p.slot) };
    geo.setAttribute('position', w.pos); geo.setAttribute('normal', w.nor); geo.setAttribute('uv', new T.BufferAttribute(pc.uv, 2)); geo.setIndex(new T.BufferAttribute(pc.idx, 1));
    const tx = pc.meta.tex, map = tx.map ? picture(tx.map, true) : null, nm = tx.normal ? picture(tx.normal, false) : null;
    if (p.slot === 'eyes') {
      // two eyeballs, each a mesh of its own on the head bone so it can turn; sorted by side below, in reshape()
      // the eye picture is clear where the outer shell (the cornea) lies over the eyeball: those pixels are not drawn
      w.mat = own(new T.MeshPhysicalMaterial({ map: picture(pl.eye, true), alphaTest: 0.5, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }));
      w.eyes = [-1, 1].map(side => { const g2 = own(new T.BufferGeometry()), e = { side, geo: g2, tri: null, mesh: new T.Mesh(g2, w.mat), at: new T.Vector3() }; e.mesh.frustumCulled = false; byName.head.add(e.mesh); return e; });
    } else {
      const hairy = p.slot === 'hair' || p.slot === 'brows' || p.slot === 'lashes';
      w.mat = own(hairy
        ? new T.MeshStandardMaterial({ map, roughness: 0.72, metalness: 0, alphaTest: p.slot === 'hair' ? 0.5 : 0.2, side: T.DoubleSide, alphaToCoverage: true })
        : p.slot === 'shoes'
          ? new T.MeshPhysicalMaterial({ map, normalMap: nm, normalScale: new T.Vector2(0.6, 0.6), roughness: 0.38, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35, side: T.DoubleSide, alphaTest: pc.meta.alpha ? 0.5 : 0 })
          : new T.MeshPhysicalMaterial({ map, normalMap: nm, normalScale: new T.Vector2(0.6, 0.6), roughness: 0.86, metalness: 0, sheen: 0.2, sheenRoughness: 0.8, sheenColor: new T.Color('#b9bec6'), side: T.DoubleSide, alphaTest: pc.meta.alpha ? 0.5 : 0 }));
      // cloth that takes the look's colours: the picture holds neutral shading where the tint picture says so
      // (red = the top's cloth, green = the bottom's), and that shading is multiplied by the colour
      if (!hairy && tx.tint) {
        const u = w.tint = { tintMap: { value: picture(tx.tint, false) }, cTop: { value: new T.Color() }, cBot: { value: new T.Color() } };
        w.mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
          sh.fragmentShader = sh.fragmentShader.replace('uniform vec3 diffuse;', 'uniform vec3 diffuse;\nuniform sampler2D tintMap;\nuniform vec3 cTop;\nuniform vec3 cBot;')
            .replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n vec3 simTint = texture2D( tintMap, vMapUv ).rgb;\n vec3 simShade = sampledDiffuseColor.rgb * 2.0;\n sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, simShade * cTop, simTint.r );\n sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, simShade * cBot, simTint.g );\n diffuseColor *= sampledDiffuseColor;\n#endif'); };
        w.mat.customProgramCacheKey = () => 'sim-tint-' + p.slot;
      }
      const sk = pieceSkin(pc, core); geo.setAttribute('skinIndex', new T.BufferAttribute(sk.i, 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(sk.w, 4));
      if (w.onFace) { geo.morphTargetsRelative = true; geo.morphAttributes.position = UNITS.map(() => new T.BufferAttribute(new Float32Array(nr * 3), 3)); }
      w.mesh = skinned(geo, w.mat, p.slot); if (w.onFace) { w.mesh.morphTargetInfluences = UNITS.map(() => 0); faceMeshes.push(w.mesh); }
      meshes[p.slot] = w.mesh;
    }
    worn.push(w);
  }

  /* the stage's joints */
  for (const [jn, , pj] of RIG) joint(pj ? J[pj] : unit, jn, null, J);
  // what the first characters wear on the head and the back is built in their measure, in two holders that
  // reshape() lays over this head and this chest
  const H = { c: new T.Vector3(0, 0.14, 0.012), r: new T.Vector3(0.138, 0.168, 0.156), jaw: 0.04 };
  // (they hang on the bones, not on the stage's joints: a clip moves the bones only)
  const sock = new T.Group(), faceG = new T.Group(), chestG = new T.Group(); byName.head.add(sock); byName.head.add(faceG); byName.spine_03.add(chestG);
  /* clips: the bones they move (in the clip set's order, parents first), each one's parent among them, and the
     turn that brings this body's bone from its own rest to where the library's bone points at rest */
  const clips = got('clips') || null, CB = [];
  if (clips) {
    const bi = n => meta.bones.findIndex(b => b.name === n), mean0 = list => { let x = 0; for (const v of list) x += core.pos[v * 3]; return x / list.length; };
    // the library's left may be this rig's right
    const swap = (mean0(meta.bones[bi('thigh_l')].head) > 0) !== clips.meta.leftIsPlusX, mine = n => swap ? n.replace(/_(l|r)$/, (m, s) => s === 'l' ? '_r' : '_l') : n;
    const inRig = new Set(RIG.map(r => r[1]));
    // a finger bone's resting turn: about the front-to-back axis (the arm lies in the side-to-side plane at rest), the
    // way round that closes the hand on its side of the body
    const curlOf = b => { const m = /^(index|middle|ring|pinky|thumb)_0([123])_/.exec(b.name); if (!m) return null;
      const a = CURL[m[1]] * CURL_AT[m[2] - 1] * (mean0(b.head) > 0 ? -1 : 1); return new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), a); };
    clips.meta.bones.forEach((n, k) => { const i = bi(mine(n)); let p = meta.bones[i].parent, par = -1;
      while (p >= 0 && par < 0) { par = CB.findIndex(c => c.i === p); p = meta.bones[p].parent; }
      CB.push({ k, i, bone: bones[i], par, rig: inRig.has(meta.bones[i].name), part: partOf(meta.bones[i].name), curl: curlOf(meta.bones[i]), right: /_r$/.test(meta.bones[i].name) ? 1 : 0, proc: new T.Quaternion(), fix: new T.Quaternion(), W: new T.Quaternion(), tgt: new T.Quaternion(), last: new T.Quaternion(), from: new T.Quaternion(), dir: new T.Vector3().fromArray(clips.meta.dirs[k]) }); });
  }
  let marker = null;                       // made after the first apply(), which already asks for it
  const pelvis = byName.pelvis, hipRest = new T.Vector3(), hipTgt = new T.Vector3(), hipFrom = new T.Vector3(), hipLast = new T.Vector3();
  // a seat that comes up when the character sits down
  const seat = new T.Mesh(own(new T.BoxGeometry(0.44, 1, 0.44)), own(new T.MeshStandardMaterial({ color: '#ffe600', roughness: 0.7 }))); seat.visible = false; seat.castShadow = true; unit.add(seat);
  const headBone = meta.bones.findIndex(b => b.name === 'head'), hatLine = HAT_LINE[L.head];
  let shapeP = null;
  // the front and the back of the trunk at a height (the arms are out at rest, so a narrow column is the trunk)
  const trunk = y => { let zf = -9, zb = 9; const P = shapeP; for (let i = 0; i < core.bodyV.length; i++) { const v = core.bodyV[i] * 3; if (Math.abs(P[v]) < 0.1 && Math.abs(P[v + 1] - y) < 0.025) { if (P[v + 2] > zf) zf = P[v + 2]; if (P[v + 2] < zb) zb = P[v + 2]; } } return { zf, zb }; };
  const rest = {}, boneOf = {}, K = { hipY: 0.9, crown: 1.7, eyeL: new T.Vector3(), eyeR: new T.Vector3(), eye: new T.Vector3(), sk: { rx: 0.08, top: 1.7, zf: 0.1, zb: -0.1 } };
  for (const [jn, bn] of RIG) { rest[bn] = new T.Quaternion(); boneOf[jn] = bn; }

  /* everything that follows the shape */
  let shapeKey = '';
  const tmpV = new T.Vector3(), tmpA = new T.Vector3();
  function reshape(look) {
    const p = plan(look, core).params, key = JSON.stringify(p); if (key === shapeKey) return; shapeKey = key;
    const P = shapeP = shape(core, p);
    // bones
    meta.bones.forEach((b, i) => { mean(P, b.head, heads[i]); });
    meta.bones.forEach((b, i) => { bones[i].position.copy(heads[i]); if (b.parent >= 0) bones[i].position.sub(heads[b.parent]); skeleton.boneInverses[i].makeTranslation(-heads[i].x, -heads[i].y, -heads[i].z); });
    // skin
    spread(P, core.bodyV, bPos.array); normals(P, core.bodyV, core.bodyIdx, bNor.array); bPos.needsUpdate = bNor.needsUpdate = true;
    UNITS.forEach((u, k) => { const a = bodyGeo.morphAttributes.position[k], A = a.array; A.fill(0);
      const t = meta.targets[meta.units[u]], s = t[3], hit = new Map(); for (let i = t[1], e = t[1] + t[2]; i < e; i++) hit.set(core.tIdx[i], i * 3);
      for (let i = 0; i < nR; i++) { const d = hit.get(core.bodyV[i]); if (d !== undefined) { A[i * 3] = core.tDel[d] * s; A[i * 3 + 1] = core.tDel[d + 1] * s; A[i * 3 + 2] = core.tDel[d + 2] * s; } }
      a.needsUpdate = true; });
    bodyGeo.computeBoundingSphere();
    // the eyes and the skull above them: where hats, glasses and pressed hair go
    { const a = mean(P, meta.joints['joint-l-eye'], tmpV).clone(), b = mean(P, meta.joints['joint-r-eye'], tmpV).clone(); K.eye.set(Math.abs(a.x - b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2 + 0.012);
      const sk = K.sk; sk.rx = 0; sk.top = 0; sk.zf = -9; sk.zb = 9;
      for (let i = 0; i < nR; i++) { const bv = core.bodyV[i]; if (core.skinI[bv * 4] !== headBone) continue; const x = Math.abs(P[bv * 3]), y = P[bv * 3 + 1], z = P[bv * 3 + 2];
        if (y > sk.top) sk.top = y; if (y < K.eye.y + 0.03) continue; if (x > sk.rx) sk.rx = x; if (z > sk.zf) sk.zf = z; if (z < sk.zb) sk.zb = z; } }
    // pieces
    for (const w of worn) {
      const pc = w.pc; fit(pc, P, w.V);
      if (w.eyes) {
        // split the two eyeballs by where their triangles are, once
        if (!w.eyes[0].tri) { const L2 = [], R2 = []; for (let i = 0; i < pc.idx.length; i += 3) (w.V[pc.v[pc.idx[i]] * 3] < 0 ? L2 : R2).push(pc.idx[i], pc.idx[i + 1], pc.idx[i + 2]); w.eyes[0].tri = L2; w.eyes[1].tri = R2; }
        spread(w.V, pc.v, w.pos.array); normals(w.V, pc.v, pc.idx, w.nor.array);
        const head = heads[meta.bones.findIndex(b => b.name === 'head')];
        for (const e of w.eyes) {
          const used = [...new Set(e.tri)], c = e.at.set(0, 0, 0); for (const i of used) c.add(tmpV.fromArray(w.pos.array, i * 3)); c.multiplyScalar(1 / used.length);
          const map = new Map(), pp = new Float32Array(used.length * 3), nn = new Float32Array(used.length * 3), uu = new Float32Array(used.length * 2);
          used.forEach((i, k) => { map.set(i, k); pp[k * 3] = w.pos.array[i * 3] - c.x; pp[k * 3 + 1] = w.pos.array[i * 3 + 1] - c.y; pp[k * 3 + 2] = w.pos.array[i * 3 + 2] - c.z; nn.set(w.nor.array.subarray(i * 3, i * 3 + 3), k * 3); uu.set(pc.uv.subarray(i * 2, i * 2 + 2), k * 2); });
          e.geo.setAttribute('position', new T.BufferAttribute(pp, 3)); e.geo.setAttribute('normal', new T.BufferAttribute(nn, 3)); e.geo.setAttribute('uv', new T.BufferAttribute(uu, 2));
          e.geo.setIndex(new T.BufferAttribute(new Uint16Array(e.tri.map(i => map.get(i))), 1)); e.mesh.position.copy(c).sub(head);
          (e.side < 0 ? K.eyeL : K.eyeR).copy(c);
        }
        continue;
      }
      if (w.p.slot === 'hair' && hatLine !== undefined) {
        // under a hat the hair is pressed to the head: nothing of it stands further out than a little over the skull
        const sk = K.sk, cy = K.eye.y, cz = (sk.zf + sk.zb) / 2, ry = sk.top - cy, rz = (sk.zf - sk.zb) / 2, up = cy + ry * hatLine;
        for (let i = 0; i < pc.meta.n; i++) { const j = i * 3; if (w.V[j + 1] <= up) continue; const e = Math.hypot(w.V[j] / sk.rx, (w.V[j + 1] - cy) / ry, (w.V[j + 2] - cz) / rz);
          if (e > 1.08) { const k = 1.08 / e; w.V[j] *= k; w.V[j + 1] = cy + (w.V[j + 1] - cy) * k; w.V[j + 2] = cz + (w.V[j + 2] - cz) * k; } }
      }
      spread(w.V, pc.v, w.pos.array); normals(w.V, pc.v, pc.idx, w.nor.array); w.pos.needsUpdate = w.nor.needsUpdate = true;
      if (w.onFace) UNITS.forEach((u, k) => { const a = w.geo.morphAttributes.position[k], A = a.array;
        withUnit(core, P, u, () => fit(pc, P, w.tmp)); for (let i = 0; i < pc.v.length; i++) { const s = pc.v[i] * 3; A[i * 3] = w.tmp[s] - w.V[s]; A[i * 3 + 1] = w.tmp[s + 1] - w.V[s + 1]; A[i * 3 + 2] = w.tmp[s + 2] - w.V[s + 2]; } a.needsUpdate = true; });
      w.geo.computeBoundingSphere();
    }
    // joints: where the bones are; the joints of an arm or a leg as if the limb hung straight down
    const at = bn => heads[meta.bones.findIndex(b => b.name === bn)], pos = {}, turn = {};
    for (const s of ['l', 'r']) {
      const arm = new T.Quaternion().setFromUnitVectors(tmpA.copy(at('hand_' + s)).sub(at('upperarm_' + s)).normalize(), DOWN); for (const b of ['upperarm_', 'lowerarm_', 'hand_']) { rest[b + s].copy(arm); turn[b + s] = arm; }
      // a leg is brought under the hip; the foot keeps its own rest, so the sole stays flat
      const leg = new T.Quaternion().setFromUnitVectors(tmpA.copy(at('foot_' + s)).sub(at('thigh_' + s)).normalize(), DOWN); for (const b of ['thigh_', 'calf_']) rest[b + s].copy(leg); for (const b of ['thigh_', 'calf_', 'foot_']) turn[b + s] = leg;
    }
    for (const [jn, bn, pj] of RIG) {
      const hang = HANG.test(bn) && pj && HANG.test(boneOf[pj]);
      pos[jn] = hang ? tmpV.copy(at(bn)).sub(at(boneOf[pj])).applyQuaternion(turn[bn]).add(pos[pj]).clone() : at(bn).clone();
      J[jn].position.copy(pos[jn]); if (pj) J[jn].position.sub(pos[pj]);
    }
    K.hipY = at('thigh_l').y; let top = 0; for (let i = 1; i < bPos.array.length; i += 3) if (bPos.array[i] > top) top = bPos.array[i]; K.crown = top; K.head = at('head').clone();
    // the holders of head and back gear, laid over this head and this chest
    { const sk = K.sk, fitK = hatLine !== undefined ? 1.1 : 1.05;
      sock.scale.set(sk.rx / H.r.x * fitK, (sk.top - K.eye.y) / H.r.y * fitK, (sk.zf - sk.zb) / 2 / H.r.z * fitK);
      sock.position.set(-K.head.x, K.eye.y - K.head.y - H.c.y * sock.scale.y, (sk.zf + sk.zb) / 2 - K.head.z - H.c.z * sock.scale.z);
      faceG.position.copy(K.head).negate();
      K.s3 = at('spine_03').clone(); K.ck = (at('neck_01').y - K.s3.y) / 0.215; chestG.scale.setScalar(K.ck); }
    // every body stands as tall as the stage expects of its sex (the camera, the pad and the motions are set for
    // that); the height slider adds or takes a little
    byName.head.scale.setScalar(HEAD_SCALE);
    K.scale = lerp(1.66, 1.74, p.sex) * (0.93 + 0.14 * p.height) / (K.head.y + (K.crown - K.head.y) * HEAD_SCALE); unit.scale.setScalar(K.scale);
    // for the clips: each bone's own direction on this body (head to tail), turned onto the library's
    hipRest.copy(at('pelvis')); K.hipK = hipRest.y / (clips ? clips.meta.hipY : 0.917);
    for (const c of CB) { mean(P, meta.bones[c.i].tail, tmpV).sub(heads[c.i]); if (tmpV.lengthSq() < 1e-10) c.fix.identity(); else c.fix.setFromUnitVectors(tmpV.normalize(), c.dir); }
    if (clips && clips.meta.clips.sit) { const s = clips.meta.clips.sit[0] * 3, h = hipRest.y + clips.hip[s + 1] * K.hipK - 0.11; K.seatH = Math.max(0.1, h); seat.position.set(0, K.seatH / 2, hipRest.z + clips.hip[s + 2] * K.hipK - 0.04); }
  }
  // the pose of the joints, handed to the bones
  const Wr = {}, Wb = {}, q = new T.Quaternion(); for (const [jn, bn] of RIG) { Wr[jn] = new T.Quaternion(); Wb[bn] = new T.Quaternion(); }
  let playing = null, fade = 1, seatK = 0; const qa = new T.Quaternion(), qb = new T.Quaternion(), va = new T.Vector3(), ID_Q = new T.Quaternion();
  const follow = (out, dt = 0, look) => {
    for (const [jn, bn, pj] of RIG) {
      const wr = Wr[jn]; if (pj) wr.copy(Wr[pj]).multiply(J[jn].quaternion); else wr.copy(J[jn].quaternion);
      Wb[bn].copy(wr).multiply(rest[bn]);
      if (pj) byName[bn].quaternion.copy(q.copy(Wb[boneOf[pj]]).invert()).multiply(Wb[bn]); else byName[bn].quaternion.copy(Wb[bn]);
    }
    if (!clips || !out) return;
    // the stage's own pose, bone by bone (fingers: their resting curl, less of it for a hand the pose holds open)
    for (const c of CB) { if (c.rig) c.proc.copy(c.bone.quaternion); else if (c.curl) c.proc.copy(ID_Q).slerp(c.curl, 1 - clamp(out.open ? out.open[c.right] : 0, 0, 1)); else c.proc.copy(ID_Q); }
    /* a clip, where the motion has one */
    const name = out.name, def = CLIP[name] && CLIP[name].every(id => clips.meta.clips[id]) ? CLIP[name] : null, key = def ? name : '';
    if (key !== playing) { for (const c of CB) c.from.copy(playing === null ? c.bone.quaternion : c.last); hipFrom.copy(playing === null ? hipRest : hipLast); fade = playing === null ? 1 : 0; playing = key; }
    fade = Math.min(1, fade + dt / 0.32);
    if (def) {
      const fps = clips.meta.fps, m = R.MOTIONS[name], part = CLIP_PART[name]; let id = def[0], t = out.t;
      if (def.length === 2) { const d0 = (clips.meta.clips[def[0]][1] - 1) / fps; if (t >= d0) { id = def[1]; t -= d0; } }
      const cl = clips.meta.clips[id], n = cl[1]; let f = t * fps;
      // a loop goes round; a single clip is stretched over the motion's own length; a way in stops on its last frame
      if (cl[2]) f %= n; else if (def.length === 1 && m && !m.loop) f = Math.min(n - 1, t / m.dur * (n - 1)); else f = Math.min(n - 1, f);
      const i0 = Math.floor(f), i1 = cl[2] ? (i0 + 1) % n : Math.min(n - 1, i0 + 1), k = f - i0, nb = CB.length, Q = clips.q, a0 = (cl[0] + i0) * nb * 4, a1 = (cl[0] + i1) * nb * 4;
      for (const c of CB) {
        const o = c.k * 4; qa.set(Q[a0 + o], Q[a0 + o + 1], Q[a0 + o + 2], Q[a0 + o + 3]); qb.set(Q[a1 + o], Q[a1 + o + 1], Q[a1 + o + 2], Q[a1 + o + 3]);
        if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w);
        qa.set(qa.x + (qb.x - qa.x) * k, qa.y + (qb.y - qa.y) * k, qa.z + (qb.z - qa.z) * k, qa.w + (qb.w - qa.w) * k).normalize();
        c.W.copy(qa).multiply(c.fix);
        if (c.par >= 0) c.tgt.copy(CB[c.par].W).invert().multiply(c.W); else c.tgt.copy(c.W);
        const share = part && part[c.part] !== undefined ? part[c.part] : 1;
        if (share <= 0) c.tgt.copy(c.proc); else if (share < 1) c.tgt.copy(qb.copy(c.proc).slerp(c.tgt, share));
      }
      const H = clips.hip, h0 = (cl[0] + i0) * 3, h1 = (cl[0] + i1) * 3;
      hipTgt.set(H[h0] + (H[h1] - H[h0]) * k, H[h0 + 1] + (H[h1 + 1] - H[h0 + 1]) * k, H[h0 + 2] + (H[h1 + 2] - H[h0 + 2]) * k).multiplyScalar(part && part.legs === 0 ? 0 : K.hipK).add(hipRest);
      // the head still turns to who is looking
      if (look && R.poseTools) { CB[clips.bone.neck_01].tgt.multiply(R.poseTools.toQ([look.y * 0.35, look.x * 0.4, 0])); CB[clips.bone.head].tgt.multiply(R.poseTools.toQ([look.y * 0.55, look.x * 0.55, -look.x * 0.06])); }
    } else { for (const c of CB) c.tgt.copy(c.proc); hipTgt.copy(hipRest); }
    const w = fade * fade * (3 - 2 * fade);
    for (const c of CB) { if (w < 1) c.bone.quaternion.copy(c.from).slerp(c.tgt, w); else c.bone.quaternion.copy(c.tgt); c.last.copy(c.bone.quaternion); }
    pelvis.position.copy(w < 1 ? va.copy(hipFrom).lerp(hipTgt, w) : hipTgt); hipLast.copy(pelvis.position);
    float(dt);
    seatK = lerp(seatK, name === 'Sit' ? 1 : 0, 1 - Math.exp(-dt * 7)); seat.visible = seatK > 0.02; if (seat.visible) { seat.scale.set(seatK, (K.seatH || 0.4) * seatK, seatK); seat.position.y = (K.seatH || 0.4) * seatK / 2; }
  };

  /* colours: what a new colour of the same look changes; a new shape too (the sliders are not part of the structure) */
  const tone = new T.Color(), refC = new T.Color();
  const apply = look => {
    PK = pk;
    reshape(look);
    const np = plan(look, core);
    // skin: the picture's own average becomes the tone asked for
    tone.set(look.skin); refC.setRGB(pl.skin.ref[0], pl.skin.ref[1], pl.skin.ref[2], T.SRGBColorSpace);
    // (kept under 1.3: a picture pushed much brighter than it was painted loses its shading)
    skinMat.color.setRGB(clamp(tone.r / refC.r, 0, 1.3), clamp(tone.g / refC.g, 0, 1.3), clamp(tone.b / refC.b, 0, 1.3));
    // a little of the skin's own colour is lit from inside: shadows on a face stay soft and warm, like painted ones
    skinMat.emissive.copy(tone).multiplyScalar(0.16);
    for (const w of worn) {
      if (w.p.slot === 'hair' || w.p.slot === 'brows' || w.p.slot === 'lashes') {
        const a = average(w.pc.meta.tex.map), c = new T.Color(w.p.slot === 'lashes' ? '#1a1412' : look.hair.color), k = w.p.slot === 'brows' ? 0.8 : 1;
        w.mat.color.setRGB(clamp(c.r * k / Math.max(a.r, 0.02), 0, 6), clamp(c.g * k / Math.max(a.g, 0.02), 0, 6), clamp(c.b * k / Math.max(a.b, 0.02), 0, 6));
      }
      if (marker) { marker.userData.mm.color.set(look.glow); marker.userData.mm.emissive.set(look.glow); }
      if (w.tint) { const t = w.tint;
        if (w.p.slot === 'shoes') t.cTop.value.set(look.shoes.color); else if (w.p.slot === 'hat') t.cTop.value.set(look.accColor);
        else { t.cTop.value.set(look.top.color); t.cBot.value.set(look.top.type === 'spacesuit' ? look.top.color : look.bottom.color); }
        // cloth is never pure black or pure white: black keeps no folds and white burns out under the key light
        for (const c of [t.cTop.value, t.cBot.value]) { c.r = clamp(c.r, CLOTH_LO.r, CLOTH_HI.r); c.g = clamp(c.g, CLOTH_LO.g, CLOTH_HI.g); c.b = clamp(c.b, CLOTH_LO.b, CLOTH_HI.b); } }
      if (w.eyes && np.eye !== w.eyeFile) { w.eyeFile = np.eye; LOAD.i(np.eye).then(() => { if (w.eyeFile === np.eye) { w.mat.map = picture(np.eye, true); w.mat.needsUpdate = true; } }, () => {}); }
    }
  };
  apply(L);
  root.updateMatrixWorld(true);

  /* what is worn on the head, the face and the back: the first characters' own pieces */
  const springs = [];
  R.human.buildHeadAcc(sock, H, mats, L.head, springs);
  if (L.face !== 'none') {
    const e = K.eye, sk = K.sk;
    if (L.face === 'visor') {
      const v = add(faceG, sphere(1, 36, 10, PI / 2 - 1.35, 2.7, PI / 2 - 0.3, 0.5), mats.get('visor'), [0, e.y + 0.004, (sk.zf + sk.zb) / 2 + 0.004], null, [sk.rx * 1.2, (sk.top - e.y) * 1.2, (sk.zf - sk.zb) / 2 * 1.16], { noShadow: true }); v.renderOrder = 2;
    } else for (const s of [1, -1]) {
      const frame = L.face === 'glasses' ? mats.get('acc') : mats.get('black'), hold = new T.Group(); hold.position.set(e.x * s, e.y - 0.001, e.z + 0.016); hold.rotation.y = 0.1 * s; faceG.add(hold);
      if (L.face === 'glasses') { add(hold, torus(0.0225, 0.0024, 6, 26), frame, null, null, [1.12, 0.92, 1], { noShadow: true }); add(hold, R.geo.circle(0.0215, 24), mats.get('glass'), null, null, [1.12, 0.92, 1], { noShadow: true }); }
      else add(hold, rbox(0.052, 0.036, 0.006, 0.013, 3), mats.get('lens'), null, null, null, { noShadow: true });
      add(faceG, rbox(0.0026, 0.0036, 0.1, 0.001, 1), frame, [(e.x + 0.03) * s, e.y + 0.004, e.z - 0.038], [0, -0.12 * s, 0], null, { noShadow: true });
      if (s > 0) add(faceG, rbox(Math.max(0.006, e.x * 2 - 0.048), 0.003, 0.003, 0.001, 1), frame, [0, e.y + 0.004, e.z + 0.018], null, null, { noShadow: true });
    }
  }
  if (L.back !== 'none') {
    const pad = 0.014, fz = y => (trunk(K.s3.y + y * K.ck).zf + pad - K.s3.z) / K.ck, bz = y => (trunk(K.s3.y + y * K.ck).zb - pad - K.s3.z) / K.ck;
    R.human.buildBack(chestG, L, mats, J, springs, fz, bz, Math.min(-0.05, bz(0.2) + 0.03));
  }

  /* the face: eyes look and blink, the mouth and the brows follow the stage's expression */
  const inf = UNITS.map(() => 0), setU = (n, v) => { inf[U[n]] = v; };
  const eyeW = worn.find(w => w.eyes);
  const face = { eyes: [], want: {}, gaze: new T.Vector2(), sacc: new T.Vector2(), saccT: 1, blinkT: 2 + Math.random() * 2, blink: 0, shut: 0, smile: 0, open: 0, wide: 0, brow: 0,
    set(e) { this.want = e || {}; },
    rest() { this.shut = 0; this.blink = 0; this.gaze.set(0, 0); this.smile = 0.3; this.open = 0; this.wide = 0; this.brow = 0; this.show(); },
    show() {
      if (eyeW) for (const e of eyeW.eyes) e.mesh.rotation.set(-this.gaze.y, this.gaze.x, 0);
      const s = this.shut; setU('eye-left-closure', s); setU('eye-right-closure', s); setU('eye-left-opened-up', this.wide * (1 - s)); setU('eye-right-opened-up', this.wide * (1 - s));
      setU('mouth-corner-puller', this.smile); setU('mouth-open', this.open);
      setU('eyebrows-left-up', Math.max(0, this.brow)); setU('eyebrows-right-up', Math.max(0, this.brow)); setU('eyebrows-left-down', Math.max(0, -this.brow)); setU('eyebrows-right-down', Math.max(0, -this.brow));
      for (const m of faceMeshes) for (let i = 0; i < inf.length; i++) m.morphTargetInfluences[i] = inf[i];
    },
    update(dt, lx, ly) {
      const e = this.want, k = 1 - Math.exp(-dt * 20), slow = 1 - Math.exp(-dt * 9);
      this.saccT -= dt; if (this.saccT <= 0) { this.sacc.set((Math.random() - 0.5) * 0.09, (Math.random() - 0.5) * 0.05); this.saccT = 0.5 + Math.random() * 1.8; }
      this.gaze.x = lerp(this.gaze.x, clamp(lx, -1, 1) * 0.42 + this.sacc.x, k); this.gaze.y = lerp(this.gaze.y, clamp(ly, -1, 1) * 0.26 + this.sacc.y + (e.eyesUp ? 0.25 : 0), k);
      this.blinkT -= dt; if (this.blinkT <= 0) { this.blink = 0.16; this.blinkT = Math.random() < 0.18 ? 0.25 : 2.2 + Math.random() * 3.2; }
      let lid = 0; if (this.blink > 0) { this.blink -= dt; lid = 1 - Math.abs((1 - this.blink / 0.16) * 2 - 1); }
      const held = e.eyes === 'closed' ? 1 : e.eyes === 'happy' ? 0.55 : e.eyes === 'squint' ? 0.4 : 0;
      this.shut = Math.max(lid, lerp(this.shut, held, 1 - Math.exp(-dt * 16)));
      this.wide = lerp(this.wide, e.eyes === 'wide' ? 0.8 : 0, slow);
      this.smile = lerp(this.smile, e.mouth === 'grin' ? 1 : e.mouth === 'smile' ? 0.7 : e.mouth === 'soft' ? 0.35 : e.mouth === 'flat' ? 0 : e.eyes === 'happy' ? 0.6 : 0.18, slow);
      this.open = lerp(this.open, e.mouth === 'open' ? 0.55 : e.mouth === 'grin' ? 0.22 : 0, slow);
      this.brow = lerp(this.brow, clamp((+e.brow || 0) + (+e.raise || 0) * 0.6, -1, 1), slow);
      this.show();
    } };
  face.rest();

  /* the marker: a small ring with a bead that floats over the head of the character on the live stage (the studio's
     own sign that this one is yours; not on the small pictures) */
  if (!o.lite) {
    const mm = own(new T.MeshStandardMaterial({ color: L.glow, emissive: L.glow, emissiveIntensity: 0.35, roughness: 0.4 }));
    marker = new T.Group(); const ring = new T.Mesh(own(new T.TorusGeometry(0.042, 0.008, 10, 36)), mm), bead = new T.Mesh(own(new T.SphereGeometry(0.016, 16, 12)), mm);
    marker.add(ring); marker.add(bead); marker.userData = { ring, mm, t: Math.random() * 6 }; root.add(marker);
  }
  const float = dt => { if (!marker) return; const u = marker.userData; u.t += dt; byName.head.getWorldPosition(tmpV); root.worldToLocal(tmpV);
    marker.position.set(tmpV.x, tmpV.y + (K.crown - K.head.y) * K.scale + 0.2 + Math.sin(u.t * 1.7) * 0.012, tmpV.z); u.ring.rotation.set(Math.PI / 2 + Math.sin(u.t * 0.9) * 0.25, u.t * 1.3, 0); };
  const dispose = () => { for (const t of trash) t.dispose(); skeleton.dispose(); };
  return { root, J, springs, extras: { flare: [], float: [] }, kind: 'human', H, face, model: true, sim: true, apply, dispose, afterPose: follow, stride: K.hipY * K.scale / 0.855, bones: byName, meshes, K };
}
S.build = buildSimHuman;
R.buildSimHuman = buildSimHuman;
})(window);
