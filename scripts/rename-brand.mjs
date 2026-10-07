/* Renames the brand everywhere: text in every file, then file and folder names. It put "Harvex" in place of the
   first working name on 6 Oct 2026, and it is how a domain (or another name) goes in.
   STOP THE DEV SERVER FIRST: on Windows a running server holds lib/<name>3d open and the folder rename fails with
   EPERM after the text and the file names were already changed.
   Usage: node scripts/rename-brand.mjs <OLD> <NEW> [old-domain new-domain]
     node scripts/rename-brand.mjs HARVEX ZENO harvex.studio zeno.app
   OLD and NEW are replaced in three spellings (HARVEX, Harvex, harvex), the domain in two (lower and UPPER, as the link
   cards print it). Skips node_modules, .git, build output and binary files. Check first that NEW is not already a
   word in the project (`git grep -il <new>`): a character is called Nova, for one.
   Afterwards: node scripts/build-<new>-engine.mjs, node scripts/build-brand-images.mjs <NEW> <new-domain>, and
   replace the logo mark (public/<new>-icon.svg, public/favicon.svg) if the letter changed. A database made under the
   old name keeps working only for data: cookie and browser storage names change, so everyone signs in again. */
import {readdirSync, readFileSync, writeFileSync, renameSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [oldName, newName, oldDomain, newDomain] = process.argv.slice(2);
if (!/^[A-Za-z]{3,12}$/.test(oldName || '') || !/^[A-Za-z]{3,12}$/.test(newName || '')) { console.error('Usage: node scripts/rename-brand.mjs <OLD> <NEW> [old-domain new-domain]  (names: 3 to 12 letters)'); process.exit(1); }
const cap = s => s[0].toUpperCase() + s.slice(1).toLowerCase();
const rx = s => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
const RULES = [
 ...(oldDomain && newDomain ? [[rx(oldDomain.toUpperCase()), newDomain.toUpperCase()], [rx(oldDomain.toLowerCase()), newDomain.toLowerCase()]] : []),
 [rx(oldName.toUpperCase()), newName.toUpperCase()], [rx(cap(oldName)), cap(newName)], [rx(oldName.toLowerCase()), newName.toLowerCase()],
];
const swap = s => RULES.reduce((t, [a, b]) => t.replace(a, b), s);
const SKIP = new Set(['node_modules', '.git', '.next', '.vinext', 'dist', '.wrangler', 'exports', 'standalone']);

const files = [], dirs = [];
(function walk(d) {
 for (const n of readdirSync(d)) {
  if (SKIP.has(n)) continue;
  const p = join(d, n);
  if (statSync(p).isDirectory()) { walk(p); dirs.push(p); } else files.push(p);
 }
})(root);

let changed = 0; const binary = [];
for (const f of files) {
 const buf = readFileSync(f), text = buf.toString('utf8');
 // a file with NUL bytes, or one that does not survive the round trip, is not text we may rewrite
 if (buf.subarray(0, 8000).includes(0) || Buffer.compare(Buffer.from(text, 'utf8'), buf) !== 0) { if (rx(oldName.toLowerCase()).test(buf.toString('latin1').toLowerCase())) binary.push(f); continue; }
 const next = swap(text);
 if (next !== text) { writeFileSync(f, next); changed++; }
}
let renamed = 0;
// files first, then folders (deepest first: walk lists children before their parents)
for (const p of [...files, ...dirs]) {
 const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')), name = p.slice(i + 1), next = swap(name);
 if (next !== name) { renameSync(p, p.slice(0, i + 1) + next); renamed++; }
}
console.log(`${changed} files changed, ${renamed} files and folders renamed.`);
if (binary.length) console.log('Binary files that still contain the old name (pictures are redrawn by build-brand-images.mjs):\n ' + binary.join('\n '));
