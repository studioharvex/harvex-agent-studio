'use client';
/* Dashboard building blocks shared by the app views: page header, KPI cards, segmented filter,
   status badges, empty state. Shapes and paddings follow the levels in app/globals.css: the page pads by
   --pad-sheet on every side, blocks are 24 / p-6, cards 16 / p-4, rows 12 / p-3, tags 8, controls pills. */
import type {ReactNode} from 'react';
import {Badge} from '@/components/ui/badge';
import {I} from '@/app/ui';
import {cn} from '@/lib/utils';
import {Folder,type Tone} from '@/components/harvex/motion';
import {LOGO_MARK,ToneIcon} from '@/components/harvex/navbar';
import {Thumb} from '@/components/landing/mocks';
import type {CharacterId} from '@/lib/characters';

export function DashPage({children,wide}:{children:ReactNode;wide?:boolean}){
 // the same padding on every side of the sheet (the page used to float in the middle with wide side margins)
 return <div className={cn('stagger mx-auto grid w-full grid-cols-[minmax(0,1fr)] gap-6 p-[var(--pad-sheet)] pb-[calc(var(--pad-sheet)+16px)]',wide?'max-w-[1760px]':'max-w-[1680px]')}>{children}</div>;
}

export function PageHeader({title,text,actions,tone='iris',icon}:{title:string;text?:string;actions?:ReactNode;tone?:Tone;icon:string}){
 // the page's contrast band: drawn in the OTHER theme (white on the dark page, black on the white one), with the
 // logo's mark lying large and cropped on its right end, one shade off the band
 return <div className="tone-flip relative flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-2xl p-5 sm:p-6">
  <svg aria-hidden="true" viewBox="0 0 109.26 100" fill="currentColor" className="pointer-events-none absolute top-1/2 -right-6 h-[230%] -translate-y-1/2 text-[var(--panel3)] max-sm:hidden"><path d={LOGO_MARK}/></svg>
  <div className="relative flex min-w-0 items-start gap-4">
   <ToneIcon icon={icon} tone={tone} className="size-11 rounded-lg [&_svg]:size-5"/>
   <div className="grid min-w-0 gap-1"><h1 className="font-display text-[clamp(24px,2.4vw,30px)] leading-tight font-medium tracking-[-.03em]">{title}</h1>{text&&<p className="max-w-[64ch] text-[14.5px] text-muted-foreground">{text}</p>}</div>
  </div>
  {actions&&<div className="relative flex flex-wrap items-center gap-2">{actions}</div>}
 </div>;
}

export function Kpi({label,value,hint,tone,icon,children}:{label:string;value:ReactNode;hint?:ReactNode;tone:Tone;icon:string;children?:ReactNode}){
 // a number is a folder: the label on its tab, the icon beside it, the number in the pocket
 return <Folder tab={label} tone={tone} aside={<span className="grid size-6 place-items-center rounded-full bg-[var(--fold)] [&_svg]:size-3.5"><I id={icon}/></span>} pocket="justify-between gap-3">
  <div className="grid gap-1"><b className="font-display text-[30px] leading-none font-medium tracking-[-.04em] tabular-nums">{value}</b>{hint&&<span className="text-xs text-muted-foreground">{hint}</span>}</div>
  {children}
 </Folder>;
}
export function KpiRow({children}:{children:ReactNode}){return <div className="stagger grid grid-cols-2 gap-4 max-sm:gap-3 lg:grid-cols-4">{children}</div>;}

/** Segmented filter with counts (All · Published · Private ...). */
export function Segmented<T extends string>({value,onChange,items,className}:{value:T;onChange:(v:T)=>void;items:[T,string,number?][];className?:string}){
 return <div role="tablist" className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-full border bg-secondary/60 p-1 max-sm:rounded-2xl sm:flex-wrap',className)}>
  {items.map(([v,l,n])=><button key={v} role="tab" aria-selected={value===v} onClick={()=>onChange(v)}
   className={cn('flex h-8 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground',value===v&&'bg-background text-foreground shadow-[0_0_0_1px_var(--line2)]')}>
   {l}{n!==undefined&&<span className="rounded-full bg-secondary px-1.5 font-mono text-[10px] text-muted-foreground">{n}</span>}
  </button>)}
 </div>;
}

const STATUS:Record<string,string>={live:'bg-t-mint text-tx-mint',private:'bg-secondary text-muted-foreground',archived:'bg-t-amber text-tx-amber',complete:'bg-t-mint text-tx-mint',failed:'bg-t-coral text-tx-coral',pending:'bg-t-sky text-tx-sky',sample:'bg-t-iris text-tx-iris',live_ai:'bg-t-lime text-tx-lime',grant:'bg-t-lime text-tx-lime',run:'bg-t-sky text-tx-sky',earning:'bg-t-mint text-tx-mint',refund:'bg-t-amber text-tx-amber',fee:'bg-t-coral text-tx-coral'};
export function StatusBadge({kind,children,className}:{kind:string;children?:ReactNode;className?:string}){
 return <Badge className={cn('rounded-md border-0 font-mono text-[10px] font-semibold tracking-[.06em] uppercase',STATUS[kind]||'bg-secondary text-muted-foreground',className)}>{children??kind}</Badge>;
}

export function EmptyState({title,text,action,chars=['atlas','lumi','scout']}:{title:string;text:string;action?:ReactNode;chars?:CharacterId[]}){
 return <div className="grid justify-items-center gap-4 rounded-2xl border border-dashed px-6 py-14 text-center">
  <div className="flex -space-x-4">{chars.map((c,k)=><Thumb key={c} id={c} className={cn('size-16 rounded-xl border-2 border-background object-[50%_18%]',['bg-t-lime','bg-t-iris','bg-t-coral'][k%3])}/>)}</div>
  <div className="grid gap-1"><b className="font-display text-lg font-medium">{title}</b><p className="max-w-[46ch] text-sm text-muted-foreground">{text}</p></div>
  {action}
 </div>;
}
