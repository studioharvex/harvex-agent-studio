/* BNB Smart Chain settings for wallet linking, credit top-ups, earnings claims and holder tiers.
   Everything on-chain is OFF until the operator sets the addresses below in the Worker environment.
   Addresses are never hard-coded here: copy them from the official explorer only
   (mainnet bscscan.com, testnet testnet.bscscan.com).

   Env (server only):
     CHAIN_NETWORK            testnet (default) | mainnet
     CHAIN_ID                 override the chain id (local test chains only)
     CHAIN_RPC_URL            server RPC; may be a private provider URL, never sent to the browser
     CHAIN_LOGS_RPC_URL       RPC for Transfer logs (holder recorder, vault refills); default CHAIN_RPC_URL. The official
                              public endpoints refuse eth_getLogs, so one of the two must be a provider that serves logs
     PAY_TOKEN_ADDRESS        ERC-20 used for top-ups and claims (USDT on BNB Smart Chain)
     PAY_TOKEN_SYMBOL         default USDT      PAY_TOKEN_DECIMALS default 18 (USDT on BNB Smart Chain has 18, not 6)
     TOPUP_TREASURY           address that receives top-ups (a multisig)
     CREDITS_PER_TOKEN        credits per 1 whole PAY token, default 100 (also the claim rate)
     TOPUP_FINALITY           safe (default): credit once the block is justified by the validators (seconds);
                              finalized: once it is finalized (a few seconds more); soft: receipt + N blocks
     TOPUP_MIN_CONFIRMATIONS  blocks for "soft" only, default 3 (blocks are ~0.45 s on BNB Smart Chain)
     CLAIMS_ENABLED           true to let creators queue earnings for on-chain claims
     CLAIMS_CONTRACT          deployed HarvexClaims address (proofs are useless without it)
     CLAIM_MIN_CREDITS        default 500
     CLAIMS_ADMIN_TOKEN       bearer token for /api/claims/epoch (32+ chars)
     HARVEX_TOKEN_ADDRESS       HARVEX ERC-20, turns holder tiers on
     TIER_BASE_CREDITS        monthly base allotment, default 100
   Holder rewards (lib/rewards.ts, /api/rewards); off until REWARDS_ENABLED=true and all of these are set:
     REWARDS_ENABLED          true to record holders and build reward periods
     REWARD_TOKEN_ADDRESS     token paid to holders (planned: NVDAon, see REWARD_PLAN in lib/site.ts; any plain BEP-20 works)
     REWARD_TOKEN_SYMBOL      default USDT      REWARD_TOKEN_DECIMALS default 18
     REWARD_CONTRACT          a SEPARATE HarvexClaims instance deployed for the reward token
     Fixed rate: every complete block of REWARD_HARVEX_PER_UNIT HARVEX held earns
     REWARD_USD_PER_UNIT_HOUR dollars of the reward token per hour, accrued per second from the Transfer history.
     REWARD_HARVEX_PER_UNIT     whole HARVEX per reward unit, default 3000000
     REWARD_USD_PER_UNIT_HOUR USD per unit per hour, default 0.01 (stored with 8 decimals: 1000000)
     REWARD_PRICE_FEED        Chainlink USD feed for the reward token (8 decimals; copy the address from Chainlink's
                              feed directory for BNB Smart Chain).
                              Set: the price is read live from the feed at every settlement and every 15 minutes.
                              Empty: the operator sets it (/api/rewards/admin {action:"price"}), e.g. on testnet.
     REWARD_SHARES_ORACLE     only for a reward token that stands for MORE THAN ONE share of what the feed prices
                              (Ondo's tokenized stocks: dividends are reinvested, so a token is worth the share price
                              times a "shares per token" number that grows). The address of the issuer's oracle with
                              getSValue(token) -> (shares per token with 18 decimals, paused). Set: the feed's price is
                              multiplied by it, and nothing is settled while the oracle reports the token as paused
                              for a corporate action. Empty: the feed's price is the token's price.
     REWARD_PRICE_MAX_AGE_HOURS  periods are not built with a price older than this, default 72
     REWARD_PERIOD_HOURS      period length in hours, default 1: periods close at every full hour UTC
     REWARD_AUTO              true (default): the scheduler builds each closed period and publishes it once the multisig
                              has posted its root on-chain; false: operator uses /api/rewards/admin by hand
     REWARD_START_BLOCK       HARVEX deployment block; the recorder reads Transfer logs from here, default 0
     REWARD_EXCLUDE           comma-separated addresses never paid (team, treasury, liquidity pools, bridges) */
import {env} from 'cloudflare:workers';
import {createPublicClient,defineChain,getAddress,http,isAddress,keccak256,parseAbi,type Abi,type Address} from 'viem';

type ChainEnv={CHAIN_NETWORK?:string;CHAIN_ID?:string;CHAIN_RPC_URL?:string;CHAIN_LOGS_RPC_URL?:string;PAY_TOKEN_ADDRESS?:string;PAY_TOKEN_SYMBOL?:string;PAY_TOKEN_DECIMALS?:string;
 TOPUP_TREASURY?:string;CREDITS_PER_TOKEN?:string;TOPUP_MIN_CONFIRMATIONS?:string;TOPUP_FINALITY?:string;CLAIMS_ENABLED?:string;CLAIMS_CONTRACT?:string;CLAIM_MIN_CREDITS?:string;
 CLAIMS_ADMIN_TOKEN?:string;HARVEX_TOKEN_ADDRESS?:string;TIER_BASE_CREDITS?:string;
 REWARDS_ENABLED?:string;REWARD_TOKEN_ADDRESS?:string;REWARD_TOKEN_SYMBOL?:string;REWARD_TOKEN_DECIMALS?:string;REWARD_CONTRACT?:string;
 REWARD_HARVEX_PER_UNIT?:string;REWARD_USD_PER_UNIT_HOUR?:string;REWARD_PRICE_FEED?:string;REWARD_SHARES_ORACLE?:string;REWARD_PRICE_MAX_AGE_HOURS?:string;REWARD_START_BLOCK?:string;REWARD_EXCLUDE?:string;REWARD_PERIOD_HOURS?:string;REWARD_AUTO?:string;REWARD_ROOT_POSTER_KEY?:string};
const E=()=>env as unknown as ChainEnv;

/** Official public endpoints (docs.bnbchain.org). The browser only ever sees these. */
export const NETWORKS={
 mainnet:{id:56,name:'BNB Smart Chain',rpc:'https://bsc-dataseed.bnbchain.org',explorer:'https://bscscan.com'},
 testnet:{id:97,name:'BNB Smart Chain Testnet',rpc:'https://bsc-testnet-dataseed.bnbchain.org',explorer:'https://testnet.bscscan.com'},
} as const;

/** The coin that pays gas on both networks. */
export const NATIVE={name:'BNB',symbol:'BNB',decimals:18} as const;

export const erc20Abi=parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)','function balanceOf(address) view returns (uint256)','function totalSupply() view returns (uint256)']);
export const claimsAbi=parseAbi(['function claimed(address) view returns (uint256)','function merkleRoot() view returns (bytes32)','function claim(address account, uint256 cumulativeAmount, bytes32[] proof)']);

const addr=(v?:string):Address|null=>v&&isAddress(v)?getAddress(v):null;
// whole numbers from 1 up; anything else (empty, 0, 0.5, text) is the default: a fraction must never floor to 0 and
// end up as a divisor or as "0 decimals" (scripts/container-start.mjs refuses such values before the server starts)
const int=(v:string|undefined,d:number)=>{const n=Number(v);return Number.isFinite(n)&&n>=1?Math.floor(n):d;};
/** Decimal string -> integer with 8 decimals, no floating point ("0.01" -> 1000000n). null when malformed. */
export function toE8(v:string|number|undefined|null):bigint|null{
 const s=String(v??'').trim();const m=s.match(/^(\d{1,12})(?:\.(\d{1,8}))?$/);if(!m)return null;
 return BigInt(m[1])*100_000_000n+BigInt((m[2]||'').padEnd(8,'0')||'0');
}
/** Integer with 8 decimals -> plain decimal string (1000000n -> "0.01"). */
export function fromE8(v:bigint){const s=v.toString().padStart(9,'0');const i=s.slice(0,-8),f=s.slice(-8).replace(/0+$/,'');return f?`${i}.${f}`:i;}
/** Every HARVEX amount is handled in raw units with 18 decimals (the HARVEX token is ours and uses the ERC-20 default). */
export const HARVEX_DECIMALS=18n;

export function chainConfig(){
 const e=E();const net=e.CHAIN_NETWORK==='mainnet'?NETWORKS.mainnet:NETWORKS.testnet;
 const id=int(e.CHAIN_ID,net.id);
 const token=addr(e.PAY_TOKEN_ADDRESS),treasury=addr(e.TOPUP_TREASURY),claims=addr(e.CLAIMS_CONTRACT),harvex=addr(e.HARVEX_TOKEN_ADDRESS);
 return {
  network:e.CHAIN_NETWORK==='mainnet'?'mainnet' as const:'testnet' as const,id,name:net.name,publicRpc:net.rpc,explorer:net.explorer,rpc:e.CHAIN_RPC_URL||net.rpc,
  // Transfer logs for the holder recorder. The official public endpoints refuse eth_getLogs ("limit exceeded", measured
  // 5 Oct 2026) and keep no old state, so logs come from CHAIN_LOGS_RPC_URL, else from CHAIN_RPC_URL: one of them must be
  // a provider that serves logs. The chain makes 8,000 blocks an hour (0.45 s each) and providers' free tiers cap the
  // range of one eth_getLogs call; the recorder's chunk adapts when a range is refused.
  logsRpc:e.CHAIN_LOGS_RPC_URL||e.CHAIN_RPC_URL||net.rpc,
  token:token?{address:token,symbol:e.PAY_TOKEN_SYMBOL||'USDT',decimals:int(e.PAY_TOKEN_DECIMALS,18)}:null,
  treasury,creditsPerToken:int(e.CREDITS_PER_TOKEN,100),confirmations:int(e.TOPUP_MIN_CONFIRMATIONS,3),
  finality:(e.TOPUP_FINALITY==='soft'||e.TOPUP_FINALITY==='finalized'?e.TOPUP_FINALITY:'safe') as 'soft'|'safe'|'finalized',
  claimsEnabled:e.CLAIMS_ENABLED==='true'&&!!token,claimsContract:claims,claimMin:int(e.CLAIM_MIN_CREDITS,500),
  harvex,tierBase:int(e.TIER_BASE_CREDITS,100),
 };
}
export type ChainConfig=ReturnType<typeof chainConfig>;

/** Holder reward program settings. `live` only when every piece exists (HARVEX token, reward token, contract). */
export function rewardConfig(c=chainConfig()){
 const e=E();const token=addr(e.REWARD_TOKEN_ADDRESS),contract=addr(e.REWARD_CONTRACT);
 const start=Number(e.REWARD_START_BLOCK);
 // the rule itself: whole HARVEX per unit and USD (8 decimals) per unit per hour; malformed values fall back to the default
 const perUnitWhole=/^\d{1,15}$/.test(e.REWARD_HARVEX_PER_UNIT||'')&&BigInt(e.REWARD_HARVEX_PER_UNIT!)>0n?BigInt(e.REWARD_HARVEX_PER_UNIT!):3_000_000n;
 const rate=toE8(e.REWARD_USD_PER_UNIT_HOUR);const rateE8=rate&&rate>0n?rate:1_000_000n;
 // an entry that is not a valid address (wrong length, broken checksum) is counted, never dropped silently: the address it
 // was meant to exclude would start earning rewards, so periods are not built until it is fixed (lib/rewards.ts)
 const listed=(e.REWARD_EXCLUDE||'').split(/[\s,]+/).filter(Boolean);
 const exclude=listed.map(x=>addr(x)).filter((x):x is Address=>!!x);
 return {live:e.REWARDS_ENABLED==='true'&&!!(c.harvex&&token&&contract),harvex:c.harvex,
  token:token?{address:token,symbol:e.REWARD_TOKEN_SYMBOL||'USDT',decimals:Number.isFinite(Number(e.REWARD_TOKEN_DECIMALS))&&e.REWARD_TOKEN_DECIMALS?Math.floor(Number(e.REWARD_TOKEN_DECIMALS)):18}:null,
  contract,priceFeed:addr(e.REWARD_PRICE_FEED),sharesOracle:addr(e.REWARD_SHARES_ORACLE),perUnitWhole,perUnit:perUnitWhole*10n**HARVEX_DECIMALS,rateE8,priceMaxAgeHours:int(e.REWARD_PRICE_MAX_AGE_HOURS,72),
  periodHours:int(e.REWARD_PERIOD_HOURS,1),auto:e.REWARD_AUTO!=='false',
  // root poster (client, 1 Oct 2026): a key that can only post roots on the vault, so claims open every hour; the vault's
  // payout limit bounds what a leaked key could do. Never the owner (Safe) key, never a key holding the vault's tokens.
  posterKey:/^0x[0-9a-fA-F]{64}$/.test(e.REWARD_ROOT_POSTER_KEY||'')?e.REWARD_ROOT_POSTER_KEY as `0x${string}`:null,
  startBlock:Number.isFinite(start)&&start>0?Math.floor(start):0,
  // the reward contract and the zero address never count as holders
  exclude:[...new Set([...exclude,...(contract?[contract]:[])])],excludeInvalid:listed.length-exclude.length};
}
export type RewardConfig=ReturnType<typeof rewardConfig>;
/** Period boundaries: every `periodHours` hours from Monday 5 Jan 1970 00:00 UTC, so hourly periods close at every
    full hour UTC (and a 168-hour period would close on Mondays). */
const ANCHOR=345_600;
export function periodBounds(periodHours:number,nowSec=Math.floor(Date.now()/1000)){
 const len=periodHours*3600;const last=ANCHOR+Math.floor((nowSec-ANCHOR)/len)*len;return {lastClose:last,nextClose:last+len,length:len};
}

/** Server-side viem client; the RPC URL may carry a provider key so it never leaves the Worker. */
export function chainClient(c=chainConfig(),{batch=false,logs=false}:{batch?:boolean;logs?:boolean}={}){
 const url=logs?c.logsRpc:c.rpc;
 const chain=defineChain({id:c.id,name:c.name,nativeCurrency:NATIVE,rpcUrls:{default:{http:[url]}}});
 // batch: many reads in one JSON-RPC request (the vault check reads claimed() for every rewarded address)
 // logs: the RPC for Transfer logs (see logsRpc); head, logs and block times must all come from the same RPC
 return createPublicClient({chain,transport:http(url,{timeout:15000,retryCount:1,...(batch?{batch:{batchSize:100}}:{})})});
}

/** Multicall3 (mds1/multicall): the same address and the same runtime code on every chain that has it. Only used when
    the chain has exactly that code there. */
const MULTICALL3='0xcA11bde05977b3631167028862bE2a173976CA11' as Address;
const MULTICALL3_CODEHASH='0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891';
const multicallOn=new Map<string,boolean>();
export type ContractRead={address:Address;abi:Abi|readonly unknown[];functionName:string;args?:readonly unknown[]};
/** Many contract reads at ONE block, answered in order. With Multicall3 on the chain they travel as one eth_call per 400
    reads: RPC providers limit and price by request, and a few hundred single calls sent together are refused in part
    (public endpoints and free tiers refuse or cut large JSON-RPC batches). Without Multicall3 (a local test chain) they go out as
    JSON-RPC batches. A single failed read fails the whole call, so the caller never works with half an answer. */
export async function readMany(c:ChainConfig,reads:ContractRead[],blockNumber:bigint):Promise<unknown[]>{
 const client=chainClient(c);
 let on=multicallOn.get(c.rpc);
 if(on===undefined){const code=await client.getCode({address:MULTICALL3});on=!!code&&keccak256(code)===MULTICALL3_CODEHASH;multicallOn.set(c.rpc,on);}
 if(!on){const batched=chainClient(c,{batch:true});return Promise.all(reads.map(r=>batched.readContract({...r,blockNumber} as never)));}
 const out:unknown[]=[];
 for(let i=0;i<reads.length;i+=400)out.push(...await client.multicall({contracts:reads.slice(i,i+400) as never,allowFailure:false,multicallAddress:MULTICALL3,blockNumber,batchSize:0}) as unknown[]);
 return out;
}

/** Credits for a raw token amount (floor), and the raw amount paid out for credits (floor). */
export const creditsFor=(raw:bigint,c:ChainConfig)=>c.token?Number(raw*BigInt(c.creditsPerToken)/10n**BigInt(c.token.decimals)):0;
export const rawFor=(credits:number,c:ChainConfig)=>c.token?BigInt(credits)*10n**BigInt(c.token.decimals)/BigInt(c.creditsPerToken):0n;

/* ---------------------------------------------------------------- holder tiers
   Thresholds in whole HARVEX (user, 6 Oct 2026: 3M / 5M / 10M, "the threshold to be eligible is at least 3 million"). 3,000,000 is also the default
   holder reward unit. `slots` is an older draft for agent slots and is not applied anywhere. */
export const TIERS=[
 {id:'free',name:'Free',min:0n,feePermille:1000,mult:0,slots:10},
 {id:'holder',name:'Holder',min:3_000_000n,feePermille:700,mult:1,slots:25},
 {id:'builder',name:'Builder',min:5_000_000n,feePermille:500,mult:3,slots:50},
 {id:'studio',name:'Studio',min:10_000_000n,feePermille:300,mult:10,slots:0},
] as const;
export type Tier=typeof TIERS[number];
/** Tier for a raw HARVEX balance (18 decimals). */
export function tierFor(raw:bigint):Tier{const whole=raw/10n**18n;let t:Tier=TIERS[0];for(const x of TIERS)if(whole>=x.min)t=x;return t;}
export const tierById=(id:string|null|undefined)=>TIERS.find(t=>t.id===id)||TIERS[0];

/** What the browser may see: public RPC, addresses and rates. No server RPC URL, no admin token. */
export function publicChainConfig(){
 const c=chainConfig();
 return {network:c.network,chainId:c.id,name:c.name,rpc:c.publicRpc,explorer:c.explorer,token:c.token,treasury:c.treasury,creditsPerToken:c.creditsPerToken,
  confirmations:c.confirmations,finality:c.finality,topupEnabled:!!(c.token&&c.treasury),claimsEnabled:c.claimsEnabled,claimsContract:c.claimsContract,claimMin:c.claimMin,
  harvexToken:c.harvex,tiersLive:!!c.harvex,tierBase:c.tierBase,
  rewards:(r=>({live:r.live,token:r.token,contract:r.contract,harvexPerUnit:r.perUnitWhole.toString(),usdPerUnitHour:fromE8(r.rateE8),priceSource:r.priceFeed?'chainlink':'manual',priceFeed:r.priceFeed,periodHours:r.periodHours,nextClose:periodBounds(r.periodHours).nextClose}))(rewardConfig(c)),
  tiers:TIERS.map(t=>({id:t.id,name:t.name,min:t.min.toString(),feePermille:t.feePermille,credits:t.mult*c.tierBase,slots:t.slots}))};
}

/** Constant-time compare for the admin bearer token. */
export function adminAllowed(req:Request){
 const want=E().CLAIMS_ADMIN_TOKEN||'';const got=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(want.length<32||got.length!==want.length)return false;let d=0;for(let i=0;i<want.length;i++)d|=want.charCodeAt(i)^got.charCodeAt(i);return d===0;
}
