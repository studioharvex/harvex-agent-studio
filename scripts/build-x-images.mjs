/* Pictures for the X account: the profile picture, the banner and the logo as files to hand out.
     exports/x/harvex-x-avatar.png            800x800   black mark on the yellow tile (X cuts it to a circle)
     exports/x/harvex-x-avatar-dark.png       800x800   yellow mark on black
     exports/x/harvex-x-banner.png            1500x500  black field, the headline, four of the cast on a yellow slab
     exports/x/harvex-x-banner-yellow.png     1500x500  the same on a yellow field
     exports/x/harvex-x-banner-text.png, -text-yellow.png, -text-white.png   1500x500  words only, no people
     exports/x/harvex-logo-yellow-on-black.png, -black-on-white.png          1600x800
     exports/x/harvex-logo-yellow.png, -black.png, -white.png                1600x480, no background
     exports/x/harvex-x-post-stage.png   1600x900  the picture of the introduction post: a text box, and the stage
     exports/x/harvex-x-banner-stage.png 1500x500  the same thought as a header
   Usage: node scripts/build-x-images.mjs [NAME]      (set CHROME=<path> if the browser is not found)
   Headless Chrome or Edge draws them; the type comes from Google Fonts, so it needs a connection. The mark and the
   word are the ones of scripts/build-brand-images.mjs and the Logo component. On X the profile picture covers the
   lower left of the banner and phones cut a little off its top and bottom: nothing that matters stands there. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = process.argv[2] || 'Harvex', WORD = NAME.toLowerCase(), FILE = WORD;
const out = path.join(root, 'exports/x'); fs.mkdirSync(out, {recursive: true});
const candidates = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browser = candidates.find(p => fs.existsSync(p));
if (!browser) { console.error('No Chrome/Edge found (set CHROME=<path>).'); process.exit(1); }

const ORANGE = '#ffe600', INK = '#0a0a0a', WHITE = '#ffffff';   // ORANGE is the name of the slot: Harvex's brand fill is the signal yellow
const MARK = 'M17 20L45 20L41.18 38L62.18 38L49.08 62L36.08 62L28 100L0 100ZM81.26 0L109.26 0L92.25 80L64.25 80L68.08 62L55.08 62L68.18 38L73.18 38Z';
const mark = (h, fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109.26 100" width="${h * 1.0926}" height="${h}" style="flex:none"><path fill="${fill}" d="${MARK}"/></svg>`;
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@700&family=Inter+Tight:wght@300;500;700&family=JetBrains+Mono:wght@500&display=block">';
const page = (w, h, bg, body) => `<!doctype html><meta charset="utf-8">${fonts}<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg};font-family:'Inter Tight',Arial,sans-serif}
.word{font-family:'Outfit','Arial Black',sans-serif;font-weight:700;letter-spacing:-.015em;line-height:1}.mono{font:500 15px 'JetBrains Mono',monospace;letter-spacing:.2em;text-transform:uppercase}</style>${body}`;
const lockup = (h, gap, fill) => `<div style="display:flex;align-items:baseline;gap:${gap}px">${mark(h, fill)}<span class="word" style="font-size:${Math.round(h / .726)}px;color:${fill}">${WORD}</span></div>`;
const center = inner => `<div style="height:100%;display:flex;align-items:center;justify-content:center">${inner}</div>`;
const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(root, f)).toString('base64');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'));
function shot(name, w, h, html, transparent) {
 const src = path.join(tmp, name + '.html'); fs.writeFileSync(src, html);
 execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, '--virtual-time-budget=8000',
  ...(transparent ? ['--default-background-color=00000000'] : []), `--screenshot=${path.join(out, name)}`, pathToFileURL(src).href], {stdio: 'ignore'});
 console.log('wrote exports/x/' + name);
}

// profile picture: the mark sits a little above the middle of what the circle keeps
shot(`${FILE}-x-avatar.png`, 800, 800, page(800, 800, ORANGE, center(mark(330, INK))));
shot(`${FILE}-x-avatar-dark.png`, 800, 800, page(800, 800, INK, center(mark(330, ORANGE))));

// the logo as files
shot(`${FILE}-logo-yellow-on-black.png`, 1600, 800, page(1600, 800, INK, center(lockup(210, 62, ORANGE))));
shot(`${FILE}-logo-black-on-white.png`, 1600, 800, page(1600, 800, WHITE, center(lockup(210, 62, INK))));
for (const [n, c] of [['yellow', ORANGE], ['black', INK], ['white', WHITE]]) shot(`${FILE}-logo-${n}.png`, 1600, 480, page(1600, 480, 'transparent', center(lockup(210, 62, c))), true);

// banner: words on the left above where the profile picture will sit, four of the cast on a slab on the right
const cast = [['echo', 880, 372], ['atlas', 1010, 420], ['juno', 1150, 396], ['maker', 1284, 408]];
const figures = cast.map(([id, left, h]) => `<img src="${img(`public/characters/deck/${id}.png`)}" style="position:absolute;left:${left}px;bottom:26px;height:${h}px">`).join('');
const banner = (bg, fg, soft, slab, tab, word) => page(1500, 500, bg, `
<div style="position:absolute;left:820px;top:96px;right:-40px;bottom:-40px;background:${slab};border-radius:44px 0 0 0"></div>
<div style="position:absolute;left:820px;top:60px;height:38px;padding:0 20px;display:flex;align-items:center;background:${slab};border-radius:16px 16px 0 0;color:${tab}" class="mono">Now standing</div>
<div style="position:absolute;left:1010px;top:150px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.22)"></div>
${figures}
<div style="position:absolute;left:96px;top:66px">${lockup(34, 11, word)}</div>
<div style="position:absolute;left:96px;top:142px;font-size:66px;line-height:1.02;letter-spacing:-.045em;color:${fg}"><div style="font-weight:300">Shape a character.</div><div style="font-weight:700">Hand it the work.</div></div>
<div class="mono" style="position:absolute;left:98px;top:304px;color:${soft}">Character-first AI agents · private preview</div>`);
shot(`${FILE}-x-banner.png`, 1500, 500, banner(INK, '#fafafa', '#8c8c8c', ORANGE, INK, ORANGE));
shot(`${FILE}-x-banner-yellow.png`, 1500, 500, banner(ORANGE, INK, 'rgba(10,10,10,.62)', INK, '#fafafa', INK));
// the banner in words only (user, 6 Oct 2026: "the banner without the people, text only"): everything stands in the
// middle, clear of the profile picture at the lower left
const words = (bg, fg, soft, word) => page(1500, 500, bg, `
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
 <div style="margin-bottom:34px">${lockup(36, 12, word)}</div>
 <div style="font-size:84px;line-height:1.02;letter-spacing:-.045em;color:${fg}"><span style="font-weight:300">Shape a character.</span> <span style="font-weight:700">Hand it the work.</span></div>
 <div class="mono" style="margin-top:34px;color:${soft}">Character-first AI agents · private preview</div>
</div>`);
shot(`${FILE}-x-banner-text.png`, 1500, 500, words(INK, '#fafafa', '#8c8c8c', ORANGE));
shot(`${FILE}-x-banner-text-yellow.png`, 1500, 500, words(ORANGE, INK, 'rgba(10,10,10,.62)', INK));
shot(`${FILE}-x-banner-text-white.png`, 1500, 500, words(WHITE, INK, '#6b6b72', INK));
// the picture of the introduction post (user, 7 Oct 2026, for "Most agents are a text box. Ours stand on a stage:
// 25 people you can restyle, brief and equip with skills ..."): a dull text box on the left, the stage on the right
const five = [['echo', 0, .86], ['lumi', 1, .9], ['atlas', 2, 1], ['juno', 3, .92], ['maker', 4, .96]];
const stage = (w, h, o) => {
 const L = o.left, T = o.top, W = w - L + 40, per = (w - L - o.pad * 2) / five.length;
 return `<div style="position:absolute;left:${L}px;top:${T + 42}px;width:${W}px;bottom:-40px;background:${ORANGE};border-radius:${o.r}px 0 0 0"></div>
<div class="mono" style="position:absolute;left:${L}px;top:${T}px;height:44px;padding:0 22px;display:flex;align-items:center;background:${ORANGE};border-radius:18px 18px 0 0;color:${INK};font-size:${o.mono}px">On stage · 25 people</div>
<div style="position:absolute;left:${L + (w - L) / 2 - o.disc / 2}px;bottom:${-o.disc * .42}px;width:${o.disc}px;height:${o.disc}px;border-radius:50%;background:rgba(255,255,255,.26)"></div>
${five.map(([id, i, k]) => `<img src="${img(`public/characters/deck/${id}.png`)}" style="position:absolute;left:${L + o.pad + per * i + per / 2 - o.tall * k * .375}px;bottom:${o.foot}px;height:${o.tall * k}px">`).join('')}`;
};
const box = (x, y, w, fs2) => `<div class="mono" style="position:absolute;left:${x}px;top:${y}px;color:#6b6b72;font-size:${fs2 * .62}px">Most agents</div>
<div style="position:absolute;left:${x}px;top:${y + fs2 * 1.5}px;width:${w}px;height:${fs2 * 3.1}px;box-sizing:border-box;border:2px solid #2e2e33;border-radius:${fs2 * .8}px;display:flex;align-items:center;padding:0 ${fs2 * .5}px 0 ${fs2 * 1.1}px;color:#5a5a62;font-size:${fs2}px">
 <span style="flex:1">Ask anything<span style="display:inline-block;width:2px;height:${fs2 * 1.1}px;background:#5a5a62;margin-left:6px;vertical-align:-3px"></span></span>
 <span style="width:${fs2 * 2.1}px;height:${fs2 * 2.1}px;border-radius:${fs2 * .6}px;background:#1d1d21;display:flex;align-items:center;justify-content:center;color:#5a5a62;font-size:${fs2 * 1.1}px">↑</span></div>`;
shot(`${FILE}-x-post-stage.png`, 1600, 900, page(1600, 900, INK, `
${stage(1600, 900, {left: 800, top: 150, r: 52, pad: 30, disc: 760, tall: 600, foot: 38, mono: 16})}
<div style="position:absolute;left:84px;top:70px">${lockup(40, 13, ORANGE)}</div>
${box(86, 196, 560, 24)}
<div style="position:absolute;left:84px;top:356px;width:680px;font-size:68px;line-height:1.03;letter-spacing:-.045em"><div style="font-weight:300;color:#8c8c8c">Most agents are<br>a text box.</div><div style="font-weight:700;color:#fafafa;margin-top:14px">Ours stand<br>on a stage.</div></div>
<div style="position:absolute;left:86px;top:690px;width:620px;font-size:25px;line-height:1.4;color:#b6b6bc">25 people you can restyle, brief and equip with skills for research, writing, translation and code.</div>
<div class="mono" style="position:absolute;left:86px;bottom:54px;width:660px;line-height:1.9;color:#8c8c8c;font-size:16px"><span style="color:#fafafa">Shape a character. Hand it the work.</span><br>Private preview, opening in stages</div>`));
shot(`${FILE}-x-banner-stage.png`, 1500, 500, page(1500, 500, INK, `
${stage(1500, 500, {left: 800, top: 56, r: 44, pad: 24, disc: 470, tall: 372, foot: 24, mono: 14})}
<div style="position:absolute;left:96px;top:60px">${lockup(32, 10, ORANGE)}</div>
<div style="position:absolute;left:96px;top:132px;width:660px;font-size:56px;line-height:1.04;letter-spacing:-.045em"><div style="font-weight:300;color:#8c8c8c">Most agents are a text box.</div><div style="font-weight:700;color:#fafafa">Ours stand on a stage.</div></div>
<div class="mono" style="position:absolute;left:98px;top:286px;color:#8c8c8c;font-size:14px">Shape a character. Hand it the work. · Private preview</div>`));
fs.rmSync(tmp, {recursive: true, force: true});
