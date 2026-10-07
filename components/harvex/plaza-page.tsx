'use client';
/* The plaza (/plaza): the published agents, each on a card of the hero deck (a colour, its number and a tag, the
   character, its name). Pointing at one shows what it is about; a click brings it forward as the live 3D character with its chat (agent-talk.tsx), so a visitor can walk
   in, look over the cards and talk to whoever they pick.
   The agents are the published ones (GET /api/market, most used first, one per look, the first twelve), each drawn
   as its own character picture; the cards wrap. A card is a picture: no agent runs or
   is charged until a message is sent, and only the picked agent is rendered in 3D. /plaza?agent=<id> opens one. */
import {useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import Avatar,{useThumb} from '@/app/avatar';
import {api,copyText,I} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import {getCharacter,lookFor} from '@/lib/characters';
import type {MarketAgent} from '@/lib/agents';
import {agentPath,type View} from '@/lib/routes';
import {AgentTalk} from './agent-talk';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;
const MAX=12;
/** One agent per look: two agents that would stand there as the same figure read as a copy, so the more used one
    (the list comes most used first) takes the place and the other stays in Discover. */
function distinct(list:MarketAgent[]){const seen=new Set<string>();return list.filter(a=>{const k=JSON.stringify([a.skin,a.look??null,a.appearance??null]);if(seen.has(k))return false;seen.add(k);return true;});}

/** The colours of the hero deck (components/landing/hero.tsx), in the same order. */
const DECK=[['bg-lime','text-ink'],['bg-iris','text-white'],['bg-[#1a1a1a]','text-white'],['bg-coral','text-ink'],['bg-sky','text-ink'],['bg-amber','text-ink'],['bg-mint','text-ink']] as const;

/** One agent of the plaza, as a card of the deck: its number and a tag, the character, its name. */
function AgentCard({a,index,picked,dim,onPick,onPoint}:{a:MarketAgent;index:number;picked:boolean;dim:boolean;onPick:()=>void;onPoint:(on:boolean)=>void}){
 const src=useThumb(lookFor(a.skin,a.look,a.appearance),a.skin,true);const [bg,fg]=DECK[index%DECK.length];
 return <button type="button" onClick={onPick} onMouseEnter={()=>onPoint(true)} onMouseLeave={()=>onPoint(false)} onFocus={()=>onPoint(true)} onBlur={()=>onPoint(false)}
  aria-pressed={picked} aria-label={`Chat with ${a.name}`}
  className={cn('group relative flex aspect-[3/4] flex-col overflow-hidden rounded-xl p-4 text-left outline-none transition-[transform,opacity,filter,box-shadow] duration-300 hover:-translate-y-1 focus-visible:-translate-y-1',bg,fg,
   dim&&'opacity-45 saturate-[.6] hover:opacity-100 hover:saturate-100',picked&&'-translate-y-1 shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--foreground)]')}>
  <span className="relative z-10 flex items-center justify-between gap-2 font-mono text-[10.5px] font-semibold tracking-[.1em] uppercase">
   <span>#{String(index+1).padStart(2,'0')}</span>
   <span className="flex min-w-0 items-center gap-1 rounded-lg border border-current/25 px-2 py-0.5">{a.verified&&<I id="check" className="i size-3 shrink-0"/>}<span className="truncate">{a.verified?a.creator:getCharacter(a.skin).role}</span></span>
  </span>
  <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-x-0 top-[12%] mx-auto h-[70%] w-auto object-contain transition-transform duration-300 group-hover:scale-[1.04] group-focus-visible:scale-[1.04]"/>
  <span className="relative z-10 mt-auto line-clamp-2 max-w-[92%] font-display text-[clamp(17px,1.5vw,22px)] leading-[1.08] font-medium tracking-[-.03em] break-words">{a.name}</span>
 </button>;
}

export function PlazaPage({auth,onSignIn,onSpent,onNavigate}:{auth:boolean;onSignIn:()=>void;onSpent:()=>void;onNavigate:Go}){
 const [agents,setAgents]=useState<MarketAgent[]|null>(null);const [pick,setPick]=useState<string|null>(null);const [point,setPoint]=useState<string|null>(null);
 const [mood,setMood]=useState<'think'|'answer'|'idle'>('idle');const calm=useRef<ReturnType<typeof setTimeout>|null>(null);const panel=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{let alive=true;
  api('/api/market?q=').then(d=>{if(!alive)return;const list=distinct(d.agents as MarketAgent[]).slice(0,MAX);setAgents(list);
   try{const want=new URLSearchParams(location.search).get('agent');if(want&&list.some(a=>a.id===want))setPick(want);}catch{/* no link */}}).catch(()=>{if(alive)setAgents([]);});
  return()=>{alive=false;if(calm.current)clearTimeout(calm.current);};},[]);

 const chosen=agents?.find(a=>a.id===pick)||null;const shown=agents?.find(a=>a.id===(point||pick))||null;
 const choose=(a:MarketAgent)=>{setPick(a.id);setMood('idle');setTimeout(()=>panel.current?.scrollIntoView({behavior:'smooth',block:'nearest'}),60);};
 const onMood=(m:'think'|'answer'|'idle')=>{if(calm.current)clearTimeout(calm.current);setMood(m);if(m==='answer')calm.current=setTimeout(()=>setMood('idle'),3500);};
 const link=typeof location!=='undefined'?location.origin+'/plaza':'/plaza';
 const post=`https://x.com/intent/post?text=${encodeURIComponent('The plaza on Harvex: published AI agents on one page. Choose one and start a chat')}&url=${encodeURIComponent(link)}`;
 return <>
  <section className="mx-auto grid max-w-[1240px] gap-8 px-[clamp(16px,3vw,32px)] pt-10 pb-16">
   <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="grid gap-3">
     <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Harvex · Plaza</span>
     <h1 className="font-display text-[clamp(38px,6.4vw,76px)] leading-[.96] font-medium tracking-[-.05em]"><span className="text-muted-foreground">Look around.</span> Then start a chat.</h1>
    </div>
    <div className="flex flex-wrap gap-2">
     <Button variant="outline" onClick={()=>onNavigate('top')}>Most used this week</Button>
     <Button variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
     <Button variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
    </div>
   </div>

   <div className="grid gap-3">
    {agents===null&&<p className="grid h-48 place-items-center rounded-2xl border text-sm text-muted-foreground">Loading the plaza…</p>}
    {agents?.length===0&&<div className="grid place-content-center justify-items-center gap-3 rounded-2xl border px-6 py-16 text-center">
     <b className="font-display text-2xl font-medium tracking-[-.02em]">Nobody is here yet</b><p className="max-w-[44ch] text-sm text-muted-foreground">This server has no published agent so far. Publish yours and it gets a card on this page.</p>
     <Button onClick={()=>onNavigate('creators')}>Create a creator agent<I id="arrow"/></Button></div>}
    {!!agents?.length&&<div role="group" aria-label="Plaza agents" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
     {agents.map((a,i)=><AgentCard key={a.id} a={a} index={i} picked={pick===a.id} dim={!!pick&&pick!==a.id} onPick={()=>choose(a)} onPoint={on=>setPoint(p=>on?a.id:p===a.id?null:p)}/>)}
    </div>}
    {/* one quiet line: who you are pointing at, or how many are here */}
    <p className="flex min-h-5 flex-wrap items-baseline gap-x-2 text-[13.5px] text-muted-foreground" aria-live="polite">
     {shown?<><b className="font-medium text-foreground">{shown.name}</b>{shown.tagline&&<span>{shown.tagline}</span>}<span className="font-mono text-[11px]">· {shown.talkPrice===0?'creator charges nothing':`creator gets ${shown.talkPrice} CR`} per message</span></>
      :agents?.length?`${agents.length} agent${agents.length===1?'':'s'} on this page. Select a card to bring that agent up for a chat.`:''}</p>
   </div>

   {chosen&&<div ref={panel} className="grid scroll-mt-24 items-start gap-5 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
    <div className="grid gap-3">
     <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border bg-stage max-md:aspect-[4/3.4]">
      <Avatar key={chosen.id} skin={chosen.skin} appearance={chosen.appearance} look={chosen.look} animation={mood==='think'?'Think':mood==='answer'?'Nod':chosen.motion||'Idle'}/>
     </div>
     <div className="grid gap-1.5">
      <b className="font-display text-2xl font-medium tracking-[-.03em] break-words">{chosen.name}</b>
      {chosen.tagline&&<p className="text-[14.5px] text-muted-foreground">{chosen.tagline}</p>}
      <span className="font-mono text-[10.5px] tracking-[.06em] text-muted-foreground uppercase">By {chosen.mine?'you':chosen.creator}{chosen.verified?' · verified creator':''} · {chosen.uses} run{chosen.uses===1?'':'s'}</span>
      <div className="flex flex-wrap gap-2 pt-1"><Button size="sm" variant="outline" asChild><a href={agentPath(chosen.id)}>Agent page<I id="arrow"/></a></Button><Button size="sm" variant="ghost" onClick={()=>setPick(null)}>Return to the cards</Button></div>
     </div>
    </div>
    <AgentTalk key={chosen.id} agent={chosen} auth={auth} onSignIn={onSignIn} onSpent={onSpent} onMood={onMood}/>
   </div>}
   <p className="max-w-[80ch] text-[12.5px] text-muted-foreground">At most {MAX} published agents get a card here, ordered by how much they were used. If two agents share a look, only the one used more appears and the other stays in Discover, which means an agent with an outfit of its own always has a card. Browsing is free. No agent runs and no credits are spent until you send a message. Every agent is an AI character, and the instructions its creator wrote are never shown.</p>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
