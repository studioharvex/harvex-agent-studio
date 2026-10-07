/* Credit top-ups on BNB Smart Chain (logic in lib/topups.ts). GET: this account's credited top-ups and the ones still
   settling. POST {txHash}: check and credit it; while its block is not settled yet it is remembered and the scheduler
   finishes it, so the buyer does not have to keep the page open.
   Every check costs calls on the server's RPC. A real payment is bounded by itself (it settles within minutes and is
   then answered from the database); hashes that are not on the chain at all are limited per account and day, so nobody
   can spend the RPC quota by posting random hashes. */
import {isHash} from 'viem';
import {context,failure,body,HttpError} from '@/lib/server';
import {chainConfig} from '@/lib/chain';
import {rememberTopup,settleTopup} from '@/lib/topups';

const UNKNOWN_PER_DAY=120;      // checks per account per UTC day of hashes that are not on the chain (an RPC outage is not counted)

export async function GET(request:Request){try{
 const {db,owner}=await context(request);const c=chainConfig();
 const [r,p]=await Promise.all([db.prepare('SELECT tx_hash,log_index,from_address,amount,credits,created FROM topups WHERE owner=? ORDER BY created DESC LIMIT 50').bind(owner).all(),
  db.prepare('SELECT tx_hash,created FROM topup_pending WHERE owner=? AND chain_id=? ORDER BY created DESC LIMIT 10').bind(owner,c.id).all()]);
 return Response.json({topups:r.results,pending:p.results},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);
 const {txHash}=await body(request) as {txHash?:string};
 if(typeof txHash!=='string'||!isHash(txHash))throw new HttpError(400,'Paste the transaction hash (0x followed by 64 characters).');
 const hash=txHash.toLowerCase() as `0x${string}`;
 const key=`t:${owner}:${new Date().toISOString().slice(0,10)}`;
 if(((await db.prepare('SELECT used FROM ai_quotas WHERE key=?').bind(key).first<{used:number}>())?.used??0)>=UNKNOWN_PER_DAY)
  throw new HttpError(429,'Too many transaction hashes that are not on BNB Smart Chain were sent from this account today. Check the hash in your wallet; you can send it again after 00:00 UTC. A payment that is already settling is credited on its own.');
 const res=await settleTopup(db,owner,hash);
 // only a real payment still settling is remembered for the scheduler; a hash that is not on-chain yet is not
 if(res.status==='pending'){const remember=res.stage!=='sent';
  if(remember)await rememberTopup(db,owner,hash);
  else await db.prepare('INSERT INTO ai_quotas (key,used) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET used=used+1').bind(key).run();
  return Response.json({...res,remembered:remember},{status:202});}
 return Response.json(res);
}catch(e){return failure(e)}}
