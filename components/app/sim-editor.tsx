'use client';
/* The character creator for the parametric humans (lib/harvex3d/src/e2c-sim.js), shown inside the Studio's outfit
   editor (the bodies are the default; ?sim=0 switches back to the earlier ones in this browser).
   - Shape: age, muscle, weight, height and chest as plain sliders;
   - Body detail and Face: the detail sliders the asset pack lists (public/sim/index.json), grouped;
   - Hair, Outfit, Shoes, Brows: the fitted pieces of the pack, picked by picture.
   Everything is written to `look.sim`; a value that was never touched is left out, so the character's preset and
   its build keep deciding it. The stage reshapes the body on every change (the structure only changes with a piece). */
import {useEffect,useState,useSyncExternalStore,type ReactNode} from 'react';
import {AccordionContent,AccordionItem,AccordionTrigger} from '@/components/ui/accordion';
import {Slider} from '@/components/ui/slider';
import {cn} from '@/lib/utils';
import type {Look} from '@/lib/characters';
import type {SimLook} from '@/lib/harvex3d/engine';

type Piece={thumb?:string};
type Index={pieces:Record<string,Record<string,Piece>>;sliders:{id:string;group:string;label:string}[]};
let INDEX:Promise<Index>|null=null;
const loadIndex=()=>INDEX||(INDEX=fetch('/sim/index.json').then(r=>{if(!r.ok)throw new Error('sim index');return r.json() as Promise<Index>;}).catch(e=>{INDEX=null;throw e;}));

/* The switch is read from the address as soon as this module loads (it is part of the app shell), not when the 3D
   engine does: the engine loads late, after the address may have changed, and the editor must agree with it. */
if(typeof window!=='undefined')try{
 if(/[?&]sim=0\b/.test(location.search))localStorage.setItem('harvex-sim','0');else if(/[?&]sim=1\b/.test(location.search))localStorage.removeItem('harvex-sim');
}catch{/* no storage: the new bodies stay on */}

/** Whether the parametric bodies are on in this browser: they are, unless ?sim=0 switched them off (?sim=1 undoes that). */
const never=()=>()=>{};
export function useSimOn(){
 return useSyncExternalStore(never,()=>{try{return localStorage.getItem('harvex-sim')!=='0';}catch{return true;}},()=>true);
}

// what the build stands for while a number is untouched: [muscle, weight, chest] (the same table as the engine's)
const BUILD:Record<string,[number,number,number]>={slim:[.4,.36,.35],regular:[.5,.5,.5],curvy:[.42,.66,.72],broad:[.86,.56,.5]};
const GROUPS:[string,string][]=[['body','Body detail'],['head','Head'],['eyes','Eyes and brows'],['nose','Nose'],['mouth','Mouth'],['jaw','Jaw and cheeks']];
const nice=(s:string)=>s.replace(/^(male|female)_/,'').replace(/(\d+)$/,' $1').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());

function Sec({title,children}:{title:string;children:ReactNode}){
 return <AccordionItem value={title} className="border-b last:border-b-0">
  <AccordionTrigger className="py-3 font-mono text-[11px] font-semibold tracking-[.1em] text-muted-foreground uppercase hover:text-foreground hover:no-underline data-[state=open]:text-foreground">{title}</AccordionTrigger>
  <AccordionContent className="grid gap-4 pb-5">{children}</AccordionContent>
 </AccordionItem>;
}
function Row({label,value,min,max,rest,ends,onChange,onReset}:{label:string;value:number;min:number;max:number;rest:number;ends?:[string,string];onChange:(v:number)=>void;onReset:()=>void}){
 const moved=Math.abs(value-rest)>.005;
 return <div className="grid gap-1.5">
  <div className="flex items-center justify-between text-[13px]"><span className="font-medium">{label}</span>
   {moved?<button onClick={onReset} className="font-mono text-[10px] tracking-[.06em] text-muted-foreground uppercase transition-colors hover:text-foreground">Reset</button>:ends&&<span className="font-mono text-[10px] tracking-[.06em] text-muted-foreground uppercase">{ends[0]} · {ends[1]}</span>}</div>
  <Slider aria-label={label} min={min} max={max} step={.01} value={[value]} onValueChange={v=>onChange(v[0])}/>
 </div>;
}
function Picker({label,items,value,onPick}:{label:string;items:[string,Piece][];value?:string;onPick:(n:string|undefined)=>void}){
 return <div className="grid gap-2"><span className="text-[13px] font-medium">{label}</span>
  <div className="grid grid-cols-4 gap-1.5">
   <button onClick={()=>onPick(undefined)} aria-pressed={!value} className={cn('grid aspect-square place-items-center rounded-xl border text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30',!value&&'border-foreground bg-secondary text-foreground')}>Preset</button>
   {items.map(([n,p])=><button key={n} title={nice(n)} aria-label={nice(n)} aria-pressed={value===n} onClick={()=>onPick(n)} className={cn('tone-light grid aspect-square place-items-center overflow-hidden rounded-xl border transition-[border-color,box-shadow] hover:border-foreground/30',value===n&&'border-foreground shadow-[0_0_0_2px_var(--lime)]')}>
    {p.thumb?<img src={`/sim/thumb/${p.thumb}`} alt="" loading="lazy" className="size-full object-contain p-1"/>:<span className="p-1 text-center text-[10px] leading-tight">{nice(n)}</span>}
   </button>)}
  </div></div>;
}

/** The creator's sections, to be placed inside the outfit editor's accordion. */
export function SimSections({look,onLook}:{look:Look;onLook:(next:Look)=>void}){
 const [ix,setIx]=useState<Index|null>(null);
 useEffect(()=>{let live=true;loadIndex().then(v=>{if(live)setIx(v);},()=>{});return()=>{live=false;};},[]);
 const sim:SimLook=look.sim||{};const b=BUILD[look.build]||BUILD.regular;const fem=look.body==='feminine';
 const write=(next:SimLook)=>{const o=JSON.parse(JSON.stringify(look)) as Look;const clean=Object.fromEntries(Object.entries(next).filter(([,v])=>v!==undefined&&!(v&&typeof v==='object'&&!Object.keys(v).length)));if(Object.keys(clean).length)o.sim=clean as SimLook;else delete o.sim;onLook(o);};
 const num=(k:'age'|'muscle'|'weight'|'height'|'cup',v:number|undefined)=>write({...sim,[k]:v===undefined?undefined:Math.round(v*100)/100});
 const slide=(id:string,v:number|undefined)=>{const s={...(sim.sliders||{})};if(v===undefined||Math.abs(v)<.005)delete s[id];else s[id]=Math.round(v*100)/100;write({...sim,sliders:s});};
 const pick=(k:'hair'|'outfit'|'shoes'|'brows',v:string|undefined)=>write({...sim,[k]:v});
 const list=(kind:string)=>Object.entries(ix?.pieces[kind]||{});
 return <>
  <Sec title="Shape">
   <Row label="Age" ends={['Young','Older']} min={0} max={1} rest={0} value={sim.age??0} onChange={v=>num('age',v)} onReset={()=>num('age',undefined)}/>
   <Row label="Muscle" ends={['Soft','Strong']} min={0} max={1} rest={b[0]} value={sim.muscle??b[0]} onChange={v=>num('muscle',v)} onReset={()=>num('muscle',undefined)}/>
   <Row label="Weight" ends={['Light','Heavy']} min={0} max={1} rest={b[1]} value={sim.weight??b[1]} onChange={v=>num('weight',v)} onReset={()=>num('weight',undefined)}/>
   <Row label="Height" ends={['Short','Tall']} min={0} max={1} rest={.5} value={sim.height??.5} onChange={v=>num('height',v)} onReset={()=>num('height',undefined)}/>
   {fem&&<Row label="Chest" ends={['Small','Full']} min={0} max={1} rest={b[2]} value={sim.cup??b[2]} onChange={v=>num('cup',v)} onReset={()=>num('cup',undefined)}/>}
  </Sec>
  {GROUPS.map(([g,title])=>{const rows=(ix?.sliders||[]).filter(s=>s.group===g);if(!rows.length)return null;
   return <Sec key={g} title={title}>{rows.map(s=><Row key={s.id} label={s.label} min={-1} max={1} rest={0} value={sim.sliders?.[s.id]??0} onChange={v=>slide(s.id,v)} onReset={()=>slide(s.id,undefined)}/>)}</Sec>;})}
  <Sec title="Hair and brows">
   <Picker label="Hair" items={list('hair')} value={sim.hair} onPick={v=>pick('hair',v)}/>
   <Picker label="Brows" items={list('brows')} value={sim.brows} onPick={v=>pick('brows',v)}/>
  </Sec>
  <Sec title="Outfit and shoes">
   <Picker label="Outfit" items={list('outfit')} value={sim.outfit} onPick={v=>pick('outfit',v)}/>
   <Picker label="Shoes" items={list('shoes')} value={sim.shoes} onPick={v=>pick('shoes',v)}/>
   <p className="text-[12px] leading-relaxed text-muted-foreground">The top and bottom colours below dye the main cloth of an outfit. A shirt under a jacket, a tie or a print stays in its own colour.</p>
  </Sec>
 </>;
}
