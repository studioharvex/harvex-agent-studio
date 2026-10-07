/* Talk to an agent (lib/talk.ts). GET is public: how a message runs here and what it costs; with a session and
   ?agent=&thread= it also returns the account's own messages of that conversation and its balance.
   POST {id, agentId, thread, message, expectedPrice?} sends one message: a normal paid run of the agent
   (lib/runs.ts performRun with `talk`), answered in the agent's own voice. */
import {z} from 'zod';
import {env} from 'cloudflare:workers';
import {context,failure,body,HttpError} from '@/lib/server';
import {performRun} from '@/lib/runs';
import {talkInfo,talkThread,TALK_MESSAGE_MAX,TALK_SKILL} from '@/lib/talk';
import {notifyConfig} from '@/lib/notify';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schema=z.object({id:z.string().uuid(),agentId:z.string().uuid(),thread:z.string().uuid(),message:z.string().trim().min(1).max(TALK_MESSAGE_MAX),expectedPrice:z.number().int().min(0).max(500).optional()});
const balanceOf=async(db:D1Database,owner:string)=>(await db.prepare('SELECT balance FROM preview_wallets WHERE owner=?').bind(owner).first<{balance:number}>())?.balance??0;
const noStore={headers:{'Cache-Control':'no-store'}};

export async function GET(request:Request){try{
 let db:D1Database|undefined,owner:string|undefined;
 try{const ctx=await context(request);db=ctx.db;owner=ctx.owner;}catch(e){if(!(e instanceof HttpError)||e.status!==401)throw e;db=(env as unknown as {DB?:D1Database}).DB;}
 const p=new URL(request.url).searchParams;const agent=p.get('agent')||'',thread=p.get('thread')||'';
 const mine=db&&owner&&UUID.test(agent)&&UUID.test(thread);
 return Response.json({signedIn:!!owner,...talkInfo(),/* this server has a Telegram bot: the agent can be put into a chat there */telegram:notifyConfig().telegram,balance:db&&owner?await balanceOf(db,owner):null,messages:mine?await talkThread(db!,owner!,agent.toLowerCase(),thread.toLowerCase()):[]},noStore);
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const parsed=schema.safeParse(await body(request));
 if(!parsed.success)throw new HttpError(400,`Write a message of up to ${TALK_MESSAGE_MAX.toLocaleString('en-US')} characters.`);
 const {id,agentId,thread,message,expectedPrice}=parsed.data;
 const run=await performRun(db,owner,{id,agentId:agentId.toLowerCase(),prompt:message,skill:TALK_SKILL,mode:talkInfo().mode,expectedPrice,talk:thread.toLowerCase()});
 return Response.json({id:run.id,answer:run.output,cost:run.cost,created:run.created,balance:await balanceOf(db,owner)},noStore);
}catch(e){return failure(e)}}
