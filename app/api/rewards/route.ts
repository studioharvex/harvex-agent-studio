/* Holder rewards dashboard data (lib/rewards.ts). Public: program settings, recorder status, funding history and
   periods. Signed in: your linked wallets (balance, holding since), your allocation per period and, after the
   eligibility statement (POST {action:'attest'}), the proof to claim from the reward contract. Claims are sent
   from the holder's own wallet. */
import {context,failure,body,HttpError} from '@/lib/server';
import {env} from 'cloudflare:workers';
import {attest,rewardsOverview} from '@/lib/rewards';
import {userWallets} from '@/lib/wallets';

export async function GET(request:Request){try{
 let db:D1Database,wallets=null,owner:string|undefined;
 try{const ctx=await context(request);db=ctx.db;owner=ctx.owner;wallets=await userWallets(ctx.db,ctx.owner);}
 catch(e){if(!(e instanceof HttpError)||e.status!==401)throw e;const d=(env as unknown as {DB?:D1Database}).DB;if(!d)throw new HttpError(503,'Storage is unavailable.');db=d;}
 return Response.json({signedIn:wallets!==null,...await rewardsOverview(db,wallets,owner)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const b=await body(request) as {action?:string;country?:string;confirm?:boolean};
 if(b.action!=='attest')throw new HttpError(400,'Unknown action.');
 return Response.json(await attest(db,owner,String(b.country||''),b.confirm===true));
}catch(e){return failure(e)}}
