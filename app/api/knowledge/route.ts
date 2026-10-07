/* Agent knowledge (lib/knowledge.ts): the sources a creator pasted for their OWN agent.
   GET ?agent=<id>                               the sources (title, kind, size; never the text) and the limits
   POST {agentId, title, kind, text}             adds a source
   POST {action:'try', agentId, question}        which passages a question would bring up (no AI, costs nothing)
   DELETE {agentId, id}                          removes a source
   Everything here needs a session and works on agents of that account only. */
import {context,failure,body} from '@/lib/server';
import {addSource,kbLimits,listSources,removeSource,tryQuestion} from '@/lib/knowledge';

const noStore={headers:{'Cache-Control':'no-store'}};

export async function GET(request:Request){try{
 const {db,owner}=await context(request);
 return Response.json({sources:await listSources(db,owner,new URL(request.url).searchParams.get('agent')),limits:kbLimits()},noStore);
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const data=await body(request) as {action?:unknown;agentId?:unknown;title?:unknown;kind?:unknown;text?:unknown;question?:unknown};
 if(data?.action==='try')return Response.json({found:await tryQuestion(db,owner,data.agentId,data.question)},noStore);
 const added=await addSource(db,owner,data||{});
 return Response.json({...added,sources:await listSources(db,owner,data.agentId)},noStore);
}catch(e){return failure(e)}}

export async function DELETE(request:Request){try{
 const {db,owner}=await context(request,true);const data=await body(request) as {agentId?:unknown;id?:unknown};
 await removeSource(db,owner,data?.agentId,data?.id);
 return Response.json({sources:await listSources(db,owner,data.agentId)},noStore);
}catch(e){return failure(e)}}
