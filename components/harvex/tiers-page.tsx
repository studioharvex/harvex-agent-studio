'use client';
/* Public page of the holder tiers (/tiers): what each tier needs (HARVEX in the linked wallets) and what it gives on
   this server: monthly credits and higher limits (GET /api/tiers, lib/tiers.ts). It states what the server does today
   and promises no return. Its link preview comes from app/tiers/page.tsx and /api/og/page/tiers. */
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import {api,copyText,I} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import type {View} from '@/lib/routes';
import type {TierRow} from '@/lib/schedules';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;
const n=(v:number|string)=>Number(v).toLocaleString('en-US');

export function TiersPage({onNavigate}:{onNavigate:Go}){
 const [tiers,setTiers]=useState<TierRow[]|null>(null);const [state,setState]=useState<'loading'|'ready'|'off'>('loading');
 useEffect(()=>{let alive=true;api('/api/tiers').then(d=>{if(!alive)return;if(d.live){setTiers(d.tiers);setState('ready');}else setState('off');}).catch(()=>{if(alive)setState('off');});return()=>{alive=false;};},[]);
 const link=typeof location!=='undefined'?location.origin+'/tiers':'/tiers';
 const post=`https://x.com/intent/post?text=${encodeURIComponent('Harvex holder tiers: what a HARVEX balance adds in schedules, runs and channels for your agent')}&url=${encodeURIComponent(link)}`;
 return <>
  <section className="mx-auto grid max-w-[1120px] gap-10 px-[clamp(16px,3vw,32px)] pt-10 pb-16">
   <div className="grid gap-3">
    <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Harvex · Holder tiers</span>
    <h1 className="font-display text-[clamp(40px,7vw,84px)] leading-[.96] font-medium tracking-[-.05em]">What a HARVEX balance adds</h1>
    <p className="max-w-[62ch] text-[17px] leading-relaxed text-muted-foreground">Your tier comes from the HARVEX in the wallets linked to your account. Nothing is locked or staked: the tokens stay in your wallet, and the server reads the balance from the chain.</p>
   </div>
   {state==='off'?<p className="max-w-[60ch] rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Holder tiers are not running on this server: they start when the HARVEX token is set.</p>
   :<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(tiers||Array.from({length:4},()=>null)).map((t,i)=><div key={t?.id||i} className={cn('grid content-start gap-4 rounded-2xl border bg-card p-5',t?.id==='studio'&&'border-lime')}>
     <div className="grid gap-1"><b className="font-display text-2xl font-medium tracking-[-.03em]">{t?.name||' '}</b>
      <span className="font-mono text-[11.5px] text-muted-foreground">{t?(t.min==='0'?'no HARVEX needed':`${n(t.min)}+ HARVEX`):' '}</span></div>
     <ul className="grid gap-2 text-[14px]">{(t?[[n(t.schedules),'schedules'],[n(t.dailyRuns),'scheduled runs a day'],[n(t.channels),'delivery channels'],[t.monthlyCredits?n(t.monthlyCredits):'no','monthly credits']] as [string,string][]:[]).map(([v,l])=>
      <li key={l} className="flex items-baseline justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"><span className="text-muted-foreground">{l}</span><b className="font-display text-lg font-medium tabular-nums">{v}</b></li>)}</ul>
    </div>)}</div>}
   <div className="grid gap-6 md:grid-cols-3">
    {([['Read from the chain','The server adds up the HARVEX of every wallet linked to your account and checks again every few hours. Link a wallet on the Wallet & chain page.'],
      ['A tier only adds','The Free row is what every account gets. A tier raises the limits; it never makes a run cheaper and never takes anything from Free.'],
      ['If you move your HARVEX','Your tier follows the balance. Schedules and channels you already have stay, but you cannot add more than the new tier allows.']] as const).map(([h,t])=>
     <div key={h} className="grid content-start gap-1.5"><b className="text-[15px] font-semibold">{h}</b><p className="text-sm text-muted-foreground">{t}</p></div>)}
   </div>
   <div className="flex flex-wrap gap-2">
    <Button size="lg" onClick={()=>onNavigate('schedules')}>Open Schedules<I id="arrow"/></Button>
    <Button size="lg" variant="outline" onClick={()=>onNavigate('wallet')}><I id="wallet"/>Link a wallet</Button>
    <Button size="lg" variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
    <Button size="lg" variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
   </div>
   <p className="max-w-[80ch] text-[12.5px] text-muted-foreground">Tiers describe what this server does today and can change. Credits pay for runs and have no cash value. Holding a token is a risk of its own; nothing here is financial advice. The token, the holder rewards and what is not done yet are in the <button type="button" onClick={()=>onNavigate('paper','token')} className="underline underline-offset-4 hover:text-foreground">whitepaper</button>.</p>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
