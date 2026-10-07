// Prepares the modelled characters for the web: public/kit/*.glb + *.webp + manifest.json.
// Source: the "Universal Base Characters" kit by Quaternius (CC0, https://quaternius.com), unpacked somewhere on
// this machine. The kit itself is not kept in the repository; only what this script writes is.
//   node scripts/build-kit-assets.mjs [folder with the unpacked kit]        (default: .wrangler/kit)
// Every body (*_FullBody.gltf) and every hairstyle (Hair_*.gltf, Eyebrows_*.gltf) found in the folder is taken, so
// the full version of the kit adds its bodies and hairstyles without a change here. Textures keep their size (2048)
// and are stored as WebP; models lose the data the studio does not use (spare UV sets, vertex colours, pictures).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2] || '.wrangler/kit', OUT = 'public/kit';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
if (!fs.existsSync(SRC)) { console.error(`No kit folder at ${SRC}. Unpack the kit there or pass its folder.`); process.exit(1); }
const files = walk(SRC), base = f => path.basename(f);
fs.mkdirSync(OUT, { recursive: true });

/* ----- models: .gltf + .bin -> one .glb with only what is drawn ----- */
function slim(json, bin, keep) {
  for (const m of json.meshes) for (const p of m.primitives) { for (const k of Object.keys(p.attributes)) if (!keep.includes(k)) delete p.attributes[k]; delete p.targets; delete p.material; }
  const used = new Set();
  for (const m of json.meshes) for (const p of m.primitives) { Object.values(p.attributes).forEach(a => used.add(a)); if (p.indices !== undefined) used.add(p.indices); }
  for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) used.add(s.inverseBindMatrices);
  const accMap = new Map(), acc = [];
  [...used].sort((a, b) => a - b).forEach(i => { accMap.set(i, acc.length); acc.push({ ...json.accessors[i] }); });
  const bvMap = new Map(), views = [], chunks = []; let off = 0;
  for (const i of [...new Set(acc.map(a => a.bufferView))].sort((a, b) => a - b)) {
    const v = json.bufferViews[i], start = v.byteOffset || 0, pad = (4 - off % 4) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
    bvMap.set(i, views.length); views.push({ ...v, buffer: 0, byteOffset: off }); chunks.push(bin.subarray(start, start + v.byteLength)); off += v.byteLength;
  }
  acc.forEach(a => { a.bufferView = bvMap.get(a.bufferView); });
  for (const m of json.meshes) for (const p of m.primitives) { for (const k in p.attributes) p.attributes[k] = accMap.get(p.attributes[k]); if (p.indices !== undefined) p.indices = accMap.get(p.indices); }
  for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = accMap.get(s.inverseBindMatrices);
  const out = Buffer.concat(chunks);
  json.accessors = acc; json.bufferViews = views; json.buffers = [{ byteLength: out.length }];
  for (const k of ['images', 'textures', 'samplers', 'materials', 'animations', 'extensionsUsed', 'extensionsRequired']) delete json[k];
  return out;
}
function glb(json, bin) {
  const j = Buffer.from(JSON.stringify(json)), jp = (4 - j.length % 4) % 4, bp = (4 - bin.length % 4) % 4;
  const head = Buffer.alloc(12), jc = Buffer.alloc(8), bc = Buffer.alloc(8);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + j.length + jp + bin.length + bp, 8);
  jc.writeUInt32LE(j.length + jp, 0); jc.writeUInt32LE(0x4E4F534A, 4); bc.writeUInt32LE(bin.length + bp, 0); bc.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([head, jc, j, Buffer.alloc(jp, 0x20), bc, bin, Buffer.alloc(bp)]);
}
// where a mesh lies once its node's own placement is applied (some files are in centimetres with z up, set right by the node)
function bounds(json, node) {
  const q = node.rotation || [0, 0, 0, 1], s = node.scale || [1, 1, 1], t = node.translation || [0, 0, 0], lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const turn = ([x, y, z]) => { const [qx, qy, qz, qw] = q, ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
    return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx]; };
  for (const p of json.meshes[node.mesh].primitives) { const a = json.accessors[p.attributes.POSITION];
    for (let k = 0; k < 8; k++) { const v = turn([0, 1, 2].map(i => (k >> i & 1 ? a.max : a.min)[i] * s[i])).map((c, i) => c + t[i]); v.forEach((c, i) => { lo[i] = Math.min(lo[i], c); hi[i] = Math.max(hi[i], c); }); } }
  return { lo, hi };
}
const r4 = v => Math.round(v * 1e4) / 1e4;
function model(file, name, keep) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8')), uri = json.buffers[0].uri;
  const pictures = (json.images || []).map(i => i.uri || '');
  const texOf = p => { const m = (json.materials || [])[p.material], t = m && m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture; return t ? pictures[json.textures[t.index].source] : ''; };
  const meshes = {}; // per mesh node: where it lies and which picture it uses (read before the materials are dropped)
  for (const n of json.nodes) if (n.mesh !== undefined) meshes[n.name] = { ...bounds(json, n), tex: texOf(json.meshes[n.mesh].primitives[0]), verts: json.meshes[n.mesh].primitives.reduce((a, p) => a + json.accessors[p.attributes.POSITION].count, 0) };
  const out = glb(json, slim(json, fs.readFileSync(path.join(path.dirname(file), decodeURIComponent(uri))), keep));
  fs.writeFileSync(path.join(OUT, name + '.glb'), out);
  return { bytes: out.length, meshes };
}
const hairTex = uri => (uri.match(/T_Hair_(\d+)/i) || [0, '1'])[1];
// the picture's own skin colour (sRGB, 0..1): what a chosen skin tone is measured against. Underwear and eyes are left out.
async function skinColour(file) {
  const { data } = await sharp(file).resize(96, 96, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 3) { const mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2]); if (mx > 60 && (mx - mn) / mx > 0.3) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; } }
  return [r, g, b].map(v => r4(v / n / 255));
}
/* Relaxed hands: the finger pose of the library's idle clip (first frame), one turn per finger bone. Only read when the
   "Universal Animation Library" (also CC0, Quaternius) is in the folder; without it the hands stay open. */
function fingers() {
  const f = files.find(p => /UAL\d*_Standard\.glb$/i.test(base(p))); if (!f) return null;
  const b = fs.readFileSync(f), jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString('utf8')), bin = b.subarray(20 + jl + 8), out = {};
  const clip = (json.animations || []).find(a => a.name === 'Idle_Loop'); if (!clip) return null;
  for (const ch of clip.channels) {
    const name = json.nodes[ch.target.node].name; if (ch.target.path !== 'rotation' || !/^(index|middle|ring|pinky|thumb)_0\d_[lr]$/.test(name)) continue;
    const a = json.accessors[clip.samplers[ch.sampler].output]; if (a.componentType !== 5126) continue;
    const at = (json.bufferViews[a.bufferView].byteOffset || 0) + (a.byteOffset || 0); out[name] = [0, 1, 2, 3].map(i => r4(bin.readFloatLE(at + i * 4)));
  }
  return Object.keys(out).length ? out : null;
}
/* ----- pictures: same size, WebP ----- */
async function picture(file, name, o = {}) {
  let img = sharp(file); const meta = await img.metadata();
  if (o.max && meta.width > o.max) img = img.resize(o.max, o.max);
  if (o.grey) img = img.greyscale();
  const buf = await img.webp({ quality: o.quality || 90, effort: 5, smartSubsample: true, alphaQuality: 100 }).toBuffer();
  fs.writeFileSync(path.join(OUT, name + '.webp'), buf);
  return { bytes: buf.length, size: Math.min(meta.width, o.max || meta.width) };
}
const pick = re => files.filter(f => re.test(base(f))).sort((a, b) => a.length - b.length);
const first = re => pick(re)[0];
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const manifest = { source: 'Universal Base Characters by Quaternius, CC0 1.0 (https://quaternius.com/packs/universalbasecharacters.html)', bodies: {}, hair: {}, textures: {} };
let total = 0; const note = (label, r) => { total += r.bytes; console.log(`${label.padEnd(34)} ${(r.bytes / 1024).toFixed(0).padStart(6)} KB${r.size ? '  ' + r.size + ' px' : ''}`); };

// bodies: <Type>_<Female|Male>_FullBody.gltf with T_<Type>_<Sex>_<tone|Normal|Roughness>.png
const seenBody = new Set();
for (const f of pick(/_FullBody\.gltf$/i)) {
  const name = base(f).replace(/_FullBody\.gltf$/i, ''), id = slug(name); if (seenBody.has(id)) continue; seenBody.add(id);
  const [type, sex] = name.split('_'), entry = { file: id + '.glb', type: type.toLowerCase(), sex: /female/i.test(sex) ? 'f' : 'm', tones: {}, ref: {} };
  const r = model(f, id, ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']); note(id + '.glb', r);
  // what the hair pieces are fitted by: the top of the head and the eyes; and which strand picture the eyebrows use
  const eyes = r.meshes.Eyes, brows = r.meshes.Eyebrows, body = Object.values(r.meshes).sort((a, b) => b.verts - a.verts)[0];
  entry.crown = r4(body.hi[1]); if (eyes) entry.eye = [r4(eyes.hi[0]), r4((eyes.lo[1] + eyes.hi[1]) / 2), r4(eyes.hi[2])]; if (brows) entry.brows = hairTex(brows.tex);
  const mine = [...new Map(pick(new RegExp('^T_' + name + '_.*\\.png$', 'i')).filter(p => !/_png\.png$/i.test(p)).map(p => [base(p).toLowerCase(), p])).values()];
  for (const p of mine) {
    const rest = base(p).slice(('T_' + name + '_').length).replace(/\.png$/i, '');
    if (/normal/i.test(rest)) { entry.normal = id + '-normal.webp'; note(entry.normal, await picture(p, id + '-normal', { quality: 92 })); }
    else if (/rough/i.test(rest)) { entry.rough = id + '-rough.webp'; note(entry.rough, await picture(p, id + '-rough', { quality: 86, grey: true })); }
    else { const tone = /dark/i.test(rest) ? 'dark' : /lig/i.test(rest) ? 'light' : slug(rest.replace(/_?basecolor/i, '')) || 'light'; entry.tones[tone] = `${id}-${tone}.webp`; entry.ref[tone] = await skinColour(p); note(entry.tones[tone], await picture(p, `${id}-${tone}`, { quality: 92 })); }
  }
  manifest.bodies[id] = entry;
}
// hair, beard, eyebrows: the meshes placed at the origin (they are hung on the head bone in the studio)
const hairFiles = pick(/^(Hair|Eyebrows)_.*\.gltf$/i).filter(f => !/rigged/i.test(f));
const seenHair = new Set();
for (const f of hairFiles) {
  const name = base(f).replace(/\.gltf$/i, ''), id = slug(name); if (seenHair.has(id)) continue; seenHair.add(id);
  const r = model(f, id, ['POSITION', 'NORMAL', 'TEXCOORD_0']); note(id + '.glb', r);
  // each piece is modelled on one of the heads: the one whose crown its top lies on, else told by its name
  const m = Object.values(r.meshes)[0], bodies = Object.entries(manifest.bodies), female = /female/i.test(name);
  const near = bodies.map(([k, b]) => [k, Math.abs(m.hi[1] - b.crown - 0.008)]).sort((a, b) => a[1] - b[1])[0];
  const named = bodies.find(([, b]) => b.sex === (female ? 'f' : 'm')) || bodies[0];
  manifest.hair[name.replace(/^Hair_/i, '')] = { file: id + '.glb', tex: hairTex(m.tex), on: near && near[1] < 0.03 ? near[0] : named && named[0] };
}
// hair pictures (strands; tinted in the studio), eyes
for (const n of [...new Set(Object.values(manifest.hair).map(h => h.tex))]) {
  const b = first(new RegExp(`^T_Hair_${n}_BaseColor\\.png$`, 'i')), nm = first(new RegExp(`^T_Hair_${n}_Normal\\.png$`, 'i'));
  if (b) { manifest.textures['hair' + n] = `hair${n}.webp`; note(`hair${n}.webp`, await picture(b, 'hair' + n, { quality: 90 })); }
  if (nm) { manifest.textures['hair' + n + 'n'] = `hair${n}-normal.webp`; note(`hair${n}-normal.webp`, await picture(nm, `hair${n}-normal`, { quality: 90, max: 1024 })); }
}
const eye = first(/^T_Eye_(?!Normal).*\.png$/i), eyeN = first(/^T_Eye_Normal\.png$/i);
if (eye) { manifest.textures.eye = 'eye.webp'; note('eye.webp', await picture(eye, 'eye', { quality: 96 })); }
if (eyeN) { manifest.textures.eyen = 'eye-normal.webp'; note('eye-normal.webp', await picture(eyeN, 'eye-normal', { quality: 96 })); }
const fist = fingers(); if (fist) manifest.fist = fist;

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
fs.mkdirSync('public/licenses', { recursive: true });
fs.writeFileSync('public/licenses/quaternius-kit.txt', `Character bodies, hairstyles and their textures in /kit are from the "Universal Base Characters" kit
by Quaternius (https://quaternius.com/packs/universalbasecharacters.html), released under
CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/).
They were converted for the web (GLB, WebP) by scripts/build-kit-assets.mjs; outfits, shoes and accessories are
drawn by the studio's own code.
`);
console.log(`${Object.keys(manifest.bodies).length} bodies, ${Object.keys(manifest.hair).length} hair pieces, ${(total / 1048576).toFixed(1)} MB in ${OUT}`);
