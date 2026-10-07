/* Harvex — agent skills: prompt builders that run on Claude via the page's `sample` capability. */
(function (G) {
'use strict';
const R = G.HARVEX;
const clip = (s, n) => (s || '').length > n ? s.slice(0, n) + '\n[…truncated]' : (s || '');

function persona(A, preset) {
  return [
    `You are "${A.name}", an AI agent built in Harvex Agent Studio.`,
    `Character: ${preset.name} (${preset.role.toLowerCase()}) — "${preset.desc}"`,
    `Personality and instructions from the owner: ${A.personality}`,
    `Tone: ${A.tone}. Write the whole answer in ${A.language}.`,
    `Be accurate. If you are not sure about a fact, say so plainly. You cannot browse the web; do not invent links, quotes or statistics.`,
  ].join('\n');
}

R.AGENT_SKILLS = [
  {
    id: 'research', name: 'Research brief', icon: 'globe', cat: 'Research', motion: 'Think',
    desc: 'Turns a question into a structured brief: key findings, context, open questions and what to verify.',
    fields: [
      { id: 'q', label: 'Question or topic', type: 'textarea', ph: 'e.g. How do optimistic rollups settle to Ethereum, and what are the trade-offs?' },
      { id: 'depth', label: 'Depth', type: 'seg', options: ['Quick', 'Standard', 'Deep'], def: 'Standard' },
    ],
    sample: { q: 'What should a small team know before launching an AI agent product with token-based rewards?', depth: 'Standard' },
    build: (f) => `TASK: Write a research brief.\nQuestion: ${f.q}\nDepth: ${f.depth} (${f.depth === 'Quick' ? '≈150 words' : f.depth === 'Deep' ? '≈700 words' : '≈350 words'}).\nFormat in Markdown:\n## Short answer\n## Key findings (bullets)\n## Context & trade-offs\n## Open questions\n## What to verify (specific things a person should check in primary sources)\nNo preamble.`,
  },
  {
    id: 'summarize', name: 'Summarizer', icon: 'sum', cat: 'Knowledge', motion: 'Typing',
    desc: 'Condenses long text into a TL;DR, key points and action items.',
    fields: [
      { id: 'text', label: 'Text to summarize', type: 'textarea', file: true, ph: 'Paste an article, notes or a transcript, or load a .txt / .md file.' },
      { id: 'style', label: 'Style', type: 'seg', options: ['TL;DR', 'Key points', 'Action items'], def: 'Key points' },
    ],
    sample: { text: 'Meeting notes — Launch sync. Design wants two more weeks for the character pass; engineering says the save flow is ready. Marketing needs final screenshots by Friday. We agreed to ship the studio as a private preview first, collect feedback from 20 users, and only then open sign-ups. Open risk: AI provider costs are not budgeted yet. Owner for budget: Rina. Next sync Tuesday.', style: 'Action items' },
    build: (f) => `TASK: Summarize the text below. Style: ${f.style}.\n${f.style === 'TL;DR' ? 'Give a 2–3 sentence TL;DR.' : f.style === 'Action items' ? 'Give a one-line TL;DR, then a checklist of action items with owner and due date when the text states them (write "unassigned" otherwise).' : 'Give a one-line TL;DR, then 4–8 key points as bullets.'}\nUse only the text. Markdown. No preamble.\n\nTEXT:\n"""\n${clip(f.text, 40000)}\n"""`,
  },
  {
    id: 'docqa', name: 'Document Q&A', icon: 'doc', cat: 'Knowledge', motion: 'Think',
    desc: 'Answers a question from a document you provide, quoting the passages it relied on.',
    fields: [
      { id: 'doc', label: 'Document', type: 'textarea', file: true, ph: 'Paste the document text or load a .txt / .md / .csv file.' },
      { id: 'q', label: 'Your question', type: 'input', ph: 'e.g. What is the refund window?' },
    ],
    sample: { doc: 'Harvex Test Credits Policy (draft)\n1. New workspaces receive 250 test credits.\n2. A sample workflow run costs 5 credits; a research brief costs 8.\n3. Test credits have no monetary value and cannot be transferred or withdrawn.\n4. Credits reset when the preview period ends.\n5. Token holder rewards are planned but not active.', q: 'Can I withdraw my credits, and how many research briefs can a new workspace run?' },
    build: (f) => `TASK: Answer the question using ONLY the document.\nQuestion: ${f.q}\nFormat in Markdown:\n**Answer:** a direct answer.\n**Evidence:** 1–3 short exact quotes from the document as blockquotes.\n**Confidence:** High / Medium / Low with one reason.\nIf the document does not contain the answer, say so and do not guess.\n\nDOCUMENT:\n"""\n${clip(f.doc, 40000)}\n"""`,
  },
  {
    id: 'write', name: 'Content writer', icon: 'pen', cat: 'Creative', motion: 'Typing',
    desc: 'Drafts posts, threads, captions, outlines and emails from a short brief.',
    fields: [
      { id: 'brief', label: 'Brief', type: 'textarea', ph: 'What is it about, who is it for, what should the reader do next?' },
      { id: 'format', label: 'Format', type: 'seg', options: ['X thread', 'LinkedIn post', 'Caption', 'Blog outline', 'Email'], def: 'X thread' },
      { id: 'len', label: 'Length', type: 'seg', options: ['Short', 'Medium', 'Long'], def: 'Medium' },
    ],
    sample: { brief: 'Announce the Harvex Agent Studio private preview: pick a 3D character, dress it, give it skills like research and summarizing. Audience: builders and creators. CTA: join the waitlist. Rewards are planned, not live.', format: 'X thread', len: 'Short' },
    build: (f) => `TASK: Write a ${f.format} (${f.len.toLowerCase()} length).\nBrief: ${f.brief}\nRules: original wording, no hashtags spam (max 2), no made-up numbers or claims. ${f.format === 'X thread' ? 'Number each post like 1/, 2/ and keep each under 270 characters.' : ''}${f.format === 'Blog outline' ? 'Give a title, H2 sections with 2–3 bullet points each.' : ''}${f.format === 'Email' ? 'Include a subject line.' : ''}\nReturn only the content in Markdown.`,
  },
  {
    id: 'translate', name: 'Translator', icon: 'lang', cat: 'Language', motion: 'Typing',
    desc: 'Translates text while keeping tone, names and formatting.',
    fields: [
      { id: 'text', label: 'Text', type: 'textarea', file: true, ph: 'Paste the text to translate.' },
      { id: 'to', label: 'Translate to', type: 'seg', options: ['English', 'Español', '日本語', '中文'], def: 'Español' },
      { id: 'style', label: 'Style', type: 'seg', options: ['Natural', 'Formal', 'Casual'], def: 'Natural' },
    ],
    sample: { text: 'Pick a character, give it skills, and let it do the busy work while you focus on the ideas that matter.', to: 'Español', style: 'Casual' },
    build: (f) => `TASK: Translate the text into ${f.to}. Style: ${f.style}. Keep names, numbers, links and Markdown formatting. Return only the translation, then one line starting with "Note:" if any phrase had no direct equivalent.\n(Ignore the persona's default answer language for the translation itself.)\n\nTEXT:\n"""\n${clip(f.text, 30000)}\n"""`,
  },
  {
    id: 'brainstorm', name: 'Idea generator', icon: 'bulb', cat: 'Creative', motion: 'Think', json: true,
    desc: 'Generates ranked ideas with a one-line reason for each.',
    fields: [
      { id: 'topic', label: 'Topic or problem', type: 'textarea', ph: 'e.g. Names for a weekly research newsletter about AI agents' },
      { id: 'n', label: 'How many', type: 'seg', options: ['5', '8', '12'], def: '8' },
    ],
    sample: { topic: 'Fun community events to introduce people to Harvex agents without promising rewards', n: '8' },
    build: (f) => `TASK: Brainstorm ${f.n} distinct ideas for: ${f.topic}\nRank them best first. Reply with only a JSON array of objects: [{"title": string (max 8 words), "why": string (one sentence), "effort": "low"|"medium"|"high"}]. Write title and why in the persona's language.`,
  },
  {
    id: 'code', name: 'Code explainer', icon: 'code', cat: 'Builder', motion: 'Typing',
    desc: 'Explains, reviews or comments a code snippet.',
    fields: [
      { id: 'code', label: 'Code', type: 'textarea', file: true, mono: true, ph: 'Paste a function or file.' },
      { id: 'mode', label: 'What to do', type: 'seg', options: ['Explain', 'Review', 'Find bugs', 'Add comments'], def: 'Explain' },
    ],
    sample: { code: 'function debounce(fn, ms) {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), ms);\n  };\n}', mode: 'Explain' },
    build: (f) => `TASK: ${f.mode} the code below.\n${f.mode === 'Explain' ? 'Explain what it does step by step for a junior developer, then list edge cases.' : f.mode === 'Review' ? 'Give a short review: strengths, issues ranked by severity, and concrete suggestions with small code examples.' : f.mode === 'Find bugs' ? 'List real bugs only (no style nits), each with the failing input and a fix.' : 'Return the same code with clear, concise comments added, in one fenced code block.'}\nMarkdown.\n\nCODE:\n\`\`\`\n${clip(f.code, 30000)}\n\`\`\``,
  },
  {
    id: 'planner', name: 'Task planner', icon: 'list', cat: 'Productivity', motion: 'Think', json: true,
    desc: 'Breaks a goal into an ordered checklist with time estimates.',
    fields: [
      { id: 'goal', label: 'Goal', type: 'textarea', ph: 'e.g. Launch a landing page for the private preview' },
      { id: 'time', label: 'Timeframe', type: 'seg', options: ['1 day', '1 week', '1 month'], def: '1 week' },
    ],
    sample: { goal: 'Prepare the Harvex private preview for 20 test users', time: '1 week' },
    build: (f) => `TASK: Plan how to reach this goal within ${f.time}: ${f.goal}\nReply with only JSON: {"summary": string (one sentence), "steps": [{"step": string (imperative, max 12 words), "detail": string (one sentence), "estimate": string (e.g. "2h", "1d")}]} with 5–10 steps in order. Write text fields in the persona's language.`,
  },
];

R.PLANNED_SKILLS = [
  { id: 'monitor', name: 'Wallet monitor', icon: 'wallet', desc: 'Watch addresses on BNB Smart Chain and summarize activity. Planned; no wallet connection is built.' },
  { id: 'schedule', name: 'Scheduled tasks', icon: 'cal', desc: 'Run a skill on a recurring schedule. Planned; not active.' },
];

R.buildPrompt = function (skill, fields, agent, preset) {
  return persona(agent, preset) + '\n\n' + skill.build(fields);
};
})(window);
