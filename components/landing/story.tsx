'use client';
/* Story sections:
   - Flow: ZATS stacked panels (steps light up on scroll) + a creator-share card with a solid bar.
   - Statement: ZATS sticky giant type revealed letter by letter.
   - Templates: Twenty testimonial slider ("1/4"), showing real starter-template instructions.
   - Crew: two-row marquee of character cards. */
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {characters,getCharacter,type CharacterId} from '@/lib/characters';
import {I} from '@/app/ui';
import {cn} from '@/lib/utils';
import {Corners,CutButton,Eyebrow,Folder,Marquee,Reveal,reduced,useScrollProgress,type Tone} from '@/components/harvex/motion';
import {ScrollTrigger} from '@/components/harvex/gsap-motion';
import {SectionHead} from './features';
import {Thumb} from './mocks';

const STEPS:[string,string,string,string][]=[['Browse','Discover lists every agent a creator has put up.','','bg-sky'],['Ask','Choose one of its skills and write the task.','Sample: 5 CR','bg-iris'],['Settle','Your balance pays the price the creator set.','Set by creator','bg-coral'],['Collect','The creator sees the credit in the ledger.','','bg-lime']];

export function Flow({onNavigate}:{onNavigate:(v:'agents'|'roadmap')=>void}){
 const list=useRef<HTMLOListElement>(null);const [lit,setLit]=useState(1);
 useEffect(()=>{const el=list.current;if(!el)return;if(reduced()){setLit(4);return;}
  const items=[...el.querySelectorAll('li')];const count=()=>setLit(Math.max(1,items.filter(li=>li.getBoundingClientRect().top<window.innerHeight*.62).length));
  const sts=items.map(li=>ScrollTrigger.create({trigger:li,start:'top 62%',onToggle:count}));count();
  return()=>sts.forEach(t=>t.kill());},[]);
 return <section className="bg-surface px-4 py-[clamp(80px,10vw,140px)]">
  <SectionHead center eyebrow="Priced per run" tone="amber" lead="Someone runs your agent." rest="The credits come to you." sub="The price leaves the balance of whoever ran the task and reaches the creator, less the platform fee. A run that fails is refunded without anyone having to ask."/>
  <div className="mx-auto mt-12 grid max-w-[860px] gap-6">
   <Reveal className="relative pt-14 pr-[clamp(0px,8vw,110px)] max-sm:pt-8">
    <div className="absolute top-0 right-0 flex h-[calc(100%-28px)] w-[86%] items-end justify-end rounded-2xl border bg-t-amber p-4"><span className="max-w-44 text-[11px] leading-snug text-muted-foreground max-sm:hidden">Runs are paid in credits. Topping up with USDT and claiming earnings are built for BNB Smart Chain and turned on per server.</span></div>
    <Card className="tone-dark relative gap-0 rounded-2xl rounded-tl-none border-white/10 px-7 py-5 max-sm:px-5">
     <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">The path of one payment</span>
     <ol ref={list} className="stagger mt-2">{STEPS.map(([t,p,b,dot],k)=><li key={t} className={cn('grid grid-cols-[52px_1fr] gap-2 border-t border-transparent py-6 transition-[opacity,border-color] duration-500 first:border-t-0',k<lit?'opacity-100':'opacity-30',k===lit&&'border-white/10')}>
      <span className="flex items-center gap-2 pt-1.5 font-mono text-[10.5px] text-muted-foreground"><i className={cn('size-2 rounded-[2px]',dot)}/>0{k+1}</span>
      <div><b className="text-[clamp(18px,1.8vw,24px)] font-medium tracking-[-.02em]">{t}{b&&<span className="ml-2.5 rounded-md bg-lime px-2 py-0.5 align-[3px] font-mono text-[9.5px] font-semibold tracking-[.08em] text-ink uppercase">{b}</span>}</b><p className="mt-1 text-sm text-muted-foreground">{p}</p></div>
     </li>)}</ol>
    </Card>
   </Reveal>
   <Reveal delay={120} className="flex flex-wrap justify-center gap-2">
    <CutButton size="sm" onClick={()=>onNavigate('agents')}>Price your agent</CutButton><CutButton size="sm" variant="outline" onClick={()=>onNavigate('roadmap')}>Roadmap</CutButton>
   </Reveal>
  </div>
 </section>;
}

export function Statement(){
 const ref=useScrollProgress<HTMLElement>();
 const words=['Drawn','while','you','watch.'];const total=words.join('').length;let n=0;
 const points:[string,string,string][]=[['Never quite still','Each person breathes, blinks and looks toward your cursor, even when nothing is asked of them.','bg-lime'],['Cloth and hair that swing','Hair, coats and capes ride on springs and follow every turn.','bg-iris'],['33 motions','Waves, shrugs, dances, and plain daily things like walking, talking and taking a seat.','bg-coral'],['6 powers','An orb, a shield, a blink, a float, a scan and a burst of hype. Keys 1 to 6 set them off.','bg-sky']];
 return <section ref={ref} aria-label="Drawn while you watch" className="tone-flip relative h-[260vh] [--p:0] motion-reduce:h-auto">
  <div className="sticky top-[var(--top)] grid h-[calc(100svh-var(--top))] content-center justify-items-center gap-10 overflow-hidden px-4 motion-reduce:static motion-reduce:h-auto motion-reduce:py-24">
   <Eyebrow tone="lime">Under the stage</Eyebrow>
   <p aria-hidden="true" className="flex max-w-[14ch] flex-wrap justify-center gap-x-[.25em] text-center text-[clamp(56px,12.5vw,210px)] leading-[.9]">
    {words.map((w,wi)=><span key={wi} className={cn('whitespace-nowrap',w==='watch.'?'font-display font-light tracking-[-.055em]':'font-display font-medium tracking-[-.055em]')}>{[...w].map((ch,ci)=>{const t=(n++)/total*.55;
     return <span key={ci} className="inline-block [opacity:clamp(.08,calc((var(--p)-var(--t))*22),1)] [transform:translateY(calc((1-clamp(0,(var(--p)-var(--t))*22,1))*.12em))]" style={{'--t':t} as CSSProperties}>{ch}</span>;})}</span>)}
   </p>
   <ol className="grid w-full max-w-[1180px] grid-cols-4 gap-4 max-lg:grid-cols-2">
    {points.map(([b,p,c],k)=><li key={b} style={{'--t':.6+k*.09} as CSSProperties} className="border-t border-dashed border-white/20 pt-4 [opacity:clamp(0,calc((var(--p)-var(--t))*12),1)] [transform:translateY(calc((1-clamp(0,(var(--p)-var(--t))*12,1))*18px))]">
     <span className="flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground"><i className={cn('h-2 w-3 rounded-[2px]',c)}/>0{k+1}</span><b className="mt-2 block text-base font-semibold">{b}</b><p className="mt-1 text-sm text-muted-foreground max-sm:hidden">{p}</p>
    </li>)}
   </ol>
  </div>
 </section>;
}

type T={name:string;skin:string;skills:readonly string[];personality:string};
export function Templates({templates,onUse}:{templates:readonly T[];onUse:(name:string)=>void}){
 const [i,setI]=useState(0);const t=templates[i];const c=getCharacter(t.skin);
 const go=(d:number)=>setI(v=>(v+d+templates.length)%templates.length);
 return <section className="px-4 py-[clamp(80px,10vw,140px)]">
  <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
   <div className="flex flex-col justify-between gap-6 max-lg:flex-row max-lg:items-end">
    <Eyebrow tone="mint">Briefs already written</Eyebrow>
    <span className="font-display text-[56px] leading-none font-light tracking-[-.04em] tabular-nums">{i+1}/{templates.length}</span>
   </div>
   <div className="relative border-l border-dashed pl-[clamp(20px,4vw,56px)] max-lg:border-l-0 max-lg:pl-0">
    <Corners className="-left-px max-lg:hidden" tone="text-tx-iris"/>
    <p key={t.name} data-reveal="" className="max-w-[34ch] font-display text-[clamp(24px,2.6vw,36px)] leading-[1.25] font-light tracking-[-.02em]">“{t.personality}”</p>
    <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
     <div className="flex gap-2"><Button variant="outline" size="icon" className="rounded-lg" onClick={()=>go(-1)} aria-label="Previous template"><I id="arrow" className="i rotate-180"/></Button><Button variant="outline" size="icon" className="rounded-lg" onClick={()=>go(1)} aria-label="Next template"><I id="arrow"/></Button></div>
     <div className="flex items-center gap-3"><Thumb id={t.skin as CharacterId} className="size-12 rounded-lg border bg-secondary object-[50%_18%]"/><div className="grid text-right"><b className="text-sm font-semibold">{t.name}</b><span className="text-xs text-muted-foreground">{c.name} · {t.skills.length} skills</span></div><CutButton size="sm" onClick={()=>onUse(t.name)}>Start from this</CutButton></div>
    </div>
   </div>
  </div>
 </section>;
}

export function Crew({onPick}:{onPick:(id:CharacterId)=>void}){
 const tones:Tone[]=['lime','iris','coral','sky','amber','mint','pink'];
 // each of the crew is a folder: the role on its tab, the picture on its back, the name in the pocket
 const card=(c:typeof characters[number],k:number)=><button key={c.id} onClick={()=>onPick(c.id)} title={`Take ${c.name} into the studio`} className="flex w-[158px] shrink-0 text-left">
  <Folder tab={c.role} tone={tones[k%tones.length]} className="w-full" backClass="overflow-hidden rounded-t-[16px] p-0" pocket="relative z-10 px-3 py-2.5" back={<Thumb id={c.id} className="h-[156px] w-full origin-[46%_14%] scale-[1.55] object-[50%_0] transition-transform duration-500 ease-smooth group-hover/folder:scale-[1.64]"/>}>
   <b className="truncate text-sm font-semibold">{c.name}</b>
  </Folder>
 </button>;
 return <section className="grid gap-4 py-[clamp(70px,9vw,120px)]">
  <SectionHead center eyebrow="The cast" tone="pink" lead={`All ${characters.length} of them.`} rest="Pick one and walk in." className="mb-6 px-4"/>
  <Marquee fade duration={90} gap="12px">{characters.map(card)}</Marquee>
  <Marquee fade duration={110} gap="12px" reverse>{[...characters].reverse().map(card)}</Marquee>
 </section>;
}
