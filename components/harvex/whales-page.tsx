'use client';
/* Public Whale watch page (/whales): the biggest HARVEX transfers of the last 24 hours and the biggest holders, from
   the server's own record of the token (GET /api/whales, lib/whales.ts). Public chain data only. It never says who
   owns an address or whether a transfer was a buy or a sell: the record does not know. Its link preview comes from
   app/whales/page.tsx and /api/og/whales. */
import {useEffect,useState} from 'react';
import {Chain,Token} from '@/components/harvex/web3';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import {api,copyText,I} from '@/app/ui';
import {Button} from '@/components/ui/button';
import type {View} from '@/lib/routes';
import type {Whales,WhaleMove} from '@/lib/whales';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;
const short=(a:string)=>`${a.slice(0,6)}…${a.slice(-4)}`;
const utc=(ts:number)=>new Date(ts*1000).toISOString().slice(0,16).replace('T',' ')+' UTC';
const ago=(ts:number)=>{const m=Math.max(0,Math.round((Date.now()/1000-ts)/60));return m<2?'just now':m<90?`${m} min ago`:m<2880?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} days ago`;};
const OFF_NOTE='Excluded from holder rewards: a team, treasury, pool or contract address';

function Addr({a,explorer,off}:{a:string;explorer:string;off?:boolean}){
 return <span className="inline-flex items-center gap-1.5"><a href={`${explorer}/address/${a}`} target="_blank" rel="noreferrer noopener" title={a} className="font-mono text-[12.5px] underline-offset-4 hover:underline">{short(a)}</a>
  {off&&<span title={OFF_NOTE} className="rounded-full border px-1.5 py-px font-mono text-[9.5px] tracking-[.06em] text-muted-foreground uppercase">no rewards</span>}</span>;
}
function Move({m,explorer}:{m:WhaleMove;explorer:string}){
 return <li className="grid gap-1 rounded-xl border bg-card p-3.5">
  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><b className="font-display text-[19px] font-medium tracking-[-.02em] tabular-nums">{m.amount} <Token symbol="HARVEX" className="text-[13px] font-normal text-muted-foreground"/></b>
   <a href={`${explorer}/tx/${m.tx}`} target="_blank" rel="noreferrer noopener" className="font-mono text-[11px] text-muted-foreground underline-offset-4 hover:underline">{utc(m.ts)} ↗</a></div>
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
   {m.kind==='mint'?<>minted to <Addr a={m.to} explorer={explorer} off={m.toOff}/></>:m.kind==='burn'?<>burned by <Addr a={m.from} explorer={explorer} off={m.fromOff}/></>
    :<><Addr a={m.from} explorer={explorer} off={m.fromOff}/><I id="arrow" className="i size-3.5"/><Addr a={m.to} explorer={explorer} off={m.toOff}/>{m.others&&<span className="text-[12px]">and others</span>}</>}
  </div>
 </li>;
}

export function WhalesPage({onNavigate}:{onNavigate:Go}){
 const [w,setW]=useState<Whales|null>(null);const [state,setState]=useState<'loading'|'ready'|'off'>('loading');
 useEffect(()=>{let alive=true;const load=()=>api('/api/whales').then(d=>{if(!alive)return;if(d.whales){setW(d.whales);setState('ready');}else setState('off');}).catch(()=>{if(alive)setState(s=>s==='ready'?s:'off');});
  load();const t=setInterval(load,120e3);return()=>{alive=false;clearInterval(t);};},[]);
 const link=typeof location!=='undefined'?location.origin+'/whales':'/whales';
 const post=`https://x.com/intent/post?text=${encodeURIComponent('Whale watch on Harvex: the largest HARVEX transfers and the top holders, read off the chain')}&url=${encodeURIComponent(link)}`;
 const head=<div className="grid gap-3">
  <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Harvex · <Chain name={w?.chain||'BNB Smart Chain'}/></span>
  <h1 className="font-display text-[clamp(40px,7vw,84px)] leading-[.96] font-medium tracking-[-.05em]">Whale watch</h1>
  <p className="max-w-[60ch] text-[17px] leading-relaxed text-muted-foreground">Which HARVEX transfers were the largest in the past 24 hours, and which addresses hold the most. All of it is taken from the token&apos;s Transfer events. You get no prices and no guessing about who stands behind an address.</p>
 </div>;

 if(state==='off')return <>
  <section className="mx-auto grid min-h-[calc(100svh-var(--top)-40px)] max-w-[1120px] content-center gap-6 px-[clamp(16px,3vw,32px)] py-16">{head}
   <p className="max-w-[60ch] rounded-xl border border-dashed p-4 text-sm text-muted-foreground">This server has no whale watch to show right now. The page depends on the HARVEX token and on the holder recorder: either one of them is switched off, or the recorder has not read the chain yet.</p>
   <div><Button variant="outline" onClick={()=>onNavigate('home')}>Go home</Button></div>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;

 const kpis:[string,string,string][]=w?[['Holders',w.holders.toLocaleString('en-US'),'addresses that hold any HARVEX'],['New holders, 24 h',w.newHolders.toLocaleString('en-US'),'got their first HARVEX and kept it'],
  ['Transactions, 24 h',w.day.txs.toLocaleString('en-US'),`HARVEX transfers touching ${w.day.wallets.toLocaleString('en-US')} addresses`],['Amount moved, 24 h',w.day.volumeShort,`${w.day.volume.split('.')[0]} HARVEX`]]:[];
 return <>
  <section className="mx-auto grid max-w-[1120px] gap-10 px-[clamp(16px,3vw,32px)] pt-10 pb-16">
   <div className="grid gap-5">{head}
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11.5px] text-muted-foreground">
     {w?<><span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full shape-round bg-lime"/>The record reaches block {w.asOf.block.toLocaleString('en-US')}</span><span>{utc(w.asOf.ts)} · {ago(w.asOf.ts)}</span>
      <a href={`${w.explorer}/token/${w.token}`} target="_blank" rel="noreferrer noopener" className="underline-offset-4 hover:underline">See the token in the explorer ↗</a></>:<span>Loading the record…</span>}
    </div>
   </div>

   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{(w?kpis:[['Holders','—',''],['New holders, 24 h','—',''],['Transactions, 24 h','—',''],['Amount moved, 24 h','—','']] as [string,string,string][]).map(([l,v,h])=>
    <div key={l} className="grid gap-1 rounded-xl border bg-card p-4"><span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">{l}</span>
     <b className="font-display text-[clamp(26px,3.4vw,38px)] leading-none font-medium tracking-[-.03em] tabular-nums">{v}</b><span className="text-[12px] text-muted-foreground">{h||' '}</span></div>)}</div>

   {w&&<div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
    <div className="grid gap-3">
     <h2 className="font-display text-2xl font-medium tracking-[-.03em]">Largest transfers <span className="text-muted-foreground">· past 24 hours</span></h2>
     {w.moves.length?<ul className="grid gap-2">{w.moves.map(m=><Move key={m.tx+m.from+m.to+m.amount} m={m} explorer={w.explorer}/>)}</ul>
      :<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">The record holds no HARVEX transfer for the 24 hours leading up to that block.</p>}
     <p className="text-xs text-muted-foreground">Each transaction gets a single line, running from the address the tokens started at to the address where they came to rest. An address that merely relayed them within the transaction, such as a router, is not listed, which keeps a swap from being counted twice.{w.day.capped?' The day was very busy, so only the 20,000 most recent transfers were read.':''}</p>
    </div>
    <div className="grid gap-3">
     <h2 className="font-display text-2xl font-medium tracking-[-.03em]">Largest holders</h2>
     <ol className="grid gap-px overflow-hidden rounded-xl border bg-border">{w.top.map((h,i)=><li key={h.address} className="relative grid grid-cols-[1.6rem_minmax(0,1fr)_auto] items-center gap-3 bg-card px-3.5 py-2.5">
      {h.share&&<span aria-hidden="true" className="absolute inset-y-0 left-0 bg-lime/10" style={{width:`${Math.min(100,parseFloat(h.share))}%`}}/>}
      <span className="relative font-mono text-[11px] text-muted-foreground tabular-nums">{i+1}</span>
      <span className="relative min-w-0"><Addr a={h.address} explorer={w.explorer} off={h.off}/></span>
      <span className="relative text-right"><b className="block text-[13.5px] font-medium tabular-nums">{h.amount.split('.')[0]}</b>{h.share&&<span className="font-mono text-[11px] text-muted-foreground tabular-nums">{h.share}</span>}</span>
     </li>)}</ol>
     {w.topShare&&<p className="text-[12.5px] text-muted-foreground">Together, these {w.top.length} addresses hold <b className="text-foreground">{w.topShare}</b> of all {w.supply?.split('.')[0]} HARVEX in supply. An address tagged &quot;no rewards&quot; is one the server excludes from holder rewards: a team, treasury, pool or contract address.</p>}
    </div>
   </div>}

   <div className="grid gap-4 rounded-2xl border bg-card p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
    <div className="grid gap-1.5"><b className="font-display text-xl font-medium tracking-[-.02em]">Have it written up for you</b>
     <p className="max-w-[62ch] text-sm text-muted-foreground">Equip an agent with the Whale watch skill, then schedule it. The agent writes up the moves and can deliver that report to a Discord channel or a Telegram chat of yours.</p></div>
    <div className="flex flex-wrap gap-2"><Button onClick={()=>onNavigate('studio')}>Open the Studio<I id="arrow"/></Button>
     <Button variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
     <Button variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button></div>
   </div>
   <p className="max-w-[80ch] text-[12.5px] text-muted-foreground">Source: the record this server keeps of the Transfer events of the HARVEX token on {w?.chain||'BNB Smart Chain'}. That record trails the chain by a few minutes, and the page reloads its numbers every two minutes. Do not read a transfer as a buy or a sell, or an address as a person. None of this is financial advice.</p>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
