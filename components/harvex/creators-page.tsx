'use client';
/* Public page of creator agents (/creators): build an agent in your own voice from posts you wrote, publish it, and
   earn each time someone talks to it. It states what the server does today (lib/voice.ts, lib/talk.ts) and that it
   is opt-in: an agent is only written from posts its creator pasted. Its link preview comes from
   app/creators/page.tsx and /api/og/page/creators. */
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import {api,copyText,I} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {Thumb} from '@/components/landing/mocks';
import type {View} from '@/lib/routes';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;
type Info={live:boolean;cost:number;min:number;max:number};
const STEPS:[string,string][]=[
 ['Bring your own posts','Paste between ten and thirty posts that you wrote yourself. The Studio reads the pasted text and nothing more. It never fetches anything from an account of yours.'],
 ['See your style written down','From those posts the Studio drafts instructions for the agent that follow your style: your way of talking, your usual subjects, and the things you would not say.'],
 ['Add your sources','Notes, an FAQ or an old thread can be pasted in as well. When a question matches a passage, the agent answers from it and lists the source below the answer.'],
 ['Choose a look, then publish','Pick one of the characters and its outfit. Go through the draft and correct anything that sounds wrong. When it is ready, publish it and set what a chat message costs.'],
 ['Visitors chat with it','Your agent gets a page that is open to anyone. For every message someone sends there, you receive your chat price.'],
 ['Add the verified mark','Post a code from your X handle, then send us the link to that post. Once a team member has checked it, your agents show “@you, verified creator”.'],
];

export function CreatorsPage({onNavigate}:{onNavigate:Go}){
 const [info,setInfo]=useState<Info|null>(null);
 useEffect(()=>{let alive=true;api('/api/voice').then(d=>{if(alive)setInfo(d);}).catch(()=>null);return()=>{alive=false;};},[]);
 const link=typeof location!=='undefined'?location.origin+'/creators':'/creators';
 const post=`https://x.com/intent/post?text=${encodeURIComponent('Creator agents on Harvex: paste posts you wrote and get an AI agent that talks in your style')}&url=${encodeURIComponent(link)}`;
 return <>
  <section className="mx-auto grid max-w-[1120px] gap-10 px-[clamp(16px,3vw,32px)] pt-10 pb-16">
   <div className="grid gap-3">
    <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Harvex · Creator agents</span>
    <h1 className="font-display text-[clamp(40px,7vw,84px)] leading-[.96] font-medium tracking-[-.05em]">An agent that sounds like you</h1>
    <p className="max-w-[62ch] text-[17px] leading-relaxed text-muted-foreground">The Studio turns posts you wrote into an agent with your way of talking. Choose its character and publish it. Every message people send it then earns you credits.</p>
   </div>
   <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{STEPS.map(([t,x],i)=><div key={t} className="grid content-start gap-2 rounded-2xl border bg-card p-5">
    <span className="font-mono text-[11px] text-muted-foreground">0{i+1}</span><b className="font-display text-xl font-medium tracking-[-.02em]">{t}</b><p className="text-[14.5px] leading-relaxed text-muted-foreground">{x}</p></div>)}</div>
   <div className="grid items-center gap-5 rounded-2xl border border-lime bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
    <div className="flex -space-x-3">{(['echo','wren','juno'] as const).map(c=><Thumb key={c} id={c} className="size-20 rounded-xl border-2 border-card bg-t-lime object-[50%_18%]"/>)}</div>
    <div className="grid gap-2"><b className="font-display text-2xl font-medium tracking-[-.03em]">Your posts, your choice</b>
     <p className="text-[15px] leading-relaxed text-muted-foreground">The only material an agent is written from is posts that its creator pasted and confirmed to be their own. What comes out is an AI character with that style, not the person. Ask it and it says so. It never claims to be the creator, and it never tells anyone to buy or sell anything.</p></div>
   </div>
   <div className="flex flex-wrap gap-2">
    <Button size="lg" asChild><a href="/dashboard/studio?voice=1">Draft my agent<I id="arrow"/></a></Button>
    <Button size="lg" variant="outline" onClick={()=>onNavigate('verified')}>About the verified mark</Button>
    <Button size="lg" variant="outline" onClick={()=>onNavigate('discover')}>Chat with an agent</Button>
    <Button size="lg" variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
    <Button size="lg" variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
   </div>
   <p className="max-w-[80ch] text-[12.5px] text-muted-foreground">{info?(info.live?`Drafting costs ${info.cost} credits, and the posts you paste must add up to ${info.min} characters or more. `:'This server has no AI connected, so it cannot write drafts. '):''}Earnings arrive as credits. Credits pay for runs on Harvex, and claiming earnings to a wallet is switched off. People who talk to your agent are never shown your instructions. Creators are listed under an anonymous creator name unless they posted a code from their X handle and the team confirmed it; those appear as verified creators.</p>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
