"use client";
/* Character pictures, light first:
   - Default looks use static images (public/characters/<id>.webp, made by scripts/render-character-thumbs.mjs),
     so pages with character cards never download three.js.
   - Custom looks render through the 3D engine only when the card is on screen and the browser is idle; the
     preset image shows meanwhile, so nothing is ever stuck on "Loading".
   - The live stage shows the same image as a poster, loads the engine when it scrolls into view, and falls back
     to the poster with a Retry button if WebGL fails or takes too long. */
import {useEffect,useRef,useState} from 'react';
import {getCharacter,lookFor,motionNames,type Appearance,type Look} from '@/lib/characters';
import type {Engine,Stage} from '@/lib/harvex3d/engine';

/* The engine and three.js load once, only in the browser, only when a 3D view needs them. The model loader turns on
   the modelled humans (files in public/kit, fetched when a character is shown). */
let enginePromise:Promise<Engine>|null=null;
export function loadEngine(){
 if(!enginePromise)enginePromise=Promise.all([import('three'),import('@/lib/harvex3d/engine'),import('three/examples/jsm/loaders/GLTFLoader.js')]).then(([THREE,m,L])=>m.createEngine(THREE,{GLTFLoader:L.GLTFLoader}))
  .catch(e=>{enginePromise=null;throw e;});
 return enginePromise;
}

/** Static picture of a character's default look. */
export const presetImage=(id:string)=>`/characters/${getCharacter(id).id}.webp`;
/** The same picture at 900x1200, for the places that show a character large (the stage on the home page). */
export const presetImageHD=(id:string)=>`/characters/hd/${getCharacter(id).id}.webp`;
const presetKeys=new Map<string,string>();
function isPresetLook(skin:string,key:string){let k=presetKeys.get(skin);if(!k){k=JSON.stringify(lookFor(skin));presetKeys.set(skin,k);}return k===key;}

/** True once the element has come within `margin` of the viewport. */
export function useInViewOnce<T extends Element>(margin='240px'){
 const ref=useRef<T>(null);const [seen,setSeen]=useState(false);
 useEffect(()=>{if(seen)return;const el=ref.current;
  if(!el||typeof IntersectionObserver==='undefined'){setSeen(true);return;}
  const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){setSeen(true);io.disconnect();}},{rootMargin:margin});
  io.observe(el);return()=>io.disconnect();},[seen,margin]);
 return [ref,seen] as const;
}
const whenIdle=(fn:()=>void)=>{const w=window as any;if(w.requestIdleCallback){const id=w.requestIdleCallback(fn,{timeout:2500});return()=>w.cancelIdleCallback(id);}const t=setTimeout(fn,250);return()=>clearTimeout(t);};

/* Custom looks render one at a time through a single offscreen renderer and are cached. */
const thumbCache=new Map<string,string>();let thumbQueue:Promise<unknown>=Promise.resolve();
/** Image URL for a look: the static preset picture, or (custom looks, when `active`) a rendered thumbnail. */
export function useThumb(look:Look,skin:string,active=true){
 const key=JSON.stringify(look);const preset=isPresetLook(skin,key);
 const [loaded,setLoaded]=useState<{key:string;src:string}|null>(null);
 useEffect(()=>{if(preset||!active||thumbCache.has(key))return;let alive=true;
  const cancel=whenIdle(()=>{thumbQueue=thumbQueue.then(async()=>{if(!alive)return;const R=await loadEngine();
   if(!thumbCache.has(key))thumbCache.set(key,await R.renderThumbAsync(JSON.parse(key),440,560));
   if(alive)setLoaded({key,src:thumbCache.get(key)!});await new Promise(r=>setTimeout(r,16));}).catch(()=>{});});
  return()=>{alive=false;cancel();};},[key,preset,active]);
 if(preset)return presetImage(skin);
 return thumbCache.get(key)||(loaded?.key===key?loaded.src:presetImage(skin));
}
/** Fire a power on the live stage from anywhere (motion tray, keyboard). */
export function castPower(id:string){window.dispatchEvent(new CustomEvent('harvex:power',{detail:id}));}
/** Play a motion once on the live stage (loops become the stance through the `animation` prop). */
export function playMotion(name:string,temp=false){window.dispatchEvent(new CustomEvent('harvex:motion',{detail:{name,temp}}));}
export function resetView(){window.dispatchEvent(new CustomEvent('harvex:view-reset'));}
/** Current animator state for UI highlighting (polled by the deck). */
export function stageState(){const s=(window as any).__harvexStage as Stage|undefined;return s?{cur:s.anim.cur,stance:s.anim.stance}:null;}

type Props={skin?:string;appearance?:Appearance;look?:Partial<Look>;animation?:string;small?:boolean;paused?:boolean;speed?:number};
export default function Avatar(props:Props){return props.small?<AvatarThumb {...props}/>:<AvatarLive {...props}/>;}

function AvatarThumb({skin='atlas',appearance,look}:Props){
 const c=getCharacter(skin);const [ref,seen]=useInViewOnce<HTMLDivElement>();const src=useThumb(lookFor(skin,look,appearance),skin,seen);
 return <div ref={ref} className="avatar-wrap small"><img className="avatar-thumb" src={src} alt={`${c.name}, ${c.desc}`} loading="lazy" decoding="async" draggable={false}/></div>;
}

const ENGINE_TIMEOUT=25000;
function AvatarLive({skin='atlas',appearance,look,animation='Idle',paused=false,speed=1}:Props){
 const canvas=useRef<HTMLCanvasElement>(null);const stage=useRef<Stage|null>(null);const [wrap,seen]=useInViewOnce<HTMLDivElement>('120px');
 const [state,setState]=useState<'idle'|'loading'|'ready'|'error'>('idle');const [retry,setRetry]=useState(0);
 const character=getCharacter(skin);const full=lookFor(skin,look,appearance);const lookKey=JSON.stringify(full);
 const motion=(motionNames as readonly string[]).includes(animation)?animation:'Idle';
 const latest=useRef({lookKey,motion,paused,speed});
 useEffect(()=>{latest.current={lookKey,motion,paused,speed};});
 useEffect(()=>{
  if(!seen)return;
  let alive=true;setState('loading');
  // never stay on "loading": after ENGINE_TIMEOUT the poster stays and a Retry button appears
  const timer=setTimeout(()=>{if(alive&&!stage.current)setState('error');},ENGINE_TIMEOUT);
  loadEngine().then(R=>{
   if(!alive||!canvas.current)return;
   const s=new R.Stage(canvas.current,{onEvent:(ev:string)=>window.dispatchEvent(new CustomEvent('harvex:stage',{detail:ev}))});const cur=latest.current;
   // the picture stays until the character is on stage (a modelled human loads its files first)
   const shown=s.setLook(JSON.parse(cur.lookKey));s.anim.play(cur.motion);s.anim.paused=cur.paused;s.anim.speed=cur.speed;s.start();
   stage.current=s;(window as any).__harvexStage=s;shown.then(()=>{if(alive&&stage.current===s){clearTimeout(timer);setState('ready');}});
  }).catch(()=>{if(alive)setState('error')});
  const onPower=(e:Event)=>{stage.current?.cast(String((e as CustomEvent).detail));};
  const onMotion=(e:Event)=>{const d=(e as CustomEvent).detail;stage.current?.anim.play(d.name,d.temp?{temp:true,dur:900}:undefined);};
  const onReset=()=>{const s=stage.current as any;if(s){s.yaw=0;s.yawVel=0;s.zoom=1;}};
  window.addEventListener('harvex:power',onPower);window.addEventListener('harvex:motion',onMotion);window.addEventListener('harvex:view-reset',onReset);
  const onVis=()=>{const s=stage.current;if(!s)return;if(document.hidden)s.stop();else s.start();};
  document.addEventListener('visibilitychange',onVis);
  return()=>{alive=false;clearTimeout(timer);window.removeEventListener('harvex:power',onPower);window.removeEventListener('harvex:motion',onMotion);window.removeEventListener('harvex:view-reset',onReset);if((window as any).__harvexStage===stage.current)(window as any).__harvexStage=undefined;document.removeEventListener('visibilitychange',onVis);stage.current?.dispose();stage.current=null;};
 },[retry,seen]);
 useEffect(()=>{stage.current?.setLook(JSON.parse(lookKey));},[lookKey,state]);
 useEffect(()=>{const s=stage.current;if(!s)return;if(s.anim.cur!==motion)s.anim.play(motion);},[motion,skin,state]);
 useEffect(()=>{const s=stage.current;if(!s)return;s.anim.paused=paused;s.anim.speed=speed;},[paused,speed,state]);
 const ready=state==='ready';
 return <div ref={wrap} className="avatar-wrap" style={{position:'absolute',inset:0}}>
  {/* poster: the character's picture until the live model is on screen */}
  <img src={presetImage(skin)} alt="" aria-hidden="true" decoding="async" fetchPriority="high" draggable={false}
   style={{position:'absolute',left:'50%',top:'50%',height:'min(78%,640px)',width:'auto',transform:'translate(-50%,-46%)',objectFit:'contain',pointerEvents:'none',transition:'opacity .5s ease',opacity:ready?0:1}}/>
  <canvas ref={canvas} className="avatar-canvas" style={{transition:'opacity .5s ease',opacity:ready?1:0}} aria-label={`${character.name}: 3D preview. Drag to turn, scroll to zoom.`}/>
  {state==='loading'&&<span className="model-loading soft" role="status">Loading 3D…</span>}
  {state==='error'&&<div className="model-loading">3D preview is not available right now.<button className="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>}
 </div>;
}
