'use client';
/* Command palette (Ctrl/Cmd K). Its own module so cmdk loads only when the palette opens. */
import {useEffect,useMemo,useState} from 'react';
import {Command,CommandEmpty,CommandGroup,CommandInput,CommandItem,CommandList} from '@/components/ui/command';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {Kbd} from '@/components/ui/kbd';
import {searchItems,type SearchMode} from '@/lib/search';
import {I} from '@/app/ui';
import {Highlight,ModeToggle,type PaletteItem} from './search';

export function SearchPalette({open,onOpenChange,items,suggestions}:{open:boolean;onOpenChange:(o:boolean)=>void;items:PaletteItem[];suggestions:PaletteItem[]}){
 const [q,setQ]=useState('');const [mode,setMode]=useState<SearchMode>('title');
 useEffect(()=>{if(!open){setQ('');}},[open]);
 const hits=useMemo(()=>searchItems(items,q,mode,60),[items,q,mode]);
 const go=(it:PaletteItem)=>{onOpenChange(false);setTimeout(it.run,0);};
 return <Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent showCloseButton={false} className="top-[10vh] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[680px] max-sm:top-0 max-sm:h-[100svh] max-sm:max-w-none max-sm:rounded-none max-sm:border-0">
   <DialogTitle className="sr-only">Search Harvex</DialogTitle>
   <DialogDescription className="sr-only">Search pages, characters, skills, docs and agents.</DialogDescription>
   <Command shouldFilter={false} loop className="flex h-full flex-col bg-transparent **:data-[slot=command-input-wrapper]:h-14 **:data-[slot=command-input-wrapper]:border-b-0 **:data-[slot=command-input-wrapper]:px-5">
    <CommandInput value={q} onValueChange={setQ} placeholder="Search characters, skills, docs, agents…" className="h-14 text-[16px]"/>
    <div className="flex items-center justify-between gap-3 border-y px-5 py-3">
     <ModeToggle mode={mode} onMode={setMode}/>
     <button type="button" onClick={()=>onOpenChange(false)} className="text-muted-foreground hover:text-foreground sm:hidden text-sm">Close</button>
    </div>
    <CommandList className="max-h-[min(62vh,560px)] flex-1 max-sm:max-h-none">
     {q.trim()?<>
      <div className="px-5 pt-4 pb-1 text-sm text-muted-foreground">{hits.length} result{hits.length===1?'':'s'}</div>
      <CommandEmpty className="px-5 py-10 text-center text-sm text-muted-foreground">
       No results for “{q}”.{mode==='title'&&<> <button type="button" className="font-medium text-foreground underline underline-offset-4" onClick={()=>setMode('all')}>Search everything</button> instead?</>}
      </CommandEmpty>
      <CommandGroup className="stagger p-0 [&_[cmdk-group-items]]:contents">
       {hits.map(h=><CommandItem key={h.item.id} value={h.item.id} onSelect={()=>go(h.item)}
         className="mx-2 flex items-start gap-4 rounded-lg border-b border-hairline px-4 py-4 last:border-b-0 data-[selected=true]:bg-accent">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-brand"><I id={h.item.icon}/></span>
        <span className="grid min-w-0 flex-1 gap-1">
         <span className="flex items-baseline justify-between gap-3">
          <Highlight className="truncate text-[17px] font-medium leading-snug text-foreground" text={h.item.title} ranges={h.titleRanges}/>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[.08em] text-dim">{h.item.kind}</span>
         </span>
         {h.snippet&&<Highlight className="line-clamp-2 text-[14.5px] leading-relaxed text-muted-foreground" text={h.snippet.text} ranges={h.snippet.ranges}/>}
        </span>
       </CommandItem>)}
      </CommandGroup>
     </>:<CommandGroup heading="Jump to" className="px-3 py-2">
      {suggestions.map(s=><CommandItem key={s.id} value={s.id} onSelect={()=>go(s)} className="gap-3 rounded-lg px-3 py-2.5">
       <span className="grid size-7 place-items-center rounded-md bg-secondary text-brand"><I id={s.icon}/></span>
       <span className="flex-1 text-[15px]">{s.title}</span><span className="font-mono text-[10px] uppercase tracking-[.08em] text-dim">{s.kind}</span>
      </CommandItem>)}
     </CommandGroup>}
    </CommandList>
    <div className="hidden items-center gap-4 border-t px-5 py-2.5 text-xs text-muted-foreground sm:flex">
     <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
     <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
     <span className="flex items-center gap-1.5"><Kbd>esc</Kbd> close</span>
     <span className="ml-auto">{mode==='title'?'Matching titles only':'Matching titles and content'}</span>
    </div>
   </Command>
  </DialogContent>
 </Dialog>;
}

/* Inline search: input + mode toggle + live count. The parent filters with lib/search filterItems. */
