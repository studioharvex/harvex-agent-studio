/* Shared search logic (Notion-style): "title" mode matches titles only, "all" mode also matches
   the body and returns a snippet around the first match. Every query word must match somewhere.
   Results are ranked: exact title > title prefix > word start in title > title substring > body. */
export type SearchMode = 'title' | 'all';
export type Range = [number, number];
export type Searchable = { title: string; body?: string };
export type Hit<T> = { item: T; score: number; titleRanges: Range[]; snippet?: { text: string; ranges: Range[] } };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const queryTerms = (q: string) => fold(q).split(/\s+/).filter(Boolean);

/** All [start,end) ranges of every term inside text (case/diacritic-insensitive), merged. */
export function findRanges(text: string, terms: string[]): Range[] {
  const hay = fold(text); const out: Range[] = [];
  for (const t of terms) { let i = hay.indexOf(t); while (i !== -1) { out.push([i, i + t.length]); i = hay.indexOf(t, i + t.length); } }
  out.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const r of out) { const last = merged[merged.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r] as Range); }
  return merged;
}

function titleScore(title: string, terms: string[]) {
  const t = fold(title); let score = 0;
  const whole = terms.join(' ');
  if (t === whole) score += 120; else if (t.startsWith(whole)) score += 70;
  for (const term of terms) {
    const i = t.indexOf(term); if (i === -1) return -1;
    score += i === 0 ? 40 : /\s|[-/(]/.test(t[i - 1]) ? 28 : 14;
  }
  return score;
}

function snippetOf(body: string, terms: string[], width = 150) {
  const clean = body.replace(/-{3,}|[#>*`|_]+/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
  const first = findRanges(clean, terms)[0];
  let start = 0;
  if (first) start = Math.max(0, first[0] - Math.floor(width / 3));
  if (start > 0) { const sp = clean.indexOf(' ', start); if (sp !== -1 && sp < first![0]) start = sp + 1; }
  let text = clean.slice(start, start + width);
  if (start + width < clean.length) text = text.replace(/\s+\S*$/, '') + '…';
  if (start > 0) text = '…' + text;
  return { text, ranges: findRanges(text, terms) };
}

export function searchItems<T extends Searchable>(items: readonly T[], query: string, mode: SearchMode, limit = 50): Hit<T>[] {
  const terms = queryTerms(query); if (!terms.length) return [];
  const hits: Hit<T>[] = [];
  for (const item of items) {
    const ts = titleScore(item.title, terms);
    if (mode === 'title') {
      if (ts < 0) continue;
      hits.push({ item, score: ts, titleRanges: findRanges(item.title, terms), snippet: item.body ? { text: item.body.slice(0, 150), ranges: [] } : undefined });
      continue;
    }
    const hayTitle = fold(item.title), hayBody = fold(item.body || '');
    if (!terms.every(t => hayTitle.includes(t) || hayBody.includes(t))) continue;
    const bodyMatches = terms.reduce((n, t) => n + (hayBody.split(t).length - 1), 0);
    const score = (ts > 0 ? ts : terms.filter(t => hayTitle.includes(t)).length * 10) + Math.min(bodyMatches, 6) * 3;
    hits.push({ item, score, titleRanges: findRanges(item.title, terms), snippet: item.body ? snippetOf(item.body, terms) : undefined });
  }
  return hits.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title)).slice(0, limit);
}

/** Simple list filter used by inline search boxes (same matching rules, keeps original order when empty). */
export function filterItems<T>(items: readonly T[], query: string, mode: SearchMode, pick: (t: T) => Searchable): T[] {
  if (!queryTerms(query).length) return [...items];
  const wrapped = items.map(item => ({ ...pick(item), item }));
  return searchItems(wrapped, query, mode, items.length).map(h => h.item.item);
}
