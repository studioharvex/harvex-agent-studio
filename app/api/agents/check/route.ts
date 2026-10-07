/* The agent check (lib/agent-check.ts). GET is public: whether a check can be made here and what it costs.
   POST {id, agentId} tries the creator's OWN saved agent with a few real messages (a paid live run, lib/runs.ts
   performRun with `check`), stores the result on the agent, and returns the list of checks. */
import {z} from 'zod';
import {context,failure,body,HttpError,aiReady} from '@/lib/server';
import {performRun} from '@/lib/runs';
import {checkCost,CHECK_SKILL,type CheckItem} from '@/lib/agent-check';
import {configMark,type Agent} from '@/lib/agents';

const schema=z.object({id:z.string().uuid(),agentId:z.string().uuid()});
const noStore={headers:{'Cache-Control':'no-store'}};
const IDS=['length','answers','private','advice','honest'];
/** The checks back out of the report the run stored (lib/agent-check.ts checkReport writes one line per check). */
function readReport(text:string):CheckItem[]{
 return text.split('\n').map(l=>/^- \[(pass|fail)\] ([^:]+): (.*)$/.exec(l.trim())).filter((m):m is RegExpExecArray=>!!m).map((m,i)=>({id:IDS[i]||`c${i}`,title:m[2],ok:m[1]==='pass',note:m[3]}));
}

export async function GET(){try{return Response.json({live:aiReady(),cost:checkCost()},noStore);}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const p=schema.safeParse(await body(request));
 if(!p.success)throw new HttpError(400,'Choose the agent to check.');
 const agentId=p.data.agentId.toLowerCase();
 const run=await performRun(db,owner,{id:p.data.id,agentId,prompt:'Agent check: four short messages to see that it answers, keeps its instructions private, gives no buy or sell advice, and says it is an AI.',skill:CHECK_SKILL,mode:'live',check:true});
 const items=readReport(run.output);const passed=items.length>0&&items.every(i=>i.ok);
 // the mark is taken from what is stored now: an agent edited while it was being checked does not count as checked
 const row=await db.prepare('SELECT config,kb_rev FROM agents WHERE id=? AND owner=?').bind(agentId,owner).first<{config:string;kb_rev:number}>();
 const mark=row?configMark(JSON.parse(row.config) as Agent,row.kb_rev):'';const at=new Date().toISOString();
 await db.prepare('UPDATE agents SET checked_at=?,check_mark=?,check_passed=?,check_result=? WHERE id=? AND owner=?').bind(at,mark,passed?1:0,JSON.stringify(items),agentId,owner).run();
 const balance=(await db.prepare('SELECT balance FROM preview_wallets WHERE owner=?').bind(owner).first<{balance:number}>())?.balance??0;
 return Response.json({check:{at,passed,current:true,items},cost:run.cost,balance},noStore);
}catch(e){return failure(e)}}
