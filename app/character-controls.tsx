'use client';
/* Studio controls. Layout goal: calm stage, one place for each job.
   - Roster: a panel inside the editor ("Character" tab), not a strip competing with the stage.
   - OutfitEditor: collapsible sections (one open at a time by default) with light option chips.
   - Powers: slim icon rail on the stage edge; name, key and description live in a tooltip.
   - MotionDeck: one floating strip (group select + chips) at the bottom of the stage.
   - StageControls: compact play/speed/reset pill. */
import {useEffect,useState} from 'react';
import {characters,getCharacter,lookFor,legacyFromLook,wardrobe,motionGroups,powers,loopMotions,type CharacterId,type Appearance,type Look,type Motion} from '@/lib/characters';
import {presetImage,castPower,playMotion,resetView,stageState} from './avatar';
import {I,Options,Swatches} from './ui';
import {SimSections,useSimOn} from '@/components/app/sim-editor';
import {Button} from '@/components/ui/button';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger} from '@/components/ui/accordion';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@/components/ui/tooltip';
import {SearchBox} from '@/components/harvex/search';
import {filterItems,type SearchMode} from '@/lib/search';
import {cn} from '@/lib/utils';

const pick=<T,>(items:readonly T[])=>items[crypto.getRandomValues(new Uint32Array(1))[0]%items.length];

/* ---------- Roster (editor tab) ---------- */
function RosterCard({c,selected,onSelect}:{c:typeof characters[number];selected:boolean;onSelect:()=>void}){
 return <button aria-pressed={selected} title={c.desc} onClick={onSelect} className={cn('group relative flex w-full flex-col overflow-hidden rounded-lg border bg-card text-left transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-foreground/25',selected&&'border-lime shadow-[0_0_0_1px_var(--lime)]')}>
  <img className="h-[118px] w-full bg-[var(--thumb-bg)] object-cover object-[50%_28%]" alt="" src={presetImage(c.id)} loading="lazy" decoding="async" draggable={false}/>
  {selected&&<span className="absolute top-1.5 left-1.5 grid size-5 place-items-center rounded-sm bg-lime text-ink [&_svg]:size-3"><I id="check"/></span>}
  <span className="grid gap-px px-2 pt-1.5 pb-2"><b className="truncate text-[13px] font-semibold">{c.name}</b><span className="truncate font-mono text-[9px] tracking-[.08em] text-muted-foreground uppercase">{c.role}</span></span>
 </button>;
}
export function Roster({skin,onSelect}:{skin:string;onSelect:(id:CharacterId)=>void}){
 const [q,setQ]=useState('');const [mode,setMode]=useState<SearchMode>('title');const [cat,setCat]=useState('All');
 const base=characters.filter(c=>cat==='All'||c.category===cat);
 const list=filterItems(base,q,mode,c=>({title:c.name+' '+c.role,body:c.desc+' '+(powers.find(p=>p.id===c.sig)?.name||'')}));
 return <div className="grid gap-3" aria-label="Characters">
  <div className="flex items-center gap-2">
   <SearchBox compact value={q} onChange={setQ} mode={mode} onMode={setMode} count={list.length} placeholder="Search name or role" label="Search characters" className="flex-1"/>
  </div>
  {/* the Humans / Bots filter is only there while the roster has bots (it has none since 6 Oct 2026) */}
  {characters.some(c=>c.category==='Companion')&&<ToggleGroup type="single" spacing={1.5} value={cat} onValueChange={v=>v&&setCat(v)} className="justify-start" aria-label="Filter">
   {[['All',`All ${characters.length}`],['Humanoid','Humans'],['Companion','Bots']].map(([v,l])=><ToggleGroupItem key={v} value={v} className="h-7 flex-none bg-secondary/70 px-2.5 text-[12.5px] data-[state=on]:bg-foreground data-[state=on]:text-background">{l}</ToggleGroupItem>)}
  </ToggleGroup>}
  <div className="stagger grid grid-cols-3 gap-2 max-[420px]:grid-cols-2">
   {list.map(c=><RosterCard key={c.id} c={c} selected={skin===c.id} onSelect={()=>onSelect(c.id)}/>)}
   {list.length===0&&<p className="col-span-3 p-2 text-sm text-muted-foreground">No character fits that search.{mode==='title'&&<> <button className="font-medium text-foreground underline underline-offset-4" onClick={()=>setMode('all')}>Search everything</button></>}</p>}
  </div>
 </div>;
}

/* ---------- Outfit editor (editor tab) ---------- */
function G({title,children}:{title:string;children:React.ReactNode}){
 return <AccordionItem value={title} className="border-b last:border-b-0">
  <AccordionTrigger className="py-3 font-mono text-[11px] font-semibold tracking-[.1em] text-muted-foreground uppercase hover:text-foreground hover:no-underline data-[state=open]:text-foreground">{title}</AccordionTrigger>
  <AccordionContent className="grid gap-4 pb-5">{children}</AccordionContent>
 </AccordionItem>;
}
export function OutfitEditor({skin,look,appearance,onLook,onChange}:{skin:string;look?:Partial<Look>;appearance?:Appearance;onLook:(v:Look)=>void;onChange?:(v:Appearance)=>void}){
 const c=getCharacter(skin);const L=lookFor(skin,look,appearance);const human=c.category==='Humanoid';const android=L.headStyle==='screen';const suit=L.top.type==='spacesuit';const W=wardrobe;
 // the parametric bodies have their own creator: its sections replace hair style, top, bottom and shoes (their colours stay)
 const sim=useSimOn()&&human&&!android;
 function set(path:string,value:string){const next=JSON.parse(JSON.stringify(L));const k=path.split('.');let o=next;while(k.length>1)o=o[k.shift()!];o[k[0]]=value;if(path==='top.type'&&value==='spacesuit'&&next.head==='none')next.head='helmet';onLook(next);onChange?.(legacyFromLook(next));}
 function randomize(){const n=JSON.parse(JSON.stringify(L)) as Look;
  if(!human){n.top.color=pick(W.swatches);n.top.accent=pick(W.swatches);n.glow=pick(W.glow);}
  else{n.build=pick(W.build)[0];if(!android){n.body=pick(W.body)[0];n.skin=pick(W.skin);n.hair={style:pick(W.hair.slice(0,12))[0],color:pick(W.hairColors)};n.facial=Math.random()<.2?pick(['stubble','beard']):'none';n.eyes=pick(W.eyes);}
   n.top={type:pick(W.top.slice(0,11))[0],color:pick(W.swatches),accent:pick(W.swatches)};n.bottom={type:pick(W.bottom)[0],color:pick(W.swatches)};n.legwear=pick(['bare','tights']);n.shoes={type:pick(W.shoes)[0],color:pick(W.swatches)};
   n.head=Math.random()<.45?pick(W.head.slice(1,7))[0]:'none';n.face=Math.random()<.3?pick(W.face.slice(1))[0]:'none';n.back=Math.random()<.35?pick(W.back.slice(1))[0]:'none';n.accColor=pick(W.swatches);n.glow=pick(W.glow);}
  onLook(n);onChange?.(legacyFromLook(n));playMotion('Spin');}
 return <div className="grid gap-2">
  <div className="grid grid-cols-2 gap-2"><Button variant="secondary" size="sm" onClick={randomize}><I id="dice"/>Randomize</Button><Button variant="ghost" size="sm" className="border" onClick={()=>{const p=lookFor(skin);onLook(p);onChange?.(legacyFromLook(p));}}><I id="reset"/>Reset to {c.name}</Button></div>
  <Accordion type="multiple" defaultValue={[human?'Body':'Shell']} key={skin}>
   {!human?<G title="Shell"><Swatches label="Body color" value={L.top.color} colors={W.swatches} onChange={v=>set('top.color',v)}/><Swatches label="Accent" value={L.top.accent} colors={W.swatches} onChange={v=>set('top.accent',v)}/></G>:<>
    <G title="Body">{!android&&<Options label="Body" value={L.body||'masculine'} options={W.body} onChange={v=>set('body',v)}/>}<Options label="Build" value={L.build} options={W.build} onChange={v=>set('build',v)}/>{android?<Swatches label="Plating" value={L.top.accent} colors={W.swatches} onChange={v=>set('top.accent',v)}/>:<><Swatches label="Skin tone" value={L.skin} colors={W.skin} onChange={v=>set('skin',v)}/><Swatches label="Eyes" value={L.eyes} colors={W.eyes} onChange={v=>set('eyes',v)}/></>}</G>
    {sim&&<SimSections look={L} onLook={n=>{onLook(n);onChange?.(legacyFromLook(n));}}/>}
    {sim&&<G title="Hair colour"><Swatches label="Color" value={L.hair.color} colors={W.hairColors} onChange={v=>set('hair.color',v)}/></G>}
    {!android&&!sim&&<G title="Hair"><Options label="Style" value={L.hair.style} options={W.hair} onChange={v=>set('hair.style',v)}/><Swatches label="Color" value={L.hair.color} colors={W.hairColors} onChange={v=>set('hair.color',v)}/><Options label="Facial hair" value={L.facial} options={W.facial} onChange={v=>set('facial',v)}/></G>}
    {!sim&&<><G title="Top"><Options label="Type" value={L.top.type} options={W.top} onChange={v=>set('top.type',v)}/><Swatches label="Color" value={L.top.color} colors={W.swatches} onChange={v=>set('top.color',v)}/><Swatches label="Accent / trim" value={L.top.accent} colors={W.swatches} onChange={v=>set('top.accent',v)}/></G>
    <G title="Bottom">{suit?<p className="text-[13px] text-muted-foreground">Legs are inside the spacesuit. Bottoms can be changed once you choose a different top.</p>:<><Options label="Type" value={L.bottom.type} options={W.bottom} onChange={v=>set('bottom.type',v)}/><Swatches label="Color" value={L.bottom.color} colors={W.swatches} onChange={v=>set('bottom.color',v)}/>{['skirt','shorts'].includes(L.bottom.type)&&<Options label="Legs" value={L.legwear} options={W.legwear} onChange={v=>set('legwear',v)}/>}</>}</G>
    <G title="Shoes">{suit?<p className="text-[13px] text-muted-foreground">The spacesuit comes with its own boots.</p>:<><Options label="Type" value={L.shoes.type} options={W.shoes} onChange={v=>set('shoes.type',v)}/><Swatches label="Color" value={L.shoes.color} colors={W.swatches} onChange={v=>set('shoes.color',v)}/></>}</G>
    </>}
    {sim&&<G title="Colours"><Swatches label="Top" value={L.top.color} colors={W.swatches} onChange={v=>set('top.color',v)}/><Swatches label="Bottom" value={L.bottom.color} colors={W.swatches} onChange={v=>set('bottom.color',v)}/><Swatches label="Shoes" value={L.shoes.color} colors={W.swatches} onChange={v=>set('shoes.color',v)}/></G>}
    <G title="Gear"><Options label="Head" value={L.head} options={W.head} onChange={v=>set('head',v)}/><Options label="Face" value={L.face} options={android?W.face.filter(x=>x[0]==='none'||x[0]==='visor'):W.face} onChange={v=>set('face',v)}/><Options label="Back" value={L.back} options={W.back} onChange={v=>set('back',v)}/><Swatches label="Gear color" value={L.accColor} colors={W.swatches} onChange={v=>set('accColor',v)}/></G></>}
   <G title="Glow & finish"><Swatches label="Glow color (lights, powers, pad)" value={L.glow} colors={W.glow} onChange={v=>set('glow',v)}/><Options label="Finish" value={L.finish} options={W.finish} onChange={v=>set('finish',v)}/></G>
  </Accordion>
 </div>;
}

/* ---------- Stage HUD ---------- */
export function Powers({skin}:{skin:string}){
 const sig=getCharacter(skin).sig;const [cool,setCool]=useState<Record<string,{until:number;dur:number}>>({});const [now,setNow]=useState(0);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),100);return()=>clearInterval(t);},[]);
 function fire(id:string){const t=Date.now();if((cool[id]?.until||0)>t)return;const p=powers.find(x=>x.id===id)!;castPower(id);const dur=p.cd*(id===sig?600:1000);setCool(c=>({...c,[id]:{until:t+dur,dur}}));}
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')||e.metaKey||e.ctrlKey||e.altKey)return;const p=powers.find(x=>x.key===e.key);if(p){e.preventDefault();fire(p.id);}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);});
 return <TooltipProvider delayDuration={120}><div aria-label="Powers" className="flex flex-col gap-1 rounded-xl border bg-background/85 p-1 backdrop-blur-md max-[820px]:flex-row">{powers.map(p=>{const c=cool[p.id];const left=c?Math.max(0,c.until-now):0;const pct=c&&left>0?(left/c.dur)*100:0;
  return <Tooltip key={p.id}><TooltipTrigger asChild><button onClick={()=>fire(p.id)} aria-label={`${p.name}, key ${p.key}`}
   className={cn('relative grid size-10 place-items-center overflow-hidden rounded-lg text-foreground transition-colors duration-300 hover:bg-secondary [&_svg]:size-[18px]',p.id===sig&&'bg-t-lime text-tx-lime')}>
   <I id={p.id}/><kbd className="absolute right-1 bottom-0.5 font-mono text-[8.5px] text-muted-foreground">{p.key}</kbd>
   {pct>0&&<span className="pointer-events-none absolute inset-0" style={{background:`conic-gradient(color-mix(in srgb,var(--bg) 78%,transparent) ${pct}%,transparent 0)`}}/>}
  </button></TooltipTrigger><TooltipContent side="right" className="max-w-[220px]"><b>{p.name}</b> · key {p.key}{p.id===sig&&' · signature'}<br/><span className="opacity-80">{p.desc}</span></TooltipContent></Tooltip>;})}</div></TooltipProvider>;
}
export function MotionDeck({stance,onStance}:{stance:string;onStance:(m:Motion)=>void}){
 const [group,setGroup]=useState(0);const [cur,setCur]=useState('');
 useEffect(()=>{const t=setInterval(()=>{const s=stageState();setCur(s?s.cur:'');},200);return()=>clearInterval(t);},[]);
 return <div className="flex min-w-0 items-center gap-1.5 rounded-xl border bg-background/85 p-1 backdrop-blur-md">
  <Select value={String(group)} onValueChange={v=>setGroup(Number(v))}>
   <SelectTrigger size="sm" className="h-8 w-[112px] shrink-0 border-0 bg-secondary/70 text-[12.5px] shadow-none" aria-label="Motion group"><SelectValue/></SelectTrigger>
   <SelectContent>{motionGroups.map((g,i)=><SelectItem key={g[0]} value={String(i)}>{g[0]}</SelectItem>)}</SelectContent>
  </Select>
  <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Motions">{(motionGroups[group][1] as Motion[]).map(m=>{const loop=loopMotions.includes(m);const on=m===stance;
   return <button key={m} aria-pressed={on} title={loop?'Loops, and is then the default stance of the agent':'Plays a single time'} onClick={()=>{if(loop)onStance(m);else playMotion(m);}}
    className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-300 hover:bg-secondary',on&&'bg-lime text-ink hover:bg-lime',cur===m&&!on&&'bg-secondary')}>
    {loop&&<span className={cn('size-1.5 rounded-sm border border-muted-foreground',on&&'border-ink bg-ink')}/>}{m}</button>;})}</div>
 </div>;
}
export function StageControls({paused,onPause,speed,onSpeed}:{paused:boolean;onPause:()=>void;speed:number;onSpeed:(v:number)=>void}){
 return <div className="flex items-center gap-0.5 rounded-xl border bg-background/85 p-1 backdrop-blur-md">
  <Button variant="ghost" size="icon-sm" onClick={onPause} aria-label={paused?'Play animation':'Pause animation'}><I id={paused?'play':'pause'}/></Button>
  <ToggleGroup type="single" size="sm" value={String(speed)} onValueChange={v=>v&&onSpeed(Number(v))} aria-label="Animation speed">
   {[0.5,1,1.5].map(v=><ToggleGroupItem key={v} value={String(v)} className="h-8 px-2 font-mono text-[11px] data-[state=on]:bg-foreground data-[state=on]:text-background">{v===1?'1×':v===0.5?'.5×':'1.5×'}</ToggleGroupItem>)}
  </ToggleGroup>
  <Button variant="ghost" size="icon-sm" onClick={resetView} aria-label="Reset view"><I id="target"/></Button>
 </div>;
}
