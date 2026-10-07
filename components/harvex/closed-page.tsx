'use client';
/* The page a visitor gets where a part of the product is not open yet (lib/gate.ts). It says plainly that the
   part is closed on purpose, what the part is, what IS open, and where to read about what comes next. It never
   says "error" and never promises a date. */
import {Button} from '@/components/ui/button';
import {I} from '@/app/ui';
import {Folder} from './motion';
import {SiteFooter} from './site-footer';
import type {Section} from '@/lib/gate';
import type {View} from '@/lib/routes';

type Go=(v:View,doc?:string)=>void;
const PART:Record<Section,{name:string;title:string;text:string;holds:string}>={
 app:{name:'The studio',title:'The studio is not open yet.',
  text:'Building, saving and running agents happens in here. This part is finished in stages and is closed to visitors for now, so there is nothing to sign up for today.',
  holds:'Studio, My agents, Discover, Skills, Schedules, History, Credits'},
 signin:{name:'Sign-in',title:'Sign-in is not open yet.',
  text:'Accounts are opened together with the studio. Until then nobody is asked to connect a wallet, and no wallet can be connected here.',
  holds:'Connecting a wallet, accounts'},
 community:{name:'The agent floor',title:'This floor opens with the first agents.',
  text:'These pages show the agents that creators have listed and what people do with them. They open once the studio does and the first agents are listed.',
  holds:'Plaza, Arena, This week, Recipes, Teams, Creators, agent pages'},
 chain:{name:'On-chain features',title:'On-chain features are not switched on.',
  text:'The HARVEX token, top-ups, holder tiers and holder rewards are plans. No token has launched and no contract is deployed, so these pages stay closed until there is something real to show.',
  holds:'Wallet & chain, Holder rewards, Holder tiers, Whale watch'},
};
const ORDER:Section[]=['app','signin','community','chain'];

export function ClosedPage({section,closed,path,onNavigate}:{section:Section;closed:readonly Section[];path:string;onNavigate:Go}){
 const p=PART[section];
 return <>
 <section className="mx-auto grid min-h-[min(680px,calc(100svh-var(--top)))] max-w-[1180px] content-center gap-[clamp(28px,5vw,72px)] px-[clamp(16px,3vw,32px)] py-[clamp(28px,6vw,80px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:items-center">
  <div className="grid gap-6">
   <span className="flex items-center gap-2.5 font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase"><i className="size-2 rounded-full shape-round bg-lime"/>Private preview · opening in stages</span>
   <h1 className="max-w-[16ch] font-display text-[clamp(36px,5.4vw,68px)] leading-[1.0] font-medium tracking-[-.045em]">{p.title}</h1>
   <p className="max-w-[52ch] text-[clamp(15.5px,1.2vw,17.5px)] leading-relaxed text-muted-foreground">{p.text}</p>
   <div className="flex flex-wrap gap-2">
    <Button size="lg" onClick={()=>onNavigate('docs')}><I id="book"/>Read the docs</Button>
    <Button size="lg" variant="outline" onClick={()=>onNavigate('roadmap')}><I id="map"/>See the roadmap</Button>
    <Button size="lg" variant="ghost" onClick={()=>onNavigate('home')}>Back to the home page</Button>
   </div>
   <p className="font-mono text-[11px] tracking-[.04em] text-muted-foreground">You asked for <span className="text-foreground">{path}</span>. Nothing is broken: this page is shown on purpose.</p>
  </div>
  <Folder tab="Where things stand" tone="lime" aside={<span className="grid size-7 place-items-center rounded-md bg-background/70 [&_svg]:size-3.5"><I id="shield"/></span>} pocket="gap-0 p-0">
   <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
    <span className="grid gap-0.5"><b className="text-[15px] font-semibold">Open now</b><span className="text-[13px] text-muted-foreground">Home, Docs, Whitepaper, Roadmap</span></span>
    <span className="rounded-md bg-lime px-2 py-1 font-mono text-[10px] leading-none font-semibold tracking-[.08em] text-ink uppercase">Open</span>
   </div>
   {ORDER.map(s=>{const shut=closed.includes(s);return <div key={s} className={'flex items-center justify-between gap-3 border-b px-5 py-4 last:border-0 '+(s===section?'bg-secondary':'')}>
    <span className="grid min-w-0 gap-0.5"><b className="text-[15px] font-semibold">{PART[s].name}</b><span className="text-[13px] text-muted-foreground">{PART[s].holds}</span></span>
    <span className={'shrink-0 rounded-md px-2 py-1 font-mono text-[10px] leading-none font-semibold tracking-[.08em] uppercase '+(shut?'bg-foreground text-background':'bg-lime text-ink')}>{shut?'Not yet':'Open'}</span>
   </div>;})}
  </Folder>
 </section>
 <SiteFooter onNavigate={onNavigate}/>
 </>;
}
