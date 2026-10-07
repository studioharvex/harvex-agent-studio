/* Wallet monitor skill: what the server reads about ONE address on BNB Smart Chain. Read-only, nothing is ever sent.
   Sources, all public chain data:
   - the RPC, at one block: BNB balance, number of transactions sent (nonce), whether the address is a contract, and the
     balances of the tokens this deployment knows (HARVEX, the top-up token, the reward token; addresses from the server
     settings, never from the task);
   - the holder recorder's table (lib/rewards.ts), when it runs: the HARVEX transfers of that address;
   - the reading the same account took last time (wallet_watch, drizzle/0017): what changed since.
   The explorer's API is not used: it sits behind a bot check. So transfers of other tokens are not listed; their
   balances and their change since the last check are.
   The reading goes to the model as plain numbers, and the same numbers are attached under the model's answer, so a
   reader can always check the summary against what was read. Token names come from the server settings: nothing an
   address owner controls (a token name, a memo) reaches the model or the page. */
import {formatUnits,getAddress,isAddress,type Address} from 'viem';
import {chainConfig,chainClient,rewardConfig,readMany,erc20Abi,tierFor,fromE8} from './chain';
import {userWallets} from './wallets';
import {HttpError} from './server';

const ADDRESS=/(?<![0-9a-fA-F])0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g;
/** The address a task is about: the first one written in it, else the account's first linked wallet. */
export async function monitorTarget(db:D1Database,owner:string,prompt:string):Promise<Address>{
 const found=[...new Set(prompt.match(ADDRESS)||[])];
 if(found.length){
  const ok=found.find(a=>isAddress(a));
  if(!ok)throw new HttpError(400,'That address does not pass its checksum (one character is mistyped). Copy it again from your wallet or the explorer. Nothing was charged.');
  return getAddress(ok);
 }
 const mine=await userWallets(db,owner);if(mine.length)return mine[0];
 throw new HttpError(400,'Put a wallet address (0x…) in the task, or link a wallet first so the agent can read yours. Nothing was charged.');
}

type Stored={eth:string;nonce:number;tokens:Record<string,{s:string;d:number;v:string}>};
export type WalletReading={address:Address;chainId:number;block:number;ts:number;stored:Stored;/** plain text for the model */facts:string;/** markdown attached under the answer */note:string};

const group=(s:string)=>s.replace(/\B(?=(\d{3})+(?!\d))/g,',');
/** A raw token amount as a readable number: thousands separated, at most six decimals. */
export function amount(raw:bigint,decimals:number){
 const s=formatUnits(raw<0n?-raw:raw,decimals);const [i,f='']=s.split('.');const frac=f.slice(0,6).replace(/0+$/,'');
 if(raw!==0n&&i==='0'&&!frac)return '<0.000001';
 return group(i)+(frac?'.'+frac:'');
}
const signed=(raw:bigint,decimals:number)=>raw===0n?'no change':(raw>0n?'+':'−')+amount(raw,decimals);
const when=(ts:number)=>new Date(ts*1000).toISOString().slice(0,16).replace('T',' ')+' UTC';
const span=(sec:number)=>{const m=Math.max(1,Math.round(sec/60));return m<90?`${m} min`:m<2880?`${Math.floor(m/60)} h ${m%60} min`:`${Math.floor(m/1440)} days`;};
const short=(a:string)=>`${a.slice(0,6)}…${a.slice(-4)}`;

/** Reads the address. Throws 503 when the chain cannot be read: the caller has not charged anything yet. */
export async function readWallet(db:D1Database,owner:string,address:Address):Promise<WalletReading>{
 const c=chainConfig();const rc=rewardConfig(c);const client=chainClient(c);
 const tokens=[c.harvex&&{symbol:'HARVEX',address:c.harvex,decimals:18},c.token&&{symbol:c.token.symbol,address:c.token.address,decimals:c.token.decimals},rc.token&&{symbol:rc.token.symbol,address:rc.token.address,decimals:rc.token.decimals}]
  .filter((t):t is {symbol:string;address:Address;decimals:number}=>!!t).filter((t,i,all)=>all.findIndex(x=>x.address===t.address)===i);
 let head:{number:bigint;timestamp:bigint},eth:bigint,nonce:number,code:string|undefined,balances:bigint[];
 try{
  head=await client.getBlock();const at={address,blockNumber:head.number};
  [eth,nonce,code,balances]=await Promise.all([client.getBalance(at),client.getTransactionCount(at),client.getCode(at),
   tokens.length?readMany(c,tokens.map(t=>({address:t.address,abi:erc20Abi,functionName:'balanceOf',args:[address]})),head.number) as Promise<bigint[]>:Promise.resolve([])]);
 }catch{throw new HttpError(503,`${c.name} could not be read right now. Nothing was charged; try again in a moment.`);}
 const block=Number(head.number),ts=Number(head.timestamp),contract=!!code&&code!=='0x';
 const stored:Stored={eth:eth.toString(),nonce,tokens:Object.fromEntries(tokens.map((t,i)=>[t.address.toLowerCase(),{s:t.symbol,d:t.decimals,v:balances[i].toString()}]))};

 // what changed since this account last read the address
 const last=await db.prepare('SELECT block,ts,reading FROM wallet_watch WHERE owner=? AND chain_id=? AND address=?').bind(owner,c.id,address).first<{block:number;ts:number;reading:string}>();
 let before:Stored|null=null;try{before=last?JSON.parse(last.reading) as Stored:null;}catch{before=null;}
 const delta=(now:bigint,was:string|undefined,d:number)=>before&&was!==undefined?` (${signed(now-BigInt(was),d)})`:'';
 const lines:string[]=[`BNB: ${amount(eth,18)}${delta(eth,before?.eth,18)}`];
 const harvex=c.harvex?balances[tokens.findIndex(t=>t.address===c.harvex)]:null;
 tokens.forEach((t,i)=>lines.push(`${t.symbol}: ${amount(balances[i],t.decimals)}${delta(balances[i],before?.tokens[t.address.toLowerCase()]?.v,t.decimals)}${t.address===c.harvex?` · enough for the ${tierFor(balances[i]).name} tier`:''}`));
 lines.push(`Transactions sent, all time: ${group(String(nonce))}${before?` (${nonce-before.nonce>0?`+${nonce-before.nonce} new`:'no new ones'})`:''}`);
 const since=last&&before?`Last check by this account: ${when(last.ts)}, ${span(ts-last.ts)} earlier (block ${group(String(last.block))}). Changes since then are in brackets.`:'First check of this address by this account: there is no earlier reading to compare with.';

 // HARVEX transfers of this address, from the holder recorder (it follows the chain a few minutes behind)
 const moves:string[]=[];let totals='';
 if(c.harvex){
  const token=c.harvex.toLowerCase();
  const sync=await db.prepare('SELECT last_block,last_ts FROM holder_sync WHERE token=?').bind(token).first<{last_block:number;last_ts:number}>();
  if(sync){
   const rows=(await db.prepare('SELECT tx_hash,from_addr,to_addr,value,ts FROM holder_transfers WHERE token=?1 AND (from_addr=?2 OR to_addr=?2) AND ts>=?3 ORDER BY block DESC,log_index DESC LIMIT 400').bind(token,address,ts-7*86400).all<{tx_hash:string;from_addr:string;to_addr:string;value:string;ts:number}>()).results;
   const sum=(from:number,dir:'in'|'out')=>{const r=rows.filter(x=>x.ts>=from&&(dir==='in'?x.to_addr===address:x.from_addr===address)&&x.from_addr!==x.to_addr);return `${r.length} ${dir} (${amount(r.reduce((a,x)=>a+BigInt(x.value),0n),18)} HARVEX)`;};
   totals=`HARVEX transfers recorded up to ${when(sync.last_ts)}: last 24 hours ${sum(ts-86400,'in')}, ${sum(ts-86400,'out')}; last 7 days ${sum(ts-7*86400,'in')}, ${sum(ts-7*86400,'out')}${rows.length===400?' (only the latest 400 transfers were counted)':''}.`;
   const latest=rows.length?rows.slice(0,8):(await db.prepare('SELECT tx_hash,from_addr,to_addr,value,ts FROM holder_transfers WHERE token=?1 AND (from_addr=?2 OR to_addr=?2) ORDER BY block DESC,log_index DESC LIMIT 1').bind(token,address).all<{tx_hash:string;from_addr:string;to_addr:string;value:string;ts:number}>()).results;
   const ZERO='0x0000000000000000000000000000000000000000';
   for(const x of latest){const out=x.from_addr===address,other=out?x.to_addr:x.from_addr,v=amount(BigInt(x.value),18);
    moves.push(`${when(x.ts)} · ${x.from_addr===x.to_addr?`${v} HARVEX to itself`:other===ZERO?(out?`OUT ${v} HARVEX burned`:`IN ${v} HARVEX minted`):`${out?'OUT':'IN'} ${v} HARVEX ${out?'to':'from'} ${short(other)}`}`);}
   if(!latest.length)totals+=' No HARVEX transfer of this address has been recorded.';
  }else totals='HARVEX transfers are not recorded on this server, so only balances are compared.';
 }
 // holder reward of this balance (only said when the program runs)
 let reward='';
 if(rc.live&&harvex!==null&&harvex!==undefined&&rc.token){
  const excluded=rc.exclude.some(x=>x===address);const units=harvex/rc.perUnit;
  reward=excluded?'This address is excluded from holder rewards (team, treasury, pool or contract).'
   :`Holder reward: ${group(units.toString())} complete ${units===1n?'unit':'units'} of ${group(rc.perUnitWhole.toString())} HARVEX, earning $${fromE8(units*rc.rateE8)} of ${rc.token.symbol} per hour while held.`;
 }
 const header=`${c.name} (chain ${c.id}) · block ${group(String(block))} · ${when(ts)}`;
 const facts=['ON-CHAIN READING (taken by the Harvex server just now, read-only)',header,`Address: ${address} (${contract?'a contract':'a wallet'})`,'Balances now:',...lines.map(l=>'- '+l),since,totals,...(moves.length?['Latest HARVEX transfers:',...moves.map(m=>'- '+m)]:[]),reward].filter(Boolean).join('\n');
 const note=['---',`**On-chain reading** · ${header}`,`Address \`${address}\` (${contract?'contract':'wallet'}) · [open in the explorer](${c.explorer}/address/${address})`,'',...lines.map(l=>'- '+l),'',since,...(totals?['',totals]:[]),...(moves.length?['',...moves.map(m=>'- '+m)]:[]),...(reward?['',reward]:[]),'',
  '_Read from the chain by the Harvex server. Where the text above and these numbers differ, the numbers are right. Not financial advice._'].join('\n');
 return {address,chainId:c.id,block,ts,stored,facts,note};
}

/** Keeps the reading as "the last check" for this account (after the run completed), and at most 50 addresses each. */
export async function saveReading(db:D1Database,owner:string,r:WalletReading){
 await db.batch([
  db.prepare('INSERT INTO wallet_watch (owner,chain_id,address,block,ts,reading) VALUES (?,?,?,?,?,?) ON CONFLICT(owner,chain_id,address) DO UPDATE SET block=excluded.block,ts=excluded.ts,reading=excluded.reading').bind(owner,r.chainId,r.address,r.block,r.ts,JSON.stringify(r.stored)),
  db.prepare('DELETE FROM wallet_watch WHERE owner=?1 AND chain_id=?2 AND address NOT IN (SELECT address FROM wallet_watch WHERE owner=?1 AND chain_id=?2 ORDER BY ts DESC LIMIT 50)').bind(owner,r.chainId),
 ]);
}
