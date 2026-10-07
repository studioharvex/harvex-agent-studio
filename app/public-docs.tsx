'use client';
/* Public docs (/docs, /whitepaper, /roadmap): a reading room of its own, not a page of the front site (user, 6 Oct
   2026: "a different layout for docs, whitepaper and roadmap, not one piece with the front page").
   - Its own top bar from 821px (the site's floating menu is hidden here: Navbar gets `appMode`): logo, the Docs /
     Whitepaper / Roadmap switch, the search field, theme, one button to the studio.
   - A grey surface with the contents on the left and the page on a round sheet, like the dashboard's sheet: the
     sheet holds the title block, the text and, on wide screens, "On this page".
   - Under 1024px the contents are a sheet behind a bar that names where you are; phones keep the site's top bar
     and the bottom dock.
   - The roadmap is a timeline on the same sheet, its phases listed on the left.
   No marketing band and no site footer here: a slim foot line closes the frame. */
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import {Kbd} from '@/components/ui/kbd';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {I} from '@/app/ui';
import {cn} from '@/lib/utils';
import {CONTENT} from '@/lib/harvex3d/content';
import type {DocSection,RoadmapPhase} from '@/lib/harvex3d/engine';
import {DOC_GROUPS,Markdown,headingsOf,type DocKind} from './content-pages';
import {Logo,ThemeButton} from '@/components/harvex/navbar';
import {Chain} from '@/components/harvex/web3';
import {useGate} from '@/components/harvex/gate';
import type {View} from '@/lib/routes';

type Go=(v:View,doc?:string)=>void;
type Kind=DocKind|'roadmap';
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const minutes=(t:string)=>Math.max(1,Math.round(t.split(/\s+/).length/220));
const two=(n:number)=>String(n).padStart(2,'0');
const KINDS:[Kind,string,string][]=[['docs','Docs','book'],['paper','Whitepaper','doc'],['roadmap','Roadmap','map']];
const KIND_NAME:Record<Kind,string>={docs:'Docs',paper:'Whitepaper',roadmap:'Roadmap'};
const BADGE:Record<string,string>={live:'bg-t-mint text-tx-mint',beta:'bg-t-amber text-tx-amber',draft:'bg-t-coral text-tx-coral'};
const LABEL:Record<string,string>={done:'Shipped',now:'In progress',next:'Up next',planned:'Planned',idea:'Idea'};
const DOT:Record<string,string>={done:'bg-lime border-lime',now:'bg-iris border-iris',next:'border-iris',planned:'border-border',idea:'border-dashed border-border'};

/** The Docs / Whitepaper / Roadmap switch. `fill`: the buttons share the row (in the contents sheet). */
function KindTabs({kind,onNavigate,fill}:{kind:Kind;onNavigate:Go;fill?:boolean}){
 return <div role="tablist" aria-label="Library" className={cn('gap-1 rounded-full bg-secondary p-1',fill?'flex w-full':'inline-flex')}>{KINDS.map(([k,t,ic])=><button key={k} role="tab" aria-selected={kind===k} onClick={()=>onNavigate(k)}
  className={cn('flex h-8 min-w-0 items-center justify-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-3.5',fill&&'flex-1 px-2 max-[399px]:[&_svg]:hidden',kind===k&&'bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/.12)]')}><I id={ic}/>{t}</button>)}</div>;
}

/** One row of the contents: its number, its title, a badge. The page you are on is yellow, like the place you are
    in on the docs' own bars and the dock. */
function Row({n,title,badge,on,onClick,dot}:{n?:string;title:string;badge?:[string,string];on:boolean;onClick:()=>void;dot?:string}){
 return <button onClick={onClick} aria-current={on?'page':undefined}
  className={cn('flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] leading-snug text-muted-foreground transition-colors duration-300 hover:bg-background hover:text-foreground',on&&'bg-lime font-medium text-ink hover:bg-lime hover:text-ink')}>
  {dot!==undefined?<i className={cn('size-2.5 shrink-0 rounded-full shape-round border-[1.5px]',dot,on&&'border-ink')}/>:<span className={cn('w-5 shrink-0 font-mono text-[10.5px] text-dim',on&&'text-ink/60')}>{n}</span>}
  <span className="min-w-0 flex-1">{title}</span>
  {badge&&<span className={cn('shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[.06em] uppercase',on?'bg-ink/10 text-ink':BADGE[badge[1]])}>{badge[0]}</span>}
 </button>;
}
const Group=({title,children}:{title:string;children:ReactNode})=><div className="grid gap-0.5"><span className="px-2.5 pt-3 pb-1.5 font-mono text-[10px] font-semibold tracking-[.1em] text-muted-foreground uppercase">{title}</span>{children}</div>;

/** The frame every page of the library stands in. `contents` is drawn twice: beside the sheet and in the sheet
    that the bar opens under 1024px. */
function Frame({kind,where,contents,onNavigate,onSearch,children}:{kind:Kind;where:string;contents:(close:()=>void)=>ReactNode;onNavigate:Go;onSearch:()=>void;children:ReactNode}){
 const [menu,setMenu]=useState(false);const studioShut=useGate().view('studio');
 return <div className="min-h-[calc(100svh-var(--top))] bg-[var(--bg2)] min-[821px]:min-h-svh min-[821px]:[--top:64px]">
  <header className="sticky top-0 z-30 hidden h-16 items-center gap-3 border-b bg-background px-5 min-[821px]:flex">
   <Logo onClick={()=>onNavigate('home')}/>
   {/* between 821 and 1100px the bar keeps the logo, the switch and its tools: the label goes and the search is its icon */}
   <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[10px] font-semibold tracking-[.1em] text-muted-foreground uppercase max-[1099px]:hidden">Library</span>
   <span aria-hidden="true" className="mx-1 h-6 w-px bg-border max-[1099px]:hidden"/>
   <KindTabs kind={kind} onNavigate={onNavigate}/>
   <button onClick={onSearch} aria-label="Search the library (Ctrl K)" className="ml-auto flex h-10 w-[min(300px,26vw)] shrink-0 items-center gap-2 rounded-full border bg-background px-3.5 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 max-[1099px]:w-10 max-[1099px]:justify-center max-[1099px]:px-0 [&_svg]:size-4"><I id="search"/><span className="flex-1 truncate text-left max-[1099px]:hidden">Search the library</span><Kbd className="max-[1099px]:hidden">Ctrl K</Kbd></button>
   <ThemeButton className="size-10"/>
   <Button onClick={()=>onNavigate('studio')} className="h-10 shrink-0">{studioShut?'Studio · soon':'Open studio'}<I id="arrow"/></Button>
  </header>
  {/* where you are; opens the contents while they are not beside the sheet */}
  <div className="sticky top-[var(--top)] z-20 border-b bg-background px-3 py-2 lg:hidden">
   <button onClick={()=>setMenu(true)} className="flex h-10 w-full items-center gap-2.5 rounded-full bg-secondary px-3.5 text-left text-[13.5px] [&_svg]:size-4"><I id="list"/><span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">{KIND_NAME[kind]}</span><b className="min-w-0 flex-1 truncate font-medium">{where}</b><span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">Contents</span></button>
  </div>
  <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] items-start gap-5 p-5 max-[820px]:p-3 lg:grid-cols-[264px_minmax(0,1fr)]">
   <aside className="sticky top-[calc(var(--top)+20px)] max-h-[calc(100svh-var(--top)-40px)] overflow-y-auto pr-1 max-lg:hidden"><nav aria-label="Contents" className="grid content-start pb-4">{contents(()=>{})}</nav><Colophon/></aside>
   <div className="min-w-0 rounded-3xl bg-background p-[var(--pad-sheet)]">{children}</div>
  </div>
  <footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 pt-1 pb-8 text-[12.5px] text-muted-foreground max-[820px]:px-4">
   <span>Harvex Agent Studio · {CONTENT.version}</span>
   <span className="flex flex-wrap items-center gap-x-4 gap-y-1"><button onClick={()=>onNavigate('home')} className="hover:text-foreground">Back to the site</button>{!studioShut&&<button onClick={()=>onNavigate('studio')} className="hover:text-foreground">Open the studio</button>}<span>Planned for <Chain/>. Independent of BNB Chain and Binance.</span></span>
  </footer>
  <Sheet open={menu} onOpenChange={setMenu}><SheetContent side="left" className="w-[min(320px,88vw)] gap-0 overflow-y-auto p-4">
   <SheetHeader className="p-0 pb-3"><SheetTitle>Library</SheetTitle><SheetDescription className="sr-only">Docs, whitepaper and roadmap</SheetDescription></SheetHeader>
   <KindTabs kind={kind} onNavigate={(v,d)=>{setMenu(false);onNavigate(v,d);}} fill/>
   <nav aria-label="Contents" className="mt-2 grid content-start">{contents(()=>setMenu(false))}</nav>
  </SheetContent></Sheet>
 </div>;
}
/** What stands under the contents: which version this is. */
function Colophon(){
 return <div className="mt-2 grid gap-1 rounded-xl bg-background p-3 text-[12px] leading-relaxed text-muted-foreground"><b className="font-mono text-[10px] font-semibold tracking-[.1em] text-foreground uppercase">{CONTENT.version}</b>The token, top-ups, claims and holder rewards described here are plans. None of them is live.</div>;
}
/** Names the parts that are closed on this site (lib/gate.ts), so that a reader of the docs is not sent to a door
    that does not open. Drawn from the server's setting: it shortens and disappears as parts are opened. */
const PART_NAME={app:'the studio',signin:'sign-in',community:'the pages about listed agents',chain:'the on-chain pages'} as const;
function ClosedNote(){
 const {closed}=useGate();if(!closed.length)return null;
 const names=(['app','signin','community','chain'] as const).filter(s=>closed.includes(s)).map(s=>PART_NAME[s]);
 const list=names.length>1?names.slice(0,-1).join(', ')+' and '+names[names.length-1]:names[0];
 return <p className="max-w-[72ch] rounded-xl bg-secondary px-4 py-3 text-[13.5px] leading-relaxed"><b className="font-semibold text-foreground">Not open on this site yet:</b> {list}. These pages describe how {names.length>1?'they work':'it works'}; {names.length>1?'the parts themselves open':'the part itself opens'} in stages.</p>;
}
/** The block at the head of a sheet: where this is, the title, one line under it. */
function Head({crumb,title,meta,children}:{crumb:string;title:string;meta:string;children?:ReactNode}){
 return <header className="grid gap-3 border-b pb-6">
  <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">{crumb}</span>
  <h1 className="max-w-[22ch] font-display text-[clamp(30px,3.6vw,46px)] leading-[1.04] font-medium tracking-[-.04em]">{title}</h1>
  <span className="font-mono text-[11px] tracking-[.06em] text-muted-foreground uppercase">{meta}</span>
  {children}
 </header>;
}

export function PublicDocs({kind,page,onPage,onNavigate,onSearch}:{kind:DocKind;page:string;onPage:(k:DocKind,id:string)=>void;onNavigate:Go;onSearch:()=>void}){
 const list:DocSection[]=kind==='docs'?CONTENT.docs:CONTENT.paper.sections;
 const sec=list.find(s=>s.id===page)||list[0];const idx=list.indexOf(sec);const prev=list[idx-1];const next=list[idx+1];
 const heads=useMemo(()=>headingsOf(sec.body),[sec.body]);const prefix=`pub-${kind}-${sec.id}-`;
 const groups=DOC_GROUPS.filter(g=>g.kind===kind);const order=groups.flatMap(g=>g.items).map(i=>i.id);
 const group=groups.find(g=>g.items.some(i=>i.id===sec.id));
 const [active,setActive]=useState('');
 useEffect(()=>{setActive(heads[0]?prefix+slug(heads[0]):'');
  const els=heads.map(h=>document.getElementById(prefix+slug(h))).filter(Boolean) as HTMLElement[];if(!els.length)return;
  const io=new IntersectionObserver(en=>{en.forEach(x=>{if(x.isIntersecting)setActive(x.target.id);});},{rootMargin:'-20% 0px -65% 0px'});els.forEach(e=>io.observe(e));return()=>io.disconnect();},[kind,sec.id]); // eslint-disable-line react-hooks/exhaustive-deps
 const contents=(close:()=>void)=>groups.map(g=><Group key={g.title} title={g.title}>{g.items.map(it=><Row key={it.id} n={two(order.indexOf(it.id)+1)} title={it.title} badge={it.badge} on={it.id===sec.id} onClick={()=>{close();onPage(kind,it.id);}}/>)}</Group>);
 return <Frame kind={kind} where={sec.title} contents={contents} onNavigate={onNavigate} onSearch={onSearch}>
  <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 xl:grid-cols-[minmax(0,1fr)_200px]">
   <article className="min-w-0">
    <Head crumb={`${KIND_NAME[kind]} / ${group&&group.title!==KIND_NAME[kind]?group.title+' / ':''}${two(idx+1)} of ${two(list.length)}`} title={sec.title} meta={`${minutes(sec.body)} min read`}>
     <ClosedNote/>
     {kind==='paper'&&<p className="max-w-[72ch] rounded-xl bg-t-amber px-4 py-3 text-[13.5px] leading-relaxed">{CONTENT.paper.status}. Harvex is independent and not affiliated with BNB Chain or Binance.</p>}
    </Head>
    <div className="doc-md max-w-[72ch] pt-8 text-[15.5px] leading-[1.75]"><Markdown src={sec.body} idPrefix={prefix}/></div>
    <div className="mt-12 grid max-w-[72ch] gap-3 sm:grid-cols-2">
     {prev?<button onClick={()=>onPage(kind,prev.id)} className="group/pn grid gap-1 rounded-xl bg-secondary p-4 text-left transition-colors hover:bg-[var(--panel3)]"><span className="font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase">Before this</span><b className="flex items-center gap-2 font-medium [&_svg]:size-4"><I id="arrow" className="i rotate-180 transition-transform group-hover/pn:-translate-x-0.5"/>{prev.title}</b></button>:<span/>}
     {next&&<button onClick={()=>onPage(kind,next.id)} className="group/pn grid justify-items-end gap-1 rounded-xl bg-lime p-4 text-right text-ink sm:col-start-2"><span className="font-mono text-[10.5px] tracking-[.08em] text-ink/60 uppercase">Read next</span><b className="flex items-center gap-2 font-medium [&_svg]:size-4">{next.title}<I id="arrow" className="i transition-transform group-hover/pn:translate-x-0.5"/></b></button>}
    </div>
   </article>
   {!!heads.length&&<aside className="sticky top-[calc(var(--top)+20px)] h-fit max-h-[calc(100svh-var(--top)-40px)] overflow-y-auto max-xl:hidden">
    <span className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">On this page</span>
    <ul className="mt-3 grid gap-1.5 border-l">{heads.map(h=>{const id=prefix+slug(h);return <li key={id}><a href={`#${id}`} onClick={e=>{e.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});}}
     className={cn('-ml-px block border-l py-0.5 pl-3 text-[13px] leading-snug text-muted-foreground transition-colors hover:text-foreground',active===id&&'border-foreground font-medium text-foreground')}>{h}</a></li>;})}</ul>
   </aside>}
  </div>
 </Frame>;
}

/* The roadmap as a timeline: a line down the sheet, a mark per phase, the items beside it. */
export function PublicRoadmap({onNavigate,onSearch}:{onNavigate:Go;onSearch:()=>void}){
 const phases:RoadmapPhase[]=CONTENT.roadmap;const items=phases.flatMap(p=>p.items);
 const done=items.filter(([s])=>s==='done').length;const now=phases.find(p=>p.status==='now')||phases.find(p=>p.status!=='done')||phases[0];
 const id=(p:RoadmapPhase)=>'roadmap-'+slug(p.phase);
 const jump=(p:RoadmapPhase)=>document.getElementById(id(p))?.scrollIntoView({behavior:'smooth',block:'start'});
 const contents=(close:()=>void)=><Group title="Phases">{phases.map(p=><Row key={p.phase} dot={DOT[p.status]} title={`${p.phase} · ${p.title}`} on={p===now} onClick={()=>{close();setTimeout(()=>jump(p),60);}}/>)}</Group>;
 return <Frame kind="roadmap" where={`${now.phase} · ${now.title}`} contents={contents} onNavigate={onNavigate} onSearch={onSearch}>
  <Head crumb="Roadmap" title="What has shipped, and what comes next" meta={`${done} of ${items.length} items shipped · dates are targets, not promises`}>
   <div aria-hidden="true" className="h-2 max-w-[72ch] overflow-hidden rounded-full shape-round bg-secondary"><div className="h-full rounded-full shape-round bg-lime" style={{width:`${Math.round(done/items.length*100)}%`}}/></div>
   <ClosedNote/>
  </Head>
  <ol className="relative grid gap-10 pt-8 before:absolute before:top-10 before:bottom-2 before:left-[7px] before:w-px before:bg-border">
   {phases.map(p=><li key={p.phase} id={id(p)} className="relative grid scroll-mt-[calc(var(--top)+72px)] gap-x-10 gap-y-4 pl-8 md:grid-cols-[200px_minmax(0,1fr)] lg:scroll-mt-[calc(var(--top)+24px)]">
    <i aria-hidden="true" className={cn('absolute top-1 left-0 size-[15px] rounded-full shape-round border-2 bg-background',DOT[p.status])}/>
    <div className="grid content-start gap-1.5">
     <span className="font-mono text-[11px] tracking-[.08em] text-muted-foreground uppercase">{p.phase} · {p.when}</span>
     <h2 className="font-display text-[22px] leading-tight font-medium tracking-[-.02em]">{p.title}</h2>
     <span className={cn('w-fit rounded-md px-2 py-1 font-mono text-[10px] font-semibold tracking-[.08em] uppercase',p.status==='done'?'bg-lime text-ink':p.status==='now'?'bg-iris text-white':'bg-secondary text-muted-foreground')}>{LABEL[p.status]}</span>
    </div>
    <ul className="grid max-w-[72ch] gap-2.5">{p.items.map(([st,t],i)=><li key={i} className="flex items-start gap-3 text-[14.5px] leading-relaxed">
     <i className={cn('mt-1 grid size-[18px] shrink-0 place-items-center rounded-md border-[1.5px] border-border text-ink [&_svg]:size-[11px] [&_svg]:stroke-[3]',st==='done'&&'border-lime bg-lime',st==='now'&&'border-iris bg-iris',st==='next'&&'border-iris',st==='idea'&&'border-dashed')}>{st==='done'&&<I id="check"/>}</i>
     <span className={cn(st==='done'?'text-foreground':'text-muted-foreground')}>{t}{st!==p.status&&st!=='done'&&<span className="ml-2 rounded bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] tracking-[.06em] text-muted-foreground uppercase">{LABEL[st]}</span>}</span></li>)}</ul>
   </li>)}
  </ol>
 </Frame>;
}
