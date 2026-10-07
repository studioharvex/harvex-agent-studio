/* Shared answers (lib/share.ts). GET ?id= is public: the answer of one run its owner made public (/s/<id>).
   POST {runId, showTask, turns?} makes a run of the signed-in account public (a chat message with up to five earlier turns), or changes whether its task is shown;
   DELETE {runId} takes it down. */
import {z} from 'zod';
import {env} from 'cloudflare:workers';
import {context,failure,body,HttpError} from '@/lib/server';
import {shareRun,sharedRun,unshareRun,SHARE_TURNS} from '@/lib/share';

// turns: for a chat message, how many earlier turns of its conversation the page shows
const post=z.object({runId:z.string().uuid(),showTask:z.boolean().default(true),turns:z.number().int().min(0).max(SHARE_TURNS).default(0)});

export async function GET(request:Request){try{
 const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw new HttpError(503,'Storage is unavailable.');
 const shared=await sharedRun(db,new URL(request.url).searchParams.get('id')||'');
 if(!shared)throw new HttpError(404,'This answer is not shared (anymore).');
 // short cache: an owner who stops sharing sees the page gone within a minute
 return Response.json({shared},{headers:{'Cache-Control':'public, max-age=30','X-Robots-Tag':'noindex'}});
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const p=post.safeParse(await body(request));if(!p.success)throw new HttpError(400,'Choose the run to share.');
 return Response.json({id:await shareRun(db,owner,p.data.runId,p.data.showTask,p.data.turns),task:p.data.showTask});
}catch(e){return failure(e)}}

export async function DELETE(request:Request){try{
 const {db,owner}=await context(request,true);const {runId}=await body(request) as {runId?:string};
 await unshareRun(db,owner,String(runId||''));return Response.json({removed:true});
}catch(e){return failure(e)}}
