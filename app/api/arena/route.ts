/* The arena (lib/arena.ts).
   GET ?id=<duel>                      public: one duel (question, both agents, both answers, the picks); with a
                                       session also the viewer's own pick
   GET                                 the signed-in account's own duels and the limits
   POST {runA, runB}                   makes a duel from two chat answers of the signed-in account
   POST {action:'vote', id, choice}    picks 'a' or 'b', or takes the pick back with null
   DELETE {id}                         the maker takes the duel down */
import {env} from 'cloudflare:workers';
import {context,failure,body,HttpError} from '@/lib/server';
import {createDuel,duelOf,duelsOf,removeDuel,voteDuel,DUEL_QUESTION_MAX,MAX_DUELS} from '@/lib/arena';

const noStore={headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}};

export async function GET(request:Request){try{
 let db:D1Database|undefined,owner:string|undefined;
 try{const ctx=await context(request);db=ctx.db;owner=ctx.owner;}catch(e){if(!(e instanceof HttpError)||e.status!==401)throw e;db=(env as unknown as {DB?:D1Database}).DB;}
 if(!db)throw new HttpError(503,'Storage is unavailable.');
 const id=new URL(request.url).searchParams.get('id');
 if(id===null)return Response.json({signedIn:!!owner,duels:owner?await duelsOf(db,owner):[],limits:{question:DUEL_QUESTION_MAX,duels:MAX_DUELS}},noStore);
 const duel=await duelOf(db,id,owner);
 if(!duel)throw new HttpError(404,'This duel is not up (anymore).');
 return Response.json({duel,signedIn:!!owner},noStore);
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const data=await body(request) as {action?:unknown;id?:unknown;choice?:unknown;runA?:unknown;runB?:unknown};
 if(data?.action==='vote'){await voteDuel(db,owner,data.id,data.choice??null);return Response.json({duel:await duelOf(db,String(data.id),owner)},noStore);}
 return Response.json({id:await createDuel(db,owner,data?.runA,data?.runB)},noStore);
}catch(e){return failure(e)}}

export async function DELETE(request:Request){try{
 const {db,owner}=await context(request,true);const data=await body(request) as {id?:unknown};
 await removeDuel(db,owner,data?.id);return Response.json({removed:true},noStore);
}catch(e){return failure(e)}}
