'use client';
/* GSAP motion runtime. One place drives the app's entrances and micro-interactions so they share
   the same easing and stay light: only transform/opacity are animated, every entrance runs once,
   and everything is disabled under prefers-reduced-motion (gsap.matchMedia).
   - `.stagger > *` children and `[data-reveal]` blocks: batched entrances. On the landing page they
     wait for the viewport (ScrollTrigger.batch); elsewhere (dashboard, menus, dialogs) they play on mount.
   - `[data-view]`: page transition when the view changes.
   - `.lift`: hover lift via delegated pointer events + gsap quick setters. */
import {useEffect} from 'react';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';

if(typeof window!=='undefined'){gsap.registerPlugin(ScrollTrigger);gsap.defaults({ease:'power3.out',duration:.7});}
export {gsap,ScrollTrigger};
export const reducedMotion=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SEL='.stagger > *, [data-reveal]';
// The first time the runtime starts in a page load, the server's HTML is already on screen. Hiding it to play an
// entrance made every page blink once the scripts arrived (worst on phones: the text was readable, went away and
// faded back). So on that first start nothing visible is touched: what is in the window stays as it is, and only
// blocks further down the landing page wait for their scroll entrance. Later view changes animate as before.
let booted=false;

export function MotionRuntime({viewKey}:{viewKey:string}){
 useEffect(()=>{
  const first=!booted;booted=true;
  const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
   // page transition
   const view=document.querySelector('[data-view]');
   if(view&&!first)gsap.fromTo(view,{autoAlpha:0,y:10},{autoAlpha:1,y:0,duration:.55,clearProps:'transform,opacity,visibility'});

   const seen=new WeakSet<Element>();let settled=!first;
   const scan=()=>{
    let fresh=[...document.querySelectorAll(SEL)].filter(e=>!seen.has(e)&&(e as HTMLElement).offsetParent!==null);
    if(!fresh.length){settled=true;return;}
    fresh.forEach(e=>seen.add(e));
    if(!settled){settled=true;const h=window.innerHeight;fresh=fresh.filter(e=>e.closest('#v-home')&&e.getBoundingClientRect().top>h);if(!fresh.length)return;}
    const onPage=fresh.filter(e=>e.closest('#v-home'));const instant=fresh.filter(e=>!e.closest('#v-home'));
    if(instant.length)gsap.fromTo(instant,{autoAlpha:0,y:12},{autoAlpha:1,y:0,duration:.55,stagger:{each:.04,from:'start'},clearProps:'transform,opacity,visibility'});
    if(onPage.length){
     gsap.set(onPage,{autoAlpha:0,y:18});
     ScrollTrigger.batch(onPage,{start:'top 92%',once:true,interval:.06,batchMax:10,
      onEnter:batch=>gsap.to(batch,{autoAlpha:1,y:0,duration:.75,stagger:.06,overwrite:true,clearProps:'transform,opacity,visibility'})});
    }
   };
   scan();
   let raf=0;
   const mo=new MutationObserver(()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;scan();});});
   mo.observe(document.body,{childList:true,subtree:true});

   // hover lift
   const lift=(e:PointerEvent,up:boolean)=>{const el=(e.target as Element)?.closest?.('.lift');if(!el)return;const rel=e.relatedTarget as Node|null;if(rel&&el.contains(rel))return;gsap.to(el,{y:up?-3:0,duration:up?.35:.45,ease:up?'power2.out':'power3.out',overwrite:'auto'});};
   const over=(e:PointerEvent)=>lift(e,true),out=(e:PointerEvent)=>lift(e,false);
   document.addEventListener('pointerover',over);document.addEventListener('pointerout',out);
   // idle float for elements marked .float
   const floats=gsap.utils.toArray<HTMLElement>('.float').map((el,i)=>gsap.to(el,{y:-7,duration:2.6+i*.3,ease:'sine.inOut',yoyo:true,repeat:-1}));
   // scroll progress bar
   const prog=document.createElement('div');prog.setAttribute('aria-hidden','true');
   prog.style.cssText='position:fixed;left:0;top:0;height:2px;width:100%;background:var(--lime);transform-origin:0 50%;transform:scaleX(0);z-index:60;pointer-events:none';
   document.body.appendChild(prog);
   const progTw=gsap.to(prog,{scaleX:1,ease:'none',scrollTrigger:{start:0,end:'max',scrub:.3}});
   const refresh=setTimeout(()=>ScrollTrigger.refresh(),400);
   return()=>{mo.disconnect();cancelAnimationFrame(raf);document.removeEventListener('pointerover',over);document.removeEventListener('pointerout',out);clearTimeout(refresh);floats.forEach(t=>t.kill());progTw.scrollTrigger?.kill();progTw.kill();prog.remove();};
  });
  mm.add('(prefers-reduced-motion: no-preference) and (pointer: fine)',()=>{
   // cursor follower: lime dot + ring that grows over interactive elements
   const ring=document.createElement('div'),dot=document.createElement('div');
   ring.style.cssText='position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border:1.5px solid color-mix(in srgb,var(--text) 35%,transparent);border-radius:50%;pointer-events:none;z-index:70;opacity:0';
   dot.style.cssText='position:fixed;left:0;top:0;width:6px;height:6px;margin:-3px 0 0 -3px;background:var(--lime);border-radius:50%;pointer-events:none;z-index:71;opacity:0';
   document.body.appendChild(ring);document.body.appendChild(dot);
   const rx=gsap.quickTo(ring,'x',{duration:.45,ease:'power3.out'}),ry=gsap.quickTo(ring,'y',{duration:.45,ease:'power3.out'});
   const dx=gsap.quickTo(dot,'x',{duration:.12,ease:'power2.out'}),dy=gsap.quickTo(dot,'y',{duration:.12,ease:'power2.out'});
   let hot=false;
   const magnets=new WeakMap<Element,{x:(v:number)=>void;y:(v:number)=>void}>();let magnet:Element|null=null;
   const tilts=new WeakMap<Element,{x:(v:number)=>void;y:(v:number)=>void}>();let tilt:Element|null=null;
   const move=(e:PointerEvent)=>{
    gsap.to([ring,dot],{opacity:1,duration:.3,overwrite:'auto'});rx(e.clientX);ry(e.clientY);dx(e.clientX);dy(e.clientY);
    const t=e.target as Element;const isHot=!!t.closest?.('a,button,[role=button],[role=tab],input,textarea,select,label');
    if(isHot!==hot){hot=isHot;gsap.to(ring,{scale:hot?1.6:1,borderColor:hot?'var(--lime)':'color-mix(in srgb,var(--text) 35%,transparent)',duration:.35});}
    const m=t.closest?.('.magnetic');
    if(magnet&&magnet!==m){gsap.to(magnet,{x:0,y:0,duration:.6,ease:'elastic.out(1,.4)'});magnet=null;}
    if(m){if(!magnets.has(m))magnets.set(m,{x:gsap.quickTo(m,'x',{duration:.4,ease:'power3.out'}),y:gsap.quickTo(m,'y',{duration:.4,ease:'power3.out'})});
     const r=m.getBoundingClientRect();const q=magnets.get(m)!;q.x((e.clientX-r.left-r.width/2)*.22);q.y((e.clientY-r.top-r.height/2)*.3);magnet=m;}
    const tl=t.closest?.('.tilt');
    if(tilt&&tilt!==tl){gsap.to(tilt,{rotationX:0,rotationY:0,duration:.7,ease:'power3.out'});tilt=null;}
    if(tl){if(!tilts.has(tl)){gsap.set(tl,{transformPerspective:900});tilts.set(tl,{x:gsap.quickTo(tl,'rotationY',{duration:.5,ease:'power3.out'}),y:gsap.quickTo(tl,'rotationX',{duration:.5,ease:'power3.out'})});}
     const r=tl.getBoundingClientRect();const q=tilts.get(tl)!;q.x(((e.clientX-r.left)/r.width-.5)*10);q.y(-((e.clientY-r.top)/r.height-.5)*8);tilt=tl;}
   };
   const leave=()=>gsap.to([ring,dot],{opacity:0,duration:.3});
   window.addEventListener('pointermove',move,{passive:true});document.documentElement.addEventListener('pointerleave',leave);
   return()=>{window.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',leave);ring.remove();dot.remove();};
  });
  return()=>mm.revert();
 },[viewKey]);
 return null;
}
