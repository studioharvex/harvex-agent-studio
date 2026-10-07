'use client';
import {useSyncExternalStore} from 'react';

/* Theme preference: white by default, "dark" stored in localStorage. The inline THEME_BOOT script in app/layout.tsx
   applies it before first paint; the truth is the data-theme attribute on <html>.

   THE SWITCH IS ONE CROSS-FADE (user, 6 Oct 2026: "the change from light to dark feels very heavy"). It used to put
   a 0.35 s colour transition on EVERY element of the page (`.theme-anim *`) and to re-render the whole app, because
   the theme was state of the root component. Now:
   - the browser takes a picture of the page, the theme changes in one step, and the two pictures fade into each
     other on the compositor (View Transitions; `.theme-switch` in app/globals.css sets the timing). While it runs,
     no element animates on its own (transition: none), so the new picture is final from its first frame;
   - without that API, or with reduced motion, the theme changes at once;
   - the theme is a small store outside React (useSyncExternalStore): only what calls useTheme() renders again
     (the theme buttons, the toaster), not the page. Do not lift it back into app/studio.tsx. */
export type Theme='dark'|'light';
const KEY='harvex-theme';
const listeners=new Set<()=>void>();
const current=():Theme=>document.documentElement.dataset.theme==='light'?'light':'dark';
const subscribe=(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};};

export function setTheme(t:Theme){
 const root=document.documentElement;if(current()===t)return;
 try{localStorage.setItem(KEY,t);}catch{}
 let flipped=false;
 const flip=()=>{if(flipped)return;flipped=true;if(t==='light')root.dataset.theme='light';else delete root.dataset.theme;listeners.forEach(f=>f());};
 const done=()=>root.classList.remove('theme-switch');
 root.classList.add('theme-switch');
 const calm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!calm&&typeof document.startViewTransition==='function'){
  try{
   document.startViewTransition(flip).finished.then(done,done);
   // the browser calls flip() with its next frame. A page that is not being drawn (a background tab) gets no
   // frame, so the theme must not wait for one: after a moment it changes anyway
   window.setTimeout(()=>{if(!flipped){flip();done();}},180);
   return;
  }catch{/* fall through to the plain switch */}
 }
 flip();window.setTimeout(done,60);
}

export function useTheme():[Theme,(t:Theme)=>void]{
 return [useSyncExternalStore(subscribe,current,()=>'light'),setTheme];
}
