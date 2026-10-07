'use client';
/* Landing feature sections, each mixing references on purpose:
   - TheIdea: Twenty "the problem" split (solid color panel + serif/sans headline + dashed list).
   - FeatureRows: ZATS zig-zag rows on a dark band, white product cards on solid tint pads.
   - FolderCards: Twenty folder-tab cards with a stats row (numbers count up).
   Solid fills, hairline borders, no gradients. */
import type {ReactNode} from 'react';
import {LiveFigure} from './hero-live';
import {Card} from '@/components/ui/card';
import {characters,motionNames,powers,type CharacterId} from '@/lib/characters';
import {skillCatalog} from '@/lib/agents';
import {I,SKILL_ICON} from '@/app/ui';
import {cn} from '@/lib/utils';
import {BracketLink,CountUp,CutButton,DashedRule,Eyebrow,Folder,Reveal,Slab,type Tone} from '@/components/harvex/motion';
import {OutfitMock,PersonaMock,PublishMock,RosterMock,SkillsMock} from './mocks';
import {TOKEN_LINE,useTokenStage} from '@/components/harvex/token-context';

/** Twenty-style heading: light serif lead-in + medium sans finish. */
export function Headline({lead,rest,className,as:Tag='h2'}:{lead:ReactNode;rest:ReactNode;className?:string;as?:'h2'|'h3'}){
 return <Tag className={cn('text-[clamp(32px,4.2vw,58px)] leading-[1.04] text-balance',className)}><span className="font-display font-light tracking-[-.04em]">{lead}</span> <span className="font-display font-medium tracking-[-.04em]">{rest}</span></Tag>;
}
export function SectionHead({eyebrow,tone='iris',lead,rest,sub,center,className}:{eyebrow:string;tone?:Tone;lead:ReactNode;rest:ReactNode;sub?:ReactNode;center?:boolean;className?:string}){
 return <Reveal className={cn('grid max-w-3xl gap-4',center&&'mx-auto justify-items-center text-center',className)}>
  <Eyebrow tone={tone}>{eyebrow}</Eyebrow><Headline lead={lead} rest={rest}/>{sub&&<p className="max-w-[56ch] text-[16px] leading-relaxed text-muted-foreground">{sub}</p>}
 </Reveal>;
}

export function TheIdea({onNavigate}:{onNavigate:(v:'studio')=>void}){
 const skills=skillCatalog.filter(s=>!s.planned&&!s.locked);
 return <section id="the-idea" className="scroll-mt-24 px-4 py-[clamp(72px,9vw,130px)]">
  <div className="mx-auto grid max-w-[1180px] items-center gap-[clamp(28px,5vw,80px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
   <Reveal>
    {/* the frame is a slab and the mock stands in it with room around it (user, 6 Oct 2026: "it is too full") */}
    <Slab tab="Drawn live · no video" fill="var(--iris)" ink="text-white" body="p-[clamp(22px,3.8vw,52px)]">
    {/* the window holds three things only: the character with room around it, three skills, one button (user, 6 Oct
        2026: "this is too dense, on the phone too"; then, of the wide panel of filled rows: "simpler"). The character is the light live one of the hero, without the
        Studio's platform; on phones the skills are a row of icons under the stage. */}
    <div className="overflow-hidden rounded-2xl border border-[#0a0a0a]/10 bg-white text-[#0a0a0a] shadow-[0_24px_48px_-28px_rgb(0_0_0/.55)]">
     <div className="flex h-11 items-center gap-2.5 border-b border-[#0a0a0a]/10 px-4"><span className="flex gap-1.5">{[0,1,2].map(k=><i key={k} className="size-2.5 rounded-full shape-round bg-[#0a0a0a]/15"/>)}</span><span className="text-xs text-[#0a0a0a]/50">Studio / <b className="font-medium text-[#0a0a0a]">Dorian on call</b></span></div>
     {/* the skills are a rail, never more than 30% of the window (user, 6 Oct 2026: "the right side a third at most") */}
     <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,min(30%,168px))]">
      <div className="relative h-[clamp(260px,27vw,380px)] bg-[#f6f6f7]">
       <LiveFigure id="atlas" everywhere className="top-5"/>
       <span className="absolute top-3 left-3 rounded-full bg-white px-3 py-1.5 font-mono text-[10px] leading-none tracking-[.1em] text-[#0a0a0a]/60 uppercase shadow-[0_6px_16px_-10px_rgb(0_0_0/.5)]">Dorian · Organizer</span>
      </div>
      <div className="flex flex-col gap-3.5 border-[#0a0a0a]/10 p-4 max-sm:flex-row max-sm:items-center max-sm:gap-2 max-sm:border-t max-sm:p-3 sm:border-l">
       <span className="font-mono text-[10px] tracking-[.1em] text-[#0a0a0a]/50 uppercase max-sm:hidden">Skills</span>
       {skills.slice(0,3).map(s=><span key={s.id} title={s.name} className="flex items-center gap-2.5 text-[12.5px] leading-tight [&_svg]:size-4"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#fff8b8] max-sm:size-10"><I id={SKILL_ICON[s.icon]||'globe'}/></span><b className="min-w-0 font-medium max-sm:hidden">{s.name}</b></span>)}
       <span className="mt-auto flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#0a0a0a] px-3 text-xs leading-none font-semibold text-white max-sm:mt-0 max-sm:ml-auto max-sm:px-4 [&_svg]:size-3.5">Run<I id="arrow"/></span>
      </div>
     </div>
    </div>
    </Slab>
   </Reveal>
   <div className="grid gap-7">
    <SectionHead eyebrow="Why a character" lead="Work reads differently" rest="when someone is doing it."/>
    <DashedRule/>
    {[['Somebody, not a text box','Each agent stands on a stage, breathes, blinks and reacts while it works. One look tells you whether it is busy, finished or waiting.'],['Made to hand something back','Ten skills, each with an output you can use: research briefs, drafts, answers from a document, summaries, translations, ideas, code notes, plans, a wallet reading and a whale report.']].map(([t,p])=><Reveal key={t} className="grid gap-1.5"><b className="text-[15px] font-semibold">{t}</b><p className="max-w-[48ch] text-[15px] leading-relaxed text-muted-foreground">{p}</p></Reveal>)}
    <div><CutButton className="nudge magnetic" onClick={()=>onNavigate('studio')}>Make your first one <I id="arrow"/></CutButton></div>
   </div>
  </div>
 </section>;
}

type Row={k:string;tone:Tone;title:string;text:string;points:[string,string][];mock:ReactNode;flip?:boolean};
export function FeatureRows({onNavigate,onPick}:{onNavigate:(v:'studio')=>void;onPick:(id:CharacterId)=>void}){
 const rows:Row[]=[
  {k:'Cast',tone:'lime',title:'Choose who shows up.',text:'Twenty-five people, each adjustable down to the jaw line: body, face, hair, clothes. On stage they breathe, blink, follow your cursor and find small things to do while they wait.',points:[['users','25 people'],['orb','One power each'],['play','33 motions'],['target','Turn, zoom, pause']],mock:<RosterMock onPick={onPick}/>},
  {k:'Wardrobe',tone:'coral',flip:true,title:'Change anything they wear.',text:'Hair, tops, bottoms, shoes, gear and glow, in whatever color you choose. Begin from a preset, or press Randomize until something fits and keep that.',points:[['user','Face, hair, skin'],['pen','Free choice of color'],['hype','Gear with a glow'],['save','Stored with the agent']],mock:<OutfitMock/>},
  {k:'Brief',tone:'iris',title:'Tell it how to think.',text:'Give the agent a name, write down what it should care about and choose a tone. That brief goes along with every task it takes.',points:[['doc','Up to 2,000 characters'],['sum','Three tones'],['lang','Replies in English'],['list','Templates to start from']],mock:<PersonaMock/>},
  {k:'Skills',tone:'sky',flip:true,title:'Decide what it can do.',text:'An agent carries up to four skills. Research briefs, summaries, answers from a document, drafts, translations, plans and code reviews are among them.',points:[['globe','Ten skills to choose from'],['layers','Four at a time'],['check','Samples carry a label'],['bulb','Live AI where connected']],mock:<SkillsMock/>},
  {k:'Listing',tone:'amber',title:'List it. Name the price.',text:'Place an agent in Discover and price it in credits. Other people run it exactly as you built it, and your instructions are never shown to them.',points:[['coins','0 to 500 CR per run'],['shield','Instructions never shown'],['archive','Take it down whenever'],['clock','Every run in the ledger']],mock:<PublishMock/>},
 ];
 return <section className="tone-flip px-4 py-[clamp(80px,10vw,150px)]">
  <div className="mx-auto max-w-[1180px]">
   <div className="flex items-center gap-4 border-b pb-5"><Eyebrow tone="lime">Inside the studio</Eyebrow><span className="ml-auto font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase max-sm:hidden">Five parts</span></div>
   {rows.map((r,i)=><article key={r.k} className="grid items-center gap-[clamp(28px,5vw,80px)] border-b py-[clamp(48px,7vw,100px)] last:border-b-0 lg:grid-cols-2">
    <Reveal className={cn('grid gap-4',r.flip&&'lg:order-2')}>
     <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">0{i+1} · {r.k}</span>
     <h3 className="font-display text-[clamp(26px,2.6vw,36px)] leading-[1.08] font-medium tracking-[-.03em]">{r.title}</h3>
     <p className="max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">{r.text}</p>
     <ul className="stagger mt-2 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-dashed border-foreground/20 pt-5 max-sm:grid-cols-1">{r.points.map(([ic,t])=><li key={t} className="flex items-center gap-2.5 font-mono text-[11px] tracking-[.06em] uppercase [&_svg]:size-4 [&_svg]:text-lime"><I id={ic}/>{t}</li>)}</ul>
    </Reveal>
    <Reveal delay={120}>
     {/* the frame is a slab in the step's colour, the step's name on its tab */}
     <Slab tab={r.k} fill={`var(--${r.tone==='ink'?'text':r.tone})`} ink={r.tone==='iris'?'text-white':r.tone==='ink'?'text-background':'text-ink'} body="p-[clamp(14px,2.4vw,28px)]">
      <Card className="tone-light gap-0 rounded-2xl border-[#0a0a0a]/10 p-5 shadow-[0_24px_48px_-28px_rgb(0_0_0/.5)]">{r.mock}</Card>
     </Slab>
    </Reveal>
   </article>)}
   <div className="flex justify-center pt-10"><CutButton variant="lime" size="lg" className="magnetic" onClick={()=>onNavigate('studio')}>Enter the studio <I id="arrow"/></CutButton></div>
  </div>
 </section>;
}

export function FolderCards({onNavigate}:{onNavigate:(v:'studio'|'discover'|'docs')=>void}){
 const stage=useTokenStage();
 const cards:{tab:string;tone:Tone;title:string;text:string;foot:[string,string];go:'studio'|'discover'|'docs';art:ReactNode}[]=[
  {tab:'Share',tone:'iris',title:'One link carries the whole agent',text:'Everything about it travels in a single link. Paste an iframe and the same agent appears, live, on any page.',foot:['Link','Embed'],go:'studio',art:<div className="grid min-w-0 gap-2"><div className="flex min-w-0 items-center gap-2 rounded-lg border bg-background p-2 text-xs"><span className="min-w-0 truncate font-mono text-muted-foreground">harvex…/#agent=eyJuYW1lIjoi…</span><span className="ml-auto shrink-0 rounded-md bg-lime px-2 py-1 font-semibold text-ink">Copy</span></div><div className="truncate rounded-lg border bg-background p-2 font-mono text-[11px] text-muted-foreground">&lt;iframe src=&quot;…?view=embed&quot; /&gt;</div></div>},
  {tab:'Discover',tone:'coral',title:'Hire what someone else made',text:'Listed agents show their price. You pay for each run in credits, and the creator receives that price less the platform fee.',foot:['Listings','Price per run'],go:'discover',art:<div className="flex flex-wrap gap-1.5">{['Source checker','Draft partner','Document desk','Build planner'].map(t=><span key={t} className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium">{t}</span>)}</div>},
  {tab:'Docs',tone:'mint',title:'Labelled for what it is',text:`Each page tells you what runs today, what depends on the server and what is still a plan. ${TOKEN_LINE[stage]}`,foot:['Docs','Roadmap'],go:'docs',art:<div className="grid gap-1.5">{[['Skills and listings','Live'],['Sign-in by wallet','Live'],['USDT top-ups','Per server'],['Token and rewards',{test:'Testnet',none:'Planned',token:'Token live',rewards:'Live'}[stage]]].map(([a,b])=><div key={a} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs"><span>{a}</span><b className={cn('font-mono text-[10px] uppercase',/live/i.test(b)?'text-tx-mint':'text-muted-foreground')}>{b}</b></div>)}</div>},
 ];
 const stats:[number,string][]=[[characters.length,'People'],[motionNames.length,'Motions'],[powers.length,'Powers'],[skillCatalog.filter(s=>!s.planned&&!s.locked).length,'Skills open']];
 return <section className="px-4 py-[clamp(80px,10vw,140px)]">
  <div className="mx-auto grid max-w-[1180px] gap-12">
   <SectionHead eyebrow="Once it is built" tone="coral" lead="Three ways" rest="to send it out the door." sub="An agent is a character, a brief and a set of skills kept together. Pass it on as a link, list it for others, or keep it working for you."/>
   <div className="grid gap-4 md:grid-cols-3">
    {cards.map((c,k)=><Reveal key={c.tab} delay={k*80} className="flex min-w-0">
     <Folder tab={c.tab} tone={c.tone} back={c.art} backClass="p-3 pt-2.5" className="tilt w-full" pocket="p-0">
      <div className="grid gap-1.5 px-5 pt-4 pb-5"><b className="text-[17px] font-semibold tracking-[-.01em]">{c.title}</b><p className="text-sm leading-relaxed text-muted-foreground">{c.text}</p></div>
      <button onClick={()=>onNavigate(c.go)} className="mt-auto flex min-w-0 items-center gap-1.5 border-t px-3 py-2.5 text-left font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase transition-colors hover:text-foreground">
       <span className="rounded-full bg-secondary px-3 py-1.5">{c.foot[0]}</span><span className="rounded-full bg-secondary px-3 py-1.5">{c.foot[1]}</span><span className="ml-auto grid size-8 place-items-center rounded-full bg-foreground text-background [&_svg]:size-4 [&_svg]:transition-transform group-hover/folder:[&_svg]:translate-x-0.5"><I id="arrow"/></span>
      </button>
     </Folder>
    </Reveal>)}
   </div>
   <Reveal className="stagger grid grid-cols-4 border-y max-md:grid-cols-2">
    {stats.map(([n,l],k)=><div key={l} className={cn('grid gap-1 px-5 py-7',k>0&&'md:border-l md:border-dashed md:border-foreground/20',k%2===1&&'max-md:border-l max-md:border-dashed max-md:border-foreground/20',k>1&&'max-md:border-t')}><CountUp to={n} className="font-display text-[clamp(44px,5vw,68px)] leading-none font-medium tracking-[-.05em]"/><span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">{l}</span></div>)}
   </Reveal>
   <div className="flex justify-center"><BracketLink onClick={()=>onNavigate('docs')}>Read the manual</BracketLink></div>
  </div>
 </section>;
}
