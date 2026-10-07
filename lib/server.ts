import {env} from 'cloudflare:workers';
import {currentUser} from '@/lib/auth';
export async function context(request:Request,write=false){
 if(write){const origin=request.headers.get('origin');if(!origin||origin!==appOrigin(request))throw new HttpError(403,'Please use this workspace to make changes.');}
 if(!env.DB)throw new HttpError(503,'Workspace storage is unavailable. Your draft is still on screen.');
 const user=await currentUser(request);if(!user)throw new HttpError(401,'Sign in to save agents and run tasks.');
 return {db:env.DB,owner:user.id,email:user.label,wallet:user.wallet};
}
/** Public origin of the site. Behind a reverse proxy (Coolify, Docker) the Worker sees an internal URL,
    so APP_ORIGIN (https://your-domain) wins when it is set. */
export function appOrigin(request:Request){return ((env as unknown as {APP_ORIGIN?:string}).APP_ORIGIN||new URL(request.url).origin).replace(/[/]+$/,'');}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
/** An error's text for the server log, with every URL cut down to its origin: RPC and provider URLs can carry an API key
    in the path (CHAIN_RPC_URL), and whoever can read the container log must not get it. */
export const safeMessage=(e:unknown)=>String((e as Error)?.stack||(e as Error)?.message||e).replace(/https?:\/\/[^\s"'<>)]+/gi,u=>{try{return new URL(u).origin+'/…';}catch{return '[url]';}}).slice(0,1500);
export function failure(e:unknown){if(e instanceof HttpError)return Response.json({error:e.message},{status:e.status});console.error('Harvex request failed',safeMessage(e));return Response.json({error:'This request could not be completed. Please try again.'},{status:500});}
export async function body(request:Request){const text=await request.text();if(text.length>18000)throw new HttpError(413,'Please keep the request under 18,000 characters.');try{return JSON.parse(text)}catch{throw new HttpError(400,'Invalid request.')}}
export function runtime(){return env as typeof env & {ANTHROPIC_API_KEY?:string;AI_GATEWAY_URL?:string;AI_GATEWAY_KEY?:string;AI_ENABLED?:string;OPENAI_API_KEY?:string;OPENAI_MODEL?:string;PLATFORM_FEE_BPS?:string};}
export function aiReady(){const e=runtime() as ReturnType<typeof runtime>&{AI_BASE_URL?:string;AI_API_KEY?:string;AI_MODEL?:string};return e.AI_ENABLED==='true'&&!!(e.ANTHROPIC_API_KEY||(e.OPENAI_API_KEY&&e.OPENAI_MODEL)||(e.AI_BASE_URL&&e.AI_API_KEY&&e.AI_MODEL)||(e.AI_GATEWAY_URL&&e.AI_GATEWAY_KEY));}
