/* Quests (lib/quests.ts). GET lists the quests of this server; with a session it also says which are done and which
   were claimed. POST {id} claims a finished quest for its free credits, once per account. */
import {env} from 'cloudflare:workers';
import {context,failure,body,HttpError} from '@/lib/server';
import {claimQuest,questList} from '@/lib/quests';

export async function GET(request:Request){try{
 let db:D1Database,owner:string|undefined;
 try{const ctx=await context(request);db=ctx.db;owner=ctx.owner;}
 catch(e){if(!(e instanceof HttpError)||e.status!==401)throw e;const d=(env as unknown as {DB?:D1Database}).DB;if(!d)throw new HttpError(503,'Storage is unavailable.');db=d;}
 return Response.json({signedIn:!!owner,...await questList(db,owner)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const {id}=await body(request) as {id?:string};
 const r=await claimQuest(db,owner,String(id||''));
 return Response.json({...r,...await questList(db,owner)});
}catch(e){return failure(e)}}
