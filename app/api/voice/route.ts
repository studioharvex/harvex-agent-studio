/* Creator voice (lib/voice.ts). GET is public: whether drafts can be made here and what one costs.
   POST {id, agentId, posts, own: true} drafts the instructions of the creator's OWN saved agent from posts the creator
   wrote: a normal paid live run (lib/runs.ts performRun with `voice`). It returns the draft; it changes nothing on
   the agent. `own` must be true: the creator states the posts are theirs. */
import {z} from 'zod';
import {context,failure,body,HttpError} from '@/lib/server';
import {performRun} from '@/lib/runs';
import {parseVoice,voiceInfo,VOICE_MAX,VOICE_MIN,VOICE_SKILL} from '@/lib/voice';

const schema=z.object({id:z.string().uuid(),agentId:z.string().uuid(),posts:z.string().trim().min(VOICE_MIN).max(VOICE_MAX),own:z.literal(true)});
const noStore={headers:{'Cache-Control':'no-store'}};

export async function GET(){try{return Response.json(voiceInfo(),noStore);}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const data=await body(request) as {own?:unknown};
 if(data?.own!==true)throw new HttpError(400,'Confirm that these are your own posts. An agent is only written from posts its creator wrote.');
 const parsed=schema.safeParse(data);
 if(!parsed.success)throw new HttpError(400,`Paste between ${VOICE_MIN.toLocaleString('en-US')} and ${VOICE_MAX.toLocaleString('en-US')} characters of your own posts.`);
 const {id,agentId,posts}=parsed.data;
 const run=await performRun(db,owner,{id,agentId:agentId.toLowerCase(),prompt:posts,skill:VOICE_SKILL,mode:'live',voice:true});
 const balance=(await db.prepare('SELECT balance FROM preview_wallets WHERE owner=?').bind(owner).first<{balance:number}>())?.balance??0;
 return Response.json({id:run.id,...parseVoice(run.output),cost:run.cost,balance},noStore);
}catch(e){return failure(e)}}
