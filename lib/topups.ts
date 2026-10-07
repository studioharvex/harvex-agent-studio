/* Credit top-ups on BNB Smart Chain. The buyer sends PAY tokens (USDT) from a LINKED wallet to the treasury with their
   own wallet, then posts the transaction hash. The server reads the receipt from its own RPC and credits the account once
   per Transfer log. Nothing is trusted from the client except the hash: token, recipient, sender, amount and finality
   all come from the chain.
   Finality (TOPUP_FINALITY): 'safe' waits until the validators have justified the block (a few seconds on
   BNB Smart Chain mainnet), 'finalized' until it is finalized, 'soft' only for N blocks. Screened (sanctioned)
   transfers never get a receipt. A hash that is still settling is kept in topup_pending and finished by the scheduler,
   so the credits arrive even when the buyer has left the page. */
import {decodeEventLog,formatUnits,getAddress,type Hex} from 'viem';
import {HttpError} from './server';
import {chainClient,chainConfig,creditsFor,erc20Abi} from './chain';
import {ensureWallet,ledgerRow} from './economy';
import {userWallets} from './wallets';

export type TopupResult={status:'credited';credits:number;already?:boolean;confirmations?:number}|{status:'pending';stage:string;finality:string;confirmations:number;needed:number};

/** Checks one transaction for `owner` and credits it when settled. Throws HttpError when it can never be credited. */
export async function settleTopup(db:D1Database,owner:string,hash:Hex):Promise<TopupResult>{
 const c=chainConfig();if(!c.token||!c.treasury)throw new HttpError(503,'Top-ups are not switched on yet.');
 // every Transfer log is credited once (UNIQUE chain_id + tx_hash + log_index); what is already credited is read first
 const used=(await db.prepare('SELECT owner,log_index,credits FROM topups WHERE chain_id=? AND tx_hash=?').bind(c.id,hash).all<{owner:string;log_index:number;credits:number}>()).results;
 const own=used.filter(r=>r.owner===owner);
 if(own.length)return {status:'credited',credits:own.reduce((s,r)=>s+r.credits,0),already:true};
 const client=chainClient(c);
 let chainId:number;try{chainId=await client.getChainId();}catch{throw new HttpError(503,'BNB Smart Chain is not reachable right now. Try again in a minute.');}
 if(chainId!==c.id)throw new HttpError(503,'The server RPC is on the wrong chain. Top-ups are paused.');
 // not on-chain (yet): reported as pending but never remembered (see the route), so random hashes cannot fill the queue.
 // An RPC failure is a different answer (503): it must not look like "this hash does not exist".
 let receipt:Awaited<ReturnType<typeof client.getTransactionReceipt>>;
 try{receipt=await client.getTransactionReceipt({hash});}
 catch(e){if((e as Error)?.name==='TransactionReceiptNotFoundError')return {status:'pending',stage:'sent',finality:c.finality,confirmations:0,needed:c.confirmations};
  throw new HttpError(503,'BNB Smart Chain is not reachable right now. Try again in a minute.');}
 // the answer must be about the transaction that was asked for
 if(String(receipt.transactionHash).toLowerCase()!==hash.toLowerCase())throw new HttpError(503,'The chain returned a different transaction. Try again in a minute.');
 if(receipt.status!=='success')throw new HttpError(400,'That transaction failed on-chain, so nothing was sent.');
 // the content is checked BEFORE waiting for finality: only a real payment of the PAY token from one of this account's
 // wallets to the treasury ever waits in the queue; anything else is refused at once. It is read again after finality.
 const mine=new Set((await userWallets(db,owner)).map(a=>a.toLowerCase()));
 const transfers=receipt.logs.filter(l=>getAddress(l.address)===c.token!.address).flatMap(l=>{
  try{const d=decodeEventLog({abi:erc20Abi,data:l.data,topics:l.topics});return d.eventName==='Transfer'?[{from:getAddress(d.args.from),to:getAddress(d.args.to),value:d.args.value,index:l.logIndex}]:[];}catch{return [];}
 }).filter(t=>t.to===c.treasury);
 if(!transfers.length)throw new HttpError(400,`No ${c.token.symbol} transfer to the Harvex treasury was found in that transaction.`);
 // transfers of this transaction that another account was already credited for are never credited again
 const taken=new Set(used.map(r=>r.log_index));
 const ours=transfers.filter(t=>mine.has(t.from.toLowerCase())&&!taken.has(t.index));
 if(!ours.length){if(used.length)throw new HttpError(409,'This transaction was already used by another account.');
  throw new HttpError(403,'The tokens came from a wallet that is not linked to your account. Link it first, then try again.');}
 const rows=ours.map(t=>({...t,credits:creditsFor(t.value,c)})).filter(t=>t.credits>0);
 if(!rows.length)throw new HttpError(400,`The amount is below one credit (1 ${c.token.symbol} = ${c.creditsPerToken} credits).`);
 const head=await client.getBlockNumber().catch(()=>null);if(head===null)throw new HttpError(503,'BNB Smart Chain is not reachable right now. Try again in a minute.');
 const confirmations=Number(head-receipt.blockNumber)+1;
 if(c.finality==='soft'){if(confirmations<c.confirmations)return {status:'pending',stage:'soft',finality:c.finality,confirmations,needed:c.confirmations};}
 else{const settled=await client.getBlock({blockTag:c.finality}).catch(()=>null);
  if(!settled||settled.number<receipt.blockNumber)return {status:'pending',stage:c.finality,finality:c.finality,confirmations,needed:c.confirmations};
  // the receipt's block must be the canonical block at that height: a receipt from a reorged-out block credits nothing
  const canon=await client.getBlock({blockNumber:receipt.blockNumber}).catch(()=>null);
  if(!canon||canon.hash!==receipt.blockHash)return {status:'pending',stage:c.finality,finality:c.finality,confirmations,needed:c.confirmations};}
 const total=rows.reduce((s,r)=>s+r.credits,0);const created=new Date().toISOString();
 await ensureWallet(db,owner);
 try{await db.batch([
  ...rows.map(r=>db.prepare('INSERT INTO topups (id,owner,chain_id,tx_hash,log_index,token,from_address,amount,credits,created) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,c.id,hash,r.index,c.token!.address,r.from,r.value.toString(),r.credits,created)),
  // bought credits: they count as `paid`, so what creators earn from them can be claimed (drizzle/0014)
  db.prepare('UPDATE preview_wallets SET balance=balance+?,paid=paid+? WHERE owner=?').bind(total,total,owner),
  ledgerRow(db,owner,total,'topup',`Top-up · ${formatUnits(rows.reduce((a,r)=>a+r.value,0n),c.token.decimals)} ${c.token.symbol} on ${c.name}`,hash,created),
  db.prepare('DELETE FROM topup_pending WHERE chain_id=? AND tx_hash=? AND owner=?').bind(c.id,hash,owner),
 ]);}
 catch{
  // the batch is all-or-nothing. A parallel request credited these logs first (UNIQUE index): say so. Anything else
  // was a storage hiccup: nothing was credited, and the answer is "try again" (the scheduler keeps the pending entry)
  const now=(await db.prepare('SELECT owner,log_index FROM topups WHERE chain_id=? AND tx_hash=?').bind(c.id,hash).all<{owner:string;log_index:number}>()).results;
  if(now.some(r=>r.owner===owner))return {status:'credited',credits:total,already:true};
  if(rows.some(r=>now.some(x=>x.log_index===r.index)))throw new HttpError(409,'This transaction was already used by another account.');
  throw new HttpError(503,'The top-up could not be saved just now. It is safe: try again in a minute.');}
 return {status:'credited',credits:total,confirmations};
}

/** Remembers a hash that is still settling, so the scheduler can finish it. */
export async function rememberTopup(db:D1Database,owner:string,hash:Hex){
 const c=chainConfig();
 await db.prepare('INSERT OR IGNORE INTO topup_pending (chain_id,tx_hash,owner,created) VALUES (?,?,?,?)').bind(c.id,hash,owner,new Date().toISOString()).run();
}

/** Scheduler step: finish pending top-ups (credited → removed; a hash that can never be credited → removed; still
    settling or chain unreachable → kept). Entries older than 2 days are dropped; the buyer can still paste the hash. */
export async function settlePendingTopups(db:D1Database,{limit=20}={}){
 const c=chainConfig();if(!c.token||!c.treasury)return null;
 await db.prepare('DELETE FROM topup_pending WHERE created<?').bind(new Date(Date.now()-2*86400e3).toISOString()).run();
 const rows=await db.prepare('SELECT tx_hash,owner FROM topup_pending WHERE chain_id=? ORDER BY COALESCE(checked,created) LIMIT ?').bind(c.id,limit).all<{tx_hash:Hex;owner:string}>();
 let credited=0,dropped=0,waiting=0;
 for(const r of rows.results){
  try{const res=await settleTopup(db,r.owner,r.tx_hash);
   if(res.status==='credited'){credited++;await db.prepare('DELETE FROM topup_pending WHERE chain_id=? AND tx_hash=? AND owner=?').bind(c.id,r.tx_hash,r.owner).run();continue;}
   waiting++;}
  catch(e){if(e instanceof HttpError&&e.status<500){dropped++;await db.prepare('DELETE FROM topup_pending WHERE chain_id=? AND tx_hash=? AND owner=?').bind(c.id,r.tx_hash,r.owner).run();continue;}waiting++;}
  await db.prepare('UPDATE topup_pending SET checked=? WHERE chain_id=? AND tx_hash=? AND owner=?').bind(new Date().toISOString(),c.id,r.tx_hash,r.owner).run();
 }
 return {credited,dropped,waiting};
}
