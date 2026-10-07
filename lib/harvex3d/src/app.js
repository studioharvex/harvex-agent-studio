/* Harvex Agent Studio — app UI */
(function () {
'use strict';
const R = window.HARVEX;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const icon = (id, cls = 'i') => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
const TONES = ['Friendly', 'Professional', 'Concise', 'Playful'];
const LANGS = ['English'];
const DEF_PERSONA = 'Be curious, precise and helpful. Explain findings clearly, show your reasoning briefly, and say when something is uncertain.';
const LOOPS = Object.values(R.MOTIONS).filter(m => m.loop && !m.hidden).map(m => m.name);

/* ---------------- storage ---------------- */
const KEY = 'harvex.studio.v2';
function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
const DB = Object.assign({ agents: [], runs: [], draft: null }, load());
let saveT = 0;
function persist() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* storage unavailable: keep in memory */ } }, 250); }

/* ---------------- agent model ---------------- */
function newDraft(presetId = 'atlas') {
  const p = R.getPreset(presetId);
  return { id: null, name: 'My ' + p.name, preset: p.id, look: clone(p.look), motion: 'Idle', personality: DEF_PERSONA, tone: 'Friendly', language: 'English', skills: ['research', 'summarize'] };
}
function migrate(o) {
  o = o || {};
  const preset = R.getPreset(o.preset || o.skin || 'atlas');
  let look;
  if (o.look) look = R.normalizeLook(Object.assign(clone(preset.look), o.look));
  else {
    look = R.normalizeLook(clone(preset.look));
    const a = o.appearance;
    if (a) {
      if (a.outfit) look.top.color = a.outfit; if (a.accent) { look.top.accent = a.accent; look.glow = a.accent; }
      if (preset.cat !== 'Companion') { if (a.skinTone) look.skin = a.skinTone; if (a.hair) look.hair.color = a.hair; if (a.accessory === 'Visor') look.face = 'visor'; if (a.accessory === 'Headphones') look.head = 'headphones'; if (a.accessory === 'Halo') look.head = 'halo'; }
      if (a.finish) look.finish = String(a.finish).toLowerCase() === 'gloss' ? 'gloss' : 'matte';
    }
  }
  const valid = new Set(R.AGENT_SKILLS.map(s => s.id));
  let skills = (Array.isArray(o.skills) ? o.skills : []).map(s => s === 'document' ? 'docqa' : s).filter(s => valid.has(s));
  skills = [...new Set(skills)].slice(0, 4); if (!skills.length) skills = ['research'];
  const motion = R.MOTIONS[o.motion] && !R.MOTIONS[o.motion].hidden ? o.motion : 'Idle';
  return { id: o.id || null, name: String(o.name || 'My ' + preset.name).slice(0, 40), preset: preset.id, look, motion, personality: String(o.personality || DEF_PERSONA).slice(0, 2000), tone: TONES.includes(o.tone) ? o.tone : 'Friendly', language: LANGS.includes(o.language) ? o.language : 'English', skills, updated: o.updated || null };
}
function exportCfg(a) {
  const L = a.look;
  return { format: 'harvex-agent@2', name: a.name, skin: a.preset, look: L, motion: a.motion, personality: a.personality, tone: a.tone, language: a.language, skills: a.skills,
    appearance: { outfit: L.top.color, accent: L.top.accent, skinTone: L.skin, hair: L.hair.color, accessory: L.face === 'visor' ? 'Visor' : L.head === 'headphones' ? 'Headphones' : L.head === 'halo' ? 'Halo' : 'None', finish: L.finish === 'gloss' ? 'Gloss' : 'Matte' } };
}
let draft = DB.draft ? migrate(DB.draft) : newDraft();
draft.look = R.normalizeLook(draft.look);
const preset = () => R.getPreset(draft.preset);
function touch() { DB.draft = draft; persist(); }

/* ---------------- toast ---------------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
async function copyText(txt, fallbackEl) {
  try { await navigator.clipboard.writeText(txt); toast('Copied'); return true; }
  catch (e) { if (fallbackEl) { fallbackEl.focus(); fallbackEl.select(); } toast('Select the text and copy it'); return false; }
}

/* ---------------- stage ---------------- */
let stage = null;
try {
  stage = new R.Stage($('#stage'), { onEvent: ev => onStageEvent(ev) });
  stage.setLook(draft.look);
  stage.anim.play(draft.motion);
  stage.anim.listeners.push(() => paintDeck());
  stage.start();
} catch (e) {
  console.error(e);
  $('#stageWrap').insertAdjacentHTML('beforeend', '<div class="webgl-err"><div><h3 style="font-size:18px;margin-bottom:8px">3D preview unavailable</h3><p>This browser could not start WebGL. You can still edit and run your agent.</p></div></div>');
}
document.addEventListener('visibilitychange', () => { if (!stage) return; document.hidden ? stage.stop() : stage.start(); });

/* ---------------- thumbnails (queued) ---------------- */
const thumbs = new Map(); const tq = []; let pumping = false;
function thumb(look, cb) {
  const k = R.structKey(R.normalizeLook(look)) + JSON.stringify(look);
  if (thumbs.has(k)) return cb(thumbs.get(k));
  tq.push({ look, k, cb }); if (!pumping) { pumping = true; setTimeout(pump, 120); }
}
function pump() {
  const it = tq.shift(); if (!it) { pumping = false; return; }
  try { if (!thumbs.has(it.k)) thumbs.set(it.k, R.renderThumb(it.look)); it.cb(thumbs.get(it.k)); } catch (e) { console.warn('thumb', e); }
  setTimeout(pump, 30);
}

/* ---------------- roster ---------------- */
const SIG_ICON = { orb: 'orb', shield: 'shield', blink: 'blink', levitate: 'levitate', scan: 'scan', hype: 'hype' };
let rosterCat = 'All';
function renderRoster() {
  const q = $('#rosterQ').value.trim().toLowerCase();
  const list = R.PRESETS.filter(p => (rosterCat === 'All' || p.cat === rosterCat) && (p.name + ' ' + p.role + ' ' + p.desc).toLowerCase().includes(q));
  $('#rosterCount').textContent = R.PRESETS.length;
  const g = $('#rosterGrid');
  g.innerHTML = list.map(p => `<button class="card" data-id="${p.id}" aria-pressed="${p.id === draft.preset}" title="${esc(p.desc)}"><div class="ph" data-thumb="${p.id}">${icon('cube')}</div><span class="sig" title="Signature power">${icon(SIG_ICON[p.sig])}</span><span class="meta"><b>${esc(p.name)}</b><span>${esc(p.role)}</span></span></button>`).join('') || '<p class="note" style="grid-column:1/-1;padding:8px">No characters match. Try another name or role.</p>';
  list.forEach(p => thumb(p.look, url => { const ph = g.querySelector(`[data-thumb="${p.id}"]`); if (ph) ph.outerHTML = `<img class="thumb" alt="" src="${url}">`; }));
}
$('#rosterGrid').addEventListener('click', e => {
  const b = e.target.closest('.card'); if (!b) return;
  choosePreset(b.dataset.id);
});
function choosePreset(id) {
  const p = R.getPreset(id), old = preset();
  const renamed = draft.name === 'My ' + old.name || !draft.name.trim();
  draft.preset = p.id; draft.look = R.normalizeLook(clone(p.look));
  if (renamed) draft.name = 'My ' + p.name;
  touch();
  if (stage) { stage.setLook(draft.look); stage.anim.play('Wave'); }
  $$('#rosterGrid .card').forEach(c => c.setAttribute('aria-pressed', c.dataset.id === id));
  paintHud(); paintPowers(); renderPane();
}
$('#rosterQ').addEventListener('input', renderRoster);
$('#rosterCat').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; rosterCat = b.dataset.cat; $$('#rosterCat button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderRoster(); });

/* ---------------- HUD ---------------- */
function paintHud() {
  const p = preset(), sig = R.POWERS.find(x => x.id === p.sig);
  $('#agentName').textContent = draft.name || 'Untitled agent';
  $('#agentTags').innerHTML = `<span class="tag lime">${esc(p.role)}</span><span class="tag">${esc(p.name)}</span><span class="tag">Signature · ${esc(sig.name)}</span>`;
}
let deckGroup = 0;
function renderDeck() {
  $('#deckGroups').innerHTML = R.MOTION_GROUPS.map((g, i) => `<button data-g="${i}" aria-pressed="${i === deckGroup}">${g[0]}</button>`).join('');
  $('#deckChips').innerHTML = R.MOTION_GROUPS[deckGroup][1].map(m => `<button class="chip ${R.MOTIONS[m].loop ? 'loop' : ''}" data-m="${m}" title="${R.MOTIONS[m].loop ? 'Loop: becomes the agent\'s default stance' : 'Plays once'}">${m}</button>`).join('');
  paintDeck();
}
function paintDeck() {
  if (!stage) return;
  $$('#deckChips .chip').forEach(c => { const m = c.dataset.m; c.setAttribute('aria-pressed', m === stage.anim.stance); c.classList.toggle('playing', m === stage.anim.cur && m !== stage.anim.stance); });
}
$('#deckGroups').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; deckGroup = +b.dataset.g; renderDeck(); });
$('#deckChips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b || !stage) return; const m = b.dataset.m;
  stage.anim.play(m);
  if (R.MOTIONS[m].loop) { draft.motion = m; touch(); if (curTab === 'persona') renderPane(); }
  paintDeck();
});
$('#btnPause').addEventListener('click', e => {
  if (!stage) return; stage.anim.paused = !stage.anim.paused;
  e.currentTarget.innerHTML = icon(stage.anim.paused ? 'play' : 'pause'); e.currentTarget.setAttribute('aria-label', stage.anim.paused ? 'Play animation' : 'Pause animation');
});
$$('.speed button').forEach(b => b.addEventListener('click', () => { if (!stage) return; stage.anim.speed = +b.dataset.speed; $$('.speed button').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
$('#btnView').addEventListener('click', () => { if (stage) { stage.yaw = 0; stage.yawVel = 0; stage.zoom = 1; } });

/* ---------------- powers ---------------- */
const cds = {}; let busyUntil = 0;
function paintPowers() {
  const sig = preset().sig;
  $('#powers').innerHTML = R.POWERS.map(p => `<button class="pw ${p.id === sig ? 'sig' : ''}" data-p="${p.id}" title="${esc(p.name)} (${p.key}) — ${esc(p.desc)}${p.id === sig ? ' Signature power.' : ''}" aria-label="${esc(p.name)}"><kbd>${p.key}</kbd>${icon(p.id)}<span class="lbl">${esc(p.name)}</span><span class="cd"></span></button>`).join('');
}
function firePower(id) {
  if (!stage) return; const now = performance.now() / 1000, p = R.POWERS.find(x => x.id === id);
  if ((cds[id] && cds[id].until > now) || busyUntil > now) return;
  const dur = stage.cast(id); busyUntil = now + dur * 0.8;
  const cd = p.cd * (id === preset().sig ? 0.6 : 1); cds[id] = { until: now + cd, dur: cd };
}
$('#powers').addEventListener('click', e => { const b = e.target.closest('.pw'); if (b) firePower(b.dataset.p); });
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
  const p = R.POWERS.find(x => x.key === e.key); if (p && view === 'studio') { firePower(p.id); e.preventDefault(); }
});
(function cdLoop() {
  const now = performance.now() / 1000;
  $$('#powers .pw').forEach(b => { const c = cds[b.dataset.p]; const left = c ? Math.max(0, c.until - now) : 0; b.querySelector('.cd').style.setProperty('--p', (c && left > 0 ? (left / c.dur) * 100 : 0) + '%'); });
  requestAnimationFrame(cdLoop);
})();
let scanHide;
function onStageEvent(ev) {
  const card = $('#scanCard');
  if (ev === 'scan-start') {
    const p = preset(), sig = R.POWERS.find(x => x.id === p.sig);
    const sk = draft.skills.map(id => R.AGENT_SKILLS.find(s => s.id === id)?.name).filter(Boolean).join(', ');
    card.innerHTML = `<div class="mono" style="color:var(--lime)">Scan · ${esc(p.name)}</div><div class="row"><span>Agent</span><span>${esc(draft.name)}</span></div><div class="row"><span>Class</span><span>${esc(p.role)}</span></div><div class="row"><span>Tone</span><span>${esc(draft.tone)} · ${esc(draft.language)}</span></div><div class="row"><span>Skills</span><span>${esc(sk)}</span></div><div class="row"><span>Signature</span><span>${esc(sig.name)}</span></div><div class="bar"><i style="width:${40 + draft.skills.length * 15}%"></i></div>`;
    card.hidden = false; clearTimeout(scanHide);
  } else if (ev === 'scan-end') { scanHide = setTimeout(() => { card.hidden = true; }, 2600); }
}

/* ---------------- inspector ---------------- */
let curTab = 'look';
$$('.tabs button').forEach(b => b.addEventListener('click', () => { curTab = b.dataset.tab; $$('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); renderPane(); }));
const W = R.WARDROBE;
function opts(key, list, val, extra = '') { return `<div class="opts" data-k="${key}" ${extra}>${list.map(([v, l]) => `<button class="opt" data-v="${v}" aria-pressed="${v === val}">${esc(l)}</button>`).join('')}</div>`; }
function sws(key, colors, val) {
  const v = (val || '').toLowerCase();
  return `<div class="sw" data-k="${key}">${colors.map(c => `<button data-v="${c}" style="background:${c}" aria-label="${c}" aria-pressed="${c.toLowerCase() === v}"></button>`).join('')}<label title="Custom color">+<input type="color" data-k="${key}" value="${/^#[0-9a-f]{6}$/i.test(val) ? val : '#ffe600'}" aria-label="Custom color"></label></div>`;
}
function setPath(obj, path, v) { const k = path.split('.'); let o = obj; while (k.length > 1) o = o[k.shift()]; o[k[0]] = v; }
function getPath(obj, path) { return path.split('.').reduce((o, k) => o && o[k], obj); }
function lookChanged() { touch(); if (stage) stage.setLook(draft.look); }
function renderLook() {
  const L = draft.look, comp = L.kind === 'companion', android = L.headStyle === 'screen';
  const f = (label, html) => `<div class="field"><div class="lab">${label}</div>${html}</div>`;
  let h = `<div style="display:flex;gap:8px"><button class="btn sm" data-act="random">${icon('dice')}Randomize</button><button class="btn sm ghost" data-act="reset">${icon('reset')}Reset to ${esc(preset().name)}</button></div>`;
  if (comp) {
    h += `<div class="group"><h3>Shell</h3>${f('Body color', sws('top.color', W.swatches, L.top.color))}${f('Accent', sws('top.accent', W.swatches, L.top.accent))}</div>`;
  } else {
    h += `<div class="group"><h3>Body</h3>${f('Build', opts('build', W.build, L.build))}${android ? f('Plating', sws('top.accent', W.swatches, L.top.accent)) : f('Skin tone', sws('skin', W.skin, L.skin))}${android ? '' : f('Eyes', sws('eyes', W.eyes, L.eyes))}</div>`;
    if (!android) h += `<div class="group"><h3>Hair</h3>${f('Style', opts('hair.style', W.hair, L.hair.style))}${f('Color', sws('hair.color', W.hairColors, L.hair.color))}${f('Facial hair', opts('facial', W.facial, L.facial))}</div>`;
    h += `<div class="group"><h3>Top</h3>${f('Type', opts('top.type', W.top, L.top.type))}${f('Color', sws('top.color', W.swatches, L.top.color))}${f('Accent / trim', sws('top.accent', W.swatches, L.top.accent))}</div>`;
    const suit = L.top.type === 'spacesuit';
    h += `<div class="group"><h3>Bottom</h3>${suit ? '<p class="note">The spacesuit covers the legs. Pick another top to change bottoms.</p>' : f('Type', opts('bottom.type', W.bottom, L.bottom.type)) + f('Color', sws('bottom.color', W.swatches, L.bottom.color)) + (['skirt', 'shorts'].includes(L.bottom.type) ? f('Legs', opts('legwear', W.legwear, L.legwear)) : '')}</div>`;
    h += `<div class="group"><h3>Shoes</h3>${suit ? '<p class="note">Spacesuit boots are built in.</p>' : f('Type', opts('shoes.type', W.shoes, L.shoes.type)) + f('Color', sws('shoes.color', W.swatches, L.shoes.color))}</div>`;
    h += `<div class="group"><h3>Gear</h3>${f('Head', opts('head', W.head, L.head))}${f('Face', opts('face', android ? W.face.filter(x => x[0] === 'none' || x[0] === 'visor') : W.face, L.face))}${f('Back', opts('back', W.back, L.back))}${f('Gear color', sws('accColor', W.swatches, L.accColor))}</div>`;
  }
  h += `<div class="group"><h3>Glow & finish</h3>${f('Glow color (lights, powers, pad)', sws('glow', W.glow, L.glow))}${f('Finish', opts('finish', W.finish, L.finish))}</div>`;
  return h;
}
function randomLook() {
  const pick = a => a[Math.floor(Math.random() * a.length)], L = draft.look;
  if (L.kind === 'companion') { L.top.color = pick(W.swatches); L.top.accent = pick(W.swatches); L.glow = pick(W.glow); return; }
  L.build = pick(W.build)[0];
  if (L.headStyle !== 'screen') { L.skin = pick(W.skin); L.hair.style = pick(W.hair.slice(0, 12))[0]; L.hair.color = pick(W.hairColors); L.facial = Math.random() < 0.2 ? pick(['stubble', 'beard']) : 'none'; L.eyes = pick(W.eyes); }
  L.top.type = pick(W.top.slice(0, 11))[0]; L.top.color = pick(W.swatches); L.top.accent = pick(W.swatches);
  L.bottom.type = pick(W.bottom)[0]; L.bottom.color = pick(W.swatches); L.legwear = pick(['bare', 'tights']);
  L.shoes.type = pick(W.shoes)[0]; L.shoes.color = pick(W.swatches);
  L.head = Math.random() < 0.45 ? pick(W.head.slice(1, 7))[0] : 'none'; L.face = Math.random() < 0.3 ? pick(W.face.slice(1))[0] : 'none';
  L.back = Math.random() < 0.35 ? pick(W.back.slice(1))[0] : 'none'; L.accColor = pick(W.swatches); L.glow = pick(W.glow);
}
const TEMPLATES = [
  { name: 'Source checker', preset: 'scout', skills: ['research', 'docqa', 'summarize'], personality: 'Check claims against each other before you answer. Say which parts are fact and which are opinion, and how sure you are. Finish with what still needs checking.' },
  { name: 'Draft partner', preset: 'nova', skills: ['write', 'brainstorm', 'translate'], personality: 'Turn loose notes into a clear draft in the voice of the writer. If the reader is not obvious, ask who it is for. Nothing goes out without a yes from the writer.' },
  { name: 'Document desk', preset: 'guardian', skills: ['docqa', 'summarize', 'planner'], personality: 'Work only from the text you are given. Pull out the main points, quote the passages that back them, and list what to do next.' },
  { name: 'Build planner', preset: 'rook', skills: ['code', 'planner', 'research'], personality: 'Keep it practical and plain. Break the work into small steps that can be tested, and flag the risks before anything else.' },
];
function renderPersona() {
  const loops = LOOPS.map(m => [m, m]);
  return `<div class="field"><label for="fName">Agent name</label><input class="input" id="fName" maxlength="40" value="${esc(draft.name)}"></div>
  <div class="field"><label for="fPersona">Personality & instructions</label><textarea class="textarea" id="fPersona" maxlength="2000">${esc(draft.personality)}</textarea><span class="note">Sent to Claude with every task this agent runs.</span></div>
  <div class="field"><div class="lab">Tone</div>${opts('tone', TONES.map(t => [t, t]), draft.tone)}</div>
  <div class="field"><div class="lab">Default stance</div>${opts('motion', loops, draft.motion)}<span class="note">The looping motion the agent returns to on the stage.</span></div>
  <div class="group"><h3>Start from a template</h3><div class="opts">${TEMPLATES.map((t, i) => `<button class="opt" data-tpl="${i}">${esc(t.name)}</button>`).join('')}</div><span class="note">Templates set character, skills and instructions. Your outfit changes are replaced.</span></div>`;
}
function renderSkills() {
  const on = new Set(draft.skills);
  let h = `<p class="note">Equip up to <b>4</b> agent skills. They run on Claude from the <b>Run task</b> tab.</p>`;
  h += R.AGENT_SKILLS.map(s => `<div class="sk" data-on="${on.has(s.id)}"><span class="ico">${icon(s.icon)}</span><div><h4>${esc(s.name)} <span class="badge">${esc(s.cat)}</span></h4><p>${esc(s.desc)}</p></div><button class="toggle" role="switch" aria-checked="${on.has(s.id)}" aria-label="Equip ${esc(s.name)}" data-skill="${s.id}"></button></div>`).join('');
  const sig = preset().sig;
  h += `<div class="group"><h3>Powers <span class="badge lime">stage</span></h3>${R.POWERS.map(p => `<div class="sk" style="grid-template-columns:36px 1fr auto"><span class="ico">${icon(p.id)}</span><div><h4>${esc(p.name)} ${p.id === sig ? '<span class="badge lime">signature · faster cooldown</span>' : ''}</h4><p>${esc(p.desc)}</p></div><button class="btn sm" data-power="${p.id}">Use · ${p.key}</button></div>`).join('')}</div>`;
  return h;
}

/* ---------------- run ---------------- */
let sampleFn = null, claudeState = 'checking';
const run = { skill: null, fields: {}, status: 'idle', text: '', data: null, err: '', ctl: null, truncated: false };
function curSkill() { if (!run.skill || !draft.skills.includes(run.skill)) run.skill = draft.skills[0]; return R.AGENT_SKILLS.find(s => s.id === run.skill); }
function fieldVals(sk) { const f = run.fields[sk.id] || (run.fields[sk.id] = {}); sk.fields.forEach(x => { if (f[x.id] === undefined) f[x.id] = x.def || ''; }); return f; }
function renderRun() {
  const sk = curSkill(); if (!sk) return '<p class="note">Equip a skill first.</p>';
  const f = fieldVals(sk);
  let h = `<div class="field"><div class="lab">Skill</div><div class="opts" data-runskill>${draft.skills.map(id => { const s = R.AGENT_SKILLS.find(x => x.id === id); return `<button class="opt" data-v="${id}" aria-pressed="${id === sk.id}">${esc(s.name)}</button>`; }).join('')}</div></div>`;
  h += `<div class="callout" style="display:grid;gap:8px"><span><b style="color:var(--text)">${esc(sk.name)}</b> — ${esc(sk.desc)}</span><button class="btn sm" data-act="example" style="justify-self:start">Load example input</button></div>`;
  sk.fields.forEach(x => {
    if (x.type === 'textarea') h += `<div class="field"><label for="rf-${x.id}">${esc(x.label)}</label><textarea class="textarea" id="rf-${x.id}" data-f="${x.id}" placeholder="${esc(x.ph)}" ${x.mono ? 'style="font-family:var(--mono);font-size:12.5px"' : ''}>${esc(f[x.id])}</textarea>${x.file ? `<label class="btn sm ghost" style="justify-self:start;cursor:pointer">${icon('doc')}Load text file<input type="file" class="sr" accept=".txt,.md,.csv,.json,.js,.ts,.py,.html,.css,text/*" data-file="${x.id}"></label>` : ''}</div>`;
    else if (x.type === 'input') h += `<div class="field"><label for="rf-${x.id}">${esc(x.label)}</label><input class="input" id="rf-${x.id}" data-f="${x.id}" placeholder="${esc(x.ph)}" value="${esc(f[x.id])}"></div>`;
    else h += `<div class="field"><div class="lab">${esc(x.label)}</div><div class="opts" data-seg="${x.id}">${x.options.map(o => `<button class="opt" data-v="${esc(o)}" aria-pressed="${o === f[x.id]}">${esc(o)}</button>`).join('')}</div></div>`;
  });
  const busy = run.status === 'thinking' || run.status === 'writing';
  if (claudeState === 'off') h += `<div class="callout warn">Skills run on Claude. Open this page inside Claude (signed in) to run tasks. Everything else in the studio works here.</div>`;
  h += `<div style="display:flex;gap:8px">${busy ? `<button class="btn" data-act="stop" style="flex:1">${icon('stop')}Stop</button>` : `<button class="btn primary" data-act="run" style="flex:1" ${claudeState === 'off' ? 'disabled' : ''}>Run ${esc(sk.name)}</button>`}</div>`;
  h += `<div class="out" id="runOut">${outHtml(sk)}</div>`;
  return h;
}
function outHtml(sk) {
  const st = run.status;
  const head = `<div class="out-head"><span class="mono muted">${st === 'idle' ? 'Output' : st === 'thinking' ? `${esc(draft.name)} is thinking` : st === 'writing' ? 'Writing' : st === 'done' ? 'Done' : st === 'stopped' ? 'Stopped' : 'Error'}</span>${run.text || run.data ? `<button class="btn sm ghost" data-act="copy">${icon('copy')}Copy</button>` : ''}</div>`;
  let body;
  if (st === 'idle') body = '<p class="note">Results appear here. The character works on the stage while Claude writes.</p>';
  else if (st === 'thinking' && !run.text) body = '<div class="thinking"><i></i><i></i><i></i> Thinking… this can take up to a minute.</div>';
  else if (run.data) body = renderData(run.data, sk);
  else body = `<div class="md">${md(run.text)}</div>`;
  if (run.err) body += `<div class="callout warn" style="margin-top:10px">${esc(run.err)}</div>`;
  if (run.truncated) body += '<p class="note" style="margin-top:8px">The answer was cut short. Ask for less at a time.</p>';
  return head + `<div class="out-body">${body}</div>`;
}
function renderData(d, sk) {
  if (sk && sk.id === 'brainstorm' || Array.isArray(d)) {
    const arr = Array.isArray(d) ? d : (d.ideas || []);
    return arr.map((x, i) => `<div class="idea"><b>${i + 1}. ${esc(x.title)}</b><span>${esc(x.why)}</span>${x.effort ? `<span class="badge" style="justify-self:start">${esc(x.effort)} effort</span>` : ''}</div>`).join('');
  }
  if (d && Array.isArray(d.steps)) return `<p style="margin-bottom:8px">${esc(d.summary || '')}</p>` + d.steps.map((s, i) => `<label class="check"><input type="checkbox"><span><b>${esc(s.step)}</b><br><span class="muted" style="font-size:13px">${esc(s.detail || '')}</span></span><small>${esc(s.estimate || '')}</small></label>`).join('');
  return `<pre>${esc(JSON.stringify(d, null, 2))}</pre>`;
}
function dataToText(d) {
  if (Array.isArray(d)) return d.map((x, i) => `${i + 1}. ${x.title} — ${x.why}${x.effort ? ` (${x.effort} effort)` : ''}`).join('\n');
  if (d && d.steps) return (d.summary ? d.summary + '\n\n' : '') + d.steps.map((s, i) => `${i + 1}. ${s.step} [${s.estimate || '-'}] — ${s.detail || ''}`).join('\n');
  return JSON.stringify(d, null, 2);
}
const ERR = { not_granted: 'Claude access was not allowed for this page. Reload the page to be asked again.', sampling_disabled: 'Claude is not available for this account or organization.', rate_limited: 'Too many requests right now. Wait a moment, then try again.', session_expired: 'Your Claude session expired. Sign in again, then retry.', prompt_too_large: 'The input is too long. Shorten the text and try again.', refused: 'Claude declined this request. Rephrase it and try again.', invalid_json: 'The answer came back in an unexpected format. Try again.', empty_completion: 'No answer came back. Simplify the request and try again.' };
let paintT = 0;
function paintOut() { const el = $('#runOut'); if (el) el.innerHTML = outHtml(curSkill()); }
async function doRun() {
  const sk = curSkill(); const f = fieldVals(sk);
  const first = sk.fields[0]; if (!String(f[first.id] || '').trim()) { toast(`Add ${first.label.toLowerCase()} first`); $(`#rf-${first.id}`)?.focus(); return; }
  if (sk.id === 'docqa' && !String(f.q || '').trim()) { toast('Add a question first'); return; }
  if (!sampleFn) { toast('Open this page inside Claude to run skills'); return; }
  const prompt = R.buildPrompt(sk, f, draft, preset());
  Object.assign(run, { status: 'thinking', text: '', data: null, err: '', truncated: false, ctl: new AbortController() });
  renderPane();
  if (stage) stage.anim.play(sk.motion || 'Typing', { temp: true, dur: 900 });
  const started = Date.now();
  try {
    if (sk.json) {
      run.data = await sampleFn.json(prompt, { signal: run.ctl.signal, onText: () => { if (run.status === 'thinking') { run.status = 'writing'; if (stage && sk.motion !== 'Typing') stage.anim.play('Typing', { temp: true, dur: 900 }); paintOut(); } } });
      run.text = dataToText(run.data);
    } else {
      const r = await sampleFn(prompt, { signal: run.ctl.signal, onText: ({ text }) => { run.text = text; if (run.status === 'thinking') { run.status = 'writing'; if (stage && sk.motion !== 'Typing') stage.anim.play('Typing', { temp: true, dur: 900 }); } cancelAnimationFrame(paintT); paintT = requestAnimationFrame(paintOut); } });
      run.text = r.text; run.truncated = r.truncated;
    }
    run.status = 'done'; if (stage) stage.anim.play(Math.random() < 0.5 ? 'Cheer' : 'Victory');
    DB.runs.unshift({ id: uid(), at: new Date().toISOString(), agent: draft.name, preset: draft.preset, skill: sk.id, input: String(f[first.id]).slice(0, 400), output: run.text, data: run.data, ms: Date.now() - started });
    DB.runs = DB.runs.slice(0, 50); persist();
  } catch (e) {
    const code = e && e.code;
    if (code === 'cancelled') { run.status = 'stopped'; run.text = e.text || run.text; if (stage) stage.anim.play(stage.anim.stance); }
    else { run.status = 'error'; run.text = (e && e.text) || run.text; run.err = ERR[code] || 'Something went wrong on the way to Claude. Try again.'; if (stage) stage.anim.play('Shrug'); if (code === 'not_granted' || code === 'sampling_disabled') { claudeState = 'off'; paintClaude(); } }
  }
  run.ctl = null; if (curTab === 'run') renderPane();
}

/* ---------------- pane dispatcher ---------------- */
function renderPane() {
  const pane = $('#pane'), st = pane.scrollTop;
  pane.innerHTML = curTab === 'look' ? renderLook() : curTab === 'persona' ? renderPersona() : curTab === 'skills' ? renderSkills() : renderRun();
  pane.scrollTop = st;
  $('#skillCount').textContent = draft.skills.length;
}
$('#pane').addEventListener('click', e => {
  const t = e.target;
  const act = t.closest('[data-act]')?.dataset.act;
  if (act === 'random') { randomLook(); lookChanged(); renderPane(); if (stage) stage.anim.play('Spin'); return; }
  if (act === 'reset') { draft.look = R.normalizeLook(clone(preset().look)); lookChanged(); renderPane(); return; }
  if (act === 'run') return doRun();
  if (act === 'stop') { run.ctl && run.ctl.abort(); return; }
  if (act === 'copy') { const ta = document.createElement('textarea'); ta.value = run.text; return copyText(run.text); }
  if (act === 'example') { const sk = curSkill(); run.fields[sk.id] = clone(sk.sample); renderPane(); return; }
  const sw = t.closest('.sw button'); if (sw) { setPath(draft.look, sw.parentElement.dataset.k, sw.dataset.v); lookChanged(); renderPane(); return; }
  const tg = t.closest('[data-skill]');
  if (tg) {
    const id = tg.dataset.skill, on = draft.skills.includes(id);
    if (on && draft.skills.length === 1) { toast('Keep at least one skill'); return; }
    if (!on && draft.skills.length >= 4) { toast('Four skills max. Turn one off first.'); return; }
    draft.skills = on ? draft.skills.filter(x => x !== id) : [...draft.skills, id]; touch(); renderPane(); return;
  }
  const pw = t.closest('[data-power]'); if (pw) { firePower(pw.dataset.power); return; }
  const tpl = t.closest('[data-tpl]');
  if (tpl) { const T = TEMPLATES[+tpl.dataset.tpl]; choosePreset(T.preset); draft.name = T.name; draft.skills = [...T.skills]; draft.personality = T.personality; touch(); paintHud(); renderPane(); toast(`Template applied: ${T.name}`); return; }
  const rs = t.closest('[data-runskill] .opt'); if (rs) { run.skill = rs.dataset.v; Object.assign(run, { status: 'idle', text: '', data: null, err: '' }); renderPane(); return; }
  const sg = t.closest('[data-seg] .opt'); if (sg) { const sk = curSkill(); fieldVals(sk)[sg.parentElement.dataset.seg] = sg.dataset.v; $$('.opt', sg.parentElement).forEach(x => x.setAttribute('aria-pressed', x === sg)); return; }
  const o = t.closest('.opts[data-k] .opt');
  if (o) {
    const k = o.parentElement.dataset.k, v = o.dataset.v;
    if (['tone', 'language'].includes(k)) { draft[k] = v; touch(); }
    else if (k === 'motion') { draft.motion = v; touch(); if (stage) stage.anim.play(v); paintDeck(); }
    else { setPath(draft.look, k, v); if (k === 'top.type' && v === 'spacesuit' && draft.look.head === 'none') draft.look.head = 'helmet'; lookChanged(); }
    renderPane(); paintHud();
  }
});
$('#pane').addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'fName') { draft.name = t.value; touch(); paintHud(); }
  else if (t.id === 'fPersona') { draft.personality = t.value; touch(); }
  else if (t.matches('input[type=color][data-k]')) { setPath(draft.look, t.dataset.k, t.value); lookChanged(); }
  else if (t.dataset.f) { const sk = curSkill(); fieldVals(sk)[t.dataset.f] = t.value; }
});
$('#pane').addEventListener('change', e => {
  const t = e.target;
  if (t.matches('input[type=color][data-k]')) renderPane();
  if (t.dataset.file) {
    const file = t.files && t.files[0]; if (!file) return;
    if (file.size > 400000) { toast('File is too large. Use a text file under 400 KB.'); return; }
    const rd = new FileReader(); rd.onload = () => { const sk = curSkill(); fieldVals(sk)[t.dataset.file] = String(rd.result); renderPane(); toast(`Loaded ${file.name}`); }; rd.onerror = () => toast('Could not read that file'); rd.readAsText(file);
  }
});

/* ---------------- save / new ---------------- */
$('#btnSave').addEventListener('click', () => {
  if (!draft.name.trim()) { toast('Give your agent a name first'); curTab = 'persona'; $$('.tabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === 'persona')); renderPane(); return; }
  draft.updated = new Date().toISOString();
  if (!draft.id) draft.id = uid();
  const i = DB.agents.findIndex(a => a.id === draft.id);
  if (i >= 0) DB.agents[i] = clone(draft); else DB.agents.unshift(clone(draft));
  touch(); persist(); toast(`Saved “${draft.name}”`); if (stage) stage.anim.play('Salute');
});
$('#btnNew').addEventListener('click', () => { draft = newDraft(draft.preset); touch(); if (stage) { stage.setLook(draft.look); stage.anim.play('Idle'); stage.anim.play('Wave'); } paintHud(); renderPane(); toast('New agent started'); });

/* ---------------- views ---------------- */
let view = 'home';
function go(v) {
  view = v;
  $$('nav.views button').forEach(b => b.toggleAttribute('aria-current', b.dataset.view === v) || (b.dataset.view === v && b.setAttribute('aria-current', 'page')));
  $$('nav.views button').forEach(b => b.dataset.view === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  ['home', 'studio', 'agents', 'skills', 'history', 'docs', 'paper', 'roadmap'].forEach(x => { $('#v-' + x).hidden = x !== v; });
  if (stage) (v === 'studio' ? stage.start() : stage.stop());
  if (v === 'agents') renderAgents(); if (v === 'history') renderRuns(); if (v === 'skills') renderLib();
  if (v === 'home') startHero(); else stopHero();
  if (v === 'docs') renderDoc('docs'); if (v === 'paper') renderDoc('paper'); if (v === 'roadmap') renderRoadmap();
  window.scrollTo(0, 0);
}
$$('nav.views button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
document.addEventListener('click', e => { if (e.target.closest('[data-go="new"]')) { draft = newDraft('atlas'); touch(); stage && stage.setLook(draft.look); paintHud(); renderPane(); go('studio'); } });

function renderAgents() {
  const el = $('#agentList');
  if (!DB.agents.length) { el.innerHTML = `<div class="empty" style="grid-column:1/-1"><h3 style="font-size:17px">No saved agents yet</h3><p>Build one in the Studio and press Save agent.</p><button class="btn primary sm" data-open-studio>Open Studio</button></div>`; return; }
  el.innerHTML = DB.agents.map(a => { const p = R.getPreset(a.preset); return `<article class="acard" data-id="${a.id}"><div class="ph" data-athumb="${a.id}" style="aspect-ratio:4/3">${icon('cube')}</div><div class="body"><h3>${esc(a.name)}</h3><span class="mono muted">${esc(p.name)} · ${esc(p.role)} · ${esc(a.tone)}</span><div class="skills">${a.skills.map(s => `<span class="badge">${esc(R.AGENT_SKILLS.find(x => x.id === s)?.name || s)}</span>`).join('')}</div></div><div class="actions"><button class="btn primary sm" data-a="open">Open</button><button class="btn sm" data-a="dup">Duplicate</button><button class="btn sm" data-a="export">Export</button><button class="btn sm ghost danger" data-a="del">Delete</button></div></article>`; }).join('');
  DB.agents.forEach(a => thumb(a.look, url => { const ph = el.querySelector(`[data-athumb="${a.id}"]`); if (ph) ph.outerHTML = `<img class="thumb" alt="" src="${url}">`; }));
}
$('#agentList').addEventListener('click', e => {
  if (e.target.closest('[data-open-studio]')) return go('studio');
  const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('.acard').dataset.id; const a = DB.agents.find(x => x.id === id); if (!a) return;
  if (b.dataset.a === 'open') { draft = migrate(clone(a)); touch(); stage && (stage.setLook(draft.look), stage.anim.play(draft.motion), stage.anim.play('Wave')); $$('#rosterGrid .card').forEach(c => c.setAttribute('aria-pressed', c.dataset.id === draft.preset)); paintHud(); paintPowers(); renderPane(); go('studio'); }
  if (b.dataset.a === 'dup') { const c = clone(a); c.id = uid(); c.name = (a.name + ' copy').slice(0, 40); c.updated = new Date().toISOString(); DB.agents.unshift(c); persist(); renderAgents(); toast('Duplicated'); }
  if (b.dataset.a === 'export') { const txt = JSON.stringify(exportCfg(a), null, 2); $('#exportBox').hidden = false; $('#exportTxt').value = txt; copyText(txt, $('#exportTxt')); }
  if (b.dataset.a === 'del') {
    if (b.dataset.confirm) { DB.agents = DB.agents.filter(x => x.id !== id); if (draft.id === id) draft.id = null; persist(); renderAgents(); toast('Deleted'); }
    else { b.dataset.confirm = '1'; b.textContent = 'Confirm delete'; setTimeout(() => { if (b.isConnected) { delete b.dataset.confirm; b.textContent = 'Delete'; } }, 3500); }
  }
});
function importText(txt) {
  try {
    const o = JSON.parse(txt); const list = Array.isArray(o) ? o : [o];
    list.forEach(x => { const a = migrate(x); a.id = uid(); a.updated = new Date().toISOString(); DB.agents.unshift(a); });
    persist(); renderAgents(); $('#importTxt').value = ''; toast(`Imported ${list.length} agent${list.length > 1 ? 's' : ''}`);
  } catch (e) { toast('That is not valid agent JSON'); }
}
$('#btnImport').addEventListener('click', () => importText($('#importTxt').value));
$('#importFile').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => importText(String(r.result)); r.readAsText(f); e.target.value = ''; });

function renderLib() {
  $('#libSkills').innerHTML = R.AGENT_SKILLS.map(s => `<div class="sk"><span class="ico">${icon(s.icon)}</span><div><h4>${esc(s.name)} <span class="badge">${esc(s.cat)}</span> ${draft.skills.includes(s.id) ? '<span class="badge lime">equipped</span>' : ''}</h4><p>${esc(s.desc)}</p><p style="margin-top:6px">Inputs: ${s.fields.map(f => esc(f.label)).join(' · ')}</p></div></div>`).join('');
  $('#libPowers').innerHTML = R.POWERS.map(p => `<div class="sk"><span class="ico">${icon(p.id)}</span><div><h4>${esc(p.name)} <span class="badge">key ${p.key}</span> <span class="badge">${p.cd}s cooldown</span></h4><p>${esc(p.desc)} Signature characters: ${R.PRESETS.filter(x => x.sig === p.id).map(x => esc(x.name)).join(', ')}.</p></div></div>`).join('');
  $('#libPlanned').innerHTML = R.PLANNED_SKILLS.map(p => `<div class="sk"><span class="ico" style="color:var(--dim)">${icon(p.icon)}</span><div><h4>${esc(p.name)} <span class="badge">planned</span></h4><p>${esc(p.desc)}</p></div></div>`).join('');
}
function renderRuns() {
  const el = $('#runList');
  if (!DB.runs.length) { el.innerHTML = '<div class="empty"><h3 style="font-size:17px">No runs yet</h3><p>Run a skill from the Studio and it will show up here.</p></div>'; return; }
  el.innerHTML = DB.runs.map(r => { const s = R.AGENT_SKILLS.find(x => x.id === r.skill); const d = new Date(r.at); return `<details class="run" data-id="${r.id}"><summary><div style="min-width:0"><b>${esc(s ? s.name : r.skill)} · ${esc(r.agent)}</b><span>${esc(r.input)}</span></div><span class="mono muted">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></summary><div class="out-body">${r.data ? renderData(r.data, s) : `<div class="md">${md(r.output)}</div>`}<button class="btn sm ghost" data-copyrun="${r.id}" style="margin-top:8px">${icon('copy')}Copy</button></div></details>`; }).join('');
}
$('#runList').addEventListener('click', e => { const b = e.target.closest('[data-copyrun]'); if (b) { const r = DB.runs.find(x => x.id === b.dataset.copyrun); r && copyText(r.output); } });
$('#btnClearRuns').addEventListener('click', e => {
  const b = e.currentTarget;
  if (b.dataset.confirm) { DB.runs = []; persist(); renderRuns(); delete b.dataset.confirm; b.textContent = 'Clear history'; toast('History cleared'); }
  else { b.dataset.confirm = '1'; b.textContent = 'Confirm clear'; setTimeout(() => { delete b.dataset.confirm; b.textContent = 'Clear history'; }, 3500); }
});

/* ---------------- home / hero ---------------- */
let hero = null, heroTimer = 0, heroIdx = 0;
const HERO_ORDER = ['atlas', 'lumi', 'scout', 'echo', 'volt', 'mira', 'maker', 'noor', 'rook', 'wren', 'guardian', 'cole'];
const HERO_MOVES = ['Wave', 'Dance', 'Spin', 'Cheer', 'Salute', 'Victory', 'Jump', 'Disco', 'Bow', 'Laugh'];
function heroShow(i) {
  heroIdx = (i + HERO_ORDER.length) % HERO_ORDER.length;
  const p = R.getPreset(HERO_ORDER[heroIdx]);
  hero.setLook(p.look); hero.char.springs.forEach(s => s.reset());
  hero.anim.play('Idle'); hero.anim.play(HERO_MOVES[Math.floor(Math.random() * HERO_MOVES.length)]);
  $('#heroName').textContent = p.name; $('#heroRole').textContent = p.role + ' · ' + R.POWERS.find(x => x.id === p.sig).name;
  $('#heroDots').innerHTML = HERO_ORDER.map((_, k) => `<i class="${k === heroIdx ? 'on' : ''}"></i>`).join('');
}
function startHero() {
  if (!R.Stage) return;
  try {
    if (!hero) { hero = new R.Stage($('#heroStage')); hero.camDist = 5.2; hero.camTarget.y = 0.72; hero.yaw = -0.25; heroShow(0); }
    hero.start(); clearInterval(heroTimer); heroTimer = setInterval(() => heroShow(heroIdx + 1), 5200);
  } catch (e) { console.warn('hero stage', e); $('#heroStageWrap').innerHTML = '<div class="webgl-err"><div><p>3D preview unavailable in this browser.</p></div></div>'; }
}
function stopHero() { if (hero) hero.stop(); clearInterval(heroTimer); }
function renderHome() {
  $('#homeRoster').innerHTML = R.PRESETS.map(p => `<button class="card" data-home-pick="${p.id}" title="Open ${esc(p.name)} in the studio"><div class="ph" data-hthumb="${p.id}">${icon('cube')}</div><span class="meta"><b>${esc(p.name)}</b><span>${esc(p.role)}</span></span></button>`).join('');
  R.PRESETS.forEach(p => thumb(p.look, url => { const ph = $(`#homeRoster [data-hthumb="${p.id}"]`); if (ph) ph.outerHTML = `<img class="thumb" alt="" src="${url}">`; }));
  $('#homeSkills').innerHTML = R.AGENT_SKILLS.map(s => `<div class="sk" style="grid-template-columns:36px 1fr"><span class="ico">${icon(s.icon)}</span><div><h4>${esc(s.name)} <span class="badge">${esc(s.cat)}</span></h4><p>${esc(s.desc)}</p></div></div>`).join('');
  $('#footVer').textContent = R.CONTENT.version;
}
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go-view]'); if (g) { go(g.dataset.goView); return; }
  const pk = e.target.closest('[data-home-pick]'); if (pk) { choosePreset(pk.dataset.homePick); go('studio'); }
});

/* ---------------- docs, whitepaper, roadmap ---------------- */
const C = R.CONTENT;
function renderDoc(kind) {
  const isPaper = kind === 'paper';
  const secs = isPaper ? C.paper.sections : C.docs;
  const toc = $(isPaper ? '#paperToc' : '#docsToc'), body = $(isPaper ? '#paperBody' : '#docsBody');
  if (body.dataset.done) return;
  toc.innerHTML = secs.map(s => `<a href="#${kind}-${s.id}" data-id="${kind}-${s.id}">${esc(s.title)}</a>`).join('') + `<div class="ver">${esc(C.version)}</div>`;
  const head = isPaper ? `<header><span class="mono" style="color:var(--lime)">Whitepaper</span><h2>${esc(C.paper.title)}</h2><p>${esc(C.paper.subtitle)}</p><div class="callout warn">${esc(C.paper.status)}. Chain: BNB Smart Chain. Harvex is independent and not affiliated with BNB Chain or Binance.</div></header>` : `<header><span class="mono" style="color:var(--lime)">Documentation</span><h2>Harvex Agent Studio</h2><p>How the studio works, what is live, and what is only planned.</p></header>`;
  body.innerHTML = head + secs.map(s => `<section id="${kind}-${s.id}"><h3>${esc(s.title)}</h3><div class="md">${md(s.body)}</div></section>`).join('');
  body.dataset.done = '1';
  toc.addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); const t = document.getElementById(a.dataset.id); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const links = $$('a', toc); const obs = new IntersectionObserver(en => { en.forEach(x => { if (x.isIntersecting) links.forEach(l => l.classList.toggle('on', l.dataset.id === x.target.id)); }); }, { rootMargin: '-20% 0px -70% 0px' });
  $$('section', body).forEach(sc => obs.observe(sc));
}
const STATUS_LABEL = { done: 'Shipped', now: 'In progress', next: 'Up next', planned: 'Planned', idea: 'Idea' };
function renderRoadmap() {
  $('#roadmapVer').textContent = C.version;
  $('#roadmapBody').innerHTML = C.roadmap.map(p => `<article class="phase" data-s="${p.status}"><div class="ph-head"><span class="mono">${esc(p.phase)}</span><h3>${esc(p.title)}</h3><span class="when">${esc(p.when)}</span><span class="status-pill" data-s="${p.status}">${STATUS_LABEL[p.status]}</span></div><ul>${p.items.map(([s, t]) => `<li data-s="${s}"><i>${s === 'done' ? icon('check') : ''}</i><span>${esc(t)}${s !== p.status && s !== 'done' ? ` <span class="badge">${STATUS_LABEL[s]}</span>` : ''}</span></li>`).join('')}</ul></article>`).join('');
}

/* ---------------- markdown (safe subset) ---------------- */
function inline(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
function md(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n'); let h = '', list = null, code = null, para = [], table = null;
  const flushP = () => { if (para.length) { h += `<p>${para.map(inline).join('<br>')}</p>`; para = []; } };
  const flushL = () => { if (list) { h += `</${list}>`; list = null; } };
  for (const ln of lines) {
    if (code !== null) { if (/^```/.test(ln)) { h += `<pre><code>${esc(code)}</code></pre>`; code = null; } else code += (code ? '\n' : '') + ln; continue; }
    if (/^```/.test(ln)) { flushP(); flushL(); code = ''; continue; }
    let m;
    if ((m = ln.match(/^(#{1,4})\s+(.*)/))) { flushP(); flushL(); h += `<h3>${inline(m[2])}</h3>`; continue; }
    if ((m = ln.match(/^\s*[-*•]\s+(.*)/))) { flushP(); if (list !== 'ul') { flushL(); h += '<ul>'; list = 'ul'; } h += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = ln.match(/^\s*\d+[.)/]\s+(.*)/))) { flushP(); if (list !== 'ol') { flushL(); h += '<ol>'; list = 'ol'; } h += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = ln.match(/^>\s?(.*)/))) { flushP(); flushL(); h += `<blockquote class="${/^\*\*Draft/.test(m[1]) ? 'warn' : ''}">${inline(m[1])}</blockquote>`; continue; }
    if (/^\|/.test(ln)) { flushP(); flushL(); if (!table) { table = []; } table.push(ln); continue; } else if (table) { h += tbl(table); table = null; }
    if (!ln.trim()) { flushP(); flushL(); continue; }
    flushL(); para.push(ln);
  }
  if (code !== null) h += `<pre><code>${esc(code)}</code></pre>`;
  if (table) h += tbl(table);
  flushP(); flushL(); return h;
}
function tbl(rows) {
  const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const body = rows.filter(r => !/^\|\s*-{3}/.test(r));
  const [head, ...rest] = body.map(cells);
  return `<table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rest.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/* ---------------- Claude availability ---------------- */
function paintClaude() {
  const p = $('#claudePill'); p.classList.toggle('on', claudeState === 'on');
  $('#claudeTxt').textContent = claudeState === 'on' ? 'Claude ready' : claudeState === 'off' ? 'Claude offline' : 'Checking Claude…';
  if (curTab === 'run') renderPane();
}
(async () => {
  try { sampleFn = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('sample') : null; } catch (e) { sampleFn = null; }
  claudeState = sampleFn ? 'on' : 'off'; paintClaude();
})();

/* ---------------- boot ---------------- */
renderRoster(); paintHud(); renderDeck(); paintPowers(); renderPane(); renderHome();
if (['#studio', '#agents', '#skills', '#history', '#docs', '#paper', '#roadmap'].includes(location.hash)) go(location.hash.slice(1)); else go('home');
window.HARVEX_APP = { go, get draft() { return draft; }, choosePreset, firePower, stage };
})();
