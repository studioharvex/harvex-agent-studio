/* Holder tiers. The tier comes from the HARVEX balance of every wallet linked to the account, read from
   BNB Smart Chain by the server. Off until HARVEX_TOKEN_ADDRESS is set (there is no token yet).
   GET  : current tier (also cached for fee discounts on runs).
   POST : claim this month's credit allotment. The balance is read at the period's snapshot block,
          fixed by the first claim of the month, so moving tokens to a fresh wallet afterwards does not
          earn a second allotment; each wallet counts once per period across all accounts. */
import {type Address} from 'viem';
import {context,failure,HttpError,safeMessage} from '@/lib/server';
import {chainClient,chainConfig,erc20Abi,TIERS,tierFor} from '@/lib/chain';
import {ensureWallet,ledgerRow} from '@/lib/economy';
import {userWallets} from '@/lib/wallets';

const period=()=>new Date().toISOString().slice(0,7);
async function balances(wallets:Address[],block?:bigint){
 const c=chainConfig();const client=chainClient(c);
 try{return await Promise.all(wallets.map(a=>client.readContract({address:c.harvex!,abi:erc20Abi,functionName:'balanceOf',args:[a],blockNumber:block})));}
 catch(e){
  // the reason goes to the server log: a past block needs an RPC that keeps historical state (archive), see DEPLOY-ID.md
  console.error('Harvex tier balance read failed',block===undefined?'(latest)':`at block ${block}`,safeMessage((e as Error)?.message).slice(0,300));
  throw new HttpError(503,block===undefined?'BNB Smart Chain is not reachable right now. Try again in a minute.':`Could not read HARVEX balances at this month's snapshot (block ${block}). Try again in a minute.`);
 }
}
/** The monthly snapshot is stored per chain, so switching CHAIN_NETWORK never reuses a block number from another chain. */
const snapKey=(chainId:number,p:string)=>`${chainId}:${p}`;
const next=(raw:bigint)=>{const t=tierFor(raw);const i=TIERS.findIndex(x=>x.id===t.id);return TIERS[i+1]?{id:TIERS[i+1].id,name:TIERS[i+1].name,min:TIERS[i+1].min.toString()}:null;};

export async function GET(request:Request){try{
 const {db,owner}=await context(request);const c=chainConfig();const wallets=await userWallets(db,owner);const p=period();
 const got=await db.prepare('SELECT tier,credits FROM tier_allotments WHERE period=? AND owner=?').bind(p,owner).first<{tier:string;credits:number}>();
 if(!c.harvex)return Response.json({live:false,wallets,period:p,tier:TIERS[0].id,allotment:null},{headers:{'Cache-Control':'no-store'}});
 const bal=(await balances(wallets)).reduce((a,v)=>a+v,0n);const t=tierFor(bal);
 await db.prepare('INSERT INTO tier_cache (owner,tier,balance,checked) VALUES (?,?,?,?) ON CONFLICT(owner) DO UPDATE SET tier=excluded.tier,balance=excluded.balance,checked=excluded.checked').bind(owner,t.id,bal.toString(),new Date().toISOString()).run();
 let supply:bigint|null=null;try{supply=await chainClient(c).readContract({address:c.harvex!,abi:erc20Abi,functionName:'totalSupply'});}catch{supply=null;}
 // share of supply in basis points (1 bp = 0.01%), used for the holder reward allocation estimate
 const shareBps=supply&&supply>0n?Number(bal*10000n/supply):null;
 return Response.json({live:true,wallets,period:p,balance:bal.toString(),supply:supply?.toString()??null,shareBps,tier:t.id,next:next(bal),
  allotment:{credits:t.mult*c.tierBase,claimed:!!got,claimedCredits:got?.credits??0}},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const c=chainConfig();
 if(!c.harvex)throw new HttpError(503,'Holder tiers start when the HARVEX token exists. There is no token yet.');
 const p=period();
 if(await db.prepare('SELECT 1 FROM tier_allotments WHERE period=? AND owner=?').bind(p,owner).first())throw new HttpError(409,'You already claimed this month\'s allotment.');
 const wallets=await userWallets(db,owner);if(!wallets.length)throw new HttpError(400,'Link a wallet that holds HARVEX first.');
 // snapshot block for the month: the first claim fixes it for everyone
 const key=snapKey(c.id,p);let head:bigint;try{head=await chainClient(c).getBlockNumber();}catch{throw new HttpError(503,'BNB Smart Chain is not reachable right now.');}
 let snap=await db.prepare('SELECT block FROM tier_periods WHERE period=?').bind(key).first<{block:number}>();
 // a snapshot above the current head cannot belong to this chain (a reset test chain): take a fresh one. On mainnet the
 // chain is never reset, so a "head" below the snapshot is a lagging RPC answer: wait instead of replacing the month's
 // snapshot with an earlier block (two accounts could otherwise be measured before and after moving the same tokens)
 if(snap&&BigInt(snap.block)>head){
  if(c.network==='mainnet')throw new HttpError(503,'BNB Smart Chain is still catching up. Try again in a minute.');
  await db.prepare('DELETE FROM tier_periods WHERE period=?').bind(key).run();snap=null;}
 if(!snap){
  await db.prepare('INSERT OR IGNORE INTO tier_periods (period,block,created) VALUES (?,?,?)').bind(key,Number(head),new Date().toISOString()).run();
  snap=await db.prepare('SELECT block FROM tier_periods WHERE period=?').bind(key).first<{block:number}>();}
 const used=new Set((await db.prepare('SELECT address FROM tier_allotment_wallets WHERE period=?').bind(p).all<{address:string}>()).results.map(r=>r.address));
 const fresh=wallets.filter(a=>!used.has(a));if(!fresh.length)throw new HttpError(409,'These wallets were already counted this month.');
 const bal=(await balances(fresh,BigInt(snap!.block))).reduce((a,v)=>a+v,0n);const t=tierFor(bal);
 if(t.mult===0)throw new HttpError(403,`Your linked wallets held less than ${TIERS[1].min.toLocaleString('en-US')} HARVEX at the snapshot (block ${snap!.block}).`);
 const credits=t.mult*c.tierBase;const created=new Date().toISOString();await ensureWallet(db,owner);
 try{await db.batch([
  db.prepare('INSERT INTO tier_allotments (period,owner,tier,credits,block,created) VALUES (?,?,?,?,?,?)').bind(p,owner,t.id,credits,snap!.block,created),
  ...fresh.map(a=>db.prepare('INSERT INTO tier_allotment_wallets (period,address,owner) VALUES (?,?,?)').bind(p,a,owner)),
  db.prepare('UPDATE preview_wallets SET balance=balance+? WHERE owner=?').bind(credits,owner),
  ledgerRow(db,owner,credits,'allotment',`${t.name} tier allotment · ${p}`,`tier:${p}`,created),
 ]);}catch{throw new HttpError(409,'This month\'s allotment was already claimed.');}
 return Response.json({period:p,tier:t.id,credits,block:snap!.block});
}catch(e){return failure(e)}}
