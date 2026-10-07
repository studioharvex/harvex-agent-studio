'use client';
/* Holder rewards dashboard (/dashboard/rewards). Data from /api/rewards (lib/rewards.ts).
   Fixed rate: every complete block of REWARD_HARVEX_PER_UNIT (3,000,000) HARVEX held earns $0.01 of the reward token per hour, counted per second from the
   wallet's Transfer history (holder recorder), converted to that token at the live Chainlink price when each hourly period is
   built, and paid from an on-chain vault (a HarvexClaims instance) that the holder claims from with their own wallet.
   While the program is off (no HARVEX token, no reward token, no vault) the page shows the rule, a calculator and what is
   built. The reward token is whatever the server names (REWARD_TOKEN_SYMBOL); while it names none, the page uses the
   planned one (REWARD_PLAN in lib/site.ts: NVDA, a name without an address). */
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {Token} from '@/components/harvex/web3';
import {RewardEligibility} from '@/components/harvex/reward-eligibility';
import {REWARD_PLAN} from '@/lib/site';
import {toast} from 'sonner';
import {formatUnits} from 'viem';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {api,I} from '@/app/ui';
import {cn} from '@/lib/utils';
import {ToneIcon} from '@/components/harvex/navbar';
import {useHarvexToken} from '@/components/harvex/token-context';
import {discoverWallets,type WalletInfo} from '@/lib/auth-client';
import {claimOnchain,fetchChain,type ChainInfo} from '@/lib/chain-client';
import {DashPage,Kpi,KpiRow,PageHeader,StatusBadge} from './parts';

type Token={address:string;symbol:string;decimals:number};
type Overview={signedIn:boolean;live:boolean;harvex:string|null;token:Token|null;contract:string|null;explorer:string;excluded:number;
 harvexPerUnit:string;usdPerUnitHour:string;periodHours:number;nextClose:number;lastClose:number;
 price:{usd:string;set:string;stale:boolean;source:'chainlink'|'manual'}|null;priceMaxAgeHours:number;
 recorder:{lastBlock:number;lastTs:number;updated:string;holders:number;earners:number}|null;
 totals:{funded:string;allocated:string;allocatedUsd:string;periods:number;units:string;hourlyUsd:string;hourlyTokens:string}|null;
 vault:{balance:string;owed:string;status:'funded'|'low'|'short'}|null;
 fundings:{tx:string;amount:string;ts:number;note:string|null;period:number|null}[];
 periods:{id:number;label:string;start:number;end:number;usd:string|null;price:string|null;distributed:string;eligible:number;status:string;tx:string|null}[];
 mine:null|{wallets:{address:string;balance:string;units:string;usdPerHour:string;since:number|null;excluded:boolean;accruedUsd:string;accruedTokens:string}[];
  allocations:{period:number;label:string;end:number;address:string;amount:string;usd:string|null;units:number|null;balance:string;boost?:number|null}[];
  claims:{address:string;cumulative:string;proof:string[];claimed:string|null}[];period:number|null;attested:boolean;country:string|null;accruedSince:number|null;accruedUntil:number|null}};

const short=(a:string)=>`${a.slice(0,6)}…${a.slice(-4)}`;
const amount=(raw:string|bigint,dec=18,max=4)=>Number(formatUnits(BigInt(raw),dec)).toLocaleString('en-US',{maximumFractionDigits:max});
const num=(v:string)=>{const n=Number(String(v).replace(/[, _]/g,''));return Number.isFinite(n)&&n>=0?n:0;};
const fmt=(n:number,d=2)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
const usd=(v:string|number|null|undefined,d=4)=>`$${fmt(Number(v??0),d)}`;
const when=(ts:number)=>new Date(ts*1000).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const closeLabel=(ts:number)=>new Date(ts*1000).toLocaleString(undefined,{weekday:'short',hour:'2-digit',minute:'2-digit'});
const walletError=(e:any)=>e?.code===4001?'The request was cancelled in your wallet.':(e?.shortMessage||e?.message||'Your wallet did not complete the request.');
const perText=(d:Overview|null)=>Number(d?.harvexPerUnit||3_000_000).toLocaleString('en-US');
/** What the page calls the reward token while the server names none: the planned one. */
const NO_TOKEN=REWARD_PLAN.symbol;
/** "every 3,000,000 HARVEX = $0.01 of USDT per hour" from the live settings. */
const ruleText=(d:Overview|null,sym=NO_TOKEN)=>`every ${perText(d)} HARVEX = $${d?.usdPerUnitHour||'0.01'} of ${sym} per hour`;

export function RewardsPage({wallet,auth,onSignIn,onPaper}:{wallet?:string;auth:boolean;onSignIn:()=>void;onPaper:()=>void}){
 const [data,setData]=useState<Overview|null>(null);const [cfg,setCfg]=useState<ChainInfo|null>(null);const [error,setError]=useState('');
 const [wallets,setWallets]=useState<WalletInfo[]>([]);const [busy,setBusy]=useState('');
 const load=useCallback(async()=>{try{const [d,c]=await Promise.all([api('/api/rewards') as Promise<Overview>,fetchChain().catch(()=>null)]);setData(d);setCfg(c);setError('');}catch(e:any){setError(e.message||'The rewards data did not load.');}},[]);
 useEffect(()=>{load();},[load,auth]);
 useEffect(()=>discoverWallets(setWallets),[]);
 const sym=data?.token?.symbol||NO_TOKEN;const dec=data?.token?.decimals??18;
 // token and program state as this server knows them: the layout's answer until /api/rewards has loaded (no flash of
 // "not paying" on a live program), then the API's (a testnet token counts there)
 const token=useHarvexToken();const hasToken=data?!!data.harvex:!!token;const live=data?data.live:!!token?.rewardsLive;

 async function claim(c:{address:string;cumulative:string;proof:string[]}){
  if(busy||!cfg||!data?.contract)return;const w=wallets[0];if(!w){toast.error('A claim needs a wallet. Open this page in a browser that has one.');return;}
  setBusy(c.address);try{const h=await claimOnchain(w.provider,cfg,c,data.contract);toast.success('Claim sent',{description:short(h)});setTimeout(load,4000);}catch(e){toast.error(walletError(e));}finally{setBusy('');}
 }

 return <DashPage>
  <PageHeader icon="coins" tone="lime" title="Holder rewards" text={`The rule for HARVEX kept in your own wallet: ${ruleText(data,sym)}, counted second by second. Payment is in ${sym} at the current price, and holders claim it themselves from an on-chain vault.`}
   actions={<><StatusBadge kind={live?'live':'pending'}>{live?'Live':hasToken?'Planned · not switched on':'Planned · no token yet'}</StatusBadge><Button variant="outline" onClick={onPaper}><I id="doc"/>How it works</Button></>}/>

  {!live&&<div className="flex flex-wrap items-start gap-3 rounded-xl border bg-t-amber p-4 text-[13.5px]">
   <ToneIcon icon="shield" tone="amber" className="size-8"/>
   <div className="grid flex-1 gap-1"><b className="font-semibold">{hasToken?'Holder rewards are switched off. No one is paid and no claim can be made.':'Holder rewards are a plan. No payment happens before a HARVEX token and a reward vault exist.'}</b><span className="text-muted-foreground">How it is designed: HARVEX that stays in your own wallet earns at a fixed rate. Payment is a token on BNB Smart Chain, kept in an on-chain vault that you claim from yourself. The reward is planned as {REWARD_PLAN.symbol}, {REWARD_PLAN.what}; which issuer's token, the vault and a start date have not been decided. The contract has had no audit and no legal review has been published. Every number here shows the rule this server would use and is not a promise.</span></div>
  </div>}

  <RewardEligibility per={Number(data?.harvexPerUnit||3_000_000)} rate={data?.usdPerUnitHour||'0.01'} sym={sym}/>

  <Pipeline data={data} live={live} hasToken={hasToken}/>

  {live&&data&&<>
   <KpiRow>
    <Kpi label="Reward rate" value={`$${data.usdPerUnitHour}/h`} hint={`per ${perText(data)} HARVEX`} tone="lime" icon="coins"/>
    <Kpi label={`${sym} price`} value={data.price?usd(data.price.usd,2):'—'} hint={!data.price?'No price yet, so rewards wait':data.price.stale?'Feed paused or market closed, so rewards wait':`${data.price.source==='chainlink'?'Chainlink live':'Set'} · ${when(Date.parse(data.price.set)/1000)}`} tone={!data.price||data.price.stale?'coral':'iris'} icon="clock"/>
    <Kpi label="Vault" value={data.vault?`${amount(data.vault.balance,dec,4)} ${sym}`:'—'} hint={!data.vault?'Cannot be read at the moment':data.vault.status==='short'?'Rewards wait for a refill':data.vault.status==='low'?'Low, under a day remains':`Funded · ${amount(data.vault.owed,dec,4)} owed`} tone={data.vault?.status==='funded'?'sky':'amber'} icon="shield"/>
    <Kpi label="Earning now" value={data.recorder?.earners??0} hint={`${usd(data.totals?.hourlyUsd,2)} per hour in total`} tone="amber" icon="users"/>
   </KpiRow>
   <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
    <Position data={data} auth={auth} onSignIn={onSignIn}/>
    <ClaimCard data={data} busy={busy} hasWallet={wallets.length>0} onClaim={claim} onAttested={load}/>
   </div>
   <MyAllocations data={data}/>
   <div className="grid items-start gap-4 xl:grid-cols-2">
    <Fundings data={data}/>
    <Periods data={data}/>
   </div>
  </>}

  {!live&&<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
   <Calculator perUnit={Number(data?.harvexPerUnit||3_000_000)} rate={Number(data?.usdPerUnitHour||0.01)} sym={sym}/>
   <div className="stagger grid gap-3">
    <section className="grid gap-3 rounded-xl border bg-card p-4">
     <b className="text-sm font-semibold">Your wallet</b>
     {wallet?<><div className="flex items-center gap-2 rounded-lg border bg-secondary/50 p-3 font-mono text-[12px]"><I id="wallet" className="i size-4"/>{short(wallet)}</div><p className="text-[13px] text-muted-foreground">This is the wallet you signed in with. If the program is switched on, your HARVEX, reward units, hourly rate and accrued amount appear here together with a Claim button.</p></>
      :<><p className="text-[13px] text-muted-foreground">{auth?'A wallet linked on the Wallet page is the one that gets counted if the program is switched on.':'You can sign in with a wallet ahead of time. The signature costs nothing and no transaction is sent.'}</p>{!auth&&<Button variant="outline" onClick={onSignIn}><I id="wallet"/>Sign in with wallet</Button>}</>}
    </section>
    <Rules data={data} sym={sym}/>
   </div>
  </div>}
  {error&&<p className="text-xs text-muted-foreground">{error}</p>}
 </DashPage>;
}

function Rules({data,sym}:{data:Overview|null;sym:string}){
 const per=Number(data?.harvexPerUnit||3_000_000);const rate=data?.usdPerUnitHour||'0.01';
 return <section className="grid gap-2 rounded-xl border bg-t-sky p-4 text-[13px]">
  <b className="font-semibold">Rules in the program</b>
  {[`Only complete units of ${per.toLocaleString('en-US')} HARVEX count, each at $${rate} an hour: ${(per*2).toLocaleString('en-US')} makes 2×, ${(per*2-1).toLocaleString('en-US')} is still 1×`,
   'The transfer history of your wallet is read second by second, so HARVEX counts only while it is really in that wallet and never in two wallets together',
   `Payment is in ${sym}: its dollar value stays fixed, and the amount of ${sym} depends on the price when an hour is settled`,
   'Each hour is one period: its root goes on-chain without manual steps, and after that a claim is possible',
   'Wallets of the team, the treasury and liquidity earn nothing',
   'Refills, roots and claims can all be seen on-chain'].map(t=><span key={t} className="flex items-start gap-2 text-muted-foreground"><I id="check" className="i mt-0.5 size-3.5 shrink-0 text-foreground"/>{t}</span>)}
 </section>;
}

/** The four parts of the program and whether each is running. */
function Pipeline({data,live,hasToken}:{data:Overview|null;live:boolean;hasToken:boolean}){
 const rec=data?.recorder;
 const parts:[string,string,string,'lime'|'iris'|'coral'|'sky',ReactNode][]=[
  ['users','Holder recorder','Follows all HARVEX transfers and so knows the balance of each wallet at any second.','sky',rec?`${rec.holders} holders · block ${rec.lastBlock.toLocaleString('en-US')}`:hasToken?'Waiting for first sync':'Waiting for the HARVEX token'],
  ['layers','Reward calculator',`Hours held × units × $${data?.usdPerUnitHour||'0.01'}. Each hour is settled at the price of that moment.`,'iris',`${perText(data)} HARVEX = 1 unit · hourly`],
  ['shield','Reward vault','Keeps the reward token and pays out claims that match a public merkle root. What it owes never exceeds what it holds.','coral',data?.contract?<a className="underline underline-offset-2" href={`${data.explorer}/address/${data.contract}`} target="_blank" rel="noreferrer">{short(data.contract)}</a>:'HarvexClaims · not deployed, not audited'],
  ['coins','Harvex dashboard','This page: your units, what has accrued, the history and the button to claim.','lime',live?'Live':hasToken?'Not switched on yet':'Planned · waiting for token'],
 ];
 return <section className="grid overflow-hidden rounded-2xl border bg-card sm:grid-cols-2 xl:grid-cols-4">
  {parts.map(([ic,t,p,tone,state],k)=><div key={t} className={cn('grid content-start gap-2.5 p-4',k>0&&'border-t sm:border-t-0',k%2===1&&'sm:border-l',k>=2&&'sm:border-t xl:border-t-0',k>0&&'xl:border-l')}>
   <div className="flex items-center justify-between gap-2"><ToneIcon icon={ic} tone={tone}/><span className="font-mono text-[10px] text-muted-foreground">0{k+1}</span></div>
   <b className="text-[14.5px] font-semibold">{t}</b><p className="text-[12.5px] leading-relaxed text-muted-foreground">{p}</p>
   <span className={cn('mt-auto flex items-center gap-1.5 font-mono text-[10.5px] font-semibold tracking-[.04em] uppercase',live?'text-foreground':'text-muted-foreground')}>
    <i className={cn('size-1.5 rounded-full shape-round',live?'bg-lime':'bg-amber')}/>Built · {state}</span>
  </div>)}
 </section>;
}

function Position({data,auth,onSignIn}:{data:Overview;auth:boolean;onSignIn:()=>void}){
 const dec=data.token?.decimals??18;const sym=data.token?.symbol||NO_TOKEN;
 return <section className="grid content-start gap-4 rounded-2xl border bg-card p-6">
  <div className="flex items-center gap-3"><ToneIcon icon="wallet" tone="sky"/><b className="text-[15px] font-semibold">Your holding</b></div>
  {!auth||!data.mine?<><p className="text-[13px] text-muted-foreground">Your HARVEX, reward units and accrued amount are shown after you sign in with your wallet.</p><Button variant="outline" className="justify-self-start" onClick={onSignIn}><I id="wallet"/>Sign in with wallet</Button></>
   :data.mine.wallets.map(w=>{const units=Number(w.units);const state=w.excluded?'Excluded':units>0?'Earning':'Below minimum';
    return <div key={w.address} className="grid gap-2.5 rounded-lg border p-3">
     <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[12px]">{short(w.address)}</span><StatusBadge kind={state==='Earning'?'live':'archived'}>{state}</StatusBadge></div>
     <b className="font-display text-xl font-medium tabular-nums">{amount(w.balance,18,2)} <Token symbol="HARVEX" className="text-sm text-muted-foreground"/></b>
     <div className="grid grid-cols-3 overflow-hidden rounded-lg border text-center">
      {([['Units',String(units)],['Rate',`$${w.usdPerHour}/h`],['Accrued',usd(w.accruedUsd)]] as const).map(([l,v],k)=><div key={l} className={cn('grid gap-0.5 p-2.5',k&&'border-l',k===2&&'bg-t-mint')}><span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">{l}</span><b className="font-display text-lg font-medium tabular-nums">{v}</b></div>)}
     </div>
     <span className="text-xs text-muted-foreground">{w.excluded?'A team, treasury or liquidity wallet earns nothing.':Number(w.accruedUsd)>0||units>0?`≈ ${amount(w.accruedTokens,dec,6)} ${sym} has accrued since ${data.mine!.accruedSince?when(data.mine!.accruedSince):'the start'}. Settlement is at ${closeLabel(data.nextClose)}, and you can claim after the root of that hour is on-chain.`:`Earning starts at ${perText(data)} HARVEX in the wallet.`}</span>
    </div>;})}
 </section>;
}

const COUNTRIES:[string,string][]=[['ID','Indonesia'],['SG','Singapore'],['MY','Malaysia'],['PH','Philippines'],['TH','Thailand'],['VN','Vietnam'],['IN','India'],['JP','Japan'],['KR','South Korea'],['AU','Australia'],['AE','United Arab Emirates'],['DE','Germany'],['FR','France'],['NL','Netherlands'],['ES','Spain'],['IT','Italy'],['BR','Brazil'],['MX','Mexico'],['NG','Nigeria'],['TR','Turkey'],['US','United States'],['CA','Canada'],['GB','United Kingdom'],['CH','Switzerland'],['RU','Russia'],['UA','Ukraine']];

/** Self-certification before the first claim (the server refuses the countries in BLOCKED_COUNTRIES, lib/rewards.ts). */
function Attest({onDone}:{onDone:()=>void}){
 const [country,setCountry]=useState('');const [ok,setOk]=useState(false);const [busy,setBusy]=useState(false);
 async function send(){setBusy(true);try{await api('/api/rewards',{method:'POST',body:JSON.stringify({action:'attest',country,confirm:ok})});toast.success('Recorded. Claiming is open for you now.');onDone();}catch(e:any){toast.error(e.message);}finally{setBusy(false);}}
 return <div className="grid gap-2.5 rounded-lg border bg-t-amber p-3 text-[12.5px]">
  <b className="text-[13px] text-foreground">Confirm you can receive holder rewards</b>
  <label className="grid gap-1"><span className="text-muted-foreground">Country of residence</span>
   <select aria-label="Country of residence" value={country} onChange={e=>setCountry(e.target.value)} className="h-9 rounded-full border bg-card px-2 text-[13px]"><option value="">Choose…</option>{COUNTRIES.map(([c,n])=><option key={c} value={c}>{n}</option>)}<option value="XX">Other</option></select></label>
  <label className="flex items-start gap-2"><input type="checkbox" aria-label="I confirm the eligibility statement" checked={ok} onChange={e=>setOk(e.target.checked)} className="mt-0.5 size-4 accent-[var(--lime)]"/>
   <span className="text-muted-foreground">I am not a US person, and I do not live in the US, Canada, the UK, Switzerland or a sanctioned country. I am allowed to receive this token where I live.</span></label>
  <Button size="sm" className="justify-self-start" disabled={!country||!ok||busy} onClick={send}>{busy?'Saving…':'Confirm'}</Button>
 </div>;
}

function ClaimCard({data,busy,hasWallet,onClaim,onAttested}:{data:Overview;busy:string;hasWallet:boolean;onClaim:(c:{address:string;cumulative:string;proof:string[]})=>void;onAttested:()=>void}){
 const dec=data.token?.decimals??18;const sym=data.token?.symbol||NO_TOKEN;const claims=data.mine?.claims||[];const price=Number(data.price?.usd||0);
 return <section className="grid content-start gap-4 rounded-2xl border bg-card p-6">
  <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><ToneIcon icon="coins" tone="lime"/><b className="text-[15px] font-semibold">Claim</b></div>{data.mine?.period&&<StatusBadge kind="live">Period {data.mine.period}</StatusBadge>}</div>
  {claims.length>0&&data.mine&&!data.mine.attested&&<Attest onDone={onAttested}/>}
  {!claims.length?<p className="rounded-lg border border-dashed p-3 text-[13px] text-muted-foreground">There is nothing to claim at the moment. An accrued amount can be claimed after its hour has been settled and the root for it is on-chain.</p>
   :claims.map(c=>{const left=BigInt(c.cumulative)-BigInt(c.claimed??'0');const leftTokens=Number(formatUnits(left>0n?left:0n,dec));
    return <div key={c.address} className="grid gap-2 rounded-lg border p-3">
     <div className="flex items-baseline justify-between gap-2"><b className="font-display text-2xl font-medium tabular-nums">{amount(left>0n?left:0n,dec,6)} <span className="text-sm text-muted-foreground">{sym}</span></b><span className="font-mono text-[11px] text-muted-foreground">{short(c.address)}</span></div>
     <span className="text-xs text-muted-foreground">{price>0&&left>0n?`≈ ${usd(leftTokens*price)} at today's price · `:''}Total earned {amount(c.cumulative,dec,6)} · claimed {c.claimed===null?'unknown':amount(c.claimed,dec,6)}</span>
     {/* a period with a single eligible holder has an empty (and valid) proof, so readiness is the statement, not the proof length */}
     <Button disabled={left<=0n||!!busy||!hasWallet||!data.mine?.attested} onClick={()=>onClaim(c)}>{busy===c.address?'Check your wallet…':left>0n?`Claim ${amount(left,dec,6)} ${sym}`:'All claimed'}</Button>
    </div>;})}
  {claims.length>0&&!hasWallet&&<p className="text-xs text-muted-foreground">To claim, open this page where your wallet is: a browser with the extension, or the browser inside the wallet app.</p>}
  <p className="text-[11.5px] text-muted-foreground">The claim is a transaction from your own wallet, with a small gas fee on BNB Smart Chain. Your key is never in the hands of Harvex.</p>
 </section>;
}

function MyAllocations({data}:{data:Overview}){
 const rows=data.mine?.allocations||[];if(!data.mine)return null;const dec=data.token?.decimals??18;
 return <section className="grid gap-3">
  <h2 className="font-display text-xl font-medium tracking-[-.02em]">Your settled hours</h2>
  {!rows.length?<p className="rounded-xl border border-dashed p-4 text-[13px] text-muted-foreground">No hour has been settled for you yet. With {perText(data)} HARVEX in a wallet, every hour that closes puts your share on this list.</p>
   :<div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Ended</TableHead><TableHead>Wallet</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">USD</TableHead><TableHead className="text-right">{data.token?.symbol||NO_TOKEN}</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map(r=><TableRow key={r.period+r.address}><TableCell>{r.label}</TableCell><TableCell>{when(r.end)}</TableCell><TableCell className="font-mono text-xs">{short(r.address)}</TableCell><TableCell className="text-right tabular-nums">{r.units??'—'}{r.boost&&r.boost>100?<span title="Referral boost: friends you invited kept a reward unit for the whole of this period" className="ml-1.5 rounded-full bg-lime/20 px-1.5 py-px font-mono text-[10px] font-semibold">×{(r.boost/100).toFixed(1)}</span>:null}</TableCell><TableCell className="text-right tabular-nums">{r.usd?usd(r.usd):'—'}</TableCell><TableCell className="text-right font-semibold tabular-nums">{amount(r.amount,dec,6)}</TableCell></TableRow>)}</TableBody></Table></div>}
 </section>;
}

/** At most five rows of a list, with a small switch to see the rest. */
function useFirst<T>(rows:T[],n=5){
 const [all,setAll]=useState(false);
 const more=rows.length>n?<button type="button" onClick={()=>setAll(a=>!a)} className="justify-self-start font-mono text-[11px] tracking-[.04em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{all?'Show fewer':`Show all ${rows.length}`}</button>:null;
 return {shown:all?rows:rows.slice(0,n),more};
}
const clock=(ts:number)=>new Date(ts*1000).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:false});
const dayShort=(ts:number)=>new Date(ts*1000).toLocaleDateString(undefined,{day:'numeric',month:'short'});
/** Money with exactly two decimals, so a column lines up. */
const usd2=(v:string|number)=>`$${Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fixed=(raw:string|bigint,dec:number,digits:number)=>Number(formatUnits(BigInt(raw),dec)).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});

function Fundings({data}:{data:Overview}){
 const dec=data.token?.decimals??18,sym=data.token?.symbol||NO_TOKEN;const {shown,more}=useFirst(data.fundings);
 const total=data.totals?.funded&&data.totals.funded!=='0'?data.totals.funded:null;const price=Number(data.price?.usd||0);
 return <section className="grid content-start gap-3">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-xl font-medium tracking-[-.02em]">Vault refills</h2>
   {total&&<span className="text-[12.5px] text-muted-foreground tabular-nums">{fixed(total,dec,4)} {sym} in {data.fundings.length} {data.fundings.length===1?'refill':'refills'}</span>}</div>
  {!data.fundings.length?<p className="rounded-xl border border-dashed p-4 text-[13px] text-muted-foreground">The chain shows no refill so far.</p>
   :<div className="overflow-hidden rounded-xl border"><Table className="table-fixed"><TableHeader><TableRow><TableHead className="w-[38%]">Date</TableHead><TableHead className="text-right">{sym}</TableHead><TableHead className="w-[26%] text-right">Proof</TableHead></TableRow></TableHeader>
    <TableBody>{shown.map(f=><TableRow key={f.tx+f.ts+f.amount}><TableCell><span className="grid"><span>{dayShort(f.ts)}</span><span className="text-[11px] text-muted-foreground tabular-nums">{clock(f.ts)}</span></span></TableCell>
     <TableCell className="text-right"><span className="grid"><span className="font-medium tabular-nums">{fixed(f.amount,dec,4)}</span>{price>0&&<span className="text-[11px] text-muted-foreground tabular-nums">about {usd2(Number(formatUnits(BigInt(f.amount),dec))*price)}</span>}</span></TableCell>
     <TableCell className="text-right"><a className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground" href={`${data.explorer}/tx/${f.tx}`} target="_blank" rel="noreferrer noopener">tx ↗</a></TableCell></TableRow>)}</TableBody></Table></div>}
  {more}
 </section>;
}

function Periods({data}:{data:Overview}){
 const dec=data.token?.decimals??18,sym=data.token?.symbol||NO_TOKEN;const {shown,more}=useFirst(data.periods);
 return <section className="grid content-start gap-3">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-xl font-medium tracking-[-.02em]">Settled periods</h2>
   {data.price&&<span className="text-[12.5px] text-muted-foreground tabular-nums">{sym} at {usd2(data.price.usd)}</span>}</div>
  {!data.periods.length?<p className="rounded-xl border border-dashed p-4 text-[13px] text-muted-foreground">No periods yet.</p>
   :<div className="overflow-hidden rounded-xl border"><Table className="table-fixed"><TableHeader><TableRow><TableHead className="w-[38%]">Period</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="w-[26%] text-right">Status</TableHead></TableRow></TableHeader>
    <TableBody>{shown.map(p=><TableRow key={p.id}><TableCell><span className="grid"><span className="tabular-nums">{dayShort(p.end)}, {clock(p.start)} – {clock(p.end)}</span><span className="text-[11px] text-muted-foreground">{p.eligible} {p.eligible===1?'holder':'holders'}</span></span></TableCell>
     <TableCell className="text-right"><span className="grid"><span className="font-medium tabular-nums">{fixed(p.distributed,dec,6)} {sym}</span><span className="text-[11px] text-muted-foreground tabular-nums">{p.usd?usd2(p.usd):'—'}</span></span></TableCell>
     <TableCell className="text-right"><StatusBadge kind={p.status==='published'?'live':p.status==='built'?'pending':'private'}>{p.status==='superseded'?'included':p.status==='built'?'waiting for root':p.status}</StatusBadge></TableCell></TableRow>)}</TableBody></Table></div>}
  {more}
 </section>;
}

/** What a holding earns, on made-up inputs (the same rule as the server: complete units only). */
function Calculator({perUnit,rate,sym}:{perUnit:number;rate:number;sym:string}){
 const [hold,setHold]=useState('6000000');const [hours,setHours]=useState('24');const [price,setPrice]=useState('180');
 const units=Math.floor(num(hold)/perUnit);const h=num(hours);const p=num(price);
 const earned=units*rate*h;const tokens=p>0?earned/p:0;
 return <section className="grid gap-4 rounded-2xl border bg-card p-6">
  <div className="flex flex-wrap items-center justify-between gap-2"><div className="grid gap-0.5"><b className="text-[15px] font-semibold">Try the rule on a holding</b><span className="text-xs text-muted-foreground">The inputs are invented. This shows the rule and forecasts neither a price nor a return.</span></div><StatusBadge kind="sample">Sample</StatusBadge></div>
  <div className="grid gap-3 sm:grid-cols-3">
   {([['HARVEX held','HARVEX',hold,setHold],['Hours held','hours',hours,setHours],[`${sym} price`,'USD',price,setPrice]] as [string,string,string,(v:string)=>void][]).map(([l,u,v,set])=><label key={l} className="grid gap-1.5"><span className="text-[12.5px] font-medium text-muted-foreground">{l}</span><div className="flex items-center gap-2"><Input inputMode="decimal" value={v} onChange={e=>set(e.target.value)} className="h-10 tabular-nums"/><span className="w-10 font-mono text-[11px] text-muted-foreground">{u}</span></div></label>)}
  </div>
  <div className="grid grid-cols-3 overflow-hidden rounded-lg border">
   <div className={cn('grid gap-1 p-3',units>0?'bg-t-mint':'bg-t-coral')}><span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">Units</span><b className="font-display text-xl font-medium">{units}</b></div>
   <div className="grid gap-1 border-l p-3"><span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">Earned</span><b className="font-display text-xl font-medium tabular-nums">{usd(earned,4)}</b></div>
   <div className="grid gap-1 border-l p-3"><span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">≈ {sym}</span><b className="font-display text-xl font-medium tabular-nums">{fmt(tokens,6)}</b></div>
  </div>
  <p className="text-xs text-muted-foreground">{units>0?`${units} × $${rate} × ${fmt(h,2)} h = ${usd(earned,4)}, paid as ${fmt(tokens,6)} ${sym} at $${fmt(p,2)}.`:`Under ${perUnit.toLocaleString('en-US')} HARVEX there is no complete unit, so nothing accrues.`}</p>
 </section>;
}
