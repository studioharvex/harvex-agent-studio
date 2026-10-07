// Builds public/sim/lite: the light copy of the character pack that the home page's live stage loads.
//
// Why: a live character from the whole pack costs about 6 MB for the first one (4.4 MB of that is the shape targets
// of the character creator) and 9 MB for the seven people on the home page. The user asked for a quarter of that
// (6 Oct 2026). The light pack holds only what those seven need:
//   - core: the base mesh and the expression units, NO shape targets. Each cast member's body is a finished shape
//     of its own (lite/shape/<id>), worked out once by the engine and stored as the distance of every vertex from
//     the base mesh. So a light character cannot be reshaped: the Studio always uses the whole pack.
//   - pieces: only the hair, outfits, shoes, brows, lashes and eyes the cast wears; no teeth, no normal maps.
//   - pictures at half size, three clips (idle, chat, use).
//   - numbers as 16-bit integers (`q` in a file's meta = the scale) and, where it packs better, as steps from the
//     entry `stride` places before (`dz`). lib/harvex3d/src/e2c-sim.js unpack() turns both back.
// The cast is read from CAST in components/landing/hero.tsx.
//
// The shapes need the engine, so this runs in two halves, like the character pictures:
//   1. npm run dev                          (http://localhost:5173)
//   2. node scripts/build-sim-lite.mjs      (waits on 127.0.0.1:5196)
//   3. open http://localhost:5173 and paste the printed snippet into the browser console
// The script then writes the pack, prints what each cast member costs to load, and exits.
// Run again after: a change to the cast, to a cast member's look (lib/harvex3d/src/data.js), to STYLE / HEAD_SCALE
// in e2c-sim.js, or after scripts/build-sim-assets.mjs / build-sim-clips.mjs rebuilt the whole pack.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';

const PORT = Number(process.env.LITE_PORT || 5196), SRC = 'public/sim', OUT = 'public/sim/lite';
const CLIPS = ['idle', 'chat', 'use'], SKIP = /^teeth\//;
const hero = fs.readFileSync('components/landing/hero.tsx', 'utf8');
const castBlock = /const CAST[^=]*=\[([\s\S]*?)\];/.exec(hero);
if (!castBlock) throw new Error('CAST not found in components/landing/hero.tsx');
const CAST = [...castBlock[1].matchAll(/\{id:'([a-z0-9-]+)'/g)].map(m => m[1]);
if (!CAST.length) throw new Error('CAST is empty');

const BYTES = { Float32: 4, Uint16: 2, Uint8: 1, Int16: 2 }, VIEW = { Float32: Float32Array, Uint16: Uint16Array, Uint8: Uint8Array, Int16: Int16Array };
const gz = b => zlib.gzipSync(b, { level: 9 });
const readPack = (json, bin) => { const meta = JSON.parse(fs.readFileSync(json, 'utf8')), buf = zlib.gunzipSync(fs.readFileSync(bin)), o = { meta };
  for (const k in meta.sections) { const [t, off, len] = meta.sections[k]; o[k] = new VIEW[t](buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + len * BYTES[t])); } return o; };
/** A file of named lists. `q`: store a float list as 16-bit integers; `dz`: store steps when that packs smaller. */
class Bin {
  constructor() { this.parts = []; this.len = 0; this.sections = {}; this.q = {}; this.dz = {}; }
  add(name, arr, o = {}) {
    if (o.q) {                                           // floats -> integers, 'u' for lists that are never negative
      let mx = 0; for (const v of arr) mx = Math.max(mx, Math.abs(v)); mx = mx || 1;
      // `step`: a fixed size of one unit (lengths: a tenth of a millimetre is plenty); `bits`: fewer levels than 16
      const bits = o.bits || 16, top = o.step ? mx / o.step : o.q === 'u' ? 2 ** bits - 1 : 2 ** (bits - 1) - 1, a = new (o.q === 'u' ? Uint16Array : Int16Array)(arr.length);
      if (top > (o.q === 'u' ? 65535 : 32767)) throw new Error(name + ': the step is too small for 16 bits');
      for (let i = 0; i < arr.length; i++) a[i] = Math.round(arr[i] / mx * top);
      this.q[name] = mx / top; arr = a;
    }
    if (o.dz && arr.BYTES_PER_ELEMENT <= 2) {            // try steps of a few strides, keep the smallest
      let best = gz(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)).length, pick = 0, kept = arr;
      for (const st of o.dz) { if (st >= arr.length) continue; const d = new arr.constructor(arr); for (let i = arr.length - 1; i >= st; i--) d[i] = arr[i] - arr[i - st];
        const n = gz(Buffer.from(d.buffer, d.byteOffset, d.byteLength)).length; if (n < best * 0.97) { best = n; pick = st; kept = d; } }
      if (pick) { this.dz[name] = pick; arr = kept; }
    }
    const pad = (4 - this.len % 4) % 4; if (pad) { this.parts.push(Buffer.alloc(pad)); this.len += pad; }
    const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    this.sections[name] = [arr.constructor.name.replace('Array', ''), this.len, arr.length]; this.parts.push(b); this.len += b.length;
  }
  meta(extra) { const m = { ...extra, sections: this.sections }; if (Object.keys(this.q).length) m.q = this.q; if (Object.keys(this.dz).length) m.dz = this.dz; return m; }
  write(file, extra) { fs.mkdirSync(path.dirname(file), { recursive: true }); const z = gz(Buffer.concat(this.parts)); fs.writeFileSync(file + '.bin', z);
    const j = Buffer.from(JSON.stringify(this.meta(extra))); fs.writeFileSync(file + '.json', j); return z.length + j.length; }
}
const kb = n => (n / 1024).toFixed(0) + ' KB';

async function build(baked) {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + '/tex', { recursive: true });
  const size = {};                                       // file (relative to the pack) -> bytes
  const index = JSON.parse(fs.readFileSync(SRC + '/index.json', 'utf8'));

  // --- core: the base mesh and the expression units
  { const c = readPack(SRC + '/core.json', SRC + '/core.bin'), m = c.meta, bin = new Bin();
    bin.add('pos', c.pos, { q: 's', step: 5e-5, dz: [3] }); bin.add('bodyV', c.bodyV, { dz: [1] }); bin.add('bodyUV', c.bodyUV, { q: 'u', bits: 13, dz: [2] }); bin.add('bodyIdx', c.bodyIdx, { dz: [1, 3] });
    bin.add('skinI', c.skinI); bin.add('skinW', c.skinW);
    const names = Object.keys(m.units), targets = [], units = {}, idx = [], del = [];
    for (const n of names) { const t = m.targets[m.units[n]]; units[n] = targets.length; targets.push([t[0], idx.length, t[2], t[3]]);
      for (let i = t[1]; i < t[1] + t[2]; i++) { idx.push(c.tIdx[i]); del.push(c.tDel[i * 3], c.tDel[i * 3 + 1], c.tDel[i * 3 + 2]); } }
    bin.add('tIdx', new Uint16Array(idx)); bin.add('tDel', new Int16Array(del));
    size['core'] = bin.write(OUT + '/core', { source: m.source, lite: true, nV: m.nV, joints: m.joints, helpers: m.helpers, bones: m.bones, targets, macro: [], sliders: [], shapes: {}, units });
    console.log(`core: ${m.nV} vertices, ${targets.length} expression units of ${m.targets.length} targets -> ${kb(size.core)} (whole pack: ${kb(fs.statSync(SRC + '/core.bin').size)})`); }

  // --- the cast's shapes
  for (const id of CAST) { const d = new Float32Array(baked[id].delta.buffer, baked[id].delta.byteOffset, baked[id].delta.byteLength / 4), bin = new Bin();
    bin.add('d', d, { q: 's', step: 2e-4, dz: [3] }); size['shape/' + id] = bin.write(`${OUT}/shape/${id}`, { id }); }
  console.log(`shapes: ${CAST.map(id => id + ' ' + kb(size['shape/' + id])).join(', ')}`);

  // --- pieces and their pictures
  const pieces = [...new Set(CAST.flatMap(id => baked[id].pieces))].filter(p => !SKIP.test(p)).sort(), tex = new Set(), liteIndex = { pieces: {}, skins: {}, eyes: { brown: index.eyes.brown }, sliders: [] };
  for (const p of pieces) { const [kind, name] = p.split('/'), pc = readPack(`${SRC}/p/${p}.json`, `${SRC}/p/${p}.bin`), m = pc.meta, bin = new Bin();
    bin.add('ref', pc.ref, { dz: [3] }); bin.add('w', pc.w, { q: 's', bits: 12 }); bin.add('off', pc.off, { q: 's', bits: 12, dz: [3] }); bin.add('v', pc.v, { dz: [1] }); bin.add('uv', pc.uv, { q: 's', bits: 13, dz: [2] }); bin.add('idx', pc.idx, { dz: [1, 3] });
    const { sections, tex: tx, ...rest } = m, keep = {}; for (const k in tx) if (tx[k] && k !== 'normal') { keep[k] = tx[k]; tex.add(tx[k]); }
    size['p/' + p] = bin.write(`${OUT}/p/${p}`, { ...rest, tex: keep });
    (liteIndex.pieces[kind] = liteIndex.pieces[kind] || {})[name] = index.pieces[kind][name]; }
  for (const id of CAST) { const s = baked[id].skin; liteIndex.skins[s] = index.skins[s]; tex.add(index.skins[s].file); tex.add(baked[id].eye);
    for (const k in index.eyes) if (index.eyes[k] === baked[id].eye) liteIndex.eyes[k] = baked[id].eye; }
  tex.add(index.eyes.brown);
  // skin and eye pictures are small already and go as they are; the rest is written again, at most 512 wide (brows and lashes 256: they cover a few pixels of the face)
  for (const f of tex) { const src = `${SRC}/tex/${f}`, meta = await sharp(src).metadata(), asIs = /^(skin|eye)-/.test(f), to = /^(brows|lashes)-/.test(f) ? 256 : 512, half = meta.width > to;
    const out = asIs ? fs.readFileSync(src) : await (half ? sharp(src).resize(to, Math.round(meta.height * to / meta.width), { kernel: 'lanczos3' }) : sharp(src)).webp({ quality: /-tint./.test(f) ? 62 : 72, alphaQuality: 80, effort: 6 }).toBuffer();
    fs.writeFileSync(`${OUT}/tex/${f}`, out); size['tex/' + f] = out.length; }
  { const j = Buffer.from(JSON.stringify(liteIndex)); fs.writeFileSync(OUT + '/index.json', j); size.core += j.length; }

  // --- clips
  { const c = readPack(SRC + '/clips.json', SRC + '/clips.bin'), m = c.meta, nb = m.bones.length, q = [], hip = [], list = {}; let at = 0;
    for (const id of CLIPS) { const e = m.clips[id]; if (!e) throw new Error('no clip ' + id); const [s, n, loop] = e; list[id] = [at, n, loop]; at += n;
      for (let i = s * nb * 4; i < (s + n) * nb * 4; i++) q.push(c.q[i]); for (let i = s * 3; i < (s + n) * 3; i++) hip.push(c.hip[i]); }
    const bin = new Bin(); bin.add('q', new Int16Array(q), { dz: [4, nb * 4] }); bin.add('hip', new Float32Array(hip));
    const { sections, clips, ...rest } = m; size.clips = bin.write(OUT + '/clips', { ...rest, clips: list });
    console.log(`clips: ${CLIPS.join(', ')} (${at} of ${Object.values(m.clips).reduce((a, e) => a + e[1], 0)} frames) -> ${kb(size.clips)}`); }

  // --- what a visitor loads, in the order the stage shows the cast
  const seen = new Set(); let total = 0; const need = id => ['core', 'clips', 'shape/' + id, ...baked[id].pieces.filter(p => !SKIP.test(p)).flatMap(p => ['p/' + p, ...Object.values(JSON.parse(fs.readFileSync(`${OUT}/p/${p}.json`, 'utf8')).tex).map(t => 'tex/' + t)]),
    'tex/' + index.skins[baked[id].skin].file, 'tex/' + baked[id].eye];
  console.log('\nloaded by the home page, in order:');
  for (const id of CAST) { let n = 0; for (const f of need(id)) if (!seen.has(f)) { seen.add(f); n += size[f] || 0; } total += n; console.log(`  ${id.padEnd(8)} ${kb(n).padStart(8)}   running total ${kb(total)}`); }
  const all = fs.readdirSync(OUT, { recursive: true }).map(f => path.join(OUT, f)).filter(f => fs.statSync(f).isFile()).reduce((a, f) => a + fs.statSync(f).size, 0);
  console.log(`\n${pieces.length} pieces, ${tex.size} pictures; everything in ${OUT}: ${kb(all)}`);
}

const baked = {};
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
  if (req.method !== 'POST' || !CAST.includes(id)) { res.statusCode = 400; res.end('bad request'); return; }
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', async () => {
    try { const j = JSON.parse(Buffer.concat(chunks).toString()); baked[id] = { pieces: j.pieces, skin: j.skin, eye: j.eye, delta: Buffer.from(j.delta, 'base64') };
      console.log(`got ${id}: ${j.pieces.length} pieces, shape of ${baked[id].delta.length / 12} vertices`); res.end('ok');
      if (CAST.every(c => baked[c])) { server.close(); await build(baked); process.exit(0); }
    } catch (e) { res.statusCode = 400; res.end(String(e)); console.error(e); }
  });
});
server.listen(PORT, '127.0.0.1', () => console.log(`Waiting on http://127.0.0.1:${PORT} for the shapes of: ${CAST.join(', ')}. Paste this in the console of http://localhost:5173:

(async()=>{const {loadEngine}=await import('/app/avatar.tsx');const R=await loadEngine();
const {lookFor}=await import('/lib/characters.ts');
const b64=a=>{const u=new Uint8Array(a.buffer);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s);};
for(const id of ${JSON.stringify(CAST)}){const L=R.normalizeLook(lookFor(id));await R.sim.ensure(L);const k=R.sim.bake(L);
 await fetch('http://127.0.0.1:${PORT}/bake?id='+id,{method:'POST',body:JSON.stringify({pieces:k.pieces,skin:k.skin,eye:k.eye,delta:b64(k.delta)})});}
return 'sent ${CAST.length} shapes';})()
`));
