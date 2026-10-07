// Prepares animation clips for the parametric humans: public/sim/clips.json + clips.bin.
// Source: the "Universal Animation Library" (Standard) by Quaternius, CC0 1.0 (public/licenses/quaternius-kit.txt).
// The library is not kept in the repository: unpack it under .wrangler/ual and run
//   node scripts/build-sim-clips.mjs [the library's .glb]
//   (default: .wrangler/ual/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb)
// The library's skeleton has the same 52 limbs as the studio's rig under other names and another rest pose. So a clip
// is not copied bone by bone; for every frame and every bone the script writes how far the bone is TURNED AWAY FROM
// ITS REST, seen in the character's own space (a "world delta"). The engine lays that turn over the same bone of the
// studio's body after bringing the bone to where the library's bone points at rest (dirs in clips.json), so the clip
// plays on any shape of body. Also written: where the hips are, relative to their rest (walk bob, sitting down).
// clips.bin is a gzip stream of 16-bit quaternions (4 per bone per frame, 30 frames a second) and 32-bit hip offsets.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SRC = process.argv[2] || '.wrangler/ual/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb', OUT = 'public/sim', FPS = 30;
if (!fs.existsSync(SRC)) { console.error(`Missing ${SRC}. See the header of this script.`); process.exit(1); }

/* the studio's clips: [id, parts of the library played one after the other, loop] */
const CLIPS = [
  ['idle', ['Idle_Loop'], true], ['chat', ['Idle_Talking_Loop'], true], ['dance', ['Dance_Loop'], true],
  ['walk', ['Walk_Loop'], true], ['stroll', ['Walk_Formal_Loop'], true], ['jog', ['Jog_Fwd_Loop'], true],
  ['jump', ['Jump_Start', 'Jump_Land'], false],
  ['sitDown', ['Sitting_Enter'], false], ['sit', ['Sitting_Idle_Loop'], true], ['sitChat', ['Sitting_Talking_Loop'], true],
  ['crouch', ['Crouch_Idle_Loop'], true], ['pickup', ['PickUp_Table'], false], ['use', ['Interact'], false], ['tinker', ['Fixing_Kneeling'], false],
  ['cast', ['Spell_Simple_Enter', 'Spell_Simple_Idle_Loop', 'Spell_Simple_Shoot', 'Spell_Simple_Exit'], false],
  ['jab', ['Punch_Enter', 'Punch_Jab', 'Punch_Cross'], false], ['roll', ['Roll'], false], ['drive', ['Driving_Loop'], true],
];
/* the library's bones -> the studio's (rig.game_engine of the MakeHuman pack) */
const side = (a, b) => [['.L', '_l'], ['.R', '_r']].map(([s, t]) => ['DEF-' + a + s, b + t]);
const BONES = [['DEF-hips', 'pelvis'], ['DEF-spine.001', 'spine_01'], ['DEF-spine.002', 'spine_02'], ['DEF-spine.003', 'spine_03'], ['DEF-neck', 'neck_01'], ['DEF-head', 'head'],
  ...side('shoulder', 'clavicle'), ...side('upper_arm', 'upperarm'), ...side('forearm', 'lowerarm'), ...side('hand', 'hand'),
  ...['index', 'middle', 'ring', 'pinky'].flatMap(f => [1, 2, 3].flatMap(k => side(`f_${f}.0${k}`, `${f}_0${k}`))), ...[1, 2, 3].flatMap(k => side(`thumb.0${k}`, `thumb_0${k}`)),
  ...side('thigh', 'thigh'), ...side('shin', 'calf'), ...side('foot', 'foot'), ...side('toe', 'ball')];

/* ---------- read the .glb ---------- */
const buf = fs.readFileSync(SRC), jl = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8')), bin = buf.subarray(20 + jl + 8);
const acc = i => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type]; return new Float32Array(bin.buffer.slice(bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0), bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0) + a.count * n * 4)); };
const nodes = json.nodes, parent = new Array(nodes.length).fill(-1); nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
const byName = {}; nodes.forEach((n, i) => { byName[n.name] = i; });
const order = []; { const visit = i => { order.push(i); (nodes[i].children || []).forEach(visit); }; nodes.forEach((n, i) => { if (parent[i] < 0) visit(i); }); }

/* ---------- quaternion helpers ([x, y, z, w]) ---------- */
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = q => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
const qnorm = q => { const l = Math.hypot(...q) || 1; return q.map(x => x / l); };
const slerp = (a, b, t) => { let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map(x => -x); d = -d; } if (d > 0.9995) return qnorm(a.map((x, i) => x + (b[i] - x) * t));
  const th = Math.acos(d), s = Math.sin(th), k0 = Math.sin((1 - t) * th) / s, k1 = Math.sin(t * th) / s; return a.map((x, i) => x * k0 + b[i] * k1); };

/* ---------- a pose: every node's place in the character's space ---------- */
const rest = nodes.map(n => ({ t: n.translation || [0, 0, 0], r: n.rotation || [0, 0, 0, 1], s: n.scale || [1, 1, 1] }));
function world(local) {
  const W = new Array(nodes.length);
  for (const i of order) { const l = local[i], p = parent[i] < 0 ? { r: [0, 0, 0, 1], t: [0, 0, 0], s: 1 } : W[parent[i]];
    const t = qrot(p.r, l.t.map(x => x * p.s)); W[i] = { r: qmul(p.r, l.r), t: [p.t[0] + t[0], p.t[1] + t[1], p.t[2] + t[2]], s: p.s * l.s[0] }; }
  return W;
}
const W0 = world(rest), hips = byName['DEF-hips'];
const anims = {}; for (const a of json.animations) anims[a.name] = a;
function sampler(a) {
  const tracks = []; let dur = 0;
  for (const c of a.channels) { const s = a.samplers[c.sampler], time = acc(s.input), val = acc(s.output), n = c.target.path === 'rotation' ? 4 : 3, cubic = s.interpolation === 'CUBICSPLINE';
    dur = Math.max(dur, time[time.length - 1]); tracks.push({ node: c.target.node, path: c.target.path, time, val, n, cubic }); }
  const at = t => { const local = rest.map(r => ({ t: r.t, r: r.r, s: r.s }));
    for (const k of tracks) { const T = k.time; let i = 0; while (i < T.length - 2 && T[i + 1] <= t) i++;
      const j = Math.min(i + 1, T.length - 1), f = T[j] > T[i] ? Math.min(1, Math.max(0, (t - T[i]) / (T[j] - T[i]))) : 0, step = k.cubic ? k.n * 3 : k.n, o = k.cubic ? k.n : 0;
      const a0 = Array.from(k.val.subarray(i * step + o, i * step + o + k.n)), b0 = Array.from(k.val.subarray(j * step + o, j * step + o + k.n));
      const v = k.path === 'rotation' ? slerp(a0, b0, f) : a0.map((x, q) => x + (b0[q] - x) * f);
      if (k.path === 'rotation') local[k.node].r = v; else if (k.path === 'translation') local[k.node].t = v; else if (k.path === 'scale') local[k.node].s = v; }
    return local; };
  return { at, dur };
}

/* ---------- write ---------- */
const src = BONES.map(([a]) => { const i = byName[a]; if (i === undefined) throw new Error('the library has no bone ' + a); return i; });
// where each bone points at rest (the library's bones lie along their own +Y)
const dirs = src.map(i => qrot(W0[i].r, [0, 1, 0]).map(x => +x.toFixed(5)));
const leftIsPlusX = W0[byName['DEF-thigh.L']].t[0] > 0;
const quats = [], hip = [], list = {};
for (const [id, parts, loop] of CLIPS) {
  const start = quats.length / (BONES.length * 4); let frames = 0;
  for (const p of parts) { const a = anims[p]; if (!a) throw new Error('the library has no clip ' + p); const s = sampler(a), n = Math.max(2, Math.round(s.dur * FPS) + (loop && parts.length === 1 ? 0 : 1));
    for (let f = 0; f < n; f++) { const W = world(s.at(Math.min(s.dur, f / FPS)));
      for (const i of src) { const d = qnorm(qmul(W[i].r, qinv(W0[i].r))); quats.push(...d.map(x => Math.round(x * 32767))); }
      hip.push(W[hips].t[0] - W0[hips].t[0], W[hips].t[1] - W0[hips].t[1], W[hips].t[2] - W0[hips].t[2]); frames++; } }
  list[id] = [start, frames, loop ? 1 : 0];
}
const q16 = new Int16Array(quats), h32 = new Float32Array(hip), pad = (4 - q16.byteLength % 4) % 4;
const body = Buffer.concat([Buffer.from(q16.buffer), Buffer.alloc(pad), Buffer.from(h32.buffer)]), gz = zlib.gzipSync(body, { level: 9 });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'clips.bin'), gz);
fs.writeFileSync(path.join(OUT, 'clips.json'), JSON.stringify({ source: 'Universal Animation Library (Standard) by Quaternius, CC0 1.0', fps: FPS, bones: BONES.map(b => b[1]), dirs, hipY: +W0[hips].t[1].toFixed(4), leftIsPlusX,
  clips: list, sections: { q: ['Int16', 0, q16.length], hip: ['Float32', q16.byteLength + pad, h32.length] } }));
const secs = Object.values(list).reduce((s, c) => s + c[1], 0) / FPS;
console.log(`${Object.keys(list).length} clips, ${secs.toFixed(1)} s at ${FPS} fps, ${BONES.length} bones -> ${(gz.length / 1024).toFixed(0)} KB (left is +x: ${leftIsPlusX}, hips at ${W0[hips].t[1].toFixed(3)} m)`);
