/* The owner's delivery channels (lib/notify.ts): where schedules send finished runs. GET lists channels and what this
   server supports; POST connects Discord (webhook address), starts a Telegram link or sends a test; DELETE removes a
   channel. A webhook address or chat id is never sent back to the browser, only the channel's label. */
import {z} from 'zod';
import {context,failure,body,HttpError} from '@/lib/server';
import {skillIds} from '@/lib/agents';
import {checkTarget} from '@/lib/schedules';
import {liveRunCost} from '@/lib/economy';
import {talkCost,TALK_SKILL} from '@/lib/talk';
import {addDiscord,channelLimit,channelsOf,notifyConfig,pendingTelegram,pollTelegram,readerFresh,removeChannel,setChat,startTelegram,testChannel} from '@/lib/notify';

const post=z.discriminatedUnion('action',[
 z.object({action:z.literal('discord'),url:z.string().trim().min(20).max(400)}),
 z.object({action:z.literal('telegram')}),
 z.object({action:z.literal('test'),id:z.string().uuid()}),
 // an agent that answers in a Telegram chat (agentId null: reports only); daily = answers per day in that chat
 // skill 'chat': the agent answers in its own voice (a conversation). An agent someone else published answers that
 // way only, and `expectedPrice` is its creator's price per message as the page showed it.
 z.object({action:z.literal('chat'),id:z.string().uuid(),agentId:z.string().uuid().nullable(),skill:z.enum([...skillIds,TALK_SKILL]).optional(),daily:z.number().int().min(1).max(200).default(20),expectedPrice:z.number().int().min(0).max(500).optional()}),
]);

async function view(db:D1Database,owner:string){
 let pending=await pendingTelegram(db,owner).catch(()=>null);
 // while the owner waits for their chat to appear, the page asks every few seconds: read the bot's messages now
 // (in the container a reader does this all the time; the page only reads where there is none)
 if(pending&&!await readerFresh(db).catch(()=>false)){await pollTelegram(db).catch(()=>null);pending=await pendingTelegram(db,owner).catch(()=>null);}
 return {config:{...notifyConfig(),max:await channelLimit(db,owner)},channels:await channelsOf(db,owner),pending,chatCosts:{...Object.fromEntries(skillIds.map(k=>[k,liveRunCost(k)])),[TALK_SKILL]:talkCost()}};
}

export async function GET(request:Request){try{const {db,owner}=await context(request);return Response.json(await view(db,owner),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const p=post.safeParse(await body(request));if(!p.success)throw new HttpError(400,'Check the request and try again.');const d=p.data;
 if(d.action==='discord'){const id=await addDiscord(db,owner,d.url);return Response.json({id,...await view(db,owner)});}
 if(d.action==='telegram'){await startTelegram(db,owner);return Response.json(await view(db,owner));}
 if(d.action==='chat'){
  let chat:{agentId:string;skill:string;daily:number;price?:number|null}|null=null;
  if(d.agentId){
   const a=await db.prepare('SELECT owner,published,archived,price,talk_price FROM agents WHERE id=?').bind(d.agentId).first<{owner:string;published:number;archived:number;price:number;talk_price:number|null}>();
   if(a&&a.owner===owner){
    // the owner's own agent: one of its skills, or its own voice
    if(!d.skill)throw new HttpError(400,'Choose the skill that answers.');
    if(d.skill===TALK_SKILL){if(a.archived)throw new HttpError(404,'This agent was archived. Restore it first.');}else await checkTarget(db,owner,d.agentId,d.skill);
    chat={agentId:d.agentId,skill:d.skill,daily:d.daily,price:null};
   }else{
    // an agent someone else published: it answers in its own voice, at its creator's price per message, and only
    // at the price the page showed (unknown, private and archived agents look the same)
    if(!a||!a.published||a.archived)throw new HttpError(404,'Schedules and chats use your own agents, or agents that are published.');
    if(d.skill&&d.skill!==TALK_SKILL)throw new HttpError(400,'An agent someone else published answers in its own voice only.');
    const price=a.talk_price??a.price;
    if(d.expectedPrice!==price)throw new HttpError(409,`This agent costs ${price} credits per message to its creator${d.expectedPrice===undefined?'':' now'}. Check the price and save again.`);
    chat={agentId:d.agentId,skill:TALK_SKILL,daily:d.daily,price};
   }
  }
  await setChat(db,owner,d.id,chat);return Response.json(await view(db,owner));
 }
 await testChannel(db,owner,d.id);return Response.json({sent:true,...await view(db,owner)});
}catch(e){return failure(e)}}

export async function DELETE(request:Request){try{
 const {db,owner}=await context(request,true);const {id}=await body(request) as {id?:string};
 await removeChannel(db,owner,String(id||''));return Response.json(await view(db,owner));
}catch(e){return failure(e)}}
