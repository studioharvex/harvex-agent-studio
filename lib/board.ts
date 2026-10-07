/* The weekly board (GET /api/board; public page /top, components/harvex/board-page.tsx): the published agents that were
   used most in the last seven days.
   What counts: a COMPLETED run (a task or a chat message) of a published agent by an account OTHER than its creator,
   made in the last seven days. An agent's place is decided first by how many different accounts used it, then by how
   many runs that was: ten messages from one person weigh less than three people asking once each.
   Next to each agent: its place in the seven days before that, so the page can say who is new and who moved.
   What it is not: a measure of quality, and not hard to inflate (an account is a wallet, and wallets are free). So the
   board gives nothing: no credits, no badge, no better place in Discover. It is a list of what was used.
   Kept in memory for five minutes: the page, its picture and the link preview ask for the same list. */
import {env} from 'cloudflare:workers';
import {publicAgent} from './economy';
import {RATING_COLUMNS} from './ratings';

export const BOARD_DAYS=7,BOARD_SIZE=10;
const DAY=86400e3;
/** Milliseconds the list is kept in memory: five minutes, or BOARD_KEEP_SECONDS (local tests set 0). */
const keep=()=>{const raw=(env as unknown as {BOARD_KEEP_SECONDS?:string}).BOARD_KEEP_SECONDS;const v=Number(raw);return typeof raw==='string'&&raw.trim()!==''&&Number.isFinite(v)&&v>=0?Math.min(v,3600)*1000:300e3;};
type Count={agent_id:string;runs:number;people:number;chats:number};
type AgentRow={id:string;owner:string;name:string;config:string;price:number;talk_price:number|null;uses:number;published_at:string|null;handle:string|null;checked_at:string|null;check_mark:string|null;check_passed:number|null;up:number;down:number;kb_rev:number;sources:number};
export type BoardEntry={rank:number;/** place in the seven days before; null when it had no run by someone else then */before:number|null;
 runs:number;people:number;chats:number;agent:ReturnType<typeof publicAgent>};
export type Board={from:string;to:string;days:number;/** over every published agent, not only the listed ones */totals:{runs:number;people:number;agents:number};entries:BoardEntry[]};

const counts=(db:D1Database,from:string,to:string,limit:number)=>db.prepare(`SELECT r.agent_id,COUNT(*) AS runs,COUNT(DISTINCT r.owner) AS people,SUM(CASE WHEN r.talk IS NOT NULL THEN 1 ELSE 0 END) AS chats
  FROM agents a JOIN runs r ON r.agent_id=a.id AND r.created>=? AND r.created<? AND r.status='complete' AND r.owner!=a.owner
  WHERE a.published=1 AND a.archived=0 GROUP BY r.agent_id ORDER BY people DESC,runs DESC,MIN(r.created) LIMIT ?`).bind(from,to,limit).all<Count>();

let kept:{at:number;data:Board}|null=null;
export async function board(db:D1Database,now=new Date()):Promise<Board>{
 if(kept&&Date.now()-kept.at<keep())return kept.data;
 const to=now.toISOString(),from=new Date(now.getTime()-BOARD_DAYS*DAY).toISOString(),earlier=new Date(now.getTime()-2*BOARD_DAYS*DAY).toISOString();
 const [week,last,all]=await Promise.all([counts(db,from,to,BOARD_SIZE),counts(db,earlier,from,50),
  db.prepare(`SELECT COUNT(*) AS runs,COUNT(DISTINCT r.owner) AS people,COUNT(DISTINCT r.agent_id) AS agents FROM agents a JOIN runs r ON r.agent_id=a.id AND r.created>=? AND r.created<? AND r.status='complete' AND r.owner!=a.owner WHERE a.published=1 AND a.archived=0`).bind(from,to).first<{runs:number;people:number;agents:number}>()]);
 const ids=week.results.map(c=>c.agent_id);
 const rows=ids.length?(await db.prepare(`SELECT id,owner,name,config,price,talk_price,uses,published_at,checked_at,check_mark,check_passed,kb_rev,(SELECT COUNT(*) FROM knowledge_sources WHERE knowledge_sources.agent_id=agents.id) AS sources,${RATING_COLUMNS},(SELECT handle FROM creators WHERE creators.owner=agents.owner AND creators.status='verified') AS handle FROM agents WHERE published=1 AND archived=0 AND id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all<AgentRow>()).results:[];
 const prev=new Map(last.results.map((c,i)=>[c.agent_id,i+1]));
 const entries=week.results.map(c=>{const row=rows.find(r=>r.id===c.agent_id);return row?{c,row}:null;}).filter((x):x is {c:Count;row:AgentRow}=>!!x)
  .map(({c,row},i)=>({rank:i+1,before:prev.get(c.agent_id)??null,runs:Number(c.runs),people:Number(c.people),chats:Number(c.chats||0),agent:publicAgent(row)}));
 const data:Board={from,to,days:BOARD_DAYS,totals:{runs:Number(all?.runs||0),people:Number(all?.people||0),agents:Number(all?.agents||0)},entries};
 kept={at:Date.now(),data};
 return data;
}
/** How an agent moved against the seven days before: 'new' (not on the list then), or places up (+) / down (-). */
export const moved=(e:{rank:number;before:number|null})=>e.before===null?'new' as const:e.before-e.rank;
