/* Exports Docs, Whitepaper and Roadmap (lib/harvex3d/content.js) plus a feature-status page to
   exports/Harvex-Docs.md, exports/Harvex-Docs.html and exports/Harvex-Docs.pdf (headless Chrome or Edge).
   Usage: node scripts/export-docs.mjs            (set CHROME=<path> if the browser is not found) */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const out = path.join(root, 'exports');
fs.mkdirSync(out, {recursive: true});

const {CONTENT: C} = await import(pathToFileURL(path.join(root, 'lib/harvex3d/content.js')).href);
const date = C.version.split('·')[1]?.trim() || '';

/* Feature status by what the code actually does. Keep in sync with Docs "What is Harvex". */
const STATUS = [
 ['Working in the software today', 'live', [
  'Opening in stages: an operator can keep the studio, sign-in, the pages about listed agents and the on-chain pages closed; a closed page says "not open yet" and names what is open, and the API routes of a closed part refuse requests',
  'A roster of 25 people on three.js: parametric human bodies that the browser shapes, dresses and colours, with a character creator, an outfit editor, 33 motions (the everyday ones are recorded clips) and 6 powers',
  'Building an agent: a persona, a tone and as many as 4 of the 10 skills',
  'The Wallet monitor skill reads one address on BNB Smart Chain and writes nothing: its balances and what is different from the last check; the server must have a chain RPC for it',
  'Every one of the 10 skills is open and runs through an AI provider on the server side; a run is paid in credits, the operator may limit tries per skill, and a failed run returns the try',
  'Agents can be saved, duplicated, archived, exported and imported as JSON and passed on by share link; tasks are kept in a history',
  'Agent teams: two or three agents in a row, your own or ones other people published; a step is an ordinary run that builds on the answer of the previous step; four teams come set up; public page /teams',
  'Chat with an agent: every published agent has a chat on its page and answers there in its own voice; a message is a run costing 3 credits by default plus the chat price of the creator, which is set separately from the task price; the last six turns are sent along as context',
  'Creator agents: from posts that a creator pasted and confirmed as their own, the Studio drafts instructions and a tagline for an agent (a draft is 8 credits by default); no account is ever fetched from; public page /creators',
  'Verified creators: the creator posts a code from their X handle, a reviewer on the team confirms it, and from then on the handle appears on the agents that creator published; open only on servers whose operator named reviewers, and the server itself never reads X; public page /verified',
  'The plaza: on the public page /plaza up to twelve published agents stand in one row, most used first and one for each look; clicking one opens it in 3D with its chat',
  'Published agents in Telegram: an account that linked a Telegram chat or group can have an agent published by someone else answer there in its own voice; each answer costs the message price plus the price of the creator, taken from the credits of that account; there is a daily limit per chat, and a changed price stops the agent until it is confirmed; the operator must have connected a Telegram bot',
  'The weekly board (/top): ten published agents with the most use over the past seven days, counting only accounts other than their creators; different accounts decide the order first and runs second, and each agent shows where it stood in the seven days before; it records use and is no rating, and a place on it earns nothing',
  'Reports only after a change: at every slot a Wallet monitor or Whale watch schedule takes a look that uses no AI and costs nothing; it runs only if a balance or the count of sent transactions is different, or if a transfer of the chosen amount or more (100K to 10M HARVEX) or a new address among the ten biggest holders has appeared; the look happens at the slots of the schedule, hourly at best, so a change is reported at the next look; recipes Whale alarm and Wallet alarm',
  'The arena: two published agents get the same question as two ordinary chat messages, and both answers go on a public page /arena/<id> that has its own preview picture; an account has one pick, the creators of the two agents have none; picks count toward no rating, no ranking and no credits; whoever made the page can remove it',
  'Agent sources: an agent takes up to 8 pasted sources of 12,000 characters each, such as notes, an FAQ or an old thread; passages with words in common with a message are sent to the AI together with it, and the sources that were used are listed below the answer; matching goes by words and not by meaning, and a Web research run that browses gets no sources',
  'Notes, greeting and starter questions: an agent answers from notes of its creator, 4,000 characters at most, and begins a chat with a line of its own and as many as three questions',
  'Agent check: four real chat messages test whether an agent answers, does not hand over its instructions, gives no advice to buy or sell and says that it is an AI; after a pass it shows Checked for as long as its instructions are unchanged (a check is 8 credits by default; it is a check and no guarantee)',
  'Ratings: each answer can be marked helpful or not helpful; once three marks have come from other accounts, an agent shows its share of helpful ones, along with how many of its last fifty runs it answered',
  'Agent cards: a published agent has a card to show around, with a colour of its own, a serial number, the verified handle, its runs and its prices; its link displays the card and its page offers it as a download',
  'Share a conversation: a chat with an agent goes on a public page /s/<id>, holding the last answered message and at most five turns before it; sharing is opt-in, the page can be removed, and it has a preview picture of its own',
  'Recipes: four automations set up in advance (a daily whale brief, a wallet check, one post a day, a morning plan); a single click creates the agent and its schedule; public page /recipes',
  'Quests: eleven things to try out; the server checks each one and pays an account free credits for it a single time (5 by default); free credits can be neither claimed nor withdrawn',
  'Invite a friend: each account has an invite link; when the invited account has finished its first run, both sides receive free credits (10 by default); an account is rewarded for 20 invitations at most',
  'Share an answer: a run gets a public page /s/<id> showing the character of the agent, with a preview picture; it is opt-in for each run and can be removed; answers that used Google Search are excluded',
  'A marketplace paid by the run, in credits: 25 free credits to start, 4–12 credits for a live AI run according to the skill, creator prices from 0 to 500, a platform fee of 0% in the beta, and a ledger that records refunds',
  'The Discover gallery lists published agents (instructions are never shown)',
  'Schedules: an agent runs a skill 1–24 times a day; every run is charged at the live price of the skill, 5 credits or more; the limits are 3 schedules and 24 runs a day',
  'Delivery: the results of a schedule go to a Discord channel through a webhook, or to a Telegram chat on servers whose operator connected a bot; an account can have 4 channels',
  'Chat on Telegram, on servers whose operator connected a bot: people in a connected chat or group put questions to an agent (with /ask in a group); every answer is a paid live run, and each chat has a daily limit',
  'Sign-in by wallet only, using SIWE for BNB Smart Chain; one account can hold several wallets',
  'The docs, the whitepaper and the roadmap',
 ]],
 ['Finished and turned off', 'off', [
  'Buying credits with USDT on BNB Smart Chain, at 1 USDT = 100 credits by default: it turns on after the operator has set a pay token and a treasury; a local chain is the only place it was tested',
  'Holder tiers worked out from the HARVEX balance, bringing monthly credits, a smaller platform fee and more schedules, scheduled runs per day and delivery channels: they cannot start without the HARVEX token',
  'Whale watch: a skill and the public page /whales, both fed by the record the server keeps of the HARVEX token (the biggest transfers of the past 24 hours, new holders, biggest holders); it gives no prices and no owner names; it cannot work without the HARVEX token',
  'Holder rewards: each 3,000,000 HARVEX held earns at a fixed dollar rate, paid in a reward token out of a vault (HarvexClaims), and the holder does the claiming; a local chain is the only place it was tested; it cannot start without the HARVEX token, a reward token and a deployed vault',
  'Holder reward boost for inviters: 10% on top of their own holder reward for each invited friend who held a reward unit for the complete hour, with 5 friends (1.5x) as the most; it belongs to holder rewards',
  'Web research that really browses, through Gemini with Google Search or the web search of Claude or OpenAI: the provider plan has to include search, and without it the skill answers from the model and tells the user so',
  'Claiming earnings in USDT via the HarvexClaims contract, from 500 earned credits upward: the contract was written and tested locally; it has no audit and is not deployed',
 ]],
 ['Still to do', 'no', [
  'A hosted production studio: none has been deployed, and the domain is still a placeholder',
  'The HARVEX token: it has not launched and has no contract address',
  'The reward token: the plan names NVDAon, the tokenized Nvidia share of Ondo Global Markets, a third party that has not reviewed the plan; neither a reward vault nor a claims contract nor a multisig has been deployed',
  'An independent audit of HarvexClaims, which serves as reward vault and as claims contract',
  'A legal review of the token and of paying out rewards',
  'Tests of any kind on BNB Smart Chain, mainnet or testnet',
  'The 10% platform fee that follows the beta',
  'Watching the chain without a break (the Wallet monitor reads only during a run)',
 ]],
];

/* ---- markdown subset -> HTML (headings, paragraphs, lists, bold, italic, code, blockquote, tables) ---- */
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s)
 .replace(/`([^`]+)`/g, '<code>$1</code>')
 .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
 .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
function md(src) {
 const L = src.replace(/\r\n/g, '\n').trim().split('\n');
 let h = '', i = 0;
 while (i < L.length) {
  const l = L[i];
  if (!l.trim()) { i++; continue; }
  if (l.startsWith('```')) { const b = []; i++; while (i < L.length && !L[i].startsWith('```')) b.push(L[i++]); i++; h += `<pre>${esc(b.join('\n'))}</pre>`; continue; }
  const hd = /^(#{1,4})\s+(.*)/.exec(l); if (hd) { const n = hd[1].length + 2; h += `<h${n}>${inline(hd[2])}</h${n}>`; i++; continue; }
  if (l.startsWith('>')) { const b = []; while (i < L.length && L[i].startsWith('>')) b.push(L[i++].replace(/^>\s?/, '')); h += `<blockquote>${inline(b.join(' '))}</blockquote>`; continue; }
  if (l.startsWith('|')) {
   const rows = []; while (i < L.length && L[i].startsWith('|')) rows.push(L[i++]);
   const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
   const body = rows.slice(2).map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
   h += `<table><thead><tr>${cells(rows[0]).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`; continue;
  }
  if (/^(-|\d+\.)\s/.test(l)) {
   const ol = /^\d+\./.test(l), b = [];
   while (i < L.length && /^(-|\d+\.)\s/.test(L[i])) b.push(L[i++].replace(/^(-|\d+\.)\s+/, ''));
   h += `<${ol ? 'ol' : 'ul'}>${b.map(x => `<li>${inline(x)}</li>`).join('')}</${ol ? 'ol' : 'ul'}>`; continue;
  }
  const p = []; while (i < L.length && L[i].trim() && !/^(#|>|\||```|-\s|\d+\.\s)/.test(L[i])) p.push(L[i++]);
  h += `<p>${inline(p.join(' '))}</p>`;
 }
 return h;
}

const MARK = {done: 'Done', now: 'Now', next: 'Next', planned: 'Planned', idea: 'Idea'};
const docs = C.docs, paper = C.paper.sections, road = C.roadmap;

/* ---- Markdown ---- */
let M = `# Harvex — Docs, Whitepaper & Roadmap\n\n${C.version}\n\n`;
M += `## Feature status\n\n` + STATUS.map(([t, , items]) => `### ${t}\n\n${items.map(x => `- ${x}`).join('\n')}`).join('\n\n') + '\n\n';
M += `# Docs\n\n` + docs.map(d => `## ${d.title}\n\n${d.body.trim()}`).join('\n\n') + '\n\n';
M += `# ${C.paper.title}\n\n_${C.paper.subtitle}_\n\n> ${C.paper.status}\n\n` + paper.map(s => `## ${s.title}\n\n${s.body.trim()}`).join('\n\n') + '\n\n';
M += `# Roadmap\n\n` + road.map(p => `## ${p.phase} · ${p.title} (${p.when})\n\n${p.items.map(([s, t]) => `- [${MARK[s] || s}] ${t}`).join('\n')}`).join('\n\n') + '\n';
fs.writeFileSync(path.join(out, 'Harvex-Docs.md'), M.replace(/\r\n/g, '\n'));

/* ---- HTML ---- */
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'public/harvex-logo.png')).toString('base64');
const toc = [['status', 'Feature status'], ['docs', 'Docs', docs], ['paper', 'Whitepaper', paper], ['roadmap', 'Roadmap']];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Harvex — Docs, Whitepaper & Roadmap</title><style>
@page{size:A4;margin:18mm 16mm 18mm}@page:first{margin:0}
*{box-sizing:border-box}body{font:10.5pt/1.55 "Segoe UI",Inter,Arial,sans-serif;color:#15201a;margin:0}
h1{font-size:24pt;line-height:1.15;margin:0 0 6mm;letter-spacing:-.02em}h2{font-size:15pt;margin:9mm 0 3mm;letter-spacing:-.01em;break-after:avoid}
h3,h4{font-size:11.5pt;margin:6mm 0 2mm;break-after:avoid}h5,h6{font-size:10.5pt;margin:4mm 0 1mm}
p{margin:0 0 3mm}ul,ol{margin:0 0 3mm;padding-left:6mm}li{margin:.8mm 0}
code{font:9pt Consolas,monospace;background:#eef2ea;padding:.2mm 1mm;border-radius:1mm;word-break:break-all}
pre{font:8.3pt/1.4 Consolas,monospace;background:#0f1712;color:#e8f5d0;padding:4mm;border-radius:2mm;white-space:pre-wrap;break-inside:avoid}
blockquote{margin:0 0 4mm;padding:3mm 4mm;border-left:1.2mm solid #ffe600;background:#f5f9ec;border-radius:0 2mm 2mm 0}
table{width:100%;border-collapse:collapse;margin:0 0 4mm;font-size:9.3pt;break-inside:auto}tr{break-inside:avoid}
th{text-align:left;background:#15201a;color:#f1efe6;font-weight:600}th,td{padding:1.6mm 2.2mm;border-bottom:.2mm solid #d6ddd0;vertical-align:top}
.cover{height:296mm;display:flex;flex-direction:column;justify-content:space-between;background:#0c1410;color:#f1efe6;padding:26mm 22mm;break-after:page;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cover img{width:26mm}.cover h1{font-size:34pt;color:#f1efe6}.cover .lime{color:#ffe600}.cover p{color:#b9c4b4;max-width:130mm}
.eyebrow{font:600 8.5pt Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:#5d6b60}
.cover .eyebrow{color:#ffe600}
.part{break-before:page}.part>h1{border-bottom:1mm solid #ffe600;padding-bottom:3mm}
.sec{break-inside:auto}.sec+.sec{margin-top:4mm}
.toc ol{padding-left:5mm}.toc li{margin:1.2mm 0}.toc ol ol{font-size:9.5pt;color:#44524a}
.status h3{display:flex;gap:2mm;align-items:center}.pill{font:600 8pt Consolas,monospace;padding:.6mm 2mm;border-radius:5mm;text-transform:uppercase}
.live{background:#ffe600;color:#15201a}.off{background:#ffe7a8;color:#6b4a00}.no{background:#ffd6cc;color:#8a2b12}
.phase{break-inside:avoid;border:.2mm solid #d6ddd0;border-radius:2mm;padding:3mm 4mm;margin:0 0 4mm}.phase h3{margin:0 0 2mm}
.phase ul{list-style:none;padding:0;margin:0}.phase li{display:flex;gap:2.5mm}.tag{flex:0 0 16mm;font:600 7.5pt Consolas,monospace;text-transform:uppercase;padding-top:.6mm}
.t-done{color:#2f7d32}.t-now{color:#0a66c2}.t-next{color:#9a6500}.t-planned{color:#5d6b60}.t-idea{color:#8a4fb8}
.foot{font-size:8.5pt;color:#5d6b60;margin-top:8mm}
</style></head><body>
<section class="cover"><div><img src="${logo}" alt="Harvex"></div>
<div><div class="eyebrow">Documentation export · ${esc(date)}</div><h1>Harvex Agent Studio<br><span class="lime">Docs, Whitepaper & Roadmap</span></h1>
<p>Everything in the studio's docs, the whitepaper and the roadmap, with a status page that separates what is live, what is built but switched off, and what has not been done.</p></div>
<div class="eyebrow">${esc(C.version)} · ${esc(C.paper.status)} · Not an offer to sell any token</div></section>

<section class="toc"><div class="eyebrow">Contents</div><h1>Contents</h1><ol>${toc.map(([id, t, list]) => `<li><strong>${t}</strong>${list ? `<ol>${list.map(s => `<li>${esc(s.title)}</li>`).join('')}</ol>` : ''}</li>`).join('')}</ol></section>

<section class="part status" id="status"><div class="eyebrow">Where things stand · ${esc(date)}</div><h1>Feature status</h1>
<p>Status of the software. Nothing is deployed on BNB Smart Chain. "Built, switched off" means the feature exists and was tested locally, but it is not switched on or still needs a token or a deployed contract.</p>
${STATUS.map(([t, k, items]) => `<h3><span class="pill ${k}">${k === 'live' ? 'Built' : k === 'off' ? 'Off' : 'Not done'}</span>${t}</h3><ul>${items.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`).join('')}
</section>

<section class="part" id="docs"><div class="eyebrow">Part 1</div><h1>Docs</h1>
${docs.map(d => `<div class="sec"><h2>${esc(d.title)}</h2>${md(d.body)}</div>`).join('')}</section>

<section class="part" id="paper"><div class="eyebrow">Part 2 · ${esc(C.paper.status)}</div><h1>${esc(C.paper.title)}</h1><p><em>${esc(C.paper.subtitle)}</em></p>
${paper.map(s => `<div class="sec"><h2>${esc(s.title)}</h2>${md(s.body)}</div>`).join('')}</section>

<section class="part" id="roadmap"><div class="eyebrow">Part 3</div><h1>Roadmap</h1>
${road.map(p => `<div class="phase"><div class="eyebrow">${esc(p.phase)} · ${esc(p.when)}</div><h3>${esc(p.title)}</h3><ul>${p.items.map(([s, t]) => `<li><span class="tag t-${s}">${MARK[s] || s}</span><span>${inline(t)}</span></li>`).join('')}</ul></div>`).join('')}
<p class="foot">Harvex is an independent project, not affiliated with BNB Chain, Binance or Anthropic. Nothing here is financial advice or an offer to sell a token.</p></section>
</body></html>`;
const htmlPath = path.join(out, 'Harvex-Docs.html');
fs.writeFileSync(htmlPath, html);

/* ---- PDF via headless Chrome / Edge ---- */
const candidates = [process.env.CHROME,
 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browser = candidates.find(p => fs.existsSync(p));
if (!browser) { console.log('Wrote Markdown and HTML. No Chrome/Edge found for the PDF (set CHROME=<path>).'); process.exit(0); }
const pdfPath = path.join(out, 'Harvex-Docs.pdf');
execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], {stdio: 'ignore'});
console.log(`Wrote ${path.relative(root, out)}/Harvex-Docs.{md,html,pdf}`);
