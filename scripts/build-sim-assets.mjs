// Prepares the parametric human ("sim") for the web: public/sim/*.
// Source: the MakeHuman base mesh hm08, its morph targets and game rig (taken from the MPFB2 repository's data
// folder) and the MakeHuman system asset pack (skins, eyes, eyebrows, eyelashes, hair, clothes, shoes). All of it is
// CC0 (see public/licenses/makehuman.txt). Nothing of the sources is kept in the repository: unpack them under
// .wrangler/mh (mpfb2-master/ and assets/) and run
//   node scripts/build-sim-assets.mjs [work folder]        (default: .wrangler/mh)
// What it writes:
//   core.json + core.bin   the base mesh (every vertex, helpers included: clothes are fitted to them), the skin's
//                          triangles and UVs, bone weights, the joints and bones of the rig, and the morph targets
//                          the Studio uses (macro: sex, age, muscle, weight, ancestry, height, cup; detail sliders
//                          for body and face; expression units), quantized to 16 bits and stored sparsely
//   p/<kind>/<name>.json + .bin   one fitted piece each (hair, clothes, shoes, eyes ...): for every vertex the three
//                          base vertices it hangs on, weights and offset (the .mhclo rule), triangles, UVs and the
//                          body vertices it hides
//   tex/*.webp             pictures (skins, piece textures)
//   thumb/*.webp           the small pictures the editor shows for hair, outfits, shoes and brows
//   index.json             what there is: pieces, skins, eye pictures, and the sliders with their labels
// .bin files are gzip streams; the engine inflates them with DecompressionStream.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';

const WORK = process.argv[2] || '.wrangler/mh', OUT = 'public/sim';
const DATA = path.join(WORK, 'mpfb2-master/src/mpfb/data'), ASSETS = path.join(WORK, 'assets');
for (const d of [DATA, ASSETS]) if (!fs.existsSync(d)) { console.error(`Missing ${d}. See the header of this script.`); process.exit(1); }
fs.mkdirSync(path.join(OUT, 'tex'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'thumb'), { recursive: true });
const S = 0.1;                                    // MakeHuman works in decimetres; the studio in metres

/* ---------- small readers ---------- */
function readObj(file) {
  const v = [], vt = [], faces = []; let g = '';
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('v ')) { const p = line.trim().split(/\s+/); v.push(+p[1], +p[2], +p[3]); }
    else if (line.startsWith('vt ')) { const p = line.trim().split(/\s+/); vt.push(+p[1], +p[2]); }
    else if (line.startsWith('g ')) g = line.slice(2).trim();
    else if (line.startsWith('f ')) { const c = line.trim().split(/\s+/).slice(1).map(s => s.split('/')); faces.push({ g, v: c.map(x => +x[0] - 1), t: c.map(x => x[1] ? +x[1] - 1 : -1) }); }
  }
  return { v, vt, faces };
}
// triangles with one render vertex per (vertex, uv) pair
function renderMesh(faces, vt) {
  const key = new Map(), rv = [], uv = [], idx = [];
  const at = (v, t) => { const k = v + '/' + t; let i = key.get(k); if (i === undefined) { i = rv.length; key.set(k, i); rv.push(v); uv.push(t < 0 ? 0 : vt[t * 2], t < 0 ? 0 : 1 - vt[t * 2 + 1]); } return i; };
  for (const f of faces) { const c = f.v.map((v, k) => at(v, f.t[k])); for (let k = 1; k + 1 < c.length; k++) idx.push(c[0], c[k], c[k + 1]); }
  return { rv, uv, idx };
}
function readTarget(file) {
  const raw = file.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)).toString('utf8') : fs.readFileSync(file, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) { if (!line || line[0] === '#') continue; const p = line.trim().split(/\s+/); if (p.length < 4) continue; out.push([+p[0], +p[1] * S, +p[2] * S, +p[3] * S]); }
  return out;
}
class Bin {
  constructor() { this.parts = []; this.len = 0; this.sections = {}; }
  add(name, arr) {
    const pad = (4 - this.len % 4) % 4; if (pad) { this.parts.push(Buffer.alloc(pad)); this.len += pad; }
    const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    this.sections[name] = [arr.constructor.name.replace('Array', ''), this.len, arr.length]; this.parts.push(b); this.len += b.length;
  }
  write(file) { const gz = zlib.gzipSync(Buffer.concat(this.parts), { level: 9 }); fs.writeFileSync(file, gz); return gz.length; }
}
const kb = n => (n / 1024).toFixed(0) + ' KB';

/* ---------- the base mesh ---------- */
const base = readObj(path.join(DATA, '3dobjs/base.obj'));
const nV = base.v.length / 3;
const pos = new Float32Array(base.v.map(c => c * S));
const groupVerts = {}; for (const f of base.faces) { const s = groupVerts[f.g] || (groupVerts[f.g] = new Set()); f.v.forEach(v => s.add(v)); }
const body = renderMesh(base.faces.filter(f => f.g === 'body'), base.vt);
const joints = {}; for (const g in groupVerts) if (g.startsWith('joint-')) joints[g] = [...groupVerts[g]].sort((a, b) => a - b);
const helpers = {}; for (const g in groupVerts) if (g.startsWith('helper-')) { const a = [...groupVerts[g]]; helpers[g.slice(7)] = [Math.min(...a), Math.max(...a)]; }

/* ---------- rig ---------- */
const rig = JSON.parse(fs.readFileSync(path.join(DATA, 'rigs/standard/rig.game_engine.json'), 'utf8'));
const order = []; { const seen = new Set(), visit = n => { if (seen.has(n)) return; const p = rig[n].parent; if (p) visit(p); seen.add(n); order.push(n); }; Object.keys(rig).sort().forEach(visit); }
const end = e => e.strategy === 'CUBE' ? joints[e.cube_name] : e.vertex_indices;   // a point = the mean of these vertices
const bones = order.map(n => ({ name: n, parent: rig[n].parent ? order.indexOf(rig[n].parent) : -1, head: end(rig[n].head), tail: end(rig[n].tail) }));
const wj = JSON.parse(fs.readFileSync(path.join(DATA, 'rigs/standard/weights.game_engine.json'), 'utf8')).weights;
const per = Array.from({ length: nV }, () => []);
for (const b in wj) { const bi = order.indexOf(b); if (bi < 0) continue; for (const [v, w] of wj[b]) per[v].push([bi, w]); }
const skinI = new Uint8Array(nV * 4), skinW = new Uint8Array(nV * 4); let unbound = 0;
for (let v = 0; v < nV; v++) {
  const l = per[v].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = l.reduce((s, x) => s + x[1], 0);
  if (!sum) { unbound++; continue; }
  let left = 255; l.forEach(([b, w], k) => { const q = k === l.length - 1 ? left : Math.min(left, Math.round(w / sum * 255)); skinI[v * 4 + k] = b; skinW[v * 4 + k] = q; left -= q; });
}

/* ---------- morph targets ---------- */
const T_DIR = path.join(DATA, 'targets');
const targets = [], tIdx = [], tDel = [];
function addTarget(name, file) {
  const rows = readTarget(file).filter(r => r[0] < nV && (r[1] || r[2] || r[3]));
  let max = 1e-9; for (const r of rows) max = Math.max(max, Math.abs(r[1]), Math.abs(r[2]), Math.abs(r[3]));
  const scale = max / 32767, start = tIdx.length;
  for (const r of rows) { tIdx.push(r[0]); tDel.push(Math.round(r[1] / scale), Math.round(r[2] / scale), Math.round(r[3] / scale)); }
  targets.push({ name, start, count: rows.length, scale }); return targets.length - 1;
}
// macro targets: a file's weight is the product of the factors its name is made of
const macro = [];
const SEX = ['female', 'male'], AGE = ['young', 'old'], LVL = ['min', 'average', 'max'];
for (const e of ['african', 'asian', 'caucasian']) for (const s of SEX) for (const a of AGE) macro.push({ f: [e, s, a], t: addTarget(`macro/${e}-${s}-${a}`, path.join(T_DIR, `macrodetails/${e}-${s}-${a}.target.gz`)) });
for (const s of SEX) for (const a of AGE) for (const m of LVL) for (const w of LVL) macro.push({ f: [s, a, m + 'muscle', w + 'weight'], t: addTarget(`macro/universal-${s}-${a}-${m}muscle-${w}weight`, path.join(T_DIR, `macrodetails/universal-${s}-${a}-${m}muscle-${w}weight.target.gz`)) });
for (const s of SEX) for (const a of AGE) for (const h of ['min', 'max']) macro.push({ f: [s, a, h + 'height'], t: addTarget(`macro/height-${s}-${a}-${h}`, path.join(T_DIR, `macrodetails/height/${s}-${a}-averagemuscle-averageweight-${h}height.target.gz`)) });
for (const a of AGE) for (const w of LVL) for (const c of ['min', 'max']) macro.push({ f: ['female', a, w + 'weight', c + 'cup'], t: addTarget(`macro/cup-${a}-${w}weight-${c}`, path.join(T_DIR, `breast/female-${a}-averagemuscle-${w}weight-${c}cup-averagefirmness.target.gz`)) });

// detail sliders: [id, group, label, folder, family, sides?]  (-1..1; "sides" joins the left and right files)
const SLIDERS = [
  ['shoulders', 'body', 'Shoulders', 'torso', 'measure-shoulder-dist'], ['vshape', 'body', 'Chest', 'torso', 'torso-vshape'], ['waist', 'body', 'Waist', 'torso', 'measure-waist-circ'],
  ['hips', 'body', 'Hips', 'torso', 'measure-hips-circ'], ['belly', 'body', 'Belly', 'stomach', 'stomach-tone'], ['butt', 'body', 'Seat', 'buttocks', 'buttocks-volume'],
  ['thighs', 'body', 'Thighs', 'legs', 'measure-thigh-circ'], ['calves', 'body', 'Calves', 'legs', 'measure-calf-circ'], ['arms', 'body', 'Arms', 'arms', 'measure-upperarm-circ'],
  ['legs', 'body', 'Leg length', 'legs', 'measure-upperleg-height'], ['neck', 'body', 'Neck', 'neck', 'neck-scale-horiz'],
  ['headWidth', 'head', 'Head width', 'head', 'head-scale-horiz'], ['headHeight', 'head', 'Head height', 'head', 'head-scale-vert'], ['headDepth', 'head', 'Head depth', 'head', 'head-scale-depth'], ['headAge', 'head', 'Face age', 'head', 'head-age'], ['faceFat', 'head', 'Fullness', 'head', 'head-fat'],
  ['forehead', 'head', 'Forehead', 'forehead', 'forehead-scale-vert'], ['ears', 'head', 'Ear size', 'ears', 'ear-scale', 1], ['earWing', 'head', 'Ear angle', 'ears', 'ear-wing', 1],
  ['eyeSize', 'eyes', 'Eye size', 'eyes', 'eye-scale', 1], ['eyeSpace', 'eyes', 'Eye spacing', 'eyes', 'eye-trans', 1, ['in', 'out']], ['eyeHeight', 'eyes', 'Eye height', 'eyes', 'eye-trans', 1, ['down', 'up']],
  ['eyeSlant', 'eyes', 'Eye slant', 'eyes', 'eye-corner2', 1], ['eyeOpen', 'eyes', 'Eye opening', 'eyes', 'eye-height2', 1],
  ['browHeight', 'eyes', 'Brow height', 'eyebrows', 'eyebrows-trans', 0, ['down', 'up']], ['browAngle', 'eyes', 'Brow angle', 'eyebrows', 'eyebrows-angle'],
  ['noseWidth', 'nose', 'Nose width', 'nose', 'nose-scale-horiz'], ['noseLength', 'nose', 'Nose length', 'nose', 'nose-scale-vert'], ['noseDepth', 'nose', 'Nose depth', 'nose', 'nose-scale-depth'],
  ['noseTip', 'nose', 'Nose tip', 'nose', 'nose-point'], ['noseBridge', 'nose', 'Bridge', 'nose', 'nose-hump'], ['nostrils', 'nose', 'Nostrils', 'nose', 'nose-nostrils-width'],
  ['mouthWidth', 'mouth', 'Mouth width', 'mouth', 'mouth-scale-horiz'], ['lipUpper', 'mouth', 'Upper lip', 'mouth', 'mouth-upperlip-volume'], ['lipLower', 'mouth', 'Lower lip', 'mouth', 'mouth-lowerlip-volume'],
  ['mouthCorners', 'mouth', 'Mouth corners', 'mouth', 'mouth-angles'], ['mouthHeight', 'mouth', 'Mouth height', 'mouth', 'mouth-trans', 0, ['down', 'up']],
  ['chinWidth', 'jaw', 'Chin width', 'chin', 'chin-width'], ['chinHeight', 'jaw', 'Chin height', 'chin', 'chin-height'], ['chinForward', 'jaw', 'Chin depth', 'chin', 'chin-prominent'],
  ['jaw', 'jaw', 'Jaw', 'chin', 'chin-bones'], ['jawDrop', 'jaw', 'Jaw drop', 'chin', 'chin-jaw-drop'], ['cheeks', 'jaw', 'Cheeks', 'cheek', 'cheek-volume', 1], ['cheekbones', 'jaw', 'Cheekbones', 'cheek', 'cheek-bones', 1],
];
const ENDS = [['decr', 'incr'], ['in', 'out'], ['down', 'up'], ['backward', 'forward']];
const sliders = [];
for (const [id, group, label, dir, fam, sides, ends] of SLIDERS) {
  const names = sides ? ['l-' + fam, 'r-' + fam] : [fam], neg = [], posT = [];
  for (const n of names) {
    const pair = (ends ? [ends] : ENDS).find(([a, b]) => fs.existsSync(path.join(T_DIR, dir, `${n}-${a}.target.gz`)) && fs.existsSync(path.join(T_DIR, dir, `${n}-${b}.target.gz`)));
    if (!pair) { console.warn('  no target pair for', id, n); continue; }
    neg.push(addTarget(`${dir}/${n}-${pair[0]}`, path.join(T_DIR, dir, `${n}-${pair[0]}.target.gz`))); posT.push(addTarget(`${dir}/${n}-${pair[1]}`, path.join(T_DIR, dir, `${n}-${pair[1]}.target.gz`)));
  }
  if (neg.length) sliders.push({ id, group, label, neg, pos: posT });
}
// head shapes (0..1 each) and expression units
const shapes = {}; for (const s of ['round', 'oval', 'square', 'rectangular', 'triangular', 'invertedtriangular', 'diamond']) shapes[s] = addTarget(`head/head-${s}`, path.join(T_DIR, `head/head-${s}.target.gz`));
const units = {}; for (const f of fs.readdirSync(path.join(T_DIR, 'expression/units/caucasian')).sort()) { const n = f.replace(/\.target(\.gz)?$/, ''); units[n] = addTarget('unit/' + n, path.join(T_DIR, 'expression/units/caucasian', f)); }

/* ---------- write the core ---------- */
{
  const bin = new Bin();
  bin.add('pos', pos); bin.add('bodyV', new Uint16Array(body.rv)); bin.add('bodyUV', new Float32Array(body.uv)); bin.add('bodyIdx', new Uint16Array(body.idx));
  bin.add('skinI', skinI); bin.add('skinW', skinW); bin.add('tIdx', new Uint16Array(tIdx)); bin.add('tDel', new Int16Array(tDel));
  if (body.rv.length > 65535) throw new Error('body needs 32-bit indices');
  const size = bin.write(path.join(OUT, 'core.bin'));
  fs.writeFileSync(path.join(OUT, 'core.json'), JSON.stringify({
    source: 'MakeHuman hm08 base mesh, targets and game rig, CC0 1.0 (https://www.makehumancommunity.org)',
    nV, sections: bin.sections, joints, helpers, bones, targets: targets.map(t => [t.name, t.start, t.count, +t.scale.toPrecision(7)]), macro, sliders, shapes, units }));
  console.log(`core: ${nV} vertices, ${body.rv.length} skin vertices, ${body.idx.length / 3} triangles, ${bones.length} bones (${unbound} helper vertices without a bone), ${targets.length} targets -> ${kb(size)}`);
}

/* ---------- pictures ---------- */
const texDone = new Map();
// `fx` works on the resized picture before it is written (the house style: smooth skin, solid hair)
async function tex(file, name, size, alpha, fx) {
  if (!fs.existsSync(file)) return null;
  const out = `${name}.webp`; if (texDone.has(out)) return out; texDone.set(out, 1);
  const dst = path.join(OUT, 'tex', out);
  let img = sharp(file).resize(size, size, { fit: 'inside', withoutEnlargement: true }); if (fx) img = await fx(img);
  await img.webp({ quality: alpha ? 88 : 82, alphaQuality: 90, effort: 5 }).toFile(dst);
  return out;
}
/* The house style. The source pictures are photographic (pores, single hairs, denim grain); the studio's characters
   are drawn smooth, like clay:
   - skin: blurred until only the soft colour of lips, cheeks and shading is left;
   - hair: the strand cards become solid locks (the see-through fringe between strands is closed, the colour is
     smoothed), so a hairstyle reads as a shape;
   - clothes and shoes: see tintTex(). */
const softSkin = img => img.blur(5).modulate({ saturation: 1.12 });
async function solidHair(img) {
  const png = await img.ensureAlpha().png().toBuffer();
  const rgb = await sharp(png).removeAlpha().blur(3).modulate({ saturation: 0.9 }).toBuffer();
  const a = await sharp(png).extractChannel('alpha').blur(2.5).linear(5, -150).toBuffer();
  return sharp(rgb).joinChannel(a);
}
const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = v => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/* Clothes that take a colour. An outfit's picture has its own colours (a blue shirt, blue jeans); the Studio lets a
   character choose them. So for every outfit two pictures are written:
     <name>-map   the picture with its main cloth turned into neutral shading (0.5 = the cloth's own brightness),
                  everything else (a white shirt under a jacket, buttons, soles, socks, prints) left as it is;
     <name>-tint  where that neutral shading is: red = the top's cloth, green = the bottom's.
   The engine multiplies the shading by the look's top and bottom colour. "Main cloth" = pixels of about the hue of
   the most common colour of their garment (faded or shaded cloth counts: it has no hue of its own) and within a few
   stops of its brightness; a garment = the islands of the mesh above (top) or below (bottom) the hips.
   The shading is flattened (a gentle curve): the source is worn, creased cloth, the studio draws clean cloth.
   PLAIN: tops whose print is the source project's own emblem; there the whole top is cloth and the print is gone. */
const PLAIN = /^(female_casualsuit0[12]|male_casualsuit0[246])$/;
const hueSat = l => { const mx = Math.max(l[0], l[1], l[2]), mn = Math.min(l[0], l[1], l[2]), d = mx - mn; if (mx < 1e-4 || d < 1e-5) return [0, 0];
  const h = mx === l[0] ? ((l[1] - l[2]) / d + 6) % 6 : mx === l[1] ? (l[2] - l[0]) / d + 2 : (l[0] - l[1]) / d + 4; return [h / 6, d / mx]; };
async function tintTex(file, kind, name, c, obj, mesh) {
  const PX = 1024, M = 512, n = c.verts.length;
  const sy = c.scale.y ? Math.abs(pos[c.scale.y[0] * 3 + 1] - pos[c.scale.y[1] * 3 + 1]) / c.scale.y[2] : 0.1, y = new Float32Array(n);
  c.verts.forEach((r, i) => { y[i] = pos[r[0] * 3 + 1] * r[3] + pos[r[1] * 3 + 1] * r[4] + pos[r[2] * 3 + 1] * r[5] + r[7] * sy; });
  const up = Int32Array.from({ length: n }, (_, i) => i), find = i => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i]; } return i; };
  for (const f of obj.faces) for (let k = 1; k < f.v.length; k++) { const a = find(f.v[0]), b = find(f.v[k]); if (a !== b) up[a] = b; }
  const mid = new Map(); for (let i = 0; i < n; i++) { const r = find(i), t = mid.get(r) || [0, 0]; t[0] += y[i]; t[1]++; mid.set(r, t); }
  const hip = joints['joint-pelvis'].reduce((t, v) => t + pos[v * 3 + 1], 0) / joints['joint-pelvis'].length;
  const region = v => { if (kind !== 'outfit') return 1; const t = mid.get(find(v)); return t[0] / t[1] < hip ? 2 : 1; };
  // which garment a pixel belongs to: the mesh drawn in the picture's own layout
  const reg = new Uint8Array(M * M);
  for (let t = 0; t < mesh.idx.length; t += 3) {
    const i = [mesh.idx[t], mesh.idx[t + 1], mesh.idx[t + 2]], r = region(mesh.rv[i[0]]);
    const x = i.map(k => mesh.uv[k * 2] * M), yy = i.map(k => mesh.uv[k * 2 + 1] * M);
    const area = (x[1] - x[0]) * (yy[2] - yy[0]) - (x[2] - x[0]) * (yy[1] - yy[0]); if (!area) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...x)) - 1), x1 = Math.min(M - 1, Math.ceil(Math.max(...x)) + 1), y0 = Math.max(0, Math.floor(Math.min(...yy)) - 1), y1 = Math.min(M - 1, Math.ceil(Math.max(...yy)) + 1);
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const a = ((x[1] - cx) * (yy[2] - cy) - (x[2] - cx) * (yy[1] - cy)) / area, b = ((x[2] - cx) * (yy[0] - cy) - (x[0] - cx) * (yy[2] - cy)) / area, g = 1 - a - b;
      if (a >= -0.2 && b >= -0.2 && g >= -0.2) reg[py * M + px] = r;
    }
  }
  const { data } = await sharp(file).resize(PX, PX, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (px, py) => reg[(py >> 1) * M + (px >> 1)];
  const dom = {};
  for (const r of [1, 2]) {
    const hist = new Map();
    for (let py = 0; py < PX; py++) for (let px = 0; px < PX; px++) { if (at(px, py) !== r) continue; const i = (py * PX + px) * 3, key = (data[i] >> 3) << 10 | (data[i + 1] >> 3) << 5 | data[i + 2] >> 3; let e = hist.get(key); if (!e) hist.set(key, e = [0, 0, 0, 0]); e[0]++; e[1] += data[i]; e[2] += data[i + 1]; e[3] += data[i + 2]; }
    let best = null; for (const e of hist.values()) if (!best || e[0] > best[0]) best = e;
    if (best) { const cl = [toLin(best[1] / best[0]), toLin(best[2] / best[0]), toLin(best[3] / best[0])]; dom[r] = { c: cl, L: 0.2126 * cl[0] + 0.7152 * cl[1] + 0.0722 * cl[2], hs: hueSat(cl) }; }
  }
  const out = Buffer.alloc(PX * PX * 3), mask = Buffer.alloc(PX * PX * 3);
  for (let py = 0; py < PX; py++) for (let px = 0; px < PX; px++) {
    const i = (py * PX + px) * 3, r = at(px, py), d = dom[r];
    if (!d) { out[i] = data[i]; out[i + 1] = data[i + 1]; out[i + 2] = data[i + 2]; continue; }
    const l = [toLin(data[i]), toLin(data[i + 1]), toLin(data[i + 2])], L = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    // same cloth: about the same hue where both have one, and within a few stops of its brightness
    const hs = hueSat(l), both = Math.min(hs[1], d.hs[1]), dh = Math.abs(hs[0] - d.hs[0]), hue = Math.min(dh, 1 - dh);
    const ratio = L / Math.max(d.L, 0.004), stops = Math.abs(Math.log2(Math.max(ratio, 1e-3)));
    const same = (1 - sstep(0.07, 0.16, hue) * sstep(0.12, 0.3, both)) * (1 - sstep(2.0, 3.0, stops));
    const plain = r === 1 && PLAIN.test(name), a = plain ? 1 : same;
    const g = toSrgb(Math.min(2, plain && same < 0.5 ? 1 : Math.pow(ratio, 0.42)) / 2);
    out[i] = data[i] + (g - data[i]) * a; out[i + 1] = data[i + 1] + (g - data[i + 1]) * a; out[i + 2] = data[i + 2] + (g - data[i + 2]) * a;
    mask[i + (r === 2 ? 1 : 0)] = Math.round(a * 255);
  }
  // the shading is smoothed inside each garment: a little everywhere (the grain of a photographed cloth goes, the
  // folds stay), a lot on a plain top (the print's outline goes too)
  for (const [ch, RAD] of [[0, PLAIN.test(name) ? 9 : 2], [1, 2]]) {
    const val = new Float32Array(PX * PX), wt = new Float32Array(PX * PX), tmpV = new Float32Array(PX * PX), tmpW = new Float32Array(PX * PX);
    for (let p = 0; p < PX * PX; p++) if (mask[p * 3 + ch] > 128) { wt[p] = 1; val[p] = out[p * 3]; }
    for (let pass = 0; pass < 2; pass++) {
      for (let py = 0; py < PX; py++) { let sv = 0, sw = 0; for (let px = -RAD; px < PX; px++) { const a = px + RAD, b = px - RAD - 1; if (a < PX) { sv += val[py * PX + a] * wt[py * PX + a]; sw += wt[py * PX + a]; } if (b >= 0) { sv -= val[py * PX + b] * wt[py * PX + b]; sw -= wt[py * PX + b]; } if (px >= 0) { tmpV[py * PX + px] = sv; tmpW[py * PX + px] = sw; } } }
      for (let px = 0; px < PX; px++) { let sv = 0, sw = 0; for (let py = -RAD; py < PX; py++) { const a = py + RAD, b = py - RAD - 1; if (a < PX) { sv += tmpV[a * PX + px]; sw += tmpW[a * PX + px]; } if (b >= 0) { sv -= tmpV[b * PX + px]; sw -= tmpW[b * PX + px]; } if (py >= 0 && wt[py * PX + px]) val[py * PX + px] = sw > 0.5 ? sv / sw : val[py * PX + px]; } }
    }
    for (let p = 0; p < PX * PX; p++) if (wt[p]) { const g = Math.round(val[p]); out[p * 3] = out[p * 3 + 1] = out[p * 3 + 2] = g; }
  }
  // the cloth is carried a few pixels past the edge of each island, so a filtered lookup at a seam finds cloth
  // (and its tint) on both sides, not the picture's background
  const full = new Uint8Array(PX * PX); for (let py = 0; py < PX; py++) for (let px = 0; px < PX; px++) full[py * PX + px] = at(px, py) ? 1 : 0;
  for (let pass = 0; pass < 4; pass++) { const add = [];
    for (let py = 1; py < PX - 1; py++) for (let px = 1; px < PX - 1; px++) { const p = py * PX + px; if (full[p]) continue; for (const q of [p - 1, p + 1, p - PX, p + PX]) if (full[q]) { add.push(p, q); break; } }
    for (let k = 0; k < add.length; k += 2) { const p = add[k] * 3, q = add[k + 1] * 3; out[p] = out[q]; out[p + 1] = out[q + 1]; out[p + 2] = out[q + 2]; mask[p] = mask[q]; mask[p + 1] = mask[q + 1]; }
    for (let k = 0; k < add.length; k += 2) full[add[k]] = 1; }
  const base = `${kind}-${name}-map.webp`, tint = `${kind}-${name}-tint.webp`;
  await sharp(out, { raw: { width: PX, height: PX, channels: 3 } }).blur(0.6).webp({ quality: 84, effort: 5 }).toFile(path.join(OUT, 'tex', base));
  await sharp(mask, { raw: { width: PX, height: PX, channels: 3 } }).webp({ quality: 90, effort: 5 }).toFile(path.join(OUT, 'tex', tint));
  return { map: base, tint };
}
const mhmat = file => { const o = {}; if (!fs.existsSync(file)) return o; for (const l of fs.readFileSync(file, 'utf8').split('\n')) { const m = /^(\w+)\s+(.+)$/.exec(l.trim()); if (m && !l.startsWith('#')) o[m[1]] = m[2].trim(); } return o; };

/* ---------- fitted pieces ---------- */
function readMhclo(file) {
  const o = { scale: {}, verts: [], del: [], obj: '', material: '' }; let mode = '';
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim(); if (!line || line[0] === '#') continue; const p = line.split(/\s+/);
    if (p[0] === 'verts') { mode = 'verts'; continue; }
    if (p[0] === 'delete_verts') { mode = 'del'; continue; }
    if (/^[a-z_]+$/i.test(p[0]) && isNaN(+p[0])) {
      // a property line; some files put a few of them after "verts 0", so it does not end that list
      if (mode === 'del') mode = '';
      if (p[0] === 'obj_file') o.obj = p[1]; else if (p[0] === 'material') o.material = p[1];
      else if (/^[xyz]_scale$/.test(p[0])) o.scale[p[0][0]] = [+p[1], +p[2], +p[3]];
      continue;
    }
    if (mode === 'verts') o.verts.push(p.length === 1 ? [+p[0], +p[0], +p[0], 1, 0, 0, 0, 0, 0] : p.map(Number));
    else if (mode === 'del') { for (let i = 0; i < p.length; i++) { if (p[i + 1] === '-') { o.del.push([+p[i], +p[i + 2]]); i += 2; } else o.del.push([+p[i], +p[i]]); } }
  }
  return o;
}
const index = {};
async function piece(kind, name, dir, opt = {}) {
  const clo = fs.readdirSync(dir).find(f => f.endsWith('.mhclo')); if (!clo) return;
  const c = readMhclo(path.join(dir, clo)), obj = readObj(path.join(dir, c.obj || clo.replace('.mhclo', '.obj')));
  const n = c.verts.length; if (n !== obj.v.length / 3) { console.warn(`  ${kind}/${name}: ${n} fitted vertices but ${obj.v.length / 3} in the mesh, skipped`); return; }
  const mesh = renderMesh(obj.faces, obj.vt); if (mesh.rv.length > 65535) { console.warn(`  ${kind}/${name}: too many vertices, skipped`); return; }
  const ref = new Uint16Array(n * 3), w = new Float32Array(n * 3), off = new Float32Array(n * 3);
  c.verts.forEach((r, i) => { ref.set(r.slice(0, 3), i * 3); w.set(r.slice(3, 6), i * 3); off.set(r.slice(6, 9), i * 3); });
  const bin = new Bin(); bin.add('ref', ref); bin.add('w', w); bin.add('off', off); bin.add('v', new Uint16Array(mesh.rv)); bin.add('uv', new Float32Array(mesh.uv)); bin.add('idx', new Uint16Array(mesh.idx));
  fs.mkdirSync(path.join(OUT, 'p', kind), { recursive: true });
  const size = bin.write(path.join(OUT, 'p', kind, name + '.bin'));
  const m = mhmat(path.join(dir, c.material || '')), t = {};
  const pic = async (key, slot, px, alpha, fx) => { if (m[key]) t[slot] = await tex(path.join(dir, m[key]), `${kind}-${name}-${slot}`, px, alpha, fx); };
  if (opt.tint && m.diffuseTexture && fs.existsSync(path.join(dir, m.diffuseTexture))) { Object.assign(t, await tintTex(path.join(dir, m.diffuseTexture), kind, name, c, obj, mesh)); await pic('normalmapTexture', 'normal', opt.npx || 1024, false); }
  else if (!opt.noTex) { await pic('diffuseTexture', 'map', opt.px || 1024, opt.alpha, opt.fx); if (!opt.noNormal) await pic('normalmapTexture', 'normal', opt.npx || 1024, false); }
  const meta = { n, sections: bin.sections, scale: c.scale, del: c.del, tex: t, alpha: !!opt.alpha, twoSided: m.backfaceCull === 'False' };
  fs.writeFileSync(path.join(OUT, 'p', kind, name + '.json'), JSON.stringify(meta));
  // the asset's own preview picture, for the editor
  const th = fs.readdirSync(dir).find(f => f.endsWith('.thumb')); let thumb = null;
  if (th && opt.thumb) { thumb = `${kind}-${name}.webp`; await sharp(path.join(dir, th)).resize(160, 160, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).webp({ quality: 80 }).toFile(path.join(OUT, 'thumb', thumb)); }
  (index[kind] || (index[kind] = {}))[name] = { tris: mesh.idx.length / 3, kb: Math.round(size / 1024), ...(thumb ? { thumb } : {}) };
}
const dirs = d => fs.existsSync(path.join(ASSETS, d)) ? fs.readdirSync(path.join(ASSETS, d)).filter(f => fs.statSync(path.join(ASSETS, d, f)).isDirectory()).sort() : [];
for (const n of dirs('hair')) await piece('hair', n, path.join(ASSETS, 'hair', n), { alpha: true, px: 1024, thumb: true, fx: solidHair, noNormal: true });
for (const n of dirs('eyebrows')) await piece('brows', n, path.join(ASSETS, 'eyebrows', n), { alpha: true, px: 512, thumb: true });
for (const n of dirs('eyelashes')) await piece('lashes', n, path.join(ASSETS, 'eyelashes', n), { alpha: true, px: 512 });
await piece('eyes', 'high', path.join(ASSETS, 'eyes/high-poly'), { noTex: true });
await piece('teeth', 'base', path.join(ASSETS, 'teeth/teeth_base'), { px: 512 });
for (const n of dirs('clothes')) await piece(/^shoes/.test(n) ? 'shoes' : /^fedora/.test(n) ? 'hat' : 'outfit', n, path.join(ASSETS, 'clothes', n), { npx: 1024, thumb: true, tint: true });

/* ---------- skins and eye pictures ---------- */
const skins = {};
for (const n of dirs('skins')) {
  if (/special_suit/.test(n)) continue;
  const m = mhmat(path.join(ASSETS, 'skins', n, n + '.mhmat')); if (!m.diffuseTexture) continue;
  const file = await tex(path.join(ASSETS, 'skins', n, m.diffuseTexture), 'skin-' + n, 1024, false, softSkin); if (!file) continue;
  // the average colour of the cheek area: what a skin tone is measured against when the picture is tinted
  const { data, info } = await sharp(path.join(ASSETS, 'skins', n, m.diffuseTexture)).resize(64, 64).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, k = 0; for (let i = 0; i < data.length; i += info.channels) { if (data[i] + data[i + 1] + data[i + 2] < 60) continue; r += data[i]; g += data[i + 1]; b += data[i + 2]; k++; }
  skins[n] = { file, ref: [r / k / 255, g / k / 255, b / k / 255].map(x => +x.toFixed(4)) };
}
const eyeTex = {};
for (const f of fs.readdirSync(path.join(ASSETS, 'eyes/materials')).filter(f => f.endsWith('_eye.png'))) eyeTex[f.replace('_eye.png', '')] = await tex(path.join(ASSETS, 'eyes/materials', f), 'eye-' + f.replace('_eye.png', ''), 512, true);

fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ pieces: index, skins, eyes: eyeTex, sliders: sliders.map(s => ({ id: s.id, group: s.group, label: s.label })) }, null, 1));
const total = fs.readdirSync(OUT, { recursive: true }).reduce((s, f) => { const p = path.join(OUT, f); return s + (fs.statSync(p).isFile() ? fs.statSync(p).size : 0); }, 0);
console.log(Object.entries(index).map(([k, v]) => `${k}: ${Object.keys(v).length}`).join(', '), `| skins: ${Object.keys(skins).length} | everything: ${(total / 1048576).toFixed(1)} MB in ${OUT}`);
