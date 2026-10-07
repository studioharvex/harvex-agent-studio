/* Link-preview cards as files (public/og/<key>.png), so that no host has to draw them inside a request.
   Why: on Cloudflare's free Workers plan a request gets too little CPU to draw a card; /api/og/page/<key> answered
   503 "Worker exceeded resource limits" there (6 Oct 2026). A file costs nothing to serve.

   node scripts/render-page-cards.mjs           draw every card of lib/page-cards.ts and write the files
   node scripts/render-page-cards.mjs --check   what `npm run build` does first (prebuild): nothing when the files
                                                are current; draws them when they are not and a server answers;
                                                stops the build when they are not and no server answers

   Drawing needs the site running (`npm run dev`); BASE=<url> names another address than http://localhost:5173.
   The cards are asked for with ?still=1: no live numbers and nothing from the database, so a card never carries
   what happened to be in a local database. "Current" = the mark in lib/page-card-files.ts equals the mark of what a
   card is drawn from: the card texts, the drawing code, the characters and the pictures a card shows. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const base = (process.env.BASE || 'http://localhost:5173').replace(/\/+$/, '');
const check = process.argv.includes('--check');
const outDir = path.join(root, 'public/og'), listFile = path.join(root, 'lib/page-card-files.ts');

const keys = [...fs.readFileSync(path.join(root, 'lib/page-cards.ts'), 'utf8').matchAll(/^ (\w+):\{path:'/gm)].map(m => m[1]);
if (keys.length < 10) { console.error('Could not read the card list from lib/page-cards.ts.'); process.exit(1); }

/* The mark of everything a card is drawn from. Text files are read without carriage returns, so a checkout with
   other line endings gives the same mark. */
function mark() {
  const h = createHash('sha256');
  const text = ['lib/page-cards.ts', 'app/api/og/page/[key]/route.tsx', 'lib/og-duel.tsx', 'lib/harvex3d/src/data.js', 'lib/chain.ts', 'lib/tiers.ts', 'lib/referrals.ts'];
  for (const f of text) h.update(f + '\n' + fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n'));
  for (const dir of ['public/characters/card', 'public/characters/deck']) for (const n of fs.readdirSync(path.join(root, dir)).sort()) h.update(dir + '/' + n).update(fs.readFileSync(path.join(root, dir, n)));
  h.update(fs.readFileSync(path.join(root, 'public/brands/harvex-logo-lime.png')));
  return h.digest('hex').slice(0, 16);
}
function known() {
  if (!fs.existsSync(listFile)) return null;
  const s = fs.readFileSync(listFile, 'utf8');
  const stamp = /CARD_STAMP='([0-9a-f]+)'/.exec(s)?.[1] || '';
  const files = Object.fromEntries([...s.matchAll(/^ '?(\w+)'?:'([0-9a-f]+)',$/gm)].map(m => [m[1], m[2]]));
  return {stamp, files};
}
const up = async () => { try { const r = await fetch(base + '/api/chain', {signal: AbortSignal.timeout(8000)}); return r.ok; } catch { return false; } };

const now = mark(), had = known();
const current = !!had && had.stamp === now && keys.every(k => had.files[k] && fs.existsSync(path.join(outDir, k + '.png'))) && Object.keys(had.files).length === keys.length;
if (check && current) { console.log(`Page cards: ${keys.length} files are current.`); process.exit(0); }
if (!(await up())) {
  if (check) console.error(`Page cards are out of date (a card text, the drawing code, a character or a picture changed) and no site answers at ${base}.\nStart it with "npm run dev", then run "npm run cards" (or build again while it runs).`);
  else console.error(`No site answers at ${base}. Start it with "npm run dev" (or set BASE=<url>), then run this again.`);
  process.exit(1);
}

fs.mkdirSync(outDir, {recursive: true});
const files = {};
for (const k of keys) {
  let body = null, why = '';
  for (let turn = 0; turn < 3 && !body; turn++) {
    // a new ?v= each turn: the route keeps a finished card by address, and a card with a gap must be drawn again
    const r = await fetch(`${base}/api/og/page/${k}?still=1&v=file-${now}-${turn}`, {signal: AbortSignal.timeout(90000)}).catch(e => ({status: 0, statusText: String(e)}));
    if (r.status !== 200 || !(r.headers.get('content-type') || '').startsWith('image/png')) { why = `answered ${r.status} ${r.statusText || ''}`; continue; }
    if (r.headers.get('x-card-gaps')) { why = 'a picture the card shows could not be loaded'; await r.arrayBuffer(); continue; }
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length < 5000 || b.readUInt32BE(0) !== 0x89504e47) { why = 'not a PNG'; continue; }
    body = b;
  }
  if (!body) { console.error(`Card "${k}" was not drawn: ${why}. Nothing was changed in lib/page-card-files.ts.`); process.exit(1); }
  fs.writeFileSync(path.join(outDir, k + '.png'), body);
  files[k] = createHash('sha256').update(body).digest('hex').slice(0, 10);
  console.log(`  ${k.padEnd(10)} ${(body.length / 1024).toFixed(0).padStart(4)} KB  ${files[k]}`);
}
for (const n of fs.readdirSync(outDir)) if (n.endsWith('.png') && !keys.includes(n.slice(0, -4))) fs.rmSync(path.join(outDir, n));
fs.writeFileSync(listFile, `/* GENERATED by scripts/render-page-cards.mjs: the link-preview cards that exist as files (public/og/<key>.png).
   The value is a mark of the file's content and goes into the picture's address. CARD_STAMP is the mark of what the
   cards were drawn from; \`npm run build\` compares it and draws the cards again when it no longer fits. */
export const CARD_STAMP='${now}';
export const CARD_FILES={
${keys.map(k => ` ${k}:'${files[k]}',`).join('\n')}
} as const;
`);
console.log(`Page cards: wrote ${keys.length} files to public/og and lib/page-card-files.ts.`);
