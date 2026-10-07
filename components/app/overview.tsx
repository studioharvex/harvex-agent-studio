'use client';
/* /dashboard: the signed-in home. Balance and activity KPIs, the holdings & allocation card, quick actions and the
   latest runs. Loaded on demand (code-split) from app/studio.tsx. */
import {Button} from '@/components/ui/button';
import {I} from '@/app/ui';
import {ToneIcon,type View} from '@/components/harvex/navbar';
import type {Run} from '@/lib/agents';
import {DashPage,EmptyState,Kpi,KpiRow,PageHeader,StatusBadge} from './parts';
import {HoldingsCard} from './holdings';

const short=(a:string)=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'';

export function Overview({auth,balance,earned,agents,published,runs,wallet,navigate,onSignIn,onNew}:{auth:boolean;balance:number|null;earned:number;agents:number;published:number;runs:Run[];wallet:string;navigate:(v:View)=>void;onSignIn:()=>void;onNew:()=>void}){
 if(!auth)return <DashPage><PageHeader icon="grid" tone="lime" title="Dashboard" text="Your agents, credits and HARVEX position in one place."/>
  <EmptyState title="Connect a wallet" text="Sign in with MetaMask, Trust Wallet or any EVM wallet to open your dashboard. Signing is free." action={<Button onClick={onSignIn}><I id="wallet"/>Connect wallet</Button>}/></DashPage>;
 const actions:[View,string,string,string,'lime'|'iris'|'coral'|'sky'][]=[
  ['studio','Build an agent','Pick a character, a persona and skills','cube','lime'],
  ['discover','Discover','Run agents other creators published','store','coral'],
  ['wallet','Wallet & chain','Link wallets, top up, claim','wallet','sky'],
  ['docs','Docs','How Harvex works','book','iris'],
 ];
 return <DashPage>
  <PageHeader icon="grid" tone="lime" title="Dashboard" text={wallet?`Signed in as ${short(wallet)} on BNB Smart Chain.`:'Your agents, credits and HARVEX position in one place.'}
   actions={<><Button variant="outline" onClick={()=>navigate('profile')}><I id="user"/>Profile</Button><Button onClick={onNew}><I id="plus"/>New agent</Button></>}/>
  <KpiRow>
   <Kpi label="Credits" value={balance??'—'} hint="Pay for runs" tone="lime" icon="coins"/>
   <Kpi label="Earned" value={earned} hint="From your published agents" tone="amber" icon="store"/>
   <Kpi label="Agents" value={agents} hint={`${published} published`} tone="iris" icon="users"/>
   <Kpi label="Runs" value={runs.length} hint="All time" tone="sky" icon="clock"/>
  </KpiRow>
  <HoldingsCard auth={auth} onWallet={()=>navigate('wallet')}/>
  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
   <section className="grid gap-3">
    <h2 className="font-display text-lg font-medium tracking-[-.02em]">Quick actions</h2>
    <div className="stagger grid gap-2.5 sm:grid-cols-2">{actions.map(([v,t,d,ic,tone])=><button key={v} onClick={()=>navigate(v)} className="lift flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/25">
     <ToneIcon icon={ic} tone={tone}/><span className="grid gap-0.5"><b className="text-sm font-semibold">{t}</b><span className="text-[12.5px] text-muted-foreground">{d}</span></span></button>)}</div>
   </section>
   <section className="grid gap-3">
    <div className="flex items-center justify-between"><h2 className="font-display text-lg font-medium tracking-[-.02em]">Latest runs</h2><Button size="sm" variant="ghost" onClick={()=>navigate('activity')}>View all<I id="arrow"/></Button></div>
    {runs.length?<ul className="grid gap-2">{runs.slice(0,5).map(r=><li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-[13px]">
     <span className="grid min-w-0"><b className="truncate font-medium">{r.agent_name}</b><span className="truncate text-xs text-muted-foreground">{r.prompt}</span></span>
     <span className="flex shrink-0 items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{r.status==='failed'?0:r.cost} CR</span><StatusBadge kind={r.status==='complete'?'complete':r.status==='failed'?'failed':'pending'}>{r.status}</StatusBadge></span></li>)}</ul>
    :<p className="rounded-xl border border-dashed p-4 text-[13px] text-muted-foreground">No runs yet. Build an agent and run a workflow sample from the Studio.</p>}
   </section>
  </div>
 </DashPage>;
}
