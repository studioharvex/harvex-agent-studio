'use client';
/* Reusable marketing primitives: motion helpers (Marquee, Reveal, CountUp, Typewriter, scroll
   progress) and small design atoms (Eyebrow, CutButton, BracketLink, Corners, DashedRule).
   Everything respects prefers-reduced-motion. No gradients, no scenery. */
import {useEffect,useRef,useState,type ButtonHTMLAttributes,type CSSProperties,type HTMLAttributes,type ReactNode} from 'react';
import {cn} from '@/lib/utils';
import {gsap,ScrollTrigger} from './gsap-motion';

export const reduced=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export type Tone='lime'|'iris'|'coral'|'sky'|'amber'|'mint'|'pink'|'ink';
export const TONE_BG:Record<Tone,string>={lime:'bg-lime',iris:'bg-iris',coral:'bg-coral',sky:'bg-sky',amber:'bg-amber',mint:'bg-mint',pink:'bg-pink',ink:'bg-foreground'};
export const TINT_BG:Record<Tone,string>={lime:'bg-t-lime',iris:'bg-t-iris',coral:'bg-t-coral',sky:'bg-t-sky',amber:'bg-t-amber',mint:'bg-t-mint',pink:'bg-t-pink',ink:'bg-secondary'};

/** Infinite horizontal marquee. Children render twice; the copy is inert. `fade` lets the row run out softly at
    both ends instead of being cut by the edge of its box (a mask, so it works on any background). */
export function Marquee({children,reverse,duration=40,gap='1rem',pauseOnHover=true,fade,className}:{children:ReactNode;reverse?:boolean;duration?:number;gap?:string;pauseOnHover?:boolean;fade?:boolean;className?:string}){
 const track=useRef<HTMLDivElement>(null);
 useEffect(()=>{const el=track.current;if(!el||reduced())return;
  const gapPx=()=>parseFloat(getComputedStyle(el).columnGap)||0;
  const dist=()=>(el.scrollWidth+gapPx())/2;
  const tw=gsap.fromTo(el,{x:reverse?()=>-dist():0},{x:reverse?0:()=>-dist(),duration,ease:'none',repeat:-1,invalidateOnRefresh:true});
  const box=el.parentElement!;
  const slow=()=>gsap.to(tw,{timeScale:0,duration:.6,ease:'power2.out',overwrite:true});
  const go=()=>gsap.to(tw,{timeScale:1,duration:.8,ease:'power2.in',overwrite:true});
  if(pauseOnHover){box.addEventListener('pointerenter',slow);box.addEventListener('pointerleave',go);}
  return()=>{tw.kill();box.removeEventListener('pointerenter',slow);box.removeEventListener('pointerleave',go);};},[duration,reverse,pauseOnHover]);
 return <div className={cn('flex overflow-hidden',fade&&'[mask-image:linear-gradient(90deg,transparent,#000_9%,#000_91%,transparent)]',className)} style={{'--marquee-gap':gap} as CSSProperties}>
  <div ref={track} className="flex w-max shrink-0 items-center gap-[var(--marquee-gap)] will-change-transform">
   {children}<div className="contents" aria-hidden="true" inert>{children}</div>
  </div>
 </div>;
}

export function useInView<T extends Element>(once=true,margin='0px 0px -10% 0px'){
 const ref=useRef<T>(null);const [inView,setInView]=useState(false);
 useEffect(()=>{const el=ref.current;if(!el)return;if(reduced()||!('IntersectionObserver' in window)){setInView(true);return;}
  const io=new IntersectionObserver(([e])=>{if(e.isIntersecting){setInView(true);if(once)io.disconnect();}else if(!once)setInView(false);},{rootMargin:margin,threshold:.1});
  io.observe(el);return()=>io.disconnect();},[once,margin]);
 return [ref,inView] as const;
}

/** Fade-up on first view. */
export function Reveal({children,className,delay=0}:{children:ReactNode;className?:string;delay?:number}){
 return <div data-reveal="" data-delay={delay||undefined} className={className}>{children}</div>;
}

/** Twenty-style section label: a small solid square + text. */
export function Eyebrow({children,tone='iris',className}:{children:ReactNode;tone?:Tone;className?:string}){
 return <span className={cn('inline-flex items-center gap-2 text-[13px] font-medium text-foreground',className)}><i className={cn('h-2 w-3 rounded-[2px]',TONE_BG[tone])}/>{children}</span>;
}

/** A card shaped like a folder (user, 6 Oct 2026, with a picture of a file folder: "cards like this folder, in the
    round, smooth style we have"): a tab on the top left that runs into the folder's back with a soft inner curve,
    the back in a tint, and in front of it the pocket, a lighter sheet that holds the content. `back` is what lies
    on the folder behind the pocket (a picture, a few chips), `aside` sits beside the tab on the right (an icon, a
    count). `fold` gives the back a colour of its own instead of a tone. The tab and the back must be one opaque
    colour: they overlap by a pixel. Hover shadow: the folder is its own `group/folder`. */
export function Folder({tab,tone='lime',fold,aside,back,backClass,children,className,pocket}:{tab:ReactNode;tone?:Tone;fold?:string;aside?:ReactNode;back?:ReactNode;backClass?:string;children:ReactNode;className?:string;pocket?:string}){
 return <div className={cn('group/folder relative flex min-w-0 flex-col pt-7',className)} style={{'--fold':fold||`var(--${tone==='ink'?'panel3':'t-'+tone})`} as CSSProperties}>
  <span className="absolute top-0 left-0 flex h-[29px] max-w-[72%] items-center rounded-t-lg bg-[var(--fold)] px-3.5 font-mono text-[10px] leading-none font-semibold tracking-[.1em] whitespace-nowrap text-foreground/70 uppercase after:absolute after:bottom-px after:left-full after:size-3 after:bg-[radial-gradient(circle_at_100%_0,transparent_11.5px,var(--fold)_12px)]"><span className="truncate">{tab}</span></span>
  {aside&&<span className="absolute top-0 right-1.5 flex h-7 items-center gap-1.5">{aside}</span>}
  <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl rounded-tl-none bg-[var(--fold)] p-2 transition-shadow duration-500 ease-smooth group-hover/folder:shadow-[0_22px_44px_-26px_rgb(0_0_0/.3)]',!back&&'pt-3')}>
   {back&&<div className={cn('min-w-0 px-3 pt-2.5 pb-3',backClass)}>{back}</div>}
   <div className={cn('flex min-w-0 flex-1 flex-col rounded-xl bg-card p-4 shadow-[0_10px_24px_-18px_rgb(0_0_0/.4)]',pocket)}>{children}</div>
  </div>
 </div>;
}

/** A large parent card in the folder's shape (user, 6 Oct 2026: the big round rectangles "are too ordinary, give
    their shape a little something"): a tab on the top left that runs into the slab with the folder's inner curve.
    `fill` is ONE opaque colour (a CSS colour or a var), `ink` the tab's text class on it. The slab is the caller's:
    its classes go in `body`, its attributes and handlers in `bodyProps`. A `rounded-*` in `body` must repeat
    `rounded-tl-none` (tailwind-merge drops it otherwise). */
export function Slab({tab,fill='var(--lime)',ink='text-ink',className,body,bodyProps,children}:{tab:ReactNode;fill?:string;ink?:string;className?:string;body?:string;bodyProps?:HTMLAttributes<HTMLDivElement>;children:ReactNode}){
 return <div className={cn('relative pt-[35px]',className)} style={{'--slab':fill} as CSSProperties}>
  <span className={cn('absolute top-0 left-0 flex h-9 max-w-[72%] items-center gap-2 rounded-t-xl bg-[var(--slab)] px-[18px] font-mono text-[10.5px] leading-none font-semibold tracking-[.1em] whitespace-nowrap uppercase after:absolute after:bottom-px after:left-full after:size-4 after:bg-[radial-gradient(circle_at_100%_0,transparent_15.5px,var(--slab)_16px)]',ink)}>{tab}</span>
  <div {...bodyProps} className={cn('rounded-3xl rounded-tl-none bg-[var(--slab)]',body)}>{children}</div>
 </div>;
}

/** The landing's call-to-action: a pill with a mono label. (The name is from its first shape, a cut corner.) */
export function CutButton({variant='dark',size='md',className,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'dark'|'lime'|'light'|'outline';size?:'sm'|'md'|'lg'}){
 const sz=size==='sm'?'h-9 px-4 text-[11px]':size==='lg'?'h-12 px-7 text-[12.5px]':'h-11 px-6 text-[12px]';
 const fill=variant==='outline'?'border border-foreground/20 bg-background text-foreground hover:border-foreground/60'
  :variant==='lime'?'bg-lime text-ink hover:bg-[var(--lime-hover)]':variant==='light'?'bg-white text-[#0a0a0a] hover:bg-white/85':'bg-foreground text-background hover:bg-foreground/85';
 return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-full font-mono font-semibold tracking-[.08em] uppercase transition-[background-color,border-color,color,transform] duration-300 ease-smooth active:scale-[.97] [&_svg]:size-3.5',sz,fill,className)}>{children}</button>;
}

/** Koyeb-style bracket CTA: ‹ LABEL › with brackets that slide apart on hover. */
export function BracketLink({children,onClick,className}:{children:ReactNode;onClick?:()=>void;className?:string}){
 return <button type="button" onClick={onClick} className={cn('group/bl inline-flex items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[.1em] text-foreground uppercase transition-colors hover:text-brand',className)}>
  <span className="transition-transform duration-300 group-hover/bl:-translate-x-1">‹</span>{children}<span className="transition-transform duration-300 group-hover/bl:translate-x-1">›</span>
 </button>;
}

/** Crosshair "+" marks on the four corners of a relative parent. */
export function Corners({className,tone='text-foreground/40'}:{className?:string;tone?:string}){
 const mark=cn('absolute size-3 before:absolute before:top-1/2 before:left-0 before:h-px before:w-full before:bg-current after:absolute after:left-1/2 after:top-0 after:h-full after:w-px after:bg-current',tone);
 return <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0',className)}>
  <span className={cn(mark,'-top-1.5 -left-1.5')}/><span className={cn(mark,'-top-1.5 -right-1.5')}/><span className={cn(mark,'-bottom-1.5 -left-1.5')}/><span className={cn(mark,'-right-1.5 -bottom-1.5')}/>
 </div>;
}
export function DashedRule({className}:{className?:string}){return <hr className={cn('border-0 border-t border-dashed border-foreground/20',className)}/>;}

/** Counts from 0 to `to` once visible. */
export function CountUp({to,suffix='',className,duration=1400}:{to:number;suffix?:string;className?:string;duration?:number}){
 const ref=useRef<HTMLSpanElement>(null);const [n,setN]=useState(to);
 useEffect(()=>{const el=ref.current;if(!el)return;if(reduced()){setN(to);return;}
  const o={v:0};setN(0);
  const tw=gsap.to(o,{v:to,duration:duration/1000,ease:'power3.out',paused:true,onUpdate:()=>setN(Math.round(o.v))});
  const st=ScrollTrigger.create({trigger:el,start:'top 92%',once:true,onEnter:()=>tw.play()});
  return()=>{tw.kill();st.kill();};},[to,duration]);
 return <span ref={ref} className={cn('tabular-nums',className)}>{n}{suffix}</span>;
}

/** Types words one by one with a blinking caret. */
export function Typewriter({words,className}:{words:string[];className?:string}){
 const [i,setI]=useState(0);const [len,setLen]=useState(0);const [del,setDel]=useState(false);
 useEffect(()=>{if(reduced()){setLen(words[i].length);return;}
  const w=words[i];let t:ReturnType<typeof setTimeout>;
  if(!del&&len<w.length)t=setTimeout(()=>setLen(len+1),55);
  else if(!del)t=setTimeout(()=>setDel(true),1500);
  else if(len>0)t=setTimeout(()=>setLen(len-1),28);
  else{setDel(false);setI((i+1)%words.length);}
  return()=>clearTimeout(t);},[len,del,i,words]);
 return <span className={className}>{words[i].slice(0,len)}<span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[.12em] animate-blink bg-current"/></span>;
}

/** 0..1 progress of a tall element scrolling through the viewport, written to --p. */
export function useScrollProgress<T extends HTMLElement>(){
 const ref=useRef<T>(null);
 useEffect(()=>{const el=ref.current;if(!el)return;if(reduced()){el.style.setProperty('--p','1');return;}
  const tw=gsap.fromTo(el,{'--p':0},{'--p':1,ease:'none',scrollTrigger:{trigger:el,start:'top top',end:'bottom bottom',scrub:.6}});
  return()=>{tw.scrollTrigger?.kill();tw.kill();};},[]);
 return ref;
}
