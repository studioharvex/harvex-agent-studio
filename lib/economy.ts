/* Credit economy: pricing rules, platform fee and ledger helpers.
   Credits are an internal unit. They have no monetary value in the preview. */
import {runtime} from './server';
import {tierById} from './chain';
import {DEFAULT_TRIAL_LIMIT,ANSWER_LANGUAGE,configMark} from './agents';
import {scoreOf} from './ratings';
import {searchesWeb,type ProviderConfig} from './provider';
export const SAMPLE_COST=5;            // workflow sample run, paid to the platform
const envInt=(name:string,fallback:number,max:number)=>{const raw=(runtime() as Record<string,unknown>)[name];const v=Number(raw);return typeof raw==='string'&&raw.trim()!==''&&Number.isFinite(v)?Math.min(Math.max(Math.round(v),0),max):fallback;};
/** Free credits granted once to a new account (STARTING_CREDITS, default 25 since 1 Oct 2026: two research runs or five
    to six lighter tasks). Every new wallet is a new account, so the real ceiling on the bill is AI_DAILY_RUNS. */
export function startingCredits(){return envInt('STARTING_CREDITS',25,100_000);}
/** Credits per live AI run by skill (client, 1 Oct 2026): priced by what the skill costs to run. Research pays for web
    searches, document and code read long inputs. LIVE_SKILL_COSTS overrides entries ("research=12,document=6"); the
    value "flat" charges LIVE_RUN_COST for every skill. */
export const DEFAULT_SKILL_COSTS:Record<string,number>={research:12,document:6,code:6,write:5,monitor:5,whales:5,summarize:4,translate:4,brainstorm:4,planner:4};
export function skillCosts():Record<string,number>{
 const raw=String((runtime() as {LIVE_SKILL_COSTS?:string}).LIVE_SKILL_COSTS??'').trim();
 if(raw==='flat')return {};
 const out={...DEFAULT_SKILL_COSTS};
 for(const part of raw.split(',')){const m=part.trim().match(/^([a-z]+)\s*=\s*(\d{1,3})$/);if(m&&m[1] in out)out[m[1]]=Math.min(Number(m[2]),500);}
 return out;
}
/** Credits for one live AI run on your own agent: the skill's price, else LIVE_RUN_COST (default 5, 0 = free). This is
    what keeps AI usage, and so the provider bill, inside what users have paid or were granted. */
export function liveRunCost(skill?:string){const own=skill!==undefined?skillCosts()[skill]:undefined;return own??envInt('LIVE_RUN_COST',5,500);}
/** Live AI runs for the whole studio per UTC day, scheduled runs included (AI_DAILY_RUNS, default 2000, at least 1):
    a hard ceiling on the provider bill whatever happens to balances. There is deliberately no "unlimited". */
export function aiDailyRuns(){return Math.max(1,envInt('AI_DAILY_RUNS',2000,1_000_000));}
/** Part of AI_DAILY_RUNS that accounts WITHOUT bought credits may use together (AI_DAILY_FREE_RUNS, default 70% of
    AI_DAILY_RUNS). Every new wallet is a free account, so without this a few hundred throwaway wallets could use up the
    whole studio's day and lock out the people who paid. Accounts holding bought credits only count against AI_DAILY_RUNS. */
export function aiDailyFreeRuns(){const all=aiDailyRuns();return Math.min(all,Math.max(1,envInt('AI_DAILY_FREE_RUNS',Math.floor(all*0.7),1_000_000)));}
/** Research runs per UTC day, for the whole studio, that may use the provider's web search (AI_DAILY_SEARCH_RUNS, default
    150, 0 = never). Web search is billed per query on top of the tokens (Google: 5,000 queries a month free on the paid
    tier, then $14 per 1,000; Oct 2026), so it gets its own ceiling: 150 runs a day stays about inside the free allowance.
    Past it the research skill still answers, without browsing and saying so. */
export function aiDailySearchRuns(){return envInt('AI_DAILY_SEARCH_RUNS',150,1_000_000);}
/** Whether accounts that hold no bought credits may use web search (AI_SEARCH_FREE_CREDITS, default true). With "false"
    only accounts holding bought credits browse, so the search bill only comes from people who paid in. */
export function searchForFreeCredits(){return String((runtime() as {AI_SEARCH_FREE_CREDITS?:string}).AI_SEARCH_FREE_CREDITS??'').trim().toLowerCase()!=='false';}
const searchKey=(created:string)=>`search:${created.slice(0,10)}`;
/** Takes one of today's web-search slots. One conditional statement, so parallel runs can never take more than the
    limit; false when the day's slots are used up. */
export async function takeSearchSlot(db:D1Database,created:string){
 const limit=aiDailySearchRuns();if(limit<=0)return false;
 const r=await db.prepare('INSERT INTO ai_quotas (key,used) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET used=used+1 WHERE used<?').bind(searchKey(created),limit).run();
 return !!r.meta.changes;
}
/** Gives a slot back when the run did not search after all (the provider refused the search, or failed unbilled). */
export const returnSearchSlot=(db:D1Database,created:string)=>db.prepare('UPDATE ai_quotas SET used=MAX(used-1,0) WHERE key=?').bind(searchKey(created)).run();
/** Manual live AI runs per account per UTC day (LIVE_DAILY_PER_USER, default 50, at least 1). */
export function liveDailyPerUser(){return Math.max(1,envInt('LIVE_DAILY_PER_USER',50,10_000));}
/** Free-credit refill (drizzle/0015): every FREE_REFILL_HOURS (default 24) the free part of the balance goes back up to
    FREE_REFILL_CREDITS (default 25, 0 = off). Bought credits are never touched and the free part never grows past it. */
export function freeRefill(){return {credits:envInt('FREE_REFILL_CREDITS',25,100_000),hours:Math.max(1,envInt('FREE_REFILL_HOURS',24,720))};}
/** Tops the free part up when the refill is due. Optimistic lock on `refilled`, so parallel requests refill once. */
export async function refillFree(db:D1Database,owner:string){
 const {credits,hours}=freeRefill();if(!credits)return 0;
 const w=await db.prepare('SELECT balance,paid,refilled FROM preview_wallets WHERE owner=?').bind(owner).first<{balance:number;paid:number;refilled:string|null}>();
 if(!w)return 0;const now=new Date();
 if(w.refilled&&now.getTime()-Date.parse(w.refilled)<hours*3600e3)return 0;
 // free credits held by runs still in flight come back if those runs fail: count them, so a refill can never be
 // stacked on top of them (the free part never grows past FREE_REFILL_CREDITS)
 const held=(await db.prepare("SELECT COALESCE(SUM(cost-COALESCE(paid_cost,0)),0) AS n FROM runs WHERE owner=? AND status='running'").bind(owner).first<{n:number}>())?.n??0;
 const add=Math.max(0,credits-(w.balance-w.paid)-held);
 const r=await db.prepare(`UPDATE preview_wallets SET balance=balance+?,refilled=? WHERE owner=? AND ${w.refilled?'refilled=?':'refilled IS NULL'}`)
  .bind(add,now.toISOString(),owner,...(w.refilled?[w.refilled]:[])).run();
 if(!r.meta.changes||!add)return 0;
 await ledgerRow(db,owner,add,'grant','Daily free credits').run();return add;
}
/** Next refill time (ISO) for the Studio screen, or null when refills are off. */
export async function nextRefill(db:D1Database,owner:string){
 const {credits,hours}=freeRefill();if(!credits)return null;
 const w=await db.prepare('SELECT refilled FROM preview_wallets WHERE owner=?').bind(owner).first<{refilled:string|null}>();
 return w?.refilled?new Date(Date.parse(w.refilled)+hours*3600e3).toISOString():null;
}
/** Heavy skills are limited per LIMIT_WINDOW_HOURS (default 5): FREE_HEAVY_PER_WINDOW (2) while the account holds no
    bought credits, PAID_HEAVY_PER_WINDOW (20) while it does. HEAVY_SKILLS defaults to research, document and code. */
export function heavyWindow(){
 const raw=String((runtime() as {HEAVY_SKILLS?:string}).HEAVY_SKILLS??'').trim();
 const skills=raw?raw.split(',').map(s=>s.trim()).filter(Boolean):['research','document','code'];
 return {hours:Math.max(1,envInt('LIMIT_WINDOW_HOURS',5,168)),free:Math.max(1,envInt('FREE_HEAVY_PER_WINDOW',2,10_000)),paid:Math.max(1,envInt('PAID_HEAVY_PER_WINDOW',20,10_000)),skills};
}
/** Window that contains `at` (fixed windows from the Unix epoch, UTC): its ai_quotas key and when it ends. */
export function heavyKey(owner:string,at:string){const ms=heavyWindow().hours*3600e3;const start=Math.floor(Date.parse(at)/ms)*ms;return {key:`h:${owner}:${start}`,resets:new Date(start+ms).toISOString()};}
/** Counter keys in ai_quotas (drizzle/0013) for a run created at `created` (ISO time, UTC day). */
export const quotaKeys=(owner:string,created:string)=>({user:`u:${owner}:${created.slice(0,10)}`,all:`all:${created.slice(0,10)}`,free:`free:${created.slice(0,10)}`});
/** Raises a daily counter inside a batch; at `limit` it writes -1 so the CHECK aborts the whole batch. */
export const quotaStep=(db:D1Database,key:string,limit:number)=>db.prepare('INSERT INTO ai_quotas (key,used) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET used=CASE WHEN used<? THEN used+1 ELSE -1 END').bind(key,limit);
/** Today's live AI use of one account and of the studio, for the Studio screen. */
export async function liveToday(db:D1Database,owner:string){
 const now=new Date().toISOString();const k=quotaKeys(owner,now);const sk=searchKey(now);
 const r=await db.prepare('SELECT key,used FROM ai_quotas WHERE key IN (?,?,?,?)').bind(k.user,k.all,k.free,sk).all<{key:string;used:number}>();
 const get=(key:string)=>r.results.find(x=>x.key===key)?.used??0;
 // heavy-skill window: tier from the bought credits the account holds right now
 const hw=heavyWindow(),h=heavyKey(owner,new Date().toISOString());
 const [hq,w]=await Promise.all([db.prepare('SELECT used FROM ai_quotas WHERE key=?').bind(h.key).first<{used:number}>(),db.prepare('SELECT paid FROM preview_wallets WHERE owner=?').bind(owner).first<{paid:number}>()]);
 const tier=(w?.paid??0)>0?'paid':'free';
 // web search for the research skill: connected at all, slots left today, and whether free credits may use it
 const sLimit=aiDailySearchRuns();
 return {used:get(k.user),limit:liveDailyPerUser(),studioFull:get(k.all)>=aiDailyRuns(),freeFull:tier==='free'&&get(k.free)>=aiDailyFreeRuns(),
  heavy:{skills:hw.skills,hours:hw.hours,tier,used:hq?.used??0,limit:tier==='paid'?hw.paid:hw.free,resets:h.resets,freeLimit:hw.free,paidLimit:hw.paid},
  search:{on:searchesWeb(runtime() as ProviderConfig)&&sLimit>0,left:Math.max(0,sLimit-get(sk)),freeCredits:searchForFreeCredits()}};
}
export const MAX_PRICE=500;            // max credits a creator may charge per run
export const MIN_PRICE=0;
/** Platform fee in basis points. 0 during beta; set PLATFORM_FEE_BPS=1000 for 10%. */
export function platformFeeBps(){const v=Number((runtime() as {PLATFORM_FEE_BPS?:string}).PLATFORM_FEE_BPS??'0');return Number.isFinite(v)?Math.min(Math.max(Math.round(v),0),5000):0;}
/** Tries per skill per user (SKILL_TRIAL_LIMIT, default 2, 0 = unlimited). */
export function skillTrialLimit(){const raw=(runtime() as {SKILL_TRIAL_LIMIT?:string}).SKILL_TRIAL_LIMIT;const v=Number(raw??DEFAULT_TRIAL_LIMIT);return raw!==undefined&&raw!==''&&Number.isFinite(v)?Math.min(Math.max(Math.round(v),0),1000):DEFAULT_TRIAL_LIMIT;}
/** Skill tries used by an owner, per skill. */
export async function trialsFor(db:D1Database,owner:string){
 const limit=skillTrialLimit();if(!limit)return {limit:0,used:{}};
 const r=await db.prepare('SELECT skill,used FROM skill_trials WHERE owner=?').bind(owner).all<{skill:string;used:number}>();
 return {limit,used:Object.fromEntries((r.results||[]).map(x=>[x.skill,x.used]))};
}
/** Split a creator price into creator share and platform fee (fee rounds down, creator gets the rest).
    `feePermille` is the creator's holder-tier multiplier on the fee (1000 = full fee, 700 = 30% off). */
export function split(price:number,feePermille=1000){const fee=Math.floor(price*platformFeeBps()*feePermille/10_000_000);return {fee,creator:price-fee};}
/** Fee multiplier from the creator's cached holder tier (refreshed by GET /api/tier, trusted for 24 hours). */
export async function tierFeePermille(db:D1Database,owner:string){
 try{const r=await db.prepare('SELECT tier,checked FROM tier_cache WHERE owner=?').bind(owner).first<{tier:string;checked:string}>();
  if(!r||Date.now()-Date.parse(r.checked)>864e5)return 1000;return tierById(r.tier).feePermille;}catch{return 1000;}
}
export type LedgerKind='grant'|'run'|'earning'|'fee'|'refund'|'topup'|'claim'|'allotment'|'quest'|'referral';
export function ledgerRow(db:D1Database,owner:string,delta:number,kind:LedgerKind,note:string,ref?:string,created=new Date().toISOString()){
 return db.prepare('INSERT INTO credit_ledger (id,owner,delta,kind,ref,note,created) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,delta,kind,ref??null,note,created);
}
/** Ensure a wallet exists and record the starting grant once. */
export async function ensureWallet(db:D1Database,owner:string){
 const grant=startingCredits();
 const r=await db.prepare('INSERT OR IGNORE INTO preview_wallets (owner,balance,earned) VALUES (?,?,0)').bind(owner,grant).run();
 if(r.meta.changes&&grant>0)await ledgerRow(db,owner,grant,'grant','Starting preview credits').run();
}
/** Public shape of a published agent: no instructions, no owner identity. */
export function publicAgent(row:{id:string;name:string;config:string;price:number;talk_price?:number|null;uses:number;published_at:string|null;owner:string;/** the creator's verified X handle (lib/creators.ts), when the query selected it */handle?:string|null;
 /** the last agent check and the helpful / not helpful marks of other accounts, when the query selected them */checked_at?:string|null;check_mark?:string|null;check_passed?:number|null;up?:number|null;down?:number|null;/** how often its sources changed, and how many it has (lib/knowledge.ts) */kb_rev?:number|null;sources?:number|null},viewer?:string){
 const c=JSON.parse(row.config);
 return {id:row.id,name:row.name,skin:c.skin,look:c.look,appearance:c.appearance,motion:c.motion,skills:c.skills,tone:c.tone,language:ANSWER_LANGUAGE,tagline:c.tagline||'',price:row.price,/* per chat message; the task price when the creator set none */talkPrice:row.talk_price??row.price,uses:row.uses,publishedAt:row.published_at,/* a handle is shown only when a reviewer confirmed it; otherwise an anonymous id */creator:row.handle?`@${row.handle}`:'creator-'+hash(row.owner),verified:!!row.handle,mine:viewer===row.owner,
  greeting:typeof c.greeting==='string'?c.greeting:'',starters:Array.isArray(c.starters)?c.starters.filter((s:unknown)=>typeof s==='string'&&s).slice(0,3):[],knows:!!c.knowledge||Number(row.sources||0)>0,/* how many sources its creator gave it to answer from; never their text */sources:Number(row.sources||0),
  // checked = it passed, and it still says and knows what was checked
  checked:row.checked_at&&row.check_passed&&row.check_mark===configMark(c,row.kb_rev)?row.checked_at:null,rating:scoreOf(Number(row.up||0),Number(row.down||0))};
}
function hash(s:string){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36).slice(0,6);}
