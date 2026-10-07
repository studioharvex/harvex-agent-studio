/* Operator check for the AI provider (Authorization: Bearer CLAIMS_ADMIN_TOKEN). Sends one tiny test prompt through the
   configured provider and returns which provider/model/host is used and the provider's own error, if any. Never returns
   the API key. Use: curl -X POST https://<site>/api/ai/check -H "Authorization: Bearer $CLAIMS_ADMIN_TOKEN" */
import {failure,HttpError,runtime,aiReady} from '@/lib/server';
import {adminAllowed} from '@/lib/chain';
import {executeAI,providerInfo,type ProviderConfig} from '@/lib/provider';
import type {Agent} from '@/lib/agents';

export async function POST(request:Request){try{
 if(!adminAllowed(request))throw new HttpError(401,'Admin token required.');
 const cfg=runtime() as unknown as ProviderConfig&{AI_ENABLED?:string};const info=providerInfo(cfg);
 if(!aiReady())return Response.json({ready:false,aiEnabled:cfg.AI_ENABLED==='true',...info,error:'AI is off: set AI_ENABLED=true and one complete provider (OPENAI_* or AI_BASE_URL+AI_API_KEY+AI_MODEL or AI_GATEWAY_*).'});
 // network probes: plain HTTP vs HTTPS tells a DNS/egress problem from a TLS (certificate) problem
 const probe=async(url:string)=>{const t=Date.now();try{const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8000)});return {url,status:r.status,ms:Date.now()-t};}catch(e){return {url,error:(e as Error).message,ms:Date.now()-t};}};
 const network=await Promise.all(['http://www.gstatic.com/generate_204','https://www.gstatic.com/generate_204',...(info.host&&info.host!=='invalid URL'?[`https://${info.host}/`]:[])].map(probe));
 const agent={name:'HARVEX check',skin:'atlas',personality:'Answer in one short sentence.',tone:'Concise',language:'English',skills:['write']} as unknown as Agent;
 const started=Date.now();
 try{const out=await executeAI(cfg,agent,'write','Reply with exactly: HARVEX AI OK',crypto.randomUUID());return Response.json({ready:true,ok:true,...info,ms:Date.now()-started,sample:out.slice(0,120),network});}
 catch(e){return Response.json({ready:true,ok:false,...info,ms:Date.now()-started,error:(e as Error).message,network});}
}catch(e){return failure(e)}}
