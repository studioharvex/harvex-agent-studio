/* Draws the pictures that carry the brand name: the logo (mark + wordmark) and the default link preview.
     public/harvex-logo.png              1774x887, yellow on the black field (docs export, agent card renderer)
     public/brands/harvex-logo-lime.png  330x100, yellow on transparent (header of every link-preview card)
     public/og.png                     1600x900, the site's default link preview
   Usage: node scripts/build-brand-images.mjs [NAME] [domain]     (set CHROME=<path> if the browser is not found)
   Rendered with headless Chrome or Edge; the fonts come from Google Fonts, so it needs a connection. Run it again
   whenever the name or the domain changes. The mark is the one in public/harvex-icon.svg; the wordmark is the name in
   lowercase Outfit Bold, as in the Logo component (components/harvex/navbar.tsx). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = process.argv[2] || 'Harvex', WORD = NAME.toLowerCase(), DOMAIN = (process.argv[3] || 'harvex.example').toUpperCase();
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const candidates = [process.env.CHROME,
 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browser = candidates.find(p => fs.existsSync(p));
if (!browser) { console.error('No Chrome/Edge found (set CHROME=<path>).'); process.exit(1); }

const LIME = '#ffe600', FIELD = '#0a0a0a';
const mark = (size, fill = LIME) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109.26 100" width="${size * 109.26 / 100}" height="${size}"><path fill="${fill}" d="M17 20L45 20L41.18 38L62.18 38L49.08 62L36.08 62L28 100L0 100ZM81.26 0L109.26 0L92.25 80L64.25 80L68.08 62L55.08 62L68.18 38L73.18 38Z"/></svg>`;
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@700&family=Poppins:wght@400;700&family=JetBrains+Mono:wght@500&display=block">';
const page = (w, h, bg, body) => `<!doctype html><meta charset="utf-8">${fonts}<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg}}
.word{font-family:'Outfit','Arial Black',sans-serif;font-weight:700;letter-spacing:-.015em;color:${LIME};line-height:1}</style>${body}`;
// the lockup: the mark stands on the wordmark's baseline and is as tall as its ascender (0.726 em in Outfit)
const lockup = (h, gap) => `<div style="display:flex;align-items:baseline;gap:${gap}px">${mark(h)}<span class="word" style="font-size:${Math.round(h / .726)}px">${esc(WORD)}</span></div>`;
const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(root, f)).toString('base64');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-'));
function shot(file, w, h, html, transparent) {
 const src = path.join(tmp, path.basename(file) + '.html'); fs.writeFileSync(src, html);
 execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, '--virtual-time-budget=8000',
  ...(transparent ? ['--default-background-color=00000000'] : []), `--screenshot=${path.join(root, file)}`, pathToFileURL(src).href], {stdio: 'ignore'});
 console.log('wrote', file);
}

shot('public/harvex-logo.png', 1774, 887, page(1774, 887, FIELD,
 `<div style="height:100%;display:flex;align-items:center;justify-content:center;">${lockup(232, 70)}</div>`));
shot('public/brands/harvex-logo-lime.png', 330, 100, page(330, 100, 'transparent',
 `<div style="height:100%;display:flex;align-items:center;">${lockup(52, 15)}</div>`), true);
shot('public/og.png', 1600, 900, page(1600, 900, FIELD, `
<div style="position:absolute;inset:0;background:radial-gradient(900px 700px at 72% 62%,#1c1c1c 0,#111111 55%,${FIELD} 100%)"></div>
<div style="position:absolute;inset:0;opacity:.5;background-image:radial-gradient(#333333 1.2px,transparent 1.4px);background-size:30px 30px"></div>
<div style="position:absolute;left:70px;top:60px">${lockup(40, 12)}</div>
<div style="position:absolute;right:70px;top:66px;border:2px solid #3a3a3a;border-radius:10px;padding:13px 20px;font:500 17px 'JetBrains Mono',monospace;letter-spacing:3px;color:${LIME}">INTRODUCING</div>
<div style="position:absolute;left:70px;top:240px;width:760px;font:700 62px/1.12 Poppins,Arial,sans-serif;letter-spacing:-1px;color:#fafafa">Shape a character. <span style="color:${LIME}">Hand it</span> the work.</div>
<div style="position:absolute;left:70px;top:446px;width:760px;font:400 27px/1.45 Poppins,Arial,sans-serif;color:#bdbdbd">In ${esc(NAME)} an AI agent starts as a person on a stage. Restyle it, write its brief, add skills and send it off on tasks.</div>
<div style="position:absolute;left:70px;bottom:52px;font:500 17px 'JetBrains Mono',monospace;letter-spacing:3px;color:#8c8c8c">${esc(DOMAIN)} · PRIVATE PREVIEW</div>
<img src="${img('public/characters/deck/echo.png')}" style="position:absolute;left:740px;bottom:60px;height:700px">
<img src="${img('public/characters/deck/atlas.png')}" style="position:absolute;left:960px;bottom:60px;height:760px">
<img src="${img('public/characters/deck/maker.png')}" style="position:absolute;left:1190px;bottom:60px;height:730px">`));
fs.rmSync(tmp, {recursive: true, force: true});
