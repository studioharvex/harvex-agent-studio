'use client';
/* Public invite page (/r/<code>): what someone sees when they open an invite link. It keeps the code in this browser
   (localStorage "harvex-ref") and, after the visitor signs in with a new account, the app shell hands it to
   POST /api/referrals (app/studio.tsx). The page learns only whether the code exists and what an invitation gives
   (GET /api/referrals?code=): nothing about the account behind the code. Its link preview comes from
   app/r/[code]/page.tsx and /api/og/page/invite. */
import {useEffect,useState} from 'react';
import {api,I} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {Thumb} from '@/components/landing/mocks';
import type {View} from '@/lib/routes';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;
export const REF_KEY='harvex-ref';

export function InvitePage({code,auth,onNavigate,onSignIn}:{code:string;auth:boolean;onNavigate:Go;onSignIn:()=>void}){
 const [info,setInfo]=useState<{enabled:boolean;valid:boolean;credits:number}|null>(null);
 useEffect(()=>{let alive=true;
  api(`/api/referrals?code=${encodeURIComponent(code)}`).then(d=>{if(!alive)return;setInfo(d);
   // remembered only when the code is real: the shell attaches it after sign-in
   try{if(d.valid)localStorage.setItem(REF_KEY,code);}catch{/* private window: the invite cannot be remembered */}
  }).catch(()=>{if(alive)setInfo({enabled:false,valid:false,credits:0});});
  return()=>{alive=false;};},[code]);
 const ok=!!info?.valid;
 return <>
  <section className="mx-auto grid min-h-[calc(100svh-var(--top)-40px)] max-w-[1120px] items-center gap-10 px-[clamp(16px,3vw,32px)] py-12 md:grid-cols-[minmax(0,1fr)_auto]">
   <div className="grid gap-5">
    <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Harvex · Invitation</span>
    <h1 className="font-display text-[clamp(40px,7vw,84px)] leading-[.96] font-medium tracking-[-.05em]">{info&&!ok?'This invite cannot be used':'Someone invited you'}</h1>
    {info&&!ok?<p className="max-w-[56ch] text-[17px] leading-relaxed text-muted-foreground">{info.enabled?'Check the link for a typo. Building an agent works without an invite, since anyone may use the Studio.':'This server has invitations turned off. Building an agent works all the same.'}</p>
    :<p className="max-w-[56ch] text-[17px] leading-relaxed text-muted-foreground">Create an AI agent that has a character, outfits to wear and skills it can run.{info&&info.credits>0?<> Join with a new account and complete a first task. You then receive <b className="text-foreground">{info.credits} free credits</b>, and the friend who sent the invite gets the same.</>:' Sign in to give it a first task.'}</p>}
    <div className="flex flex-wrap gap-2">
     {auth?<Button size="lg" onClick={()=>onNavigate('studio')}>Open the Studio<I id="arrow"/></Button>:<Button size="lg" onClick={onSignIn}><I id="wallet"/>Connect wallet</Button>}
     <Button size="lg" variant="outline" onClick={()=>onNavigate('home')}>What is Harvex?</Button>
    </div>
    {ok&&<p className="max-w-[70ch] text-[12.5px] text-muted-foreground">Free credits are the whole bonus. You spend them on runs, and they can be neither withdrawn nor claimed as earnings. Only a new account that has not run anything yet can take an invite, and the credits are added when its first run completes.</p>}
   </div>
   <div className="flex gap-3 max-md:hidden">{(['nova','lumi','scout'] as const).map((id,i)=><Thumb key={id} id={id} className={`h-56 w-40 rounded-2xl border bg-stage object-[50%_18%] ${i===1?'mt-10':''}`}/>)}</div>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
