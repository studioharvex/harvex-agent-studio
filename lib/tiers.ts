/* Holder perks: the limits of an account grow with its holder tier (the HARVEX held by its linked wallets, lib/chain.ts
   TIERS). The Free tier keeps exactly the server's own limits (SCHEDULE_MAX, SCHEDULE_DAILY_RUNS, NOTIFY_MAX): a tier
   only ever adds. Scheduled runs still cost credits, so a higher limit lets an account do more, not do it for free.
   The tier is the cached one (tier_cache, also written by GET /api/tier). When it is older than six hours it is read
   again from the chain: balanceOf for every linked wallet at the latest block. If the chain cannot be read, the last
   known tier stands for up to a week, so an RPC outage does not take a holder's schedules away; without any record the
   account is Free. Off (everyone Free) until the token is set. */
import {chainClient,chainConfig,erc20Abi,TIERS,tierById,tierFor,type Tier} from './chain';
import {userWallets} from './wallets';

/** What each tier does to the server's limits: schedules and scheduled runs a day are multiplied, channels are added. */
export const PERKS:Record<Tier['id'],{schedules:number;runs:number;channels:number}>={
 free:{schedules:1,runs:1,channels:0},holder:{schedules:2,runs:2,channels:2},builder:{schedules:4,runs:4,channels:4},studio:{schedules:8,runs:8,channels:8}};
const FRESH_MS=6*3600e3,KEEP_MS=7*864e5,MAX_CHANNELS=20;
export type Base={schedules:number;dailyRuns:number;channels:number};
const apply=(t:Tier,b:Base)=>({schedules:b.schedules*PERKS[t.id].schedules,dailyRuns:b.dailyRuns*PERKS[t.id].runs,channels:Math.min(b.channels+PERKS[t.id].channels,Math.max(MAX_CHANNELS,b.channels))});

/** The account's tier, from the cache or (when that is stale) from the chain. Never throws. */
export async function tierOf(db:D1Database,owner:string):Promise<Tier>{
 const c=chainConfig();if(!c.harvex)return TIERS[0];
 const row=await db.prepare('SELECT tier,checked FROM tier_cache WHERE owner=?').bind(owner).first<{tier:string;checked:string}>().catch(()=>null);
 const age=row?Date.now()-Date.parse(row.checked):Infinity;
 if(row&&age<FRESH_MS)return tierById(row.tier);
 try{
  const wallets=await userWallets(db,owner);const client=chainClient(c);
  const bal=(await Promise.all(wallets.map(a=>client.readContract({address:c.harvex!,abi:erc20Abi,functionName:'balanceOf',args:[a]})))).reduce((a,v)=>a+v,0n);
  const t=tierFor(bal);
  await db.prepare('INSERT INTO tier_cache (owner,tier,balance,checked) VALUES (?,?,?,?) ON CONFLICT(owner) DO UPDATE SET tier=excluded.tier,balance=excluded.balance,checked=excluded.checked').bind(owner,t.id,bal.toString(),new Date().toISOString()).run();
  return t;
 }catch{return row&&age<KEEP_MS?tierById(row.tier):TIERS[0];}
}
/** The limits of this account: the server's own, raised by its tier. */
export async function limitsFor(db:D1Database,owner:string,base:Base){
 const t=await tierOf(db,owner);return {tier:t.id,tierName:t.name,...apply(t,base)};
}
/** Every tier's limits on this server, for the page (null while the token is not set: there are no tiers to show). */
export function perkTable(base:Base){
 if(!chainConfig().harvex)return null;
 return TIERS.map(t=>({id:t.id,name:t.name,min:t.min.toString(),...apply(t,base)}));
}
