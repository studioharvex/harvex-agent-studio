'use client';
/* Landing hero. The copy is centred on top; under it one wide, round stage in the brand colour with a character
   standing in the middle and four small cards floating around it (skills, roster, persona, price): the product at a
   glance instead of a deck beside the text. The character changes every few seconds (pictures of the default looks,
   cross-faded: the first screen is drawn without the 3D engine; on desktop the live character then takes the
   picture's place, see hero-live.tsx); the bar under it names the one on stage and opens it in the Studio. On phones the stage keeps the character and the bar, and the cards become one scrolling row below.
   Followed by the skills strip with crosshair corners. */
import {useEffect,useState,type ReactNode} from 'react';
import {characters,getCharacter,powers,type CharacterId} from '@/lib/characters';
import {openSkills} from '@/lib/agents';
import {I,SKILL_ICON} from '@/app/ui';
import {cn} from '@/lib/utils';
import {Corners,CutButton,Eyebrow,Folder,Marquee,Slab,reduced} from '@/components/harvex/motion';
import {Face,Thumb} from './mocks';
import {HeroLive} from './hero-live';
import {ContractPill} from '@/components/harvex/contract-pill';

/** Who stands on the stage, and the line the bar shows for each. */
const CAST:{id:CharacterId;line:string}[]=[
 {id:'atlas',line:`${characters.length} people, ready to be cast`},
 {id:'mira',line:'A brief it carries into every task'},
 {id:'scout',line:'Ten skills, four to a character'},
 {id:'nova',line:'Each garment recolored your way'},
 {id:'volt',line:'33 motions, 6 powers, one stage'},
 {id:'cole',line:'List it, name a price, get paid per run'},
 {id:'lumi',line:'Holder rewards on BNB Smart Chain: a plan, not live'},
];
const HOLD=3800,HOLD_LIVE=9000;       // a live character stays longer: it has a wave to finish and a moment to be looked at

/** A small folder on the stage. `float` is read by the motion runtime (a slow idle drift); .tone-light paints a
    background of its own, which the folder must not have behind its tab. */
type StageCardData={tab:string;aside?:ReactNode;body:ReactNode};
function StageCard({card,className}:{card:StageCardData;className?:string}){
 return <Folder tab={card.tab} aside={card.aside} fold="#fffbd6" pocket="gap-2.5 p-3.5" className={cn('tone-light bg-transparent! text-left drop-shadow-[0_18px_22px_rgb(0_0_0/.16)]',className)}>{card.body}</Folder>;
}

export function Hero({onNavigate,onPick}:{onNavigate:(v:'studio')=>void;onPick:(id:CharacterId)=>void}){
 const N=CAST.length;const [a,setA]=useState(0);const [paused,setPaused]=useState(false);
 const [live,setLive]=useState<CharacterId|null>(null);       // who stands on the stage in 3D right now (hero-live.tsx)
 useEffect(()=>{if(paused||reduced())return;const t=setTimeout(()=>setA(x=>(x+1)%N),live?HOLD_LIVE:HOLD);return()=>clearTimeout(t);},[paused,a,N,live]);
 const step=(d:number)=>setA(x=>(x+d+N)%N);
 const skills=openSkills();const now=getCharacter(CAST[a].id);
 const cards:Record<'skills'|'roster'|'persona'|'price',StageCardData>={
  skills:{tab:'Skills',aside:<span className="rounded-full bg-[var(--fold)] px-2 py-1 font-mono text-[9.5px] leading-none font-semibold text-foreground">3 / 4</span>,body:<>
   {skills.slice(0,3).map(s=><span key={s.id} className="flex items-center gap-2 rounded-xl bg-t-lime px-2.5 py-2 text-[12.5px] font-medium [&_svg]:size-4"><I id={SKILL_ICON[s.icon]||'globe'}/><span className="truncate">{s.name}</span></span>)}</>},
  roster:{tab:'Cast',body:<>
   <div className="flex items-center gap-3"><span className="flex -space-x-3">{(['kira','juno','byte','zara'] as const).map(id=><Face key={id} id={id} className="size-11 border-2 border-white bg-secondary"/>)}</span><b className="font-display text-[26px] leading-none font-medium tracking-[-.04em]">{characters.length}</b></div>
   <span className="text-[12px] text-muted-foreground">Twenty-five people to restyle and set to work</span></>},
  persona:{tab:'Brief',aside:<span className="rounded-full bg-ink px-2 py-1 font-mono text-[9.5px] leading-none font-semibold text-lime uppercase">Saved</span>,body:<>
   <b className="font-display text-[19px] leading-tight font-medium tracking-[-.02em]">{now.name} on call</b>
   <p className="text-[12.5px] leading-relaxed text-muted-foreground">Check each claim against a source. Mark opinion as opinion, and list what still needs proof.<span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-blink bg-foreground"/></p>
   <div className="flex gap-1">{['Friendly','Professional','Concise'].map((t,k)=><span key={t} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium',k===1?'bg-foreground text-background':'bg-secondary')}>{t}</span>)}</div></>},
  price:{tab:'Per run',body:<>
   <b className="font-display text-[44px] leading-none font-medium tracking-[-.05em]">12<span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">CR</span></b>
   <span className="text-[11.5px] text-muted-foreground">An example price, in preview credits</span></>},
 };
 return <>
  <section className="relative bg-background">
   <h1 className="sr-only">Harvex Agent Studio: shape a character, give it skills and hand it the work.</h1>
   {/* copy */}
   <div className="stagger mx-auto grid max-w-[1000px] justify-items-center gap-6 px-[clamp(16px,3vw,40px)] pt-[clamp(24px,5vh,56px)] text-center">
    <Eyebrow tone="lime">Character-first AI agents · private preview</Eyebrow>
    <p aria-hidden="true" className="font-display text-[clamp(42px,6.6vw,104px)] leading-[.96] tracking-[-.05em] text-balance"><span className="font-light">Shape a character.</span> <span className="font-medium">Hand it the work.</span></p>
    <p className="max-w-[52ch] text-[clamp(15.5px,1.2vw,17px)] leading-relaxed text-muted-foreground">Start with a person on a stage: choose the body, the clothes and the voice. Add skills for research, writing, translation and code, then let it take on tasks for you or for anyone you share it with.</p>
    <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-center"><CutButton size="lg" className="magnetic w-full sm:w-auto" onClick={()=>onNavigate('studio')}>Enter the studio <I id="arrow"/></CutButton><CutButton size="lg" variant="outline" className="w-full sm:w-auto" onClick={()=>document.getElementById('the-idea')?.scrollIntoView({behavior:'smooth'})}>Take the tour</CutButton></div>
    <ContractPill className="w-full sm:w-auto"/>
   </div>

   {/* the stage */}
   <div className="mx-auto mt-[clamp(28px,4vw,48px)] max-w-[1320px] px-[clamp(8px,2vw,24px)]">
    {/* the stage is a slab: the folder's shape at the size of a parent card, the name of who is on it on the tab */}
    <Slab tab={<>Now standing<span aria-hidden="true" className="size-1 rounded-full bg-ink/40"/><span key={a} className="animate-view">{now.name}</span></>}
     body="relative h-[clamp(430px,48vw,620px)] overflow-hidden rounded-[32px] rounded-tl-none outline-none max-md:rounded-3xl max-md:rounded-tl-none"
     bodyProps={{role:'region','aria-roledescription':'carousel','aria-label':'Harvex in seven characters',tabIndex:0,
      onKeyDown:e=>{if(e.key==='ArrowRight'){e.preventDefault();step(1);}if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}},
      onPointerEnter:()=>setPaused(true),onPointerLeave:()=>setPaused(false)}}>
     {/* the floor: a soft disc the character stands on */}
     <div aria-hidden="true" className="pointer-events-none absolute bottom-[-34%] left-1/2 aspect-square w-[min(820px,92%)] -translate-x-1/2 rounded-full shape-round bg-white/35"/>
     {/* the character on stage: every picture is in place, only the current one is shown */}
     <div className="absolute inset-x-0 top-[5%] bottom-[84px] mx-auto w-[min(520px,82%)]">
      {/* the 900x1200 pictures: this is the one place a character is shown large. The slow rise and fall is the stage's
          own (a still picture of a person reads as a mannequin). */}
      <div className="absolute inset-0 origin-bottom animate-[stage-breathe_4.8s_ease-in-out_infinite] motion-reduce:animate-none">
       {CAST.map((c,k)=><Thumb key={c.id} id={c.id} hd eager={k===0} className={cn('pointer-events-none absolute inset-0 size-full !object-contain object-bottom transition-[opacity,transform] duration-700 ease-smooth',k!==a?'translate-y-3 scale-[.97] opacity-0':live===c.id?'opacity-0':'opacity-100')}/>)}
      </div>
      {/* the live character (desktop): over the picture once it stands */}
      <div className={cn('absolute inset-0 transition-opacity duration-500 ease-smooth max-md:hidden',live===CAST[a].id?'opacity-100':'pointer-events-none opacity-0')}>
       <HeroLive id={CAST[a].id} next={CAST[(a+1)%N].id} onLive={setLive}/>
      </div>
     </div>
     {/* floating cards (tablet and up) */}
     <StageCard card={cards.skills} className="float absolute! top-[7%] left-[5%] w-[226px] max-lg:left-[3%] max-lg:w-[204px] max-md:hidden"/>
     <StageCard card={cards.roster} className="float absolute! bottom-[21%] left-[9%] w-[236px] max-lg:left-[3%] max-md:hidden"/>
     <StageCard card={cards.persona} className="float absolute! top-[10%] right-[5%] w-[256px] max-lg:right-[3%] max-lg:w-[226px] max-md:hidden"/>
     <StageCard card={cards.price} className="float absolute! right-[10%] bottom-[20%] w-[196px] max-lg:right-[3%] max-md:hidden"/>
     {/* the notch (tablet and up): the page reaches into the stage's foot with round shoulders, and the bar sits in it */}
     <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-[62px] w-[580px] -translate-x-1/2 rounded-t-[36px] bg-background max-md:hidden before:absolute before:right-full before:bottom-0 before:size-6 before:bg-[radial-gradient(circle_at_0_0,transparent_23.5px,var(--bg)_24px)] after:absolute after:bottom-0 after:left-full after:size-6 after:bg-[radial-gradient(circle_at_100%_0,transparent_23.5px,var(--bg)_24px)]"/>
     {/* the bar: who is on stage. Drawn in the other theme: black on the white page, white on the dark one */}
     <div className="tone-flip absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full p-1.5 sm:inset-x-auto sm:left-1/2 sm:w-[min(560px,calc(100%-24px))] sm:-translate-x-1/2 md:bottom-0">
      <button onClick={()=>step(-1)} aria-label="Previous character" className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary transition-colors hover:bg-foreground/20 [&_svg]:size-4"><I id="arrow" className="i rotate-180"/></button>
      <button onClick={()=>onPick(CAST[a].id)} title={`Take ${now.name} into the studio`} className="grid min-w-0 flex-1 gap-0.5 px-2 text-left">
       <span className="flex items-center gap-2 font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase"><b className="font-semibold text-brand">{String(a+1).padStart(2,'0')} / {String(N).padStart(2,'0')}</b><span className="truncate">{now.name} · {now.role}</span></span>
       <span key={a} className="animate-view truncate text-[14px] font-medium">{CAST[a].line}</span>
      </button>
      <button onClick={()=>step(1)} aria-label="Next character" className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-ink transition-colors hover:bg-[var(--lime-hover)] [&_svg]:size-4"><I id="arrow"/></button>
     </div>
    </Slab>

    {/* phones: the same cards as one scrolling row */}
    <div className="-mx-2 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-1 md:hidden">
     {(['skills','persona','roster','price'] as const).map(k=><Folder key={k} tab={cards[k].tab} aside={cards[k].aside} tone="lime" pocket="gap-2.5 p-3.5" className="w-[72vw] max-w-[280px] shrink-0 snap-center">{cards[k].body}</Folder>)}
    </div>

    {/* numbers */}
    <dl className="mx-auto mt-6 grid max-w-[720px] grid-cols-3 border-y border-dashed border-foreground/20 text-center">
     {[[characters.length,'People'],[skills.length,'Skills'],[powers.length,'Powers']].map(([n,l],k)=><div key={l as string} className={cn('flex flex-col-reverse gap-1 py-4',k>0&&'border-l border-dashed border-foreground/20')}><dt className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">{l}</dt><dd className="font-display text-[28px] leading-none font-medium tracking-[-.04em]">{n}</dd></div>)}
    </dl>
    <p className="mt-3 pb-[clamp(28px,5vh,56px)] text-center font-mono text-[10.5px] tracking-[.06em] text-muted-foreground uppercase">Preview credits are not money</p>
   </div>
  </section>

  {/* skills strip (Twenty "trusted by") */}
  <section className="bg-background px-4 pb-4">
   <div className="relative mx-auto flex max-w-[1280px] items-stretch border">
    <Corners/>
    <span className="grid shrink-0 place-items-center border-r px-6 font-mono text-[10.5px] leading-tight font-semibold tracking-[.1em] uppercase max-sm:hidden">On the job<br/>today</span>
    <Marquee duration={40} gap="0px" className="min-w-0 flex-1">
     {[...skills.map(s=>({k:s.id,icon:SKILL_ICON[s.icon]||'globe',t:s.name})),...powers.map(p=>({k:p.id,icon:p.id,t:p.name}))].map(x=><span key={x.k} className="flex h-16 items-center gap-2.5 border-r px-7 text-[15px] font-medium whitespace-nowrap text-foreground/80 [&_svg]:size-4"><I id={x.icon}/>{x.t}</span>)}
    </Marquee>
    <span className="flex shrink-0 items-center gap-2 border-l px-5 text-[13px] text-muted-foreground max-md:hidden"><I id="clock"/>any of them on a timer</span>
   </div>
  </section>
 </>;
}
