/* Whale watch: what the HARVEX token did lately, read from the holder recorder's own tables (lib/rewards.ts): every
   Transfer event of the token and the running balance of each address. No chain call is made here and nothing is sent.
   Used by the public page /whales (GET /api/whales, its link-preview picture) and by the tenth skill, `whales`.
   What it can say: how many addresses hold HARVEX, how many got their first HARVEX in the last 24 hours and still hold it,
   how many transactions moved HARVEX and how much (each transaction counted once, however many addresses the tokens
   passed through inside it), the biggest of them, the biggest holders and their share.
   What it cannot say, and the texts must not pretend otherwise: prices, who owns an address, or whether a transfer was
   a buy or a sell. The only label an address gets is "not earning holder rewards": it is on the server's
   REWARD_EXCLUDE list (team, treasury, pool or contract), which is a setting, not a guess.
   The 24 hours end at the recorder's last block, not at the wall clock, so a recorder that is behind still shows a
   coherent day and the page says how old it is. A server without the token or without the recorder returns null. */
import {chainConfig,rewardConfig} from './chain';
import {HttpError} from './server';
import {amount} from './monitor';

const ZERO='0x0000000000000000000000000000000000000000';
const BURN=new Set([ZERO,'0x000000000000000000000000000000000000dead']);
const DAY=86400,MAX_ROWS=20000;

export type WhaleMove={ts:number;tx:string;from:string;to:string;amount:string;kind:'transfer'|'mint'|'burn';/** more than one sender or receiver in the transaction: from/to are the biggest */others:boolean;fromOff:boolean;toOff:boolean};
export type WhaleHolder={address:string;amount:string;share:string|null;off:boolean};
export type Whales={chainId:number;chain:string;explorer:string;token:string;asOf:{block:number;ts:number};
 supply:string|null;holders:number;newHolders:number;
 day:{/** transactions that moved HARVEX */txs:number;volume:string;volumeShort:string;wallets:number;capped:boolean};
 moves:WhaleMove[];top:WhaleHolder[];topShare:string|null};

const whole=(raw:bigint)=>raw/10n**18n;
/** 12,345,678 HARVEX → "12.3M": for a headline, never for a figure someone checks. */
export function compact(raw:bigint){
 const n=Number(whole(raw));
 for(const [div,unit] of [[1e9,'B'],[1e6,'M'],[1e3,'K']] as const)if(n>=div)return (n/div).toFixed(n/div>=100?0:1).replace(/\.0$/,'')+unit;
 return String(n);
}
const pct=(part:bigint,all:bigint)=>all>0n?(Number(part*10000n/all)/100).toFixed(2)+'%':null;

export type TransferRow={tx_hash:string;from_addr:string;to_addr:string;value:string;ts:number;block:number;log_index:number};
/** One transaction often moves the same tokens through several addresses (a router hands them to a pool): counted
    log by log, one swap would show up as three "big transfers" and the day's volume could exceed the supply. So each
    transaction is settled first: what every address sent or received in it on balance. An address that only passed
    tokens along comes out at zero and disappears; what is left is who the tokens left and who ended up with them. */
export function settleTransfers(rows:TransferRow[]){
 const txs=new Map<string,{ts:number;tx:string;net:Map<string,bigint>}>();
 for(const r of rows){
  if(r.from_addr===r.to_addr)continue;
  const key=r.tx_hash||`${r.block}:${r.log_index}`;const t=txs.get(key)||{ts:r.ts,tx:r.tx_hash,net:new Map<string,bigint>()};const v=BigInt(r.value);
  t.net.set(r.from_addr,(t.net.get(r.from_addr)||0n)-v);t.net.set(r.to_addr,(t.net.get(r.to_addr)||0n)+v);txs.set(key,t);
 }
 const wallets=new Set<string>();
 const list=[...txs.values()].map(t=>{
  let moved=0n,from='',to='',most=0n,least=0n,ends=0;
  for(const [a,v] of t.net){
   if(v===0n)continue;ends++;if(!BURN.has(a.toLowerCase()))wallets.add(a);
   if(v>0n){moved+=v;if(v>most){most=v;to=a;}}else if(v<least){least=v;from=a;}
  }
  return {ts:t.ts,tx:t.tx,moved,from,to,others:ends>2};
 }).filter(t=>t.moved>0n&&t.from&&t.to);
 return {list,wallets};
}
/** A settled transaction as the page and the texts show it. */
export const asMove=(t:{ts:number;tx:string;moved:bigint;from:string;to:string;others:boolean},off:Set<string>):WhaleMove=>({ts:t.ts,tx:t.tx,from:t.from,to:t.to,amount:amount(t.moved,18),
 kind:t.from===ZERO?'mint':BURN.has(t.to.toLowerCase())?'burn':'transfer',others:t.others,fromOff:off.has(t.from.toLowerCase()),toOff:off.has(t.to.toLowerCase())});
/** The ten biggest holders (burn addresses left out), biggest first. */
export async function topHolders(db:D1Database,token:string){
 // balances are whole numbers kept as text: longer means bigger, equal length compares as text
 const top=await db.prepare("SELECT address,balance FROM holder_balances WHERE token=? AND balance!='0' ORDER BY LENGTH(balance) DESC,balance DESC,address LIMIT 14").bind(token).all<{address:string;balance:string}>();
 return top.results.filter(h=>!BURN.has(h.address.toLowerCase())).slice(0,10);
}

let cache:{at:number;token:string;data:Whales}|null=null;
/** The reading, kept for a minute in memory (the page, the picture and the skill ask for the same numbers). */
export async function whales(db:D1Database):Promise<Whales|null>{
 const c=chainConfig();if(!c.harvex)return null;const token=c.harvex.toLowerCase();
 if(cache&&cache.token===token&&Date.now()-cache.at<60e3)return cache.data;
 const sync=await db.prepare('SELECT last_block,last_ts FROM holder_sync WHERE token=?').bind(token).first<{last_block:number;last_ts:number}>();
 if(!sync)return null;
 const off=new Set(rewardConfig(c).exclude.map(a=>a.toLowerCase()));
 const from=sync.last_ts-DAY;
 type Row=TransferRow;
 const [rows,count,top,minted,burned,first]=await Promise.all([
  db.prepare('SELECT tx_hash,from_addr,to_addr,value,ts,block,log_index FROM holder_transfers WHERE token=? AND ts>=? ORDER BY block DESC,log_index DESC LIMIT ?').bind(token,from,MAX_ROWS+1).all<Row>(),
  db.prepare("SELECT COUNT(*) AS n FROM holder_balances WHERE token=? AND balance!='0' AND lower(address) NOT IN (?,?)").bind(token,...BURN).first<{n:number}>(),
  topHolders(db,token),
  db.prepare('SELECT value FROM holder_transfers WHERE token=? AND from_addr=? LIMIT 5000').bind(token,ZERO).all<{value:string}>(),
  db.prepare('SELECT value FROM holder_transfers WHERE token=? AND to_addr=? LIMIT 5000').bind(token,ZERO).all<{value:string}>(),
  db.prepare('SELECT MIN(block) AS b FROM holder_transfers WHERE token=? AND ts>=?').bind(token,from).first<{b:number|null}>(),
 ]);
 // wallets whose first HARVEX ever arrived inside the window and that still hold some
 const fresh=first?.b==null?0:(await db.prepare("SELECT COUNT(*) AS n FROM (SELECT t.to_addr FROM holder_transfers t JOIN holder_balances h ON h.token=t.token AND h.address=t.to_addr AND h.balance!='0' WHERE t.token=?1 AND lower(t.to_addr) NOT IN (?3,?4) GROUP BY t.to_addr HAVING MIN(t.block)>=?2)")
  .bind(token,first.b,...BURN).first<{n:number}>())?.n??0;
 const sum=(r:{value:string}[])=>r.reduce((a,x)=>a+BigInt(x.value),0n);
 const supply=sum(minted.results)-sum(burned.results);
 // each transaction is settled first (settleTransfers), so tokens passed along inside one are counted once
 const capped=rows.results.length>MAX_ROWS;
 const {list:day,wallets}=settleTransfers(rows.results.slice(0,MAX_ROWS));let volume=0n;
 for(const t of day)volume+=t.moved;
 const moves=[...day].sort((x,y)=>x.moved===y.moved?y.ts-x.ts:x.moved>y.moved?-1:1).slice(0,8).map(t=>asMove(t,off));
 const holders=top;
 const data:Whales={chainId:c.id,chain:c.name,explorer:c.explorer,token:c.harvex,asOf:{block:sync.last_block,ts:sync.last_ts},
  supply:supply>0n?amount(supply,18):null,holders:count?.n??0,newHolders:fresh,
  day:{txs:day.length,volume:amount(volume,18),volumeShort:compact(volume),wallets:wallets.size,capped},
  moves,top:holders.map(h=>({address:h.address,amount:amount(BigInt(h.balance),18),share:pct(BigInt(h.balance),supply),off:off.has(h.address.toLowerCase())})),
  topShare:pct(holders.reduce((a,h)=>a+BigInt(h.balance),0n),supply)};
 cache={at:Date.now(),token,data};
 return data;
}

export const when=(ts:number)=>new Date(ts*1000).toISOString().slice(0,16).replace('T',' ')+' UTC';
export const short=(a:string)=>`${a.slice(0,6)}…${a.slice(-4)}`;
export const OFF=' (not earning holder rewards: team, treasury, pool or contract)';
export const moveLine=(m:WhaleMove)=>m.kind==='mint'?`${m.amount} HARVEX minted to ${short(m.to)}`:m.kind==='burn'?`${m.amount} HARVEX burned by ${short(m.from)}`
 :`${m.amount} HARVEX from ${short(m.from)}${m.fromOff?OFF:''} to ${short(m.to)}${m.toOff?OFF:''}${m.others?' and others':''}`;

/** The reading for the skill: plain text for the model, and the same numbers as markdown under its answer.
    Throws 503 when there is no record to read: the caller has not charged anything yet. */
export async function whaleReading(db:D1Database):Promise<{facts:string;note:string}>{
 const w=await whales(db).catch(()=>null);
 if(!w)throw new HttpError(503,'The HARVEX token record is not available on this server right now. Nothing was charged; try again later.');
 const header=`${w.chain} (chain ${w.chainId}) · HARVEX · recorded up to block ${w.asOf.block.toLocaleString('en-US')} · ${when(w.asOf.ts)}`;
 const lines=[`Addresses holding HARVEX: ${w.holders.toLocaleString('en-US')}`,
  `New holders in the 24 hours before that block (first HARVEX ever, still holding): ${w.newHolders.toLocaleString('en-US')}`,
  `Transactions that moved HARVEX in those 24 hours: ${w.day.txs.toLocaleString('en-US')}${w.day.capped?' (only the latest 20,000 transfers were read)':''}, moving ${w.day.volume} HARVEX between ${w.day.wallets.toLocaleString('en-US')} addresses (tokens passed along inside one transaction are counted once)`,
  ...(w.supply?[`Supply: ${w.supply} HARVEX`]:[]),...(w.topShare?[`The 10 biggest holders have ${w.topShare} of the supply`]:[])];
 const moves=w.moves.slice(0,6),top=w.top.slice(0,6);
 const holder=(h:WhaleHolder,i:number)=>`${i+1}. ${short(h.address)} · ${h.amount} HARVEX${h.share?` · ${h.share}`:''}${h.off?OFF:''}`;
 const facts=['HARVEX TOKEN READING (from the Harvex server\'s record of the token\'s Transfer events, read-only)',header,...lines.map(l=>'- '+l),
  moves.length?'Biggest transfers in those 24 hours (per transaction, from the address the tokens left to the address they ended up at):':'No transfer was recorded in those 24 hours.',...moves.map(m=>`- ${when(m.ts)} · ${moveLine(m)}`),
  'Biggest holders:',...top.map((h,i)=>'- '+holder(h,i)),
  'A transfer is not a buy or a sell, and an address is not a person: the record says neither.'].join('\n');
 const note=['---',`**HARVEX token reading** · ${header}`,`[Token in the explorer](${w.explorer}/token/${w.token})`,'',...lines.map(l=>'- '+l),
  ...(moves.length?['','Biggest transfers:',...moves.map(m=>`- ${when(m.ts)} · ${moveLine(m)} · [tx](${w.explorer}/tx/${m.tx})`)]:[]),
  '','Biggest holders:',...top.map((h,i)=>'- '+holder(h,i)),'',
  '_Read from the Harvex server\'s record of the token. Where the text above and these numbers differ, the numbers are right. A transfer is not a buy or a sell. Not financial advice._'].join('\n');
 return {facts,note};
}
