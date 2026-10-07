/* Agent knowledge, the part without server imports (lib/knowledge.ts stores and reads; the test imports this file):
   how a pasted source is cut into passages, and how the passages that bear on a question are picked.
   No AI and no outside service is used for this: a question is matched to passages by the words they share, weighted
   so that rare words count more than common ones (the usual "BM25" scoring). That is simple, predictable and free,
   and it means a question worded very differently from the source may find nothing: the agent then says it does not
   know, which is the honest result. */

/** Sources per agent, characters per source (a request body holds 18,000 once escaped), and characters over all sources. */
export const KB_SOURCES_MAX=8,KB_SOURCE_MAX=12000,KB_TOTAL_MAX=60000,KB_TITLE_MAX=60;
/** The line under an answer that names the sources it came from. One wording, written by `settle` and cut off again
    by kbStrip (so an earlier turn handed back to the AI does not teach it to write such a line itself). */
export const KB_NOTE='From its creator\u2019s sources:';
export const kbNote=(titles:string[])=>`---\n**${KB_NOTE}** ${titles.join(' · ')}`;
export function kbStrip(text:string){const i=text.lastIndexOf(`---\n**${KB_NOTE}**`);return i<0?text:text.slice(0,i).trimEnd();}

/** The AI is asked to end its answer with a line "USED: 1, 3" or "USED: none": which of the numbered passages it took
    facts from. That line is cut off here and becomes the note under the answer: the titles of the passages it named,
    or no note when it named none (a question the passages did not help with). When the line is missing, every source
    it was given is listed. `titles` holds the title of each passage, in the order they were numbered.
    This is what the AI reports, not a proof: the note says where an answer came from, not that it is right. */
export function settle(output:string,titles:string[]):string{
 const text=output.trimEnd();const all=()=>[...new Set(titles)];
 const m=/(?:^|\n)[ \t>*_-]*USED[ \t]*:[ \t]*([^\n]*)$/i.exec(text);
 if(!m)return `${text}\n\n${kbNote(all())}`;
 const body=text.slice(0,m.index).trimEnd();if(!body)return text;
 const nums=(m[1].match(/\d+/g)||[]).map(Number);
 if(!nums.length)return /none|no\b|nothing|n\/a/i.test(m[1])||!m[1].trim()?body:`${body}\n\n${kbNote(all())}`;
 const used=[...new Set(nums.map(n=>titles[n-1]).filter(Boolean))];
 return used.length?`${body}\n\n${kbNote(used)}`:body;
}
export const KB_KINDS=['notes','faq','thread'] as const;
export type KbKind=typeof KB_KINDS[number];
/** A passage aims for this many characters and is never longer than the second number. */
const TARGET=700,HARD=1100;
/** Passages given to the AI for one question, and the characters they may take together. */
export const KB_PASSAGES=4,KB_BUDGET=3200;

/** Cuts a source into passages: blank lines separate blocks (a question with its answer, a post, a paragraph), small
    blocks are joined up to about TARGET characters, and a block longer than HARD is cut at sentence ends. */
export function chunk(text:string):string[]{
 const blocks=String(text||'').replace(/\r/g,'').split(/\n\s*\n+/).map(b=>b.trim()).filter(Boolean);
 const pieces:string[]=[];
 for(const b of blocks){
  if(b.length<=HARD){pieces.push(b);continue;}
  // a long block: sentence by sentence, then by force when one sentence is itself too long
  let cur='';
  for(const s of b.split(/(?<=[.!?])\s+|\n+/)){
   if(cur&&cur.length+s.length+1>TARGET){pieces.push(cur);cur='';}
   if(s.length>HARD){for(let i=0;i<s.length;i+=TARGET)pieces.push(s.slice(i,i+TARGET));continue;}
   cur=cur?`${cur} ${s}`:s;
  }
  if(cur)pieces.push(cur);
 }
 // join neighbours that are small, so a passage carries enough to be understood on its own
 const out:string[]=[];
 for(const p of pieces){const last=out[out.length-1];if(last!==undefined&&last.length+p.length+2<=TARGET)out[out.length-1]=`${last}\n\n${p}`;else out.push(p);}
 return out;
}

const STOP=new Set('a an and are as at be but by can do does for from had has have how i if in is it its me my of on or our so that the their them then there these they this to up us was we were what when where which who why will with you your about into than too very not no yes just also more most any all some one two did get got give tell please much many would could should am been being he she his her him im ive dont lets let say said know think want need like really thing'.split(' '));
/** The words of a text that carry meaning: lower case, letters and digits, no very common words, plural "s" dropped. */
export function words(text:string):string[]{
 return (String(text||'').toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>1&&!STOP.has(w)).map(w=>w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w);
}

export type Passage={title:string;text:string};
/** The passages that bear on `query`, best first: at most `max`, at most `budget` characters together, and only ones
    that share at least one meaningful word with the question. */
export function pick<T extends Passage>(query:string,passages:T[],max=KB_PASSAGES,budget=KB_BUDGET):T[]{
 const q=[...new Set(words(query))];if(!q.length||!passages.length)return [];
 const docs=passages.map(p=>{const w=words(`${p.title} ${p.text}`);const tf=new Map<string,number>();for(const x of w)tf.set(x,(tf.get(x)||0)+1);return {p,len:w.length||1,tf};});
 const avg=docs.reduce((a,d)=>a+d.len,0)/docs.length;const N=docs.length;
 const df=new Map<string,number>();for(const t of q)df.set(t,docs.filter(d=>d.tf.has(t)).length);
 const k1=1.4,b=0.75;
 const scored=docs.map((d,i)=>{let s=0,hits=0;
  for(const t of q){const f=d.tf.get(t)||0;if(!f)continue;hits++;const idf=Math.log(1+(N-df.get(t)!+0.5)/(df.get(t)!+0.5));s+=idf*(f*(k1+1))/(f+k1*(1-b+b*d.len/avg));}
  return {d,i,s,hits};}).filter(x=>x.hits>0).sort((a,b2)=>b2.s-a.s||a.i-b2.i);
 // a passage that only shares one common-ish word with a longer question is noise: ask for a second hit when the
 // question has enough words to choose from
 const need=q.length>=4?2:1;const strong=scored.filter(x=>x.hits>=need);const list=strong.length?strong:scored.slice(0,1);
 const out:T[]=[];let used=0;
 for(const x of list){if(out.length>=max)break;if(used+x.d.p.text.length>budget&&out.length)continue;out.push(x.d.p);used+=x.d.p.text.length;}
 return out;
}
