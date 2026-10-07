'use client';
/* The live character on the home page's stage (user, 6 Oct 2026: "I want the character on the hero truly alive",
   with one condition: a quarter of the weight). Desktop only; phones, reduced motion and data saver keep the
   picture. It reads the LIGHT pack (public/sim/lite, scripts/build-sim-lite.mjs): 0.8 MB for the first character
   and 2.2 MB for all seven, against 6 MB and 9 MB from the whole pack.
   - Nothing loads until the stage is in view and the browser is idle; the picture stays until the character stands.
   - The next cast member's files are fetched while the current one is on stage, so a change of character swaps
     3D for 3D. If they are not there yet, the picture shows in between.
   - The character stands in the stance of its picture (the motion `Portrait`, same number), so the picture hands
     over without a jump. The library's idle clip is not used here: on these bodies it leans back and stands stiff.
   - Whoever comes on stage says hello with a small wave (the motion `Hello`); then the stage's own life runs (breathing, blinking, looking at the pointer, a
     small thing to do now and then). Drag turns the character; the wheel stays the page's.
   - The loop stops while the stage is out of view or the tab is hidden. */
import {useEffect,useRef,useState} from 'react';
import {loadEngine,presetImageHD,useInViewOnce} from '@/app/avatar';
import {cn} from '@/lib/utils';
import {getCharacter,lookFor,type CharacterId} from '@/lib/characters';
import type {Engine,Stage} from '@/lib/harvex3d/engine';

const liteLook=(id:CharacterId)=>{const L=lookFor(id);return {...L,sim:{...(L.sim||{}),lite:true,baked:id}};};
/** Whether this visit gets the live stage at all. `everywhere`: phones too (one small stage; the hero's stays desktop only). */
function allowed(everywhere?:boolean){
 if(typeof window==='undefined'||typeof DecompressionStream==='undefined')return false;
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||(!everywhere&&!window.matchMedia('(min-width: 768px) and (pointer: fine)').matches))return false;
 if((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData)return false;
 try{return !!document.createElement('canvas').getContext('webgl2');}catch{return false;}
}

/** `id` is who should stand on the stage, `next` who comes after; `onLive` reports who is standing there in 3D
    (null while it is still the picture's turn). */
export function HeroLive({id,next,onLive,everywhere}:{id:CharacterId;next:CharacterId;onLive:(id:CharacterId|null)=>void;everywhere?:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null);const [wrap,seen]=useInViewOnce<HTMLDivElement>('0px');
 const st=useRef<{R:Engine;s:Stage}|null>(null);const want=useRef({id,next});const report=useRef(onLive);
 useEffect(()=>{report.current=onLive;});
 // put `who` on the stage; fetch the one after
 const show=useRef((who:CharacterId,after:CharacterId)=>{const cur=st.current;if(!cur||!cur.R.sim)return;const {R,s}=cur;
  const L=liteLook(who);if(!R.sim!.ready(R.normalizeLook(L)))report.current(null);
  s.setLook(L).then(()=>{if(st.current!==cur||want.current.id!==who)return;
   s.anim.portrait=R.poseOf(R.normalizeLook(lookFor(who)));if(s.anim.stance!=='Portrait')s.anim.play('Portrait');
   report.current(who);
   setTimeout(()=>{if(st.current===cur&&want.current.id===who&&s.anim.cur==='Portrait')s.anim.play('Hello');},900);
   R.sim!.ensure(R.normalizeLook(liteLook(after))).catch(()=>{});},()=>{});});
 useEffect(()=>{want.current={id,next};show.current(id,next);},[id,next]);
 useEffect(()=>{
  if(!seen||!allowed(everywhere))return;let alive=true,idle=0,timer=0;
  const begin=()=>{timer=window.setTimeout(()=>{loadEngine().then(R=>{
   if(!alive||!canvas.current||!R.sim||!R.sim.enabled)return;
   const s=new R.Stage(canvas.current,{bare:true});st.current={R,s};s.start();show.current(want.current.id,want.current.next);
  }).catch(()=>{});},500);};
  const w=window as Window&{requestIdleCallback?:(f:()=>void,o?:{timeout:number})=>number;cancelIdleCallback?:(n:number)=>void};
  if(w.requestIdleCallback)idle=w.requestIdleCallback(begin,{timeout:3000});else begin();
  // run only while it can be seen
  const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(es=>{const s=st.current?.s;if(!s)return;if(es.some(e=>e.isIntersecting)&&!document.hidden)s.start();else s.stop();},{threshold:.05});
  if(io&&wrap.current)io.observe(wrap.current);
  const vis=()=>{const s=st.current?.s;if(!s)return;if(document.hidden)s.stop();else s.start();};
  document.addEventListener('visibilitychange',vis);
  return()=>{alive=false;clearTimeout(timer);if(idle&&w.cancelIdleCallback)w.cancelIdleCallback(idle);io?.disconnect();document.removeEventListener('visibilitychange',vis);
   const cur=st.current;st.current=null;report.current(null);cur?.s.dispose();};
 },[seen,wrap,everywhere]);
 return <div ref={wrap} className="absolute inset-0"><canvas ref={canvas} className="size-full" aria-hidden="true"/></div>;
}

/** One cast member standing alone in a box: its picture, and over it the live character where the visit allows one
    (the same light pack and the same stance, so the picture hands over without a jump). */
export function LiveFigure({id,everywhere,className}:{id:CharacterId;everywhere?:boolean;className?:string}){
 const [live,setLive]=useState<CharacterId|null>(null);const c=getCharacter(id);
 return <div className={cn('absolute inset-0',className)}>
  <img src={presetImageHD(id)} alt={`${c.name}, ${c.role}`} loading="lazy" decoding="async" draggable={false} className={cn('pointer-events-none absolute inset-0 size-full object-contain object-bottom transition-opacity duration-500 ease-smooth',live===id&&'opacity-0')}/>
  <div className={cn('absolute inset-0 transition-opacity duration-500 ease-smooth',live===id?'opacity-100':'pointer-events-none opacity-0')}><HeroLive id={id} next={id} onLive={setLive} everywhere={everywhere}/></div>
 </div>;
}
