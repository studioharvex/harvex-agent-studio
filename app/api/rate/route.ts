/* Ratings of answers (lib/ratings.ts). POST {runId, value} marks the caller's own completed run as helpful (1) or not
   helpful (-1), or removes the mark (0). */
import {context,failure,body} from '@/lib/server';
import {rateRun} from '@/lib/ratings';

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const {runId,value}=await body(request) as {runId?:unknown;value?:unknown};
 return Response.json(await rateRun(db,owner,runId,value),{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
