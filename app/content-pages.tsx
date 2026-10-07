'use client';
/* Docs, Whitepaper and Roadmap. Docs/Whitepaper use an AlignUI-style shell: grouped sidebar with
   tinted icons and badges, quick search, one page at a time with breadcrumb and prev/next, and an
   "On this page" rail that highlights the heading in view. Content lives in lib/harvex3d/src/content.js. */
import {Fragment,useEffect,useMemo,useState,type ReactNode} from 'react';
import {I} from './ui';
import {Badge} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {Kbd} from '@/components/ui/kbd';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Collapsible,CollapsibleContent,CollapsibleTrigger} from '@/components/ui/collapsible';
import {cn} from '@/lib/utils';
import {CONTENT} from '@/lib/harvex3d/content';
import type {DocSection,RoadmapPhase} from '@/lib/harvex3d/engine';
import {ToneIcon} from '@/components/harvex/navbar';
import type {Tone} from '@/components/harvex/motion';
const C=CONTENT;
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

/* ---- tiny Markdown subset renderer (headings, bold-line headings, lists, tables, code, quotes, inline) ---- */
function inline(s:string):ReactNode[]{
 const out:ReactNode[]=[];const re=/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s](?:[^*]*[^*\s])?\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;let last=0,m:RegExpExecArray|null,k=0;
 while((m=re.exec(s))){if(m.index>last)out.push(s.slice(last,m.index));const t=m[0];
  if(t.startsWith('`'))out.push(<code key={k++} className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[12.5px]">{t.slice(1,-1)}</code>);
  else if(t.startsWith('**'))out.push(<strong key={k++} className="font-semibold text-foreground">{t.slice(2,-2)}</strong>);
  // *single asterisks*: the name of a button, tab or page as it reads in the app
  else if(t.startsWith('*'))out.push(<em key={k++} className="font-medium text-foreground not-italic">{t.slice(1,-1)}</em>);
  else{const mm=t.match(/^\[([^\]]+)\]\((.+)\)$/)!;out.push(<a key={k++} href={mm[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-tx-coral underline-offset-4 hover:underline">{mm[1]}</a>);}
  last=m.index+t.length;}
 if(last<s.length)out.push(s.slice(last));return out;
}
const isHeading=(ln:string)=>/^#{1,4}\s+/.test(ln)||/^\*\*[^*]+\*\*\s*$/.test(ln.trim());
const headingText=(ln:string)=>ln.trim().replace(/^#{1,4}\s+/,'').replace(/^\*\*|\*\*$/g,'');
export function headingsOf(src:string){return src.replace(/\r/g,'').split('\n').filter(isHeading).map(headingText);}
function cells(r:string){return r.replace(/^\||\|$/g,'').split('|').map(c=>c.trim());}
export function Markdown({src,idPrefix=''}:{src:string;idPrefix?:string}){
 const lines=src.replace(/\r/g,'').split('\n');const nodes:ReactNode[]=[];let para:string[]=[],list:{type:'ul'|'ol';items:string[]}|null=null,code:string[]|null=null,table:string[]|null=null,k=0;
 const flushP=()=>{if(para.length){nodes.push(<p key={k++} className="mb-4 text-[15.5px] leading-[1.75] text-muted-foreground">{para.map((l,i)=><Fragment key={i}>{i>0&&<br/>}{inline(l)}</Fragment>)}</p>);para=[];}};
 const flushL=()=>{if(list){const items=list.items.map((t,i)=><li key={i} className="pl-1 text-[15.5px] leading-[1.7] text-muted-foreground marker:text-dim">{inline(t)}</li>);nodes.push(list.type==='ul'?<ul key={k++} className="mb-5 ml-5 grid list-disc gap-1.5">{items}</ul>:<ol key={k++} className="mb-5 ml-5 grid list-decimal gap-1.5">{items}</ol>);list=null;}};
 const flushT=()=>{if(table){const rows=table.filter(r=>!/^\|\s*-{3}/.test(r)).map(cells);const [h,...rest]=rows;nodes.push(<div key={k++} className="mb-6 overflow-x-auto rounded-xl border"><table className="w-full border-collapse text-[13.5px]"><thead className="bg-secondary"><tr>{h.map((c,i)=><th key={i} className="px-3.5 py-2.5 text-left font-mono text-[10.5px] font-medium tracking-[.08em] text-muted-foreground uppercase">{inline(c)}</th>)}</tr></thead><tbody>{rest.map((r,i)=><tr key={i} className="border-t">{r.map((c,j)=><td key={j} className={cn('px-3.5 py-2.5 align-top text-muted-foreground',j===0&&'font-semibold whitespace-nowrap text-foreground')}>{inline(c)}</td>)}</tr>)}</tbody></table></div>);table=null;}};
 for(const ln of lines){
  if(code){if(/^```/.test(ln)){nodes.push(<pre key={k++} className="mb-5 overflow-x-auto rounded-xl border bg-secondary p-4 font-mono text-[12.5px]"><code>{code.join('\n')}</code></pre>);code=null;}else code.push(ln);continue;}
  if(/^```/.test(ln)){flushP();flushL();flushT();code=[];continue;}
  if(/^\|/.test(ln)){flushP();flushL();(table||(table=[])).push(ln);continue;}else flushT();
  let m:RegExpMatchArray|null;
  if(isHeading(ln)){flushP();flushL();const t=headingText(ln);nodes.push(<h3 key={k++} id={idPrefix+slug(t)} className="mt-9 mb-3 scroll-mt-[calc(var(--top)+24px)] font-display text-[20px] font-medium tracking-[-.02em] text-foreground first:mt-0">{inline(t)}</h3>);continue;}
  if((m=ln.match(/^\s*[-*•]\s+(.*)/))){flushP();if(!list||list.type!=='ul'){flushL();list={type:'ul',items:[]};}list.items.push(m[1]);continue;}
  if((m=ln.match(/^\s*\d+[.)]\s+(.*)/))){flushP();if(!list||list.type!=='ol'){flushL();list={type:'ol',items:[]};}list.items.push(m[1]);continue;}
  if((m=ln.match(/^>\s?(.*)/))){flushP();flushL();const warn=/^\*\*Draft/.test(m[1]);nodes.push(<blockquote key={k++} className={cn('mb-5 rounded-xl border px-4 py-3 text-[14.5px] leading-relaxed',warn?'bg-t-amber':'bg-t-sky')}>{inline(m[1])}</blockquote>);continue;}
  if(!ln.trim()){flushP();flushL();continue;}
  flushL();para.push(ln);
 }
 if(code)nodes.push(<pre key={k++} className="mb-5 overflow-x-auto rounded-xl border bg-secondary p-4 font-mono text-[12.5px]"><code>{(code as string[]).join('\n')}</code></pre>);
 flushT();flushP();flushL();
 return <div>{nodes}</div>;
}

/* ---- docs shell ---- */
export type DocKind='docs'|'paper';
type Entry={id:string;title:string;icon:string;tone:Tone;badge?:[string,string]};
type Group={title:string;kind:DocKind;items:Entry[]};
const byId=(list:DocSection[],id:string)=>list.find(s=>s.id===id);
export const DOC_GROUPS:Group[]=[
 {title:'Getting started',kind:'docs',items:[{id:'overview',title:'What is Harvex',icon:'book',tone:'lime'},{id:'start',title:'Getting started',icon:'play',tone:'iris'}]},
 {title:'Build an agent',kind:'docs',items:[{id:'characters',title:'Characters & outfits',icon:'users',tone:'coral'},{id:'motions',title:'Motions & powers',icon:'levitate',tone:'sky'},{id:'skills',title:'Agent skills',icon:'layers',tone:'amber',badge:['10 open','live']}]},
 {title:'Workspace',kind:'docs',items:[{id:'credits',title:'Credits, prices & earnings',icon:'coins',tone:'amber',badge:['Beta','beta']},{id:'save',title:'Saving, export & share',icon:'share',tone:'mint'},{id:'rewards',title:'Holder rewards',icon:'coins',tone:'lime',badge:['Planned','draft']}]},
 {title:'Trust',kind:'docs',items:[{id:'privacy',title:'Privacy & safety',icon:'shield',tone:'iris'},{id:'faq',title:'FAQ',icon:'bulb',tone:'sky'}]},
 {title:'Whitepaper',kind:'paper',items:C.paper.sections.map((s:DocSection,i:number)=>({id:s.id,title:s.title,icon:s.id==='token'?'coins':s.id==='risks'?'shield':'doc',tone:(['lime','iris','coral','sky','amber','mint'] as Tone[])[i%6],...(s.id==='token'?{badge:['Planned','draft'] as [string,string]}:{})}))},
];
const BADGE:Record<string,string>={live:'bg-t-mint text-tx-mint',beta:'bg-t-amber text-tx-amber',draft:'bg-t-coral text-tx-coral'};

function Sidebar({kind,page,onPage,onRoadmap}:{kind:DocKind;page:string;onPage:(k:DocKind,id:string)=>void;onRoadmap:()=>void}){
 return <nav aria-label="Documentation" className="grid content-start gap-1 pb-10">
  <div className="mb-3 flex items-center gap-2"><span className="rounded-md border bg-secondary px-2 py-1 font-mono text-[10.5px]">{C.version.split('·')[0].trim()}</span><span className="text-xs text-muted-foreground">Docs & whitepaper</span></div>
  {DOC_GROUPS.map((g,gi)=><Collapsible key={g.title} defaultOpen className={cn(gi>0&&'border-t border-dashed border-foreground/15 pt-3')}>
   <CollapsibleTrigger className="group/c flex w-full items-center justify-between py-1.5 text-[13px] font-semibold text-foreground">{g.title}<svg viewBox="0 0 24 24" className="size-4 text-muted-foreground transition-transform duration-300 group-data-[state=closed]/c:-rotate-90" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></CollapsibleTrigger>
   <CollapsibleContent className="stagger grid gap-0.5 pb-3">
    {g.items.map(it=>{const on=kind===g.kind&&page===it.id;return <button key={it.id} onClick={()=>onPage(g.kind,it.id)} aria-current={on?'page':undefined}
     className={cn('group/it flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] text-muted-foreground transition-colors duration-300 hover:bg-secondary hover:text-foreground',on&&'bg-secondary font-medium text-foreground')}>
     <ToneIcon icon={it.icon} tone={it.tone} className="size-6 rounded-md [&_svg]:size-3.5"/><span className="flex-1">{it.title}</span>{it.badge&&<span className={cn('rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[.06em] uppercase',BADGE[it.badge[1]])}>{it.badge[0]}</span>}
    </button>;})}
   </CollapsibleContent>
  </Collapsible>)}
  <button onClick={onRoadmap} className="mt-1 flex items-center gap-2.5 rounded-lg border-t border-dashed border-foreground/15 px-2 pt-4 pb-1.5 text-left text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"><ToneIcon icon="map" tone="mint" className="size-6 rounded-md [&_svg]:size-3.5"/>Roadmap<I id="arrow" className="i ml-auto size-3.5"/></button>
 </nav>;
}

export function DocsShell({kind,page,onPage,onSearch,onRoadmap}:{kind:DocKind;page:string;onPage:(k:DocKind,id:string)=>void;onSearch:()=>void;onRoadmap:()=>void}){
 const flat=useMemo(()=>DOC_GROUPS.flatMap(g=>g.items.map(it=>({...it,kind:g.kind,group:g.title}))),[]);
 const list=kind==='docs'?C.docs:C.paper.sections;const sec=byId(list,page)||list[0];
 const idx=flat.findIndex(f=>f.kind===kind&&f.id===sec.id);const prev=flat[idx-1];const next=flat[idx+1];
 const prefix=`${kind}-${sec.id}-`;const heads=headingsOf(sec.body);
 const [active,setActive]=useState('');const [menu,setMenu]=useState(false);
 useEffect(()=>{window.scrollTo({top:0});setActive(heads[0]?prefix+slug(heads[0]):'');
  const els=heads.map(h=>document.getElementById(prefix+slug(h))).filter(Boolean) as HTMLElement[];if(!els.length)return;
  const io=new IntersectionObserver(en=>{en.forEach(x=>{if(x.isIntersecting)setActive(x.target.id);});},{rootMargin:'-15% 0px -70% 0px'});els.forEach(e=>io.observe(e));return()=>io.disconnect();},[kind,sec.id]); // eslint-disable-line react-hooks/exhaustive-deps
 const go=(k:DocKind,id:string)=>{setMenu(false);onPage(k,id);};
 const here=flat[idx];
 return <div className="mx-auto grid max-w-[1320px] gap-10 px-4 pt-8 pb-20 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_210px]">
  <aside className="sticky top-[calc(var(--top)+16px)] max-h-[calc(100svh-var(--top)-32px)] overflow-y-auto max-lg:hidden"><Sidebar kind={kind} page={sec.id} onPage={go} onRoadmap={onRoadmap}/></aside>
  <main data-view="" className="min-w-0" key={kind+sec.id}>
   <div className="mb-8 flex items-center gap-2 border-b pb-4">
    <button onClick={()=>setMenu(true)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm lg:hidden"><I id="list" className="i size-4"/>Menu</button>
    <button onClick={onSearch} className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/30"><I id="search" className="i size-4"/>Quick search…<Kbd className="ml-auto">/</Kbd></button>
   </div>
   <div className="mb-3 flex items-center gap-1.5 text-[13px] text-muted-foreground"><span>{kind==='docs'?'Docs':'Whitepaper'}</span><span>/</span><span>{here?.group}</span></div>
   <h1 className="font-display text-[clamp(30px,3.4vw,42px)] leading-[1.05] font-medium tracking-[-.035em]">{sec.title}</h1>
   {kind==='paper'&&<p className="mt-3 rounded-xl border bg-t-amber px-4 py-3 text-sm">{C.paper.status}. Chain: BNB Smart Chain. Harvex is independent and not affiliated with BNB Chain or Binance.</p>}
   <div className="mt-8 max-w-[72ch]"><Markdown src={sec.body} idPrefix={prefix}/></div>
   <div className="mt-14 grid gap-3 border-t pt-8 sm:grid-cols-2">
    {prev?<button onClick={()=>go(prev.kind,prev.id)} className="group/pn grid gap-1 rounded-xl border p-4 text-left transition-colors hover:border-foreground/30"><span className="text-xs text-muted-foreground">Previous</span><span className="flex items-center gap-2 font-medium"><I id="arrow" className="i size-4 rotate-180 transition-transform group-hover/pn:-translate-x-0.5"/>{prev.title}</span></button>:<span/>}
    {next&&<button onClick={()=>go(next.kind,next.id)} className="group/pn grid justify-items-end gap-1 rounded-xl border p-4 text-right transition-colors hover:border-foreground/30"><span className="text-xs text-muted-foreground">Next</span><span className="flex items-center gap-2 font-medium">{next.title}<I id="arrow" className="i size-4 transition-transform group-hover/pn:translate-x-0.5"/></span></button>}
   </div>
  </main>
  <aside className="sticky top-[calc(var(--top)+16px)] self-start max-xl:hidden">
   {heads.length>0&&<><div className="mb-3 flex items-center gap-2 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase"><I id="sum" className="i size-3.5"/>On this page</div>
    <div className="stagger grid border-l">{heads.map(h=>{const id=prefix+slug(h);return <a key={id} href={'#'+id} onClick={e=>{e.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});}}
     className={cn('-ml-px border-l py-1.5 pl-3 text-[13px] text-muted-foreground transition-colors duration-300 hover:text-foreground',active===id&&'border-coral font-medium text-tx-coral')}>{h}</a>;})}</div></>}
  </aside>
  <Sheet open={menu} onOpenChange={setMenu}><SheetContent side="left" className="w-[300px] overflow-y-auto p-4"><SheetHeader className="p-0 pb-3"><SheetTitle>Docs</SheetTitle><SheetDescription className="sr-only">Documentation pages</SheetDescription></SheetHeader><Sidebar kind={kind} page={sec.id} onPage={go} onRoadmap={()=>{setMenu(false);onRoadmap();}}/></SheetContent></Sheet>
 </div>;
}

const LABEL:Record<string,string>={done:'Shipped',now:'In progress',next:'Up next',planned:'Planned',idea:'Idea'};
export function RoadmapPage(){
 return <div className="stagger grid gap-3.5">{C.roadmap.map((p:RoadmapPhase)=><Card key={p.phase} className={cn('grid gap-5 rounded-2xl p-5 shadow-none md:grid-cols-[170px_minmax(0,1fr)]',p.status==='now'&&'border-foreground/30 bg-t-lime')}>
  <div className="grid content-start gap-1.5"><span className="font-mono text-[11px] tracking-[.08em] text-muted-foreground uppercase">{p.phase}</span><h3 className="font-display text-lg font-medium">{p.title}</h3><span className="text-sm text-muted-foreground">{p.when}</span>
   <Badge variant={p.status==='done'?'default':'outline'} className="rounded-md font-mono text-[10px] tracking-[.08em] uppercase">{LABEL[p.status]}</Badge></div>
  <ul className="grid gap-2">{p.items.map(([st,t],i)=><li key={i} className="flex items-start gap-2.5 text-sm">
   <i className={cn('mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-lg border-[1.5px] border-border text-ink [&_svg]:size-[11px] [&_svg]:stroke-[3]',st==='done'&&'border-lime bg-lime',st==='now'&&'border-iris bg-iris',st==='next'&&'border-iris',st==='idea'&&'border-dashed')}>{st==='done'&&<I id="check"/>}</i>
   <span>{t}{st!==p.status&&st!=='done'&&<Badge variant="outline" className="ml-1.5 rounded-md font-mono text-[9.5px] uppercase">{LABEL[st]}</Badge>}</span></li>)}</ul>
 </Card>)}</div>;
}
