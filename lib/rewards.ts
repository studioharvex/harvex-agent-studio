/* Holder rewards, fixed rate: every complete block of REWARD_HARVEX_PER_UNIT HARVEX held earns
   REWARD_USD_PER_UNIT_HOUR of the reward token per hour (defaults: 3,000,000 HARVEX = $0.01). The reward token is any
   BEP-20 the operator names in REWARD_TOKEN_ADDRESS; none is chosen yet and the program is off.
   Four pieces:
   1. Holder recorder  (syncHolders)  reads every HARVEX Transfer log (settled blocks only) with its block time, so the
                                      server knows each wallet's balance at every second. A token sits in exactly one
                                      wallet at a time: moving HARVEX between wallets never earns twice, and a balance only
                                      earns for the seconds it was actually held (buying right before a close and selling
                                      right after earns seconds, not hours). A contract that only calls balanceOf() cannot
                                      know this history, which is why the rewards are computed here and not on-chain.
   2. Reward calculator (accrue)      per address: sum over time of units x seconds x rate / 3600, where units =
                                      floor(balance / unit). Integer math, rounded down once per period, never up.
                                      USD is the unit of account; a period converts its USD to the reward token at the
                                      price (reward_prices) when it is built, so the USD value is fixed and the token amount
                                      follows the price. Team, treasury, pools, burn and the vault itself never earn.
   3. Vault            (HarvexClaims)   a second HarvexClaims instance holds the reward token; refilling is a plain transfer to it
                                      (record it with action fund). A period is only built when the vault can pay every
                                      outstanding cumulative amount in full, and with a price younger than
                                      REWARD_PRICE_MAX_AGE_HOURS. Otherwise it waits: the next period starts where the last
                                      one ended, so no second of accrual is lost. Each cumulative root is posted by the
                                      multisig or, for hourly claims, by the root poster key (REWARD_ROOT_POSTER_KEY: it
                                      can only call setMerkleRoot, and the vault's payout limit bounds what a leaked key
                                      could take). Holders claim themselves and pay their own gas. The server holds no
                                      key that can move the vault's tokens.
   4. Dashboard        (/api/rewards) rule, price, vault, your balance, units, rate, accrued, claimable and the proof.
   Everything stays off until REWARDS_ENABLED=true with HARVEX_TOKEN_ADDRESS, REWARD_TOKEN_ADDRESS and REWARD_CONTRACT.
   Safety rules added by the audit of 1 Oct 2026 (drizzle/0016):
   - periods are bound to ONE vault, token and chain: a build for another vault is refused (it would pay history twice);
   - the root poster never posts without a payout limit on the vault, and never as the vault's owner;
   - every RootUpdated event of the vault is read (watchRoots): a root this server did not build stops all automation;
   - a root transaction that never lands is sent again after POST_RETRY_SECONDS instead of blocking the periods forever;
   - guard rails (MAX_REPLAY_TRANSFERS, MAX_LEAVES) stop the build before it could exhaust the single runtime process. */
import {createWalletClient,defineChain,getAddress,http,parseAbi,parseAbiItem,type Address,type Hex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {NATIVE,chainClient,chainConfig,erc20Abi,fromE8,periodBounds,readMany,rewardConfig,toE8,type ChainConfig,type RewardConfig} from './chain';
import {applyBoost} from './boost';
import {boostData} from './referrals';
import {buildTree} from './merkle';
import {HttpError} from './server';

const ZERO='0x0000000000000000000000000000000000000000';
const BURN=new Set([ZERO,'0x000000000000000000000000000000000000dead']);
const HOUR=3600;
const hourLabel=(ts:number)=>new Date(ts*1000).toISOString().slice(0,16).replace('T',' ');
const periodLabel=(s:number,e:number)=>{const h=Math.round((e-s)/HOUR);return `${h<=1?'Hour':`${h}h`} to ${hourLabel(e)} UTC`;};
const blockTag=(c:ChainConfig)=>c.finality==='soft'?'latest' as const:c.finality;
/** Raw token amount -> short decimal text for messages (never used for math). */
const tokenText=(raw:bigint,dec:number)=>{const s=raw.toString().padStart(dec+1,'0');const i=s.slice(0,-dec)||'0',f=s.slice(-dec).slice(0,6).replace(/0+$/,'');return f?`${i}.${f}`:i;};
const claimedAbi=[{type:'function',name:'claimed',stateMutability:'view',inputs:[{type:'address'}],outputs:[{type:'uint256'}]}] as const;
const vaultAbi=parseAbi(['function rootPoster() view returns (address)','function maxPayoutPerWindow() view returns (uint256)','function windowSeconds() view returns (uint256)','function owner() view returns (address)','function token() view returns (address)','function merkleRoot() view returns (bytes32)','function setMerkleRoot(bytes32 root)']);
const rootUpdated=parseAbiItem('event RootUpdated(bytes32 indexed root, bytes32 indexed previous)');
/** Guard rails. The calculator replays the whole Transfer history and every tree carries every address that ever earned;
    past these sizes one build could exhaust the single runtime process and take the whole site down with it. The build
    then stops with a clear message instead (accrual is not lost, periods wait). They are far above normal use at
    3,000,000 HARVEX per unit (at most 333 earners of a 1,000,000,000 supply); reaching them means the token is being
    spammed or the incremental calculator is due. */
const MAX_REPLAY_TRANSFERS=400_000,MAX_LEAVES=20_000;
/** A root transaction that is not mined, or was replaced on the vault, is sent again after this many seconds. */
const POST_RETRY_SECONDS=600;

export type Transfer={block:number;logIndex:number;from:string;to:string;value:bigint;ts:number;tx?:string};

/* ------------------------------------------------------------------ 1. recorder */

/** Applies transfers (in chain order) to balances and earning starts (`since`: holding at least one unit). */
export function applyTransfers(state:Map<string,{balance:bigint;since:number|null}>,transfers:Transfer[],perUnit:bigint){
 const touched=new Set<string>();
 const move=(a:string,delta:bigint,ts:number)=>{
  if(a===ZERO)return;
  const s=state.get(a)||{balance:0n,since:null};const balance=s.balance+delta;
  const since=balance>=perUnit&&balance>0n?(s.since??ts):null;
  state.set(a,{balance,since});touched.add(a);
 };
 for(const t of transfers){move(t.from,-t.value,t.ts);move(t.to,t.value,t.ts);}
 return touched;
}

async function loadState(db:D1Database,token:string){
 const r=await db.prepare('SELECT address,balance,since FROM holder_balances WHERE token=?').bind(token).all<{address:string;balance:string;since:number|null}>();
 return new Map(r.results.map(x=>[x.address,{balance:BigInt(x.balance),since:x.since}]));
}
async function saveState(db:D1Database,token:string,state:Map<string,{balance:bigint;since:number|null}>,addresses:Iterable<string>,now:number){
 const stmts=[...addresses].map(a=>{const s=state.get(a)!;return db.prepare('INSERT INTO holder_balances (token,address,balance,since,updated) VALUES (?,?,?,?,?) ON CONFLICT(token,address) DO UPDATE SET balance=excluded.balance,since=excluded.since,updated=excluded.updated').bind(token,a,s.balance.toString(),s.since,now);});
 for(let i=0;i<stmts.length;i+=80)await db.batch(stmts.slice(i,i+80));
}

/** Reads new HARVEX Transfer logs up to the settled head (TOPUP_FINALITY: safe by default), in chunks.
    Safe to call repeatedly (cron); each call handles at most `maxBlocks` blocks. The head, the logs and the block times
    all come from the logs RPC (chainConfig().logsRpc), so a lagging node can never make the cursor skip blocks. The
    chunk shrinks when the RPC refuses a range (too many logs, provider range cap) and grows back after. */
export async function syncHolders(db:D1Database,{chunk=5000,maxBlocks=200_000}={}){
 const c=chainConfig();const rc=rewardConfig(c);if(!rc.harvex)throw new HttpError(503,'Set HARVEX_TOKEN_ADDRESS first.');
 const token=rc.harvex.toLowerCase();const client=chainClient(c,{logs:true});
 let head:{number:bigint;timestamp:bigint};try{head=await client.getBlock({blockTag:blockTag(c)});}catch{throw new HttpError(503,'BNB Smart Chain is not reachable right now.');}
 const sync=await db.prepare('SELECT last_block,last_ts FROM holder_sync WHERE token=?').bind(token).first<{last_block:number;last_ts:number}>();
 // first run without REWARD_START_BLOCK: start at the HARVEX deploy block (the chain has tens of millions of blocks)
 let from=sync?sync.last_block+1:(rc.startBlock||await deployBlock(chainClient(c),rc.harvex,head.number));const target=Math.min(Number(head.number),from+maxBlocks-1);
 const state=await loadState(db,token);const touched=new Set<string>();let logs=0;const now=Math.floor(Date.now()/1000);
 const times=new Map<bigint,number>();
 const ts=async(b:bigint)=>{if(!times.has(b))times.set(b,Number((await client.getBlock({blockNumber:b})).timestamp));return times.get(b)!;};
 let size=chunk;
 while(from<=target){
  const to=Math.min(from+size-1,target);
  let found;try{found=await client.getLogs({address:rc.harvex,event:erc20Abi[0],fromBlock:BigInt(from),toBlock:BigInt(to)});}
  catch{if(size>10){size=Math.max(10,Math.floor(size/4));continue;}
   throw new HttpError(503,`Could not read Transfer logs for blocks ${from}-${to}. Try again; progress up to block ${from-1} is saved.`);}
  size=Math.min(chunk,size*2);
  const batch:Transfer[]=[];
  for(const l of found){if(l.blockNumber===null||l.logIndex===null)continue;
   batch.push({block:Number(l.blockNumber),logIndex:l.logIndex,from:getAddress(l.args.from!),to:getAddress(l.args.to!),value:l.args.value!,ts:await ts(l.blockNumber),tx:l.transactionHash||''});}
  batch.sort((a,b)=>a.block-b.block||a.logIndex-b.logIndex);
  for(const t of applyTransfers(state,batch,rc.perUnit))touched.add(t);
  const ins=batch.map(t=>db.prepare('INSERT OR IGNORE INTO holder_transfers (token,block,log_index,tx_hash,from_addr,to_addr,value,ts) VALUES (?,?,?,?,?,?,?,?)').bind(token,t.block,t.logIndex,t.tx||'',t.from,t.to,t.value.toString(),t.ts));
  // transfers, balances and the cursor move together, so a failed chunk is simply read again
  for(let i=0;i<ins.length;i+=80)await db.batch(ins.slice(i,i+80));
  await saveState(db,token,state,touched,now);touched.clear();
  const endTs=to===Number(head.number)?Number(head.timestamp):await ts(BigInt(to));
  await db.prepare('INSERT INTO holder_sync (token,last_block,last_ts,updated) VALUES (?,?,?,?) ON CONFLICT(token) DO UPDATE SET last_block=excluded.last_block,last_ts=excluded.last_ts,updated=excluded.updated').bind(token,to,endTs,new Date().toISOString()).run();
  logs+=batch.length;from=to+1;
 }
 const holders=[...state.values()].filter(s=>s.balance>0n).length;
 return {lastBlock:from-1,head:Number(head.number),caughtUp:from-1>=Number(head.number),transfers:logs,holders};
}

/** First block where `address` has code (its deploy block), by binary search on getCode. Needs an RPC that keeps old
    state (archive); the public BNB Smart Chain RPC does not, so the error says what to set instead. */
async function deployBlock(client:ReturnType<typeof chainClient>,address:Address,head:bigint){
 const has=async(b:bigint)=>{const code=await client.getCode({address,blockNumber:b});return !!code&&code!=='0x';};
 try{
  if(!await has(head))throw new HttpError(409,'HARVEX_TOKEN_ADDRESS has no contract code on this chain.');
  let lo=0n,hi=head;while(lo<hi){const mid=(lo+hi)/2n;if(await has(mid))hi=mid;else lo=mid+1n;}
  return Number(lo);
 }catch(e){if(e instanceof HttpError)throw e;
  throw new HttpError(503,'Could not find the HARVEX deploy block: this RPC does not keep old state. Set REWARD_START_BLOCK to the block of the HARVEX deploy transaction (see the explorer), or use an archive RPC in CHAIN_RPC_URL.');}
}

/** Rebuilds balances and earning starts from the stored transfers (after changing REWARD_HARVEX_PER_UNIT). */
export async function rebuildHolders(db:D1Database){
 const rc=rewardConfig();if(!rc.harvex)throw new HttpError(503,'Set HARVEX_TOKEN_ADDRESS first.');const token=rc.harvex.toLowerCase();
 const state=new Map<string,{balance:bigint;since:number|null}>();
 applyTransfers(state,await storedTransfers(db,token),rc.perUnit);
 await db.prepare('DELETE FROM holder_balances WHERE token=?').bind(token).run();
 await saveState(db,token,state,state.keys(),Math.floor(Date.now()/1000));
 return {holders:[...state.values()].filter(s=>s.balance>0n).length};
}

async function storedTransfers(db:D1Database,token:string,untilTs?:number):Promise<Transfer[]>{
 const r=await db.prepare(`SELECT block,log_index,from_addr,to_addr,value,ts FROM holder_transfers WHERE token=?${untilTs!==undefined?' AND ts<=?':''} ORDER BY block,log_index`)
  .bind(...(untilTs!==undefined?[token,untilTs]:[token])).all<{block:number;log_index:number;from_addr:string;to_addr:string;value:string;ts:number}>();
 return r.results.map(x=>({block:x.block,logIndex:x.log_index,from:x.from_addr,to:x.to_addr,value:BigInt(x.value),ts:x.ts}));
}
const transferCount=async(db:D1Database,token:string,untilTs?:number)=>(await db.prepare(`SELECT COUNT(*) AS n FROM holder_transfers WHERE token=?${untilTs!==undefined?' AND ts<=?':''}`).bind(...(untilTs!==undefined?[token,untilTs]:[token])).first<{n:number}>())?.n??0;
const tooManyTransfers=()=>new HttpError(503,`The HARVEX transfer history has passed ${MAX_REPLAY_TRANSFERS.toLocaleString('en-US')} transfers, more than this version settles in one pass. Reward periods wait and nothing is lost; install the incremental calculator before continuing.`);

/* ------------------------------------------------------------------ 2. calculator */

export type Accrual={address:string;unitSeconds:bigint;usdE8:bigint;units:bigint;balance:bigint};

/** Pure fixed-rate accrual over [start, end] from the full Transfer history (chain order).
    unitSeconds = sum of floor(balance / perUnit) x seconds held at that balance inside the window.
    usdE8 = floor(unitSeconds x rateE8 / 3600): USD with 8 decimals, rounded down once per address and period.
    Excluded and burn addresses never accrue; `units` and `balance` are the values at `end`. */
export function accrue(transfers:Transfer[],{start,end,perUnit,rateE8,exclude}:{start:number;end:number;perUnit:bigint;rateE8:bigint;exclude:string[]}){
 if(perUnit<=0n||rateE8<=0n||end<start)return {rows:[] as Accrual[],usdTotal:0n,unitSeconds:0n};
 const ex=new Set([...exclude.map(a=>a.toLowerCase()),...BURN]);
 const acc=new Map<string,{balance:bigint;last:number;unitSeconds:bigint}>();
 const credit=(s:{balance:bigint;last:number;unitSeconds:bigint},until:number)=>{
  const a=Math.max(s.last,start),b=Math.min(until,end);
  if(b>a&&s.balance>=perUnit)s.unitSeconds+=(s.balance/perUnit)*BigInt(b-a);
 };
 const move=(a:string,delta:bigint,ts:number)=>{
  if(a===ZERO)return;const s=acc.get(a)||{balance:0n,last:ts,unitSeconds:0n};
  credit(s,ts);s.balance+=delta;s.last=ts;acc.set(a,s);
 };
 for(const t of transfers){if(t.ts>end)break;move(t.from,-t.value,t.ts);move(t.to,t.value,t.ts);}
 const rows:Accrual[]=[];let usdTotal=0n,unitSeconds=0n;
 for(const [address,s] of acc){credit(s,end);s.last=end;
  if(ex.has(address.toLowerCase())||s.unitSeconds<=0n)continue;
  const usdE8=s.unitSeconds*rateE8/BigInt(HOUR);if(usdE8<=0n)continue;
  rows.push({address,unitSeconds:s.unitSeconds,usdE8,units:s.balance>=perUnit?s.balance/perUnit:0n,balance:s.balance});
  usdTotal+=usdE8;unitSeconds+=s.unitSeconds;}
 rows.sort((a,b)=>a.address<b.address?-1:1);
 return {rows,usdTotal,unitSeconds};
}
/** USD (8 decimals) -> reward-token raw amount at `priceE8` USD per whole token, rounded down. */
export const tokensFor=(usdE8:bigint,priceE8:bigint,decimals:number)=>priceE8>0n?usdE8*10n**BigInt(decimals)/priceE8:0n;

/* ------------------------------------------------------------------ price (set by the operator) */

type PriceRow={id:number;price_e8:string;previous_e8:string|null;note:string|null;created:string;source:string|null;observed:number|null};
export const latestPrice=(db:D1Database)=>db.prepare('SELECT * FROM reward_prices ORDER BY id DESC LIMIT 1').first<PriceRow>();
const MAX_PRICE_E8=10_000_000n*100_000_000n; // $10,000,000 per token: anything above is a typo
/** When the price itself is from (the feed's updatedAt, or when the operator set it). */
const observedAt=(p:PriceRow)=>p.observed??Math.floor(Date.parse(p.created)/1000);
// a move of 50% or more (a halved price is exactly what a 2-for-1 split read without its multiplier would look like)
const bigMove=(prev:bigint,next:bigint)=>(next>prev?next-prev:prev-next)*2n>=prev;
/** True when a contract read failed because the contract has no such function (it reverted or returned nothing), as
    opposed to the RPC being unreachable. */
const noSuchFunction=(e:unknown)=>{const walk=(e as {walk?:(f:(x:unknown)=>boolean)=>unknown})?.walk;
 return !!(typeof walk==='function'&&walk.call(e,x=>['ContractFunctionRevertedError','ContractFunctionZeroDataError','AbiDecodingZeroDataError'].includes((x as Error)?.name)));};

const feedAbi=[{type:'function',name:'latestRoundData',stateMutability:'view',inputs:[],outputs:[{type:'uint80'},{type:'int256'},{type:'uint256'},{type:'uint256'},{type:'uint80'}]},
 {type:'function',name:'decimals',stateMutability:'view',inputs:[],outputs:[{type:'uint8'}]}] as const;
const pausedAbi=[{type:'function',name:'oraclePaused',stateMutability:'view',inputs:[],outputs:[{type:'bool'}]}] as const;
/* REWARD_SHARES_ORACLE: the issuer's "shares per token" oracle (Ondo's SyntheticSharesOracle). 18 decimals, and a pause
   flag that is up around a corporate action. */
const sharesAbi=[{type:'function',name:'getSValue',stateMutability:'view',inputs:[{type:'address'}],outputs:[{type:'uint128'},{type:'bool'}]}] as const;
const SHARES_ONE=10n**18n;
/** Shares per token is 1 when a token starts and only grows with reinvested dividends; a split moves it by the split's
    ratio. Outside this range the number is not believed (a wrong oracle address answers with anything). */
const SHARES_MIN=SHARES_ONE/100n,SHARES_MAX=SHARES_ONE*100n;
const fromShares=(v:bigint)=>{const s=v.toString().padStart(19,'0');return `${s.slice(0,-18)}.${s.slice(-18)}`.replace(/0+$/,'').replace(/\.$/,'');};

/** Reads the Chainlink feed: a positive answer with a timestamp, and no price while the reward token reports
    `oraclePaused()` (tokenized stocks pause their price for a split or dividend; a token without that function is
    simply not paused).
    Returns the price with 8 decimals whatever the feed's own decimals. Staleness is judged against the period end. */
async function readFeed(c:ChainConfig,rc:RewardConfig){
 if(!rc.priceFeed)throw new HttpError(503,'No REWARD_PRICE_FEED is set.');
 const client=chainClient(c);const sym=rc.token?.symbol||'reward token';
 let dec:number,rd:readonly [bigint,bigint,bigint,bigint,bigint];
 try{[dec,rd]=await Promise.all([client.readContract({address:rc.priceFeed,abi:feedAbi,functionName:'decimals'}),client.readContract({address:rc.priceFeed,abi:feedAbi,functionName:'latestRoundData'})]);}
 catch{throw new HttpError(503,`Could not read the ${sym} price feed on BNB Smart Chain. Rewards wait; nothing is lost.`);}
 const [round,answer,,updatedAt]=rd;
 if(answer<=0n||updatedAt===0n)throw new HttpError(409,`The ${sym} price feed has no valid price right now. Rewards wait; nothing is lost.`);
 if(rc.token){let paused=false;
  // only a token that has no such flag counts as "not paused"; when the chain cannot be read the answer is unknown, so
  // nothing is settled (a split price must never be used because one read timed out)
  try{paused=await client.readContract({address:rc.token.address,abi:pausedAbi,functionName:'oraclePaused'});}
  catch(e){if(!noSuchFunction(e))throw new HttpError(503,`Could not read whether the ${sym} price is paused for a corporate action. Rewards wait; nothing is lost.`);}
  if(paused)throw new HttpError(409,`The ${sym} price is paused for a corporate action (for example a split). Rewards wait until it resumes; nothing is lost.`);}
 let e8=dec===8?answer:dec>8?answer/10n**BigInt(dec-8):answer*10n**BigInt(8-dec);
 // a token that stands for more than one share: the feed prices the share, the issuer's oracle says how many shares a
 // token is. Without an answer nothing is settled (the share price alone would pay too many tokens).
 let shares:bigint|null=null;
 if(rc.sharesOracle&&rc.token){let sv:readonly [bigint,boolean];
  try{sv=await client.readContract({address:rc.sharesOracle,abi:sharesAbi,functionName:'getSValue',args:[rc.token.address]});}
  catch{throw new HttpError(503,`Could not read how many shares one ${sym} stands for (REWARD_SHARES_ORACLE). Rewards wait; nothing is lost.`);}
  if(sv[1])throw new HttpError(409,`The ${sym} price is paused for a corporate action (for example a split). Rewards wait until it resumes; nothing is lost.`);
  if(sv[0]<SHARES_MIN||sv[0]>SHARES_MAX)throw new HttpError(409,`The shares-per-token number for ${sym} is implausible. Rewards wait; check REWARD_SHARES_ORACLE.`);
  shares=sv[0];e8=e8*shares/SHARES_ONE;}
 if(e8<=0n||e8>MAX_PRICE_E8)throw new HttpError(409,`The ${sym} price feed returned an implausible price. Rewards wait.`);
 return {e8,round:round.toString(),updatedAt:Number(updatedAt),shares};
}

/** Records the live feed price when a new round appeared (REWARD_PRICE_FEED). A move of 50% or more from the last
    recorded price is not applied on its own: rewards wait until the operator accepts it (fromFeed + confirm). */
export async function refreshPrice(db:D1Database,{confirm=false}:{confirm?:boolean}={}){
 const c=chainConfig();const rc=rewardConfig(c);const f=await readFeed(c,rc);const sym=rc.token?.symbol||'reward token';
 // the same round with another shares-per-token number is another price, so that number is part of the mark
 const last=await latestPrice(db);const source=f.shares===null?`chainlink:${f.round}`:`chainlink:${f.round}:x${f.shares}`;
 if(last&&last.source===source)return {price:fromE8(f.e8),round:f.round,observed:f.updatedAt,updated:false};
 const prev=last?BigInt(last.price_e8):null;
 if(prev&&!confirm&&bigMove(prev,f.e8))throw new HttpError(409,`The ${sym} feed moved by 50% or more (from $${fromE8(prev)} to $${fromE8(f.e8)}). Rewards wait; check for a stock split first, and if the price is right accept it with {"action":"price","fromFeed":true,"confirm":true}.`);
 await db.prepare('INSERT INTO reward_prices (price_e8,previous_e8,note,source,observed,created) VALUES (?,?,?,?,?,?)')
  .bind(f.e8.toString(),prev?.toString()??null,`Chainlink ${rc.priceFeed} round ${f.round}${f.shares===null?'':` x ${fromShares(f.shares)} shares per token`}`.slice(0,120),source,f.updatedAt,new Date().toISOString()).run();
 return {price:fromE8(f.e8),round:f.round,observed:f.updatedAt,updated:true};
}
/** Operator price. With REWARD_PRICE_FEED the price comes from Chainlink and this only accepts a large feed move
    (fromFeed + confirm). Without a feed: USD per whole token as a decimal string (up to 8 decimals, "182.35"); a move of
    50% or more needs `confirm`, so a slipped decimal point cannot multiply the payout. */
export async function setPrice(db:D1Database,{price,note,confirm,fromFeed}:{price?:string|number;note?:string;confirm?:boolean;fromFeed?:boolean}){
 const rc=rewardConfig();
 if(rc.priceFeed){
  if(fromFeed)return refreshPrice(db,{confirm});
  throw new HttpError(409,'The price is read live from Chainlink (REWARD_PRICE_FEED). To accept a large move from the feed send {"action":"price","fromFeed":true,"confirm":true}; to set prices by hand, remove REWARD_PRICE_FEED.');
 }
 const e8=toE8(price);
 if(!e8||e8<=0n)throw new HttpError(400,'Send the price in USD per whole token, for example "182.35" (up to 8 decimals).');
 if(e8>MAX_PRICE_E8)throw new HttpError(400,'That price is not plausible. Check the decimal point.');
 const last=await latestPrice(db);const prev=last?BigInt(last.price_e8):null;
 if(prev&&!confirm&&bigMove(prev,e8))throw new HttpError(409,`This moves the price by 50% or more (from $${fromE8(prev)} to $${fromE8(e8)}). Send confirm:true if that is right.`);
 await db.prepare('INSERT INTO reward_prices (price_e8,previous_e8,note,source,observed,created) VALUES (?,?,?,?,?,?)').bind(e8.toString(),prev?.toString()??null,note?String(note).slice(0,120):null,'manual',Math.floor(Date.now()/1000),new Date().toISOString()).run();
 return {price:fromE8(e8),previous:prev===null?null:fromE8(prev)};
}
/** Age of a price in hours at `at` (unix seconds; the period end when settling, now for the dashboard). */
const priceAgeHours=(p:PriceRow,at=Math.floor(Date.now()/1000))=>Math.max(0,at-observedAt(p))/3600;

/* ------------------------------------------------------------------ vault */

/** On-chain vault check: reward-token balance of the vault and what the cumulative `leaves` still owe after what each
    address already claimed. One claimed() read per leaf, through Multicall3 where the chain has it (lib/chain.ts readMany). */
async function vaultState(c:ChainConfig,rc:RewardConfig,leaves:Record<string,bigint>){
 if(!rc.token||!rc.contract)throw new HttpError(503,'Holder rewards are not switched on.');
 const vault=rc.contract;const addrs=Object.keys(leaves).filter(a=>leaves[a]>0n);
 // every read is taken at ONE block: on a chain with a block every 0.45 s, a claim landing between the balance read and
 // the claimed() reads would otherwise make the vault look more solvent than it is
 const blockNumber=await chainClient(c).getBlockNumber();
 const [balance,...claimed]=await readMany(c,[{address:rc.token.address,abi:erc20Abi,functionName:'balanceOf',args:[vault]},
  ...addrs.map(a=>({address:vault,abi:claimedAbi,functionName:'claimed',args:[a as Address]}))],blockNumber) as bigint[];
 let outstanding=0n;addrs.forEach((a,i)=>{const d=leaves[a]-claimed[i];if(d>0n)outstanding+=d;});
 return {balance,outstanding};
}
const cache=new Map<string,{at:number;v:{balance:bigint;outstanding:bigint}}>();
/** `leaves` is a function so the (large) leaf list is only parsed when the cached answer is older than a minute. */
async function vaultCached(c:ChainConfig,rc:RewardConfig,root:string,leaves:()=>Record<string,bigint>){
 const hit=cache.get(root);if(hit&&Date.now()-hit.at<60_000)return hit.v;
 const v=await vaultState(c,rc,leaves());cache.set(root,{at:Date.now(),v});if(cache.size>8)cache.delete(cache.keys().next().value!);return v;
}
const parseLeaves=(json:string)=>Object.fromEntries(Object.entries(JSON.parse(json) as Record<string,string>).map(([a,v])=>[a,BigInt(v)]));
/** Leaves and tree of a period, kept per root: the dashboard asks for them on every request and hashing every leaf of a
    large tree each time would let a handful of visitors keep the one runtime process busy. */
const trees=new Map<string,{leaves:Record<string,bigint>;tree:ReturnType<typeof buildTree>}>();
function periodTree(p:{root:string;leaves:string}){
 let t=trees.get(p.root);
 if(!t){const leaves=parseLeaves(p.leaves);t={leaves,tree:buildTree(leaves)};trees.set(p.root,t);if(trees.size>3)trees.delete(trees.keys().next().value!);}
 return t;
}

/* ------------------------------------------------------------------ funding + periods (operator) */

/** Records reward-token transfers INTO the vault from a transaction, after the chain settled it (history only: the vault
    check always reads the live on-chain balance). */
export async function recordFunding(db:D1Database,txHash:string,note?:string){
 const c=chainConfig();const rc=rewardConfig(c);if(!rc.live||!rc.token||!rc.contract)throw new HttpError(503,'Holder rewards are not switched on.');
 if(!/^0x[0-9a-fA-F]{64}$/.test(txHash))throw new HttpError(400,'Send a transaction hash (0x + 64 hex).');
 const client=chainClient(c);
 let receipt;try{receipt=await client.getTransactionReceipt({hash:txHash as Hex});}catch{throw new HttpError(404,'Transaction not found yet. Try again once it is mined.');}
 if(receipt.status!=='success')throw new HttpError(400,'That transaction failed on-chain.');
 const settled=await client.getBlock({blockTag:blockTag(c)});
 if(receipt.blockNumber>settled.number)throw new HttpError(409,`Mined, but BNB Smart Chain has not settled it yet (${c.finality}). Try again in a few minutes.`);
 const block=await client.getBlock({blockNumber:receipt.blockNumber});
 const {decodeEventLog}=await import('viem');
 const rows=receipt.logs.flatMap(l=>{
  if(l.address.toLowerCase()!==rc.token!.address.toLowerCase())return [];
  try{const e=decodeEventLog({abi:erc20Abi,data:l.data,topics:l.topics});
   if(e.eventName!=='Transfer'||getAddress(e.args.to)!==rc.contract)return [];
   return [{logIndex:l.logIndex,from:getAddress(e.args.from),amount:e.args.value}];}catch{return [];}
 });
 if(!rows.length)throw new HttpError(400,`No ${rc.token.symbol} transfer to the reward vault in that transaction.`);
 const created=new Date().toISOString();
 const res=await db.batch(rows.map(r=>db.prepare('INSERT OR IGNORE INTO reward_fundings (tx_hash,log_index,token,from_addr,amount,block,ts,note,period_id,created) VALUES (?,?,?,?,?,?,?,?,NULL,?)')
  .bind(txHash.toLowerCase(),r.logIndex,rc.token!.address,r.from,r.amount.toString(),Number(receipt.blockNumber),Number(block.timestamp),note?String(note).slice(0,120):null,created)));
 const added=res.reduce((a,r)=>a+(r.meta.changes||0),0);
 return {recorded:added,already:added===0,amount:rows.reduce((a,r)=>a+r.amount,0n).toString()};
}

type PeriodRow={id:number;label:string;start_ts:number;end_ts:number;end_block:number;pool:string;distributed:string;eligible:number;total_weight:string;root:Hex;leaves:string;status:string;tx_hash:string|null;created:string;usd_total:string|null;price_e8:string|null};
export const latestPublished=(db:D1Database)=>db.prepare("SELECT * FROM reward_periods WHERE status='published' ORDER BY id DESC LIMIT 1").first<PeriodRow>();
/** End of the last period that holds accrual (built, published or included in a later root). */
const lastEnd=async(db:D1Database)=>(await db.prepare("SELECT end_ts FROM reward_periods WHERE status IN ('built','published','superseded') ORDER BY id DESC LIMIT 1").first<{end_ts:number}>())?.end_ts;

/** Builds the next period: fixed-rate accrual since the previous period, converted to the reward token at the current
    price, added to the cumulative merkle leaves. Refused (and retried later, nothing lost) when the price is missing or
    stale or when the vault cannot pay everything owed after this period. */
export async function buildPeriod(db:D1Database,{label,end}:{label?:string;end?:number}){
 const c=chainConfig();const rc=rewardConfig(c);if(!rc.live||!rc.harvex||!rc.token||!rc.contract)throw new HttpError(503,'Holder rewards are not switched on.');
 const token=rc.harvex.toLowerCase();const sym=rc.token.symbol,dec=rc.token.decimals;
 if(rc.excludeInvalid)throw new HttpError(409,`REWARD_EXCLUDE has ${rc.excludeInvalid} entr${rc.excludeInvalid===1?'y that is':'ies that are'} not a valid address (wrong length or broken checksum). The address it was meant to exclude would earn rewards, so no period is built until it is fixed. Accrual continues.`);
 if(await db.prepare("SELECT 1 FROM reward_periods WHERE status='built'").first())throw new HttpError(409,'A built period is waiting to be published or discarded.');
 // one vault only: `claimed()` starts at zero on another contract, so a tree built on these periods would pay history twice
 const bound=await db.prepare("SELECT id,contract,token,chain_id FROM reward_periods WHERE status IN ('built','published','superseded') ORDER BY id DESC LIMIT 1").first<{id:number;contract:string|null;token:string|null;chain_id:number|null}>();
 if(bound&&(bound.contract!==rc.contract||bound.token!==rc.token.address||bound.chain_id!==c.id))
  throw new HttpError(409,`This database already holds reward periods built for another vault (${bound.contract||'unknown'}, token ${bound.token||'unknown'}, chain ${bound.chain_id??'unknown'}). REWARD_CONTRACT is now ${rc.contract}: its claimed() amounts start at zero, so continuing would make every earlier reward claimable a second time. Do not refill. Moving to a new vault needs a migration of the cumulative amounts; see GO-LIVE-HARVEX-ID.md.`);
 const sync=await db.prepare('SELECT last_block,last_ts FROM holder_sync WHERE token=?').bind(token).first<{last_block:number;last_ts:number}>();
 if(!sync)throw new HttpError(409,'Run the holder recorder (sync) first.');
 const prev=await lastEnd(db);
 const first=await db.prepare('SELECT MIN(ts) AS t FROM holder_transfers WHERE token=?').bind(token).first<{t:number|null}>();
 if(end!==undefined&&!Number.isSafeInteger(end))throw new HttpError(400,'end must be a whole number of seconds (unix time).');
 const e=end!==undefined?end:sync.last_ts;
 // the first period covers one period length, or starts at the first transfer if the token is younger. There is no way to
 // choose an earlier start: rewards are never paid for the time before the program was switched on.
 const s=prev??Math.max(first?.t??e,e-rc.periodHours*HOUR);
 if(e>sync.last_ts)throw new HttpError(409,`The recorder has only reached ${new Date(sync.last_ts*1000).toISOString()}. Sync first or choose an earlier end.`);
 if(e<=s)throw new HttpError(400,'The period must end after it starts.');
 if(await transferCount(db,token,e)>MAX_REPLAY_TRANSFERS)throw tooManyTransfers();
 // the live feed price at settlement (refused while paused for a corporate action or after a >50% jump)
 if(rc.priceFeed)await refreshPrice(db);
 const price=await latestPrice(db);
 if(!price)throw new HttpError(409,`Set the ${sym} price first (action price). Accrual continues meanwhile.`);
 const age=priceAgeHours(price,e);
 if(age>rc.priceMaxAgeHours)throw new HttpError(409,`The ${sym} price is ${Math.floor(age)} hours older than this period (limit ${rc.priceMaxAgeHours}). Accrual continues and is settled when the price resumes.`);
 const priceE8=BigInt(price.price_e8);
 // the fixed-rate accrual, then the referral boost on the inviters' own amounts (lib/boost.ts: a friend must have held
 // a full unit through this whole period). Everything after this line, the vault check included, uses the boosted amounts.
 const rows=applyBoost(accrue(await storedTransfers(db,token,e),{start:s,end:e,perUnit:rc.perUnit,rateE8:rc.rateE8,exclude:rc.exclude}).rows,e-s,await boostData(db));
 const paid=rows.map(r=>({...r,amount:tokensFor(r.usdE8,priceE8,dec)})).filter(r=>r.amount>0n);
 if(!paid.length)throw new HttpError(409,`Nobody held ${rc.perUnitWhole.toLocaleString('en-US')} HARVEX in this period. Accrual continues.`);
 const last=await latestPublished(db);
 const leaves:Record<string,bigint>=last?parseLeaves(last.leaves):{};
 for(const r of paid)leaves[r.address]=(leaves[r.address]??0n)+r.amount;
 if(Object.keys(leaves).length>MAX_LEAVES)throw new HttpError(503,`The reward tree would carry more than ${MAX_LEAVES.toLocaleString('en-US')} addresses, more than this version checks against the vault in one pass. Reward periods wait and nothing is lost; a minimum first payout (or the incremental calculator) must be installed before continuing.`);
 // full-or-wait: never publish a root the vault cannot pay in full
 let vault;try{vault=await vaultState(c,rc,leaves);}catch(err){if(err instanceof HttpError)throw err;throw new HttpError(503,'Could not read the reward vault on BNB Smart Chain. Try again in a minute.');}
 if(vault.outstanding>vault.balance)throw new HttpError(409,`The vault holds ${tokenText(vault.balance,dec)} ${sym} but ${tokenText(vault.outstanding,dec)} ${sym} would be owed after this period. Refill at least ${tokenText(vault.outstanding-vault.balance,dec)} ${sym}; accrual continues and nothing is lost.`);
 const tree=buildTree(leaves);const created=new Date().toISOString();
 const usdTotal=paid.reduce((a,r)=>a+r.usdE8,0n),distributed=paid.reduce((a,r)=>a+r.amount,0n),unitSeconds=paid.reduce((a,r)=>a+r.unitSeconds,0n);
 const endBlock=(await db.prepare('SELECT MAX(block) AS b FROM holder_transfers WHERE token=? AND ts<=?').bind(token,e).first<{b:number|null}>())?.b??0;
 // the row is only inserted while no other built period exists and the previous period still ends where this one starts:
 // two builds at the same moment (an operator and the scheduler) cannot both land, and time is never paid twice
 const ins=await db.prepare(`INSERT INTO reward_periods (label,start_ts,end_ts,end_block,pool,distributed,eligible,total_weight,root,leaves,status,created,usd_total,price_e8,contract,token,chain_id)
   SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM reward_periods WHERE status='built')
    AND COALESCE((SELECT end_ts FROM reward_periods WHERE status IN ('built','published','superseded') ORDER BY id DESC LIMIT 1),-1)=? RETURNING id`)
  .bind(String(label||periodLabel(s,e)).slice(0,40),s,e,endBlock,usdTotal.toString(),distributed.toString(),paid.length,unitSeconds.toString(),tree.root,
   JSON.stringify(Object.fromEntries(Object.entries(leaves).map(([a,v])=>[a,v.toString()]))),'built',created,usdTotal.toString(),priceE8.toString(),rc.contract,rc.token.address,c.id,prev??-1).first<{id:number}>();
 if(!ins)throw new HttpError(409,'Another period was built at the same moment. Nothing was changed; try again.');
 const id=ins.id;
 const stmts=[...paid.map(r=>db.prepare('INSERT INTO reward_allocations (period_id,address,weight,amount,balance,since,usd,units,boost) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,r.address,r.unitSeconds.toString(),r.amount.toString(),r.balance.toString(),null,r.usdE8.toString(),Number(r.units),r.boost)),
  // informational: the first period built after each funding
  db.prepare('UPDATE reward_fundings SET period_id=? WHERE period_id IS NULL AND ts<=?').bind(id,e)];
 for(let i=0;i<stmts.length;i+=80)await db.batch(stmts.slice(i,i+80));
 return {period:id,root:tree.root,start:s,end:e,usd:fromE8(usdTotal),usdE8:usdTotal.toString(),price:fromE8(priceE8),distributed:distributed.toString(),eligible:paid.length,
  cumulativeOwed:Object.values(leaves).reduce((a,v)=>a+v,0n).toString(),vaultBalance:vault.balance.toString(),outstanding:vault.outstanding.toString()};
}

/** Dry run of the open period (since the last period, up to the recorder): who accrues what, in USD and at the current
    price, plus the vault check. Nothing is saved. */
export async function previewPeriod(db:D1Database){
 const c=chainConfig();const rc=rewardConfig(c);if(!rc.harvex)throw new HttpError(503,'Set HARVEX_TOKEN_ADDRESS first.');const token=rc.harvex.toLowerCase();const dec=rc.token?.decimals??18;
 const sync=await db.prepare('SELECT last_ts FROM holder_sync WHERE token=?').bind(token).first<{last_ts:number}>();if(!sync)throw new HttpError(409,'Run the holder recorder (sync) first.');
 const e=sync.last_ts;const prev=await lastEnd(db);const s=prev&&prev<e?prev:e-rc.periodHours*HOUR;
 if(await transferCount(db,token,e)>MAX_REPLAY_TRANSFERS)throw tooManyTransfers();
 const price=await latestPrice(db);const priceE8=price?BigInt(price.price_e8):0n;
 const rows=applyBoost(accrue(await storedTransfers(db,token,e),{start:s,end:e,perUnit:rc.perUnit,rateE8:rc.rateE8,exclude:rc.exclude}).rows,e-s,await boostData(db));
 const usdTotal=rows.reduce((a,r)=>a+r.usdE8,0n);
 const tokens=rows.reduce((a,r)=>a+tokensFor(r.usdE8,priceE8,dec),0n);
 let vault=null;
 if(rc.live&&rc.token&&rc.contract){const last=await latestPublished(db);const leaves=last?parseLeaves(last.leaves):{};
  try{const v=await vaultState(c,rc,leaves);vault={balance:v.balance.toString(),outstanding:v.outstanding.toString(),afterThis:(v.outstanding+tokens).toString(),enough:v.balance>=v.outstanding+tokens};}catch{vault=null;}}
 const top=[...rows].sort((a,b)=>a.usdE8<b.usdE8?1:-1).slice(0,20);
 // contract = the address has code: usually a liquidity pool, bridge or vault that belongs in REWARD_EXCLUDE (a smart
 // wallet is a contract too, so this is a hint for the operator, not an automatic exclusion)
 const client=chainClient(c,{batch:true});const codes=await Promise.all(top.map(r=>client.getCode({address:r.address as Address}).then(x=>!!x&&x!=='0x').catch(()=>null)));
 return {start:s,end:e,price:price?fromE8(priceE8):null,priceSource:price?.source??null,priceAgeHours:price?Math.floor(priceAgeHours(price,e)):null,usd:fromE8(usdTotal),tokens:tokens.toString(),earners:rows.length,vault,
  top:top.map((r,i)=>({address:r.address,contract:codes[i],balance:r.balance.toString(),units:r.units.toString(),usd:fromE8(r.usdE8),tokens:tokensFor(r.usdE8,priceE8,dec).toString()}))};
}

/** Reads the vault's RootUpdated events since the last check. Every root on the vault must be one this server built
    (reward_periods.root). Any other root was posted by someone else: a leaked root poster key, or the owner by hand.
    A forged root can pay a thief up to the payout limit in EVERY window, and it can be swapped back to the real root in
    the same second so that claims keep working and nothing looks wrong. So the events are read, not the current root.
    On a foreign root the alert is stored and all reward automation stops until the operator has looked (action "ack").
    Returns null (not live), {alert} (stopped) or {checked} (blocks read). */
export async function watchRoots(db:D1Database){
 const c=chainConfig();const rc=rewardConfig(c);if(!rc.live||!rc.contract)return null;
 const key=rc.contract.toLowerCase();
 const w=await db.prepare('SELECT last_block,alert FROM reward_watch WHERE contract=?').bind(key).first<{last_block:number;alert:string|null}>();
 if(w?.alert)return {alert:w.alert};
 const save=(block:number,alert:string|null)=>db.prepare('INSERT INTO reward_watch (contract,last_block,alert,updated) VALUES (?,?,?,?) ON CONFLICT(contract) DO UPDATE SET last_block=excluded.last_block,alert=excluded.alert,updated=excluded.updated').bind(key,block,alert,new Date().toISOString()).run();
 const known=async(root:string)=>/^0x0{64}$/.test(root)||!!(await db.prepare('SELECT 1 FROM reward_periods WHERE lower(root)=lower(?) LIMIT 1').bind(root).first());
 const client=chainClient(c,{logs:true});const head=Number(await client.getBlockNumber());
 if(!w){
  // first look at this vault: its current root must be empty or one of ours; events are read from here on
  const now=await chainClient(c).readContract({address:rc.contract,abi:vaultAbi,functionName:'merkleRoot'});
  if(!await known(now)){const alert=`The reward vault already holds a root (${now}) that this server did not build. Check who posted it before any reward is funded or claimed.`;await save(head,alert);return {alert};}
  await save(head,null);return {checked:0};
 }
 let from=w.last_block+1,checked=0;
 // logs RPCs cap the block range; at one tick a minute a single range is normally enough (downtime is caught up over ticks)
 for(let i=0;i<10&&from<=head;i++){
  const to=Math.min(from+4999,head);
  const logs=await client.getLogs({address:rc.contract,event:rootUpdated,fromBlock:BigInt(from),toBlock:BigInt(to)});
  for(const l of logs){const root=String(l.args.root||'');
   if(!await known(root)){const alert=`Root ${root} was posted to the reward vault in block ${l.blockNumber} (transaction ${l.transactionHash}) and is NOT a root this server built. If nobody on the team posted it, the root poster key has leaked: pause the vault from the Safe (setPaused true), remove the poster (setRootPoster 0x0), post the last correct root again, and only then clear this alert.`;
    await save(Number(l.blockNumber??to),alert);return {alert};}}
  checked+=to-from+1;await save(to,null);from=to+1;
 }
 return {checked};
}
/** Refills of the reward vault, read from the chain: every transfer of the reward token to the vault, in settled
    blocks. A refill used to appear on the page only after the operator registered its transaction (recordFunding); one
    sent straight from a wallet was missing. The first call finds the block the vault was deployed in (binary search on
    its code; needs the archive RPC, else it looks back FUND_LOOKBACK blocks) and stores it; later calls read forward
    from there, a few ranges at a time, then follow the head. The cursor is a row of reward_watch under the key
    "funds:<vault>" (watchRoots only reads the row keyed by the vault's own address). Nothing here moves or decides
    money: the list is what the page shows under "Vault refills". */
const FUND_LOOKBACK=5_000_000;let fundStep=100_000;
export async function scanFundings(db:D1Database,{ranges=8}:{ranges?:number}={}){
 const c=chainConfig();const rc=rewardConfig(c);if(!rc.contract||!rc.token)return null;
 const vault=rc.contract,token=rc.token.address,key=`funds:${vault.toLowerCase()}`;
 const logs=chainClient(c,{logs:true});
 const head=Number((await logs.getBlock({blockTag:blockTag(c)})).number);
 const save=(block:number)=>db.prepare('INSERT INTO reward_watch (contract,last_block,alert,updated) VALUES (?,?,NULL,?) ON CONFLICT(contract) DO UPDATE SET last_block=excluded.last_block,updated=excluded.updated').bind(key,block,new Date().toISOString()).run();
 const w=await db.prepare('SELECT last_block FROM reward_watch WHERE contract=?').bind(key).first<{last_block:number}>();
 if(!w){
  let first=Math.max(0,head-FUND_LOOKBACK);
  try{
   const state=chainClient(c);const has=async(b:number)=>{const code=await state.getCode({address:vault,blockNumber:BigInt(b)});return !!code&&code!=='0x';};
   if(await has(head)){let lo=0,hi=head;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(await has(mid))hi=mid;else lo=mid+1;}first=lo;}
  }catch{/* no archive state on this RPC: the fixed look-back stands */}
  await save(first-1);return {recorded:0,from:first,head,caughtUp:false};
 }
 let from=w.last_block+1,recorded=0;
 for(let i=0;i<ranges&&from<=head;i++){
  const to=Math.min(from+fundStep-1,head);
  let found;try{found=await logs.getLogs({address:token,event:erc20Abi[0],args:{to:vault},fromBlock:BigInt(from),toBlock:BigInt(to)});}
  catch(e){if(fundStep<=2000)throw e;fundStep=Math.floor(fundStep/2);continue;}
  for(const l of found){
   if(!l.transactionHash||l.args.value===undefined||!l.args.from)continue;
   const ts=Number((await logs.getBlock({blockNumber:l.blockNumber})).timestamp);
   const r=await db.prepare('INSERT OR IGNORE INTO reward_fundings (tx_hash,log_index,token,from_addr,amount,block,ts,note,period_id,created) VALUES (?,?,?,?,?,?,?,NULL,NULL,?)')
    .bind(l.transactionHash.toLowerCase(),l.logIndex,token,getAddress(l.args.from),l.args.value.toString(),Number(l.blockNumber),ts,new Date().toISOString()).run();
   recorded+=r.meta.changes||0;
  }
  await save(to);from=to+1;
 }
 return {recorded,upTo:from-1,head,caughtUp:from>head};
}
/** Operator: clears a watchRoots alert after the vault was checked (events are read again from the current block). */
export async function ackRootAlert(db:D1Database){
 const c=chainConfig();const rc=rewardConfig(c);if(!rc.contract)throw new HttpError(503,'Holder rewards are not switched on.');
 const head=Number(await chainClient(c,{logs:true}).getBlockNumber());
 await db.prepare('INSERT INTO reward_watch (contract,last_block,alert,updated) VALUES (?,?,NULL,?) ON CONFLICT(contract) DO UPDATE SET last_block=excluded.last_block,alert=NULL,updated=excluded.updated').bind(rc.contract.toLowerCase(),head,new Date().toISOString()).run();
 return {cleared:true,from:head};
}

/** Scheduler step (REWARD_AUTO): publish a built period once its root is on-chain, and build each closed period.
    Building is tried every minute for 10 minutes after a close, every 5 minutes up to half an hour, then every 15 minutes
    until the period is built (a refused build: no price, stale price, vault too low, nobody eligible, is retried, so a
    refill is picked up within minutes and not at the next close). Nothing is posted or built while watchRoots reports a
    root on the vault that this server did not build. */
export async function autoRewards(db:D1Database,now=new Date()){
 const rc=rewardConfig();if(!rc.live||!rc.auto||!rc.harvex)return null;
 // live price for the dashboard every 15 minutes (settlement reads it again anyway)
 if(rc.priceFeed){const p=await latestPrice(db);if(!p||Date.now()-Date.parse(p.created)>15*60e3)await refreshPrice(db).catch(()=>null);}
 let watch:Awaited<ReturnType<typeof watchRoots>>=null;
 try{watch=await watchRoots(db);}catch(e){return {stalled:'vault',why:`Could not read the reward vault's root history: ${(e as Error).message}`};}
 if(watch&&'alert' in watch)return {stalled:'vault',why:watch.alert};
 const built=await db.prepare("SELECT id,root,tx_hash,posted_at FROM reward_periods WHERE status='built' ORDER BY id DESC LIMIT 1").first<{id:number;root:Hex;tx_hash:string|null;posted_at:number|null}>();
 if(built){try{return {published:(await publishPeriod(db,built.id,built.tx_hash||undefined)).period};}
  catch{if(!rc.posterKey)return {waitingForRoot:built.id};try{return {posting:built.id,...await postRoot(db,built)};}catch(e){return {waitingForRoot:built.id,posterError:(e as Error).message};}}}
 const sec=Math.floor(now.getTime()/1000);const {lastClose}=periodBounds(rc.periodHours,sec);
 const last=await db.prepare("SELECT end_ts FROM reward_periods ORDER BY id DESC LIMIT 1").first<{end_ts:number}>();
 if(last&&last.end_ts>=lastClose)return null;
 const age=sec-lastClose,minute=now.getUTCMinutes();if(!(age<600||(age<1800&&minute%5===0)||minute%15===0))return null;
 const sync=await db.prepare('SELECT last_ts FROM holder_sync WHERE token=?').bind(rc.harvex.toLowerCase()).first<{last_ts:number}>();
 if(!sync||sync.last_ts<lastClose)return {waitingForRecorder:true};
 try{return {built:(await buildPeriod(db,{end:lastClose})).period};}catch(e){return {skipped:(e as Error).message};}
}

/** Root poster step: sends setMerkleRoot(root) for the latest built period with REWARD_ROOT_POSTER_KEY. The hash and the
    time are kept on the period. A reverted transaction is sent again at once; one that is still not mined, or whose root
    is no longer the vault's root, is sent again after POST_RETRY_SECONDS (so a dropped transaction cannot block every
    later period, and a fight over the root costs at most one transaction per ten minutes). Before sending, the vault must
    name this key as rootPoster, have a payout limit, not be owned by this key and pay the configured token. Only a period
    that buildPeriod accepted ever gets here, and the publish step re-checks the root on-chain. */
export async function postRoot(db:D1Database,p:{id:number;root:Hex;tx_hash:string|null;posted_at?:number|null}){
 const c=chainConfig();const rc=rewardConfig(c);if(!rc.posterKey||!rc.contract)throw new Error('No root poster configured.');
 const client=chainClient(c);const account=privateKeyToAccount(rc.posterKey);const nowSec=Math.floor(Date.now()/1000);
 if(p.tx_hash){
  const r=await client.getTransactionReceipt({hash:p.tx_hash as Hex}).catch(()=>null);
  const waited=nowSec-(p.posted_at??0);
  if(r?.status!=='reverted'&&waited<POST_RETRY_SECONDS)return {tx:p.tx_hash,status:r?'mined':'sent'};
  await db.prepare('UPDATE reward_periods SET tx_hash=NULL,posted_at=NULL WHERE id=? AND tx_hash=?').bind(p.id,p.tx_hash).run();
  if(r?.status==='reverted')return {tx:p.tx_hash,status:'reverted, will resend'};
  // not mined after the wait (dropped), or mined but the vault's root was replaced meanwhile: send it again below
 }
 const read=<T extends 'rootPoster'|'maxPayoutPerWindow'|'windowSeconds'|'owner'|'token'>(functionName:T)=>client.readContract({address:rc.contract!,abi:vaultAbi,functionName});
 const [allowed,limit,windowSeconds,owner,pays]=await Promise.all([read('rootPoster'),read('maxPayoutPerWindow'),read('windowSeconds'),read('owner'),read('token')]);
 if(getAddress(allowed)!==account.address)throw new Error(`The vault's rootPoster is ${allowed}, not this key (${account.address}). The Safe must call setRootPoster first.`);
 if(limit===0n||windowSeconds===0n)throw new Error('The vault has no payout limit. An automated root poster without one could empty the vault if its key leaked: the Safe must call setPayoutLimit first (VAULT-MAINNET-ID.md).');
 if(getAddress(owner)===account.address)throw new Error('The root poster key is the OWNER of the vault. Use a separate key that can only post roots; the owner must be the Safe.');
 if(rc.token&&getAddress(pays)!==rc.token.address)throw new Error(`The vault pays ${pays}, not REWARD_TOKEN_ADDRESS (${rc.token.address}).`);
 const chain=defineChain({id:c.id,name:c.name,nativeCurrency:NATIVE,rpcUrls:{default:{http:[c.rpc]}}});
 const wallet=createWalletClient({chain,transport:http(c.rpc,{timeout:15000}),account});
 const hash=await wallet.writeContract({address:rc.contract,abi:vaultAbi,functionName:'setMerkleRoot',args:[p.root]});
 await db.prepare("UPDATE reward_periods SET tx_hash=?,posted_at=? WHERE id=? AND status='built' AND tx_hash IS NULL").bind(hash,nowSec,p.id).run();
 return {tx:hash,status:'sent'};
}

/** Drops a built (unpublished) period. Every statement acts only while the period is still 'built', so a discard racing
    the scheduler's publish can never delete a period that has just gone live (the cumulative base of all later trees). */
export async function discardPeriod(db:D1Database,id:number){
 if(!Number.isSafeInteger(id))throw new HttpError(400,'Send the period number.');
 const p=await db.prepare('SELECT status FROM reward_periods WHERE id=?').bind(id).first<{status:string}>();
 if(!p)throw new HttpError(404,'Unknown period.');if(p.status!=='built')throw new HttpError(409,'Only a built, unpublished period can be discarded.');
 const built="EXISTS (SELECT 1 FROM reward_periods WHERE id=? AND status='built')";
 const res=await db.batch([
  db.prepare(`UPDATE reward_fundings SET period_id=NULL WHERE period_id=? AND ${built}`).bind(id,id),
  db.prepare(`DELETE FROM reward_allocations WHERE period_id=? AND ${built}`).bind(id,id),
  db.prepare("DELETE FROM reward_periods WHERE id=? AND status='built'").bind(id),
 ]);
 if(!res[2].meta.changes)throw new HttpError(409,'The period was published at the same moment, so it was not discarded.');
 return {period:id,status:'discarded'};
}

/** Marks a built period live once its root is on the vault (checked on-chain). The earlier published period is only
    demoted in the same breath as this one goes live: if the period is no longer 'built' nothing changes. */
export async function publishPeriod(db:D1Database,id:number,txHash?:string){
 const c=chainConfig();const rc=rewardConfig(c);if(!rc.live||!rc.contract)throw new HttpError(503,'Holder rewards are not switched on.');
 if(!Number.isSafeInteger(id))throw new HttpError(400,'Send the period number.');
 const p=await db.prepare('SELECT id,root,status FROM reward_periods WHERE id=?').bind(id).first<{id:number;root:Hex;status:string}>();
 if(!p)throw new HttpError(404,'Unknown period.');if(p.status!=='built')throw new HttpError(409,`Period ${id} is ${p.status}.`);
 let onchain:Hex;try{onchain=await chainClient(c).readContract({address:rc.contract,abi:vaultAbi,functionName:'merkleRoot'});}
 catch{throw new HttpError(503,'Could not read the reward vault.');}
 if(onchain.toLowerCase()!==p.root.toLowerCase())throw new HttpError(409,'The reward vault root does not match this period yet. Post the root on-chain first.');
 const res=await db.batch([
  db.prepare("UPDATE reward_periods SET status='superseded' WHERE status='published' AND EXISTS (SELECT 1 FROM reward_periods WHERE id=? AND status='built')").bind(id),
  db.prepare("UPDATE reward_periods SET status='published',tx_hash=? WHERE id=? AND status='built'").bind(typeof txHash==='string'?txHash.slice(0,80):null,id),
 ]);
 if(!res[1].meta.changes)throw new HttpError(409,`Period ${id} was discarded or published at the same moment. Nothing was changed.`);
 cache.clear();
 return {period:id,status:'published'};
}

/** Operator view: recorder, price, vault (balance vs what the published root still owes), open-period estimate, the
    root poster (address, gas) and whether the root watch has stopped the automation. */
export async function adminStatus(db:D1Database){
 const preview=await previewPeriod(db).catch(e=>({error:(e as Error).message}));
 const price=await latestPrice(db);
 const c=chainConfig();const rc=rewardConfig(c);
 // root poster: its address and gas balance (it pays a little BNB for every hourly root)
 let poster:{address:string;eth:string|null}|null=null;
 if(rc.posterKey){const address=privateKeyToAccount(rc.posterKey).address;let eth:string|null=null;try{eth=(Number(await chainClient().getBalance({address}))/1e18).toFixed(6);}catch{eth=null;}poster={address,eth};}
 const watch=rc.contract?await db.prepare('SELECT last_block,alert,updated FROM reward_watch WHERE contract=?').bind(rc.contract.toLowerCase()).first<{last_block:number;alert:string|null;updated:string}>():null;
 const bound=await db.prepare("SELECT contract,token,chain_id FROM reward_periods WHERE status IN ('built','published','superseded') ORDER BY id DESC LIMIT 1").first<{contract:string|null;token:string|null;chain_id:number|null}>();
 return {poster,priceFeed:rc.priceFeed,price:price?{usd:fromE8(BigInt(price.price_e8)),previous:price.previous_e8?fromE8(BigInt(price.previous_e8)):null,source:price.source,observed:new Date(observedAt(price)*1000).toISOString(),ageHours:Math.floor(priceAgeHours(price))}:null,openPeriod:preview,
  rootWatch:watch?{readTo:watch.last_block,alert:watch.alert,updated:watch.updated}:null,
  // the vault the existing periods were built for; `matches` false means builds are refused (see buildPeriod)
  vault:{configured:rc.contract,periodsBuiltFor:bound?.contract??null,matches:!bound||(bound.contract===rc.contract&&bound.token===rc.token?.address&&bound.chain_id===c.id)},
  excludeInvalid:rc.excludeInvalid};
}

/* ------------------------------------------------------------------ eligibility (self-certification) */

/** A cautious default list, kept from the first design (which paid a tokenized stock): no legal review has been done
    for any reward token here, so the operator must have this list checked before rewards are switched on.
    ISO codes refused at the claim step: United States, Canada, United Kingdom, Switzerland (restricted) and
    Cuba, Belarus, Iran, North Korea, Russia, Syria, Ukraine, South Sudan, Sudan, Myanmar, Venezuela (prohibited).
    Afghanistan, Libya and Somalia were added on 8 Oct 2026 with the plan to pay NVDAon: with them the list holds every
    country Ondo's eligibility page names as prohibited for its tokenized stocks (docs.ondo.finance, read that day; all
    of Ukraine stays refused, where Ondo names its occupied regions). Ondo also RESTRICTS the EEA, Hong Kong, Singapore,
    Brazil and Malaysia to qualified investors: that is not in this list and is a question for the legal review. */
export const BLOCKED_COUNTRIES=['US','CA','GB','CH','CU','BY','IR','KP','RU','SY','UA','SS','SD','MM','VE','AF','LY','SO'];
export const ATTEST_VERSION='rewards-2026-09-30';
export async function attest(db:D1Database,owner:string,country:string,confirm:boolean){
 const c=String(country||'').toUpperCase();
 if(!/^[A-Z]{2}$/.test(c))throw new HttpError(400,'Choose your country of residence.');
 if(!confirm)throw new HttpError(400,'Confirm the statement to continue.');
 if(BLOCKED_COUNTRIES.includes(c))throw new HttpError(403,'Holder rewards cannot be claimed from your country of residence.');
 await db.prepare('INSERT INTO reward_attestations (owner,version,country,created) VALUES (?,?,?,?) ON CONFLICT(owner) DO UPDATE SET version=excluded.version,country=excluded.country,created=excluded.created')
  .bind(owner,ATTEST_VERSION,c,new Date().toISOString()).run();
 return {attested:true,country:c};
}

/* ------------------------------------------------------------------ 4. dashboard data */

/** Accrual of the open period (since the last period, up to what the recorder has read) for every address: computed
    once per recorder position and reused by every dashboard request. Replaying the history on each request would let
    a few visitors keep the single runtime process busy. Empty while the history is beyond the guard rail. Only the
    finished result is kept (never a promise: a promise made by one request must not be awaited by another). */
let openCache:{key:string;rows:Map<string,bigint>}|null=null;
async function openAccrual(db:D1Database,token:string,rc:RewardConfig,start:number,end:number){
 const boost=await boostData(db);
 const key=[token,start,end,rc.perUnit,rc.rateE8,rc.exclude.join(','),boost?`${boost.percent}:${boost.maxFriends}:${boost.pairs.length}:${boost.wallets.length}`:'-'].join('|');
 if(openCache?.key===key)return openCache.rows;
 const rows=new Map<string,bigint>();
 if(await transferCount(db,token,end)<=MAX_REPLAY_TRANSFERS)
  for(const r of applyBoost(accrue(await storedTransfers(db,token,end),{start,end,perUnit:rc.perUnit,rateE8:rc.rateE8,exclude:rc.exclude}).rows,end-start,boost))rows.set(r.address.toLowerCase(),r.usdE8);
 openCache={key,rows};return rows;
}

/** Public program data, plus the signed-in holder's wallets (balance, units, rate, accrued since the last period),
    allocations and claim proofs. */
export async function rewardsOverview(db:D1Database,wallets:Address[]|null,owner?:string){
 const c=chainConfig();const rc=rewardConfig(c);const token=rc.harvex?.toLowerCase()||'';const dec=rc.token?.decimals??18;
 const price=await latestPrice(db);const priceE8=price?BigInt(price.price_e8):0n;
 const pub={live:rc.live,harvex:rc.harvex,token:rc.token,contract:rc.contract,explorer:c.explorer,excluded:rc.exclude.length,
  harvexPerUnit:rc.perUnitWhole.toString(),usdPerUnitHour:fromE8(rc.rateE8),periodHours:rc.periodHours,...periodBounds(rc.periodHours),
  price:price?{usd:fromE8(priceE8),set:new Date(observedAt(price)*1000).toISOString(),stale:priceAgeHours(price)>rc.priceMaxAgeHours,source:price.source?.startsWith('chainlink')?'chainlink':'manual'}:null,priceMaxAgeHours:rc.priceMaxAgeHours};
 if(!rc.harvex)return {...pub,recorder:null,totals:null,vault:null,fundings:[],periods:[],mine:null};
 const [sync,holders,fund,periods,fundings,last]=await Promise.all([
  db.prepare('SELECT last_block,last_ts,updated FROM holder_sync WHERE token=?').bind(token).first<{last_block:number;last_ts:number;updated:string}>(),
  db.prepare("SELECT address,balance FROM holder_balances WHERE token=? AND balance<>'0'").bind(token).all<{address:string;balance:string}>(),
  db.prepare('SELECT amount FROM reward_fundings').all<{amount:string}>(),
  db.prepare('SELECT id,label,start_ts,end_ts,distributed,eligible,status,tx_hash,usd_total,price_e8 FROM reward_periods ORDER BY id DESC LIMIT 12').all<Pick<PeriodRow,'id'|'label'|'start_ts'|'end_ts'|'distributed'|'eligible'|'status'|'tx_hash'|'usd_total'|'price_e8'>>(),
  db.prepare('SELECT tx_hash,from_addr,amount,ts,note,period_id FROM reward_fundings ORDER BY ts DESC LIMIT 20').all<{tx_hash:string;from_addr:string;amount:string;ts:number;note:string|null;period_id:number|null}>(),
  latestPublished(db),
 ]);
 const ex=new Set([...rc.exclude.map(a=>a.toLowerCase()),...BURN]);
 const unitsOf=(b:bigint)=>b>=rc.perUnit?b/rc.perUnit:0n;
 let earners=0,totalUnits=0n;for(const h of holders.results){if(ex.has(h.address.toLowerCase()))continue;const u=unitsOf(BigInt(h.balance));if(u>0n){earners++;totalUnits+=u;}}
 const hourlyUsd=totalUnits*rc.rateE8;
 const done=periods.results.filter(p=>p.status!=='built');
 let vault:null|{balance:string;owed:string;status:'funded'|'low'|'short'}=null;
 if(rc.live&&rc.token&&rc.contract){
  try{const v=last?await vaultCached(c,rc,last.root,()=>periodTree(last).leaves):await vaultCached(c,rc,'none',()=>({}));
   const day=tokensFor(hourlyUsd*24n,priceE8,dec);const free=v.balance>v.outstanding?v.balance-v.outstanding:0n;
   vault={balance:v.balance.toString(),owed:v.outstanding.toString(),status:v.balance<v.outstanding?'short':priceE8>0n&&free<day?'low':'funded'};}catch{vault=null;}
 }
 const out={...pub,
  recorder:sync?{lastBlock:sync.last_block,lastTs:sync.last_ts,updated:sync.updated,holders:holders.results.length,earners}:null,
  totals:{funded:fund.results.reduce((a,f)=>a+BigInt(f.amount),0n).toString(),allocated:done.reduce((a,p)=>a+BigInt(p.distributed),0n).toString(),
   allocatedUsd:fromE8(done.reduce((a,p)=>a+BigInt(p.usd_total??'0'),0n)),periods:done.length,units:totalUnits.toString(),hourlyUsd:fromE8(hourlyUsd),
   hourlyTokens:tokensFor(hourlyUsd,priceE8,dec).toString()},
  vault,
  fundings:fundings.results.map(f=>({tx:f.tx_hash,amount:f.amount,ts:f.ts,note:f.note,period:f.period_id})),
  periods:periods.results.map(p=>({id:p.id,label:p.label,start:p.start_ts,end:p.end_ts,usd:p.usd_total?fromE8(BigInt(p.usd_total)):null,price:p.price_e8?fromE8(BigInt(p.price_e8)):null,distributed:p.distributed,eligible:p.eligible,status:p.status,tx:p.tx_hash})),
  mine:null as null|{wallets:{address:string;balance:string;units:string;usdPerHour:string;since:number|null;excluded:boolean;accruedUsd:string;accruedTokens:string}[];
   allocations:{period:number;label:string;end:number;address:string;amount:string;usd:string|null;units:number|null;balance:string;boost:number|null}[];
   claims:{address:string;cumulative:string;proof:Hex[];claimed:string|null}[];period:number|null;attested:boolean;country:string|null;accruedSince:number|null;accruedUntil:number|null}};
 if(!wallets)return out;
 const qs=wallets.map(()=>'?').join(',')||"''";
 const [bal,allocs]=await Promise.all([
  db.prepare(`SELECT address,balance,since FROM holder_balances WHERE token=? AND address IN (${qs})`).bind(token,...wallets).all<{address:string;balance:string;since:number|null}>(),
  db.prepare(`SELECT a.period_id,p.label,p.end_ts,a.address,a.amount,a.usd,a.units,a.balance,a.boost FROM reward_allocations a JOIN reward_periods p ON p.id=a.period_id WHERE p.status<>'built' AND a.address IN (${qs}) ORDER BY a.period_id DESC LIMIT 60`).bind(...wallets).all<{period_id:number;label:string;end_ts:number;address:string;amount:string;usd:string|null;units:number|null;balance:string;boost:number|null}>(),
 ]);
 // accrued but not yet in a root: from the end of the last period to what the recorder has read
 const from=await lastEnd(db);const until=sync?.last_ts??null;
 const accrued=new Map<string,bigint>();
 if(until&&(from===undefined||until>from)){
  const all=await openAccrual(db,token,rc,from??until-rc.periodHours*HOUR,until);
  for(const a of wallets){const usd=all.get(a.toLowerCase());if(usd)accrued.set(a.toLowerCase(),usd);}
 }
 const att=owner?await db.prepare('SELECT country,version FROM reward_attestations WHERE owner=?').bind(owner).first<{country:string;version:string}>():null;
 const attested=!!att&&att.version===ATTEST_VERSION&&!BLOCKED_COUNTRIES.includes(att.country);
 const byAddr=new Map(bal.results.map(b=>[b.address.toLowerCase(),b]));
 let claims:{address:string;cumulative:string;proof:Hex[];claimed:string|null}[]=[];
 if(last){
  const {leaves,tree}=periodTree(last);
  const client=rc.contract?chainClient(c):null;
  claims=await Promise.all(wallets.filter(a=>leaves[a]!==undefined).map(async a=>{
   let claimed:string|null=null;if(client&&rc.contract)try{claimed=(await client.readContract({address:rc.contract,abi:claimedAbi,functionName:'claimed',args:[a]})).toString();}catch{claimed=null;}
   // the proof is only served after the eligibility statement (a single-leaf tree has an empty, valid proof)
   return {address:a,cumulative:leaves[a].toString(),proof:attested?tree.proof(a)!:[],claimed};
  }));
 }
 out.mine={wallets:wallets.map(a=>{const b=byAddr.get(a.toLowerCase());const balance=BigInt(b?.balance??'0');const excluded=ex.has(a.toLowerCase());const units=excluded?0n:unitsOf(balance);const usd=accrued.get(a.toLowerCase())??0n;
   return {address:a,balance:balance.toString(),units:units.toString(),usdPerHour:fromE8(units*rc.rateE8),since:b?.since??null,excluded,accruedUsd:fromE8(usd),accruedTokens:tokensFor(usd,priceE8,dec).toString()};}),
  allocations:allocs.results.map(x=>({period:x.period_id,label:x.label,end:x.end_ts,address:x.address,amount:x.amount,usd:x.usd?fromE8(BigInt(x.usd)):null,units:x.units,balance:x.balance,boost:x.boost})),
  claims,period:last?.id??null,attested,country:att?.country??null,accruedSince:from??null,accruedUntil:until};
 return out;
}
export type RewardsOverview=Awaited<ReturnType<typeof rewardsOverview>>;
