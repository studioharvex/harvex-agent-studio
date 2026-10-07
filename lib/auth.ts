/* Authentication with Better Auth on Cloudflare D1: wallet only. Sign-In with Ethereum (EIP-4361) for
   BNB Smart Chain: the signed message must name this site and the configured BNB Smart Chain id (56 mainnet,
   97 testnet). Any EIP-1193 wallet works: browser extensions (EIP-6963), a wallet app's in-app
   browser, or WalletConnect. Signing is free and sends no transaction. There is no email or password login.
   Session cookie: `harvex.session_token` (HttpOnly, SameSite=Lax, Secure on https).
   Env: BETTER_AUTH_SECRET (32+ chars, required), APP_ORIGIN (https://your-domain),
        AUTH_TRUST_SITES_HEADERS=true only for the legacy ChatGPT Site. */
import {env} from 'cloudflare:workers';
import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {siwe} from 'better-auth/plugins/siwe';
import {drizzle} from 'drizzle-orm/d1';
import {verifyMessage} from 'viem';
import {generateSiweNonce} from 'viem/siwe';
import {authSchema} from '@/db/auth-schema';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {chainConfig} from './chain';
import {strictSiwe} from './siwe';

type Env={DB:D1Database;BETTER_AUTH_SECRET?:string;APP_ORIGIN?:string;AUTH_TRUST_SITES_HEADERS?:string};
const E=()=>env as unknown as Env;
export const WALLET_EMAIL_DOMAIN='wallet.invalid';
export class AuthError extends Error{constructor(public status:number,message:string){super(message)}}

function origin(req:Request){return (E().APP_ORIGIN||new URL(req.url).origin).replace(/[/]+$/,'');}
function secret(){
 const s=E().BETTER_AUTH_SECRET;if(s&&s.length>=32)return s;
 throw new AuthError(503,'Sign-in is not configured on this server (BETTER_AUTH_SECRET is missing).');
}

/** Better Auth instance for one request. */
export function createAuth(req:Request){
 const db=E().DB;if(!db)throw new AuthError(503,'Sign-in is unavailable right now.');
 const base=origin(req);const chainId=chainConfig().id;
 return betterAuth({
  appName:'Harvex Agent Studio',baseURL:base,basePath:'/api/auth',secret:secret(),trustedOrigins:[base],
  database:drizzleAdapter(drizzle(db,{schema:authSchema}),{provider:'sqlite',schema:authSchema}),
  session:{expiresIn:60*60*24*30,updateAge:60*60*24},
  advanced:{cookiePrefix:'harvex',useSecureCookies:base.startsWith('https:'),ipAddress:{ipAddressHeaders:['cf-connecting-ip','x-forwarded-for','x-real-ip']}},
  rateLimit:{enabled:true,window:60,max:30},
  plugins:[
   siwe({domain:new URL(base).host,emailDomainName:WALLET_EMAIL_DOMAIN,anonymous:true,
    getNonce:async()=>generateSiweNonce(),
    // only messages signed for this BNB Smart Chain network are accepted
    verifyMessage:async({message,signature,address,chainId:signedFor})=>{
     // the configured BNB Smart Chain id, or Ethereum (1) for wallets that refuse unknown chains in SIWE messages
     if(signedFor!==chainId&&signedFor!==1)return false;
     // only a well-formed, fresh EIP-4361 message for this site and this address (lib/siwe.ts explains why)
     const m=strictSiwe(message,{host:new URL(base).host,origin:base,chains:[chainId,1]});
     if(!m||m.chainId!==signedFor||m.address.toLowerCase()!==String(address).toLowerCase())return false;
     try{return await verifyMessage({address:address as `0x${string}`,message,signature:signature as `0x${string}`});}catch{return false;}}}),
  ],
 });
}

export type User={id:string;email:string;label:string;wallet?:string};
const shortAddr=(a:string)=>a.slice(0,6)+'…'+a.slice(-4);

/** Current user from the Better Auth session, or (only when explicitly enabled) platform identity headers. */
export async function currentUser(req:Request):Promise<User|null>{
 if(E().DB&&(req.headers.get('cookie')||'').includes('harvex.session_token')){
  try{const s=await createAuth(req).api.getSession({headers:req.headers});
   if(s?.user){const email=s.user.email;const wallet=email.endsWith('@'+WALLET_EMAIL_DOMAIN)?email.split('@')[0]:undefined;
    return {id:s.user.id,email:wallet?'':email,label:wallet?shortAddr(wallet):email,wallet};}}
  catch(e){if(!(e instanceof AuthError))console.error('session lookup failed',e);}
 }
 if(E().AUTH_TRUST_SITES_HEADERS==='true'){const u=await getChatGPTUser();if(u)return {id:u.userId,email:u.email,label:u.email};}
 return null;
}
