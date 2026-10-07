'use client';
/* Notion-style search UI built on shadcn Command + Dialog, sharing lib/search.ts:
   - <SearchPalette/>: global ⌘K palette with "Search by title" / "Search everything",
     a result count, and each result as icon + highlighted title + highlighted snippet.
   - <SearchBox/>: the same logic inline (lists, roster, library), with the mode toggle and count. */
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {Kbd} from '@/components/ui/kbd';
import {InputGroup,InputGroupAddon,InputGroupInput} from '@/components/ui/input-group';
import {cn} from '@/lib/utils';
import {searchItems,type Range,type SearchMode} from '@/lib/search';
import {I} from '@/app/ui';

export function Highlight({text,ranges,className}:{text:string;ranges:Range[];className?:string}){
 if(!ranges.length)return <span className={className}>{text}</span>;
 const out:ReactNode[]=[];let last=0;
 ranges.forEach(([a,b],k)=>{if(a>last)out.push(text.slice(last,a));out.push(<mark key={k} className="rounded-[3px] bg-lime/35 px-px text-inherit dark:bg-lime/25">{text.slice(a,b)}</mark>);last=b;});
 if(last<text.length)out.push(text.slice(last));
 return <span className={className}>{out}</span>;
}

export function ModeToggle({mode,onMode,className}:{mode:SearchMode;onMode:(m:SearchMode)=>void;className?:string}){
 // a segmented switch, the same shape as Segmented in components/app/parts.tsx
 return <div className={cn('inline-flex w-fit gap-1 rounded-full border bg-secondary/60 p-1',className)} role="group" aria-label="Search mode">
  {([['title','Search by title'],['all','Search everything']] as const).map(([m,label])=>
   <button key={m} type="button" aria-pressed={mode===m} onClick={()=>onMode(m)}
    className={cn('h-7 rounded-full px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-300',mode===m?'bg-background text-foreground shadow-[0_0_0_1px_var(--line2)]':'text-muted-foreground hover:text-foreground')}>{label}</button>)}
 </div>;
}

export type PaletteItem={id:string;kind:string;title:string;body?:string;icon:string;run:()=>void};

export function SearchBox({value,onChange,mode,onMode,count,placeholder,label,compact,className}:{value:string;onChange:(v:string)=>void;mode:SearchMode;onMode:(m:SearchMode)=>void;count?:number;placeholder:string;label:string;compact?:boolean;className?:string}){
 return <div className={cn('grid gap-2',className)}>
  <InputGroup className={cn('bg-card',compact?'h-9':'h-11 [&_[data-slot=input-group-addon]:first-child]:pl-4')}>
   <InputGroupAddon><I id="search"/></InputGroupAddon>
   <InputGroupInput value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} aria-label={label}/>
   {value&&<InputGroupAddon align="inline-end"><button type="button" onClick={()=>onChange('')} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Clear search">Clear</button></InputGroupAddon>}
  </InputGroup>
  {(value||!compact)&&<div className="flex flex-wrap items-center justify-between gap-2">
   <ModeToggle mode={mode} onMode={onMode} className={compact?'[&>button]:h-6 [&>button]:px-2.5 [&>button]:text-xs':''}/>
   {value&&count!==undefined&&<span className="text-xs text-muted-foreground">{count} result{count===1?'':'s'}</span>}
  </div>}
 </div>;
}
