'use client';
/* Public page of the verified mark (/verified): how a creator proves an agent is theirs (a code posted from their own
   X account, checked by a person on the team), what the mark then shows, and what it does and does not mean. It says
   whether verification is open on this server (GET /api/creator, lib/creators.ts). The steps themselves are done on
   the Profile page. Its link preview comes from app/verified/page.tsx and /api/og/page/verified. */
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import {api,copyText,I} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {Thumb} from '@/components/landing/mocks';
import type {View} from '@/lib/routes';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;
const STEPS:[string,string][]=[
 ['Enter your handle','Open your Profile page and type in your X handle. Harvex answers with a short code tied to your account on this site.'],
 ['Publish the code on X','Send out a post with the code from that X account, then paste the link to it here. Your account is not read beyond that one post.'],
 ['A team member looks','A person from the team opens your post and confirms two things: the handle posted it, and the code is in it. After that your handle appears on every agent you have published.'],
];
const MEANS:[string,string][]=[
 ['The mark means','We gave a code to the creator of the agent, the X account shown on the agent posted that code, and a person checked the post.'],
 ['The mark does not mean','Harvex vouching for anything the agent says, or the agent being that person. The agent is an AI character. It can get things wrong, and when asked it says what it is.'],
 ['The mark can be removed','Creators may take the mark off whenever they want. One handle can be verified for a single account only. An agent with no mark is listed under an anonymous creator name.'],
];

export function VerifiedPage({onNavigate}:{onNavigate:Go}){
 const [open,setOpen]=useState<boolean|null>(null);
 useEffect(()=>{let alive=true;api('/api/creator').then(d=>{if(alive)setOpen(!!d.enabled);}).catch(()=>{if(alive)setOpen(false);});return()=>{alive=false;};},[]);
 const link=typeof location!=='undefined'?location.origin+'/verified':'/verified';
 const post=`https://x.com/intent/post?text=${encodeURIComponent('Verified creators on Harvex: the X handle on an AI agent, checked by a person')}&url=${encodeURIComponent(link)}`;
 return <>
  <section className="mx-auto grid max-w-[1120px] gap-10 px-[clamp(16px,3vw,32px)] pt-10 pb-16">
   <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
    <div className="grid gap-3">
     <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Harvex · Verified creators</span>
     <h1 className="font-display text-[clamp(38px,6.4vw,76px)] leading-[.96] font-medium tracking-[-.05em]"><span className="text-muted-foreground">Whose agent is this?</span> Check the mark.</h1>
     <p className="max-w-[60ch] text-[17px] leading-relaxed text-muted-foreground">To show that an agent belongs to them, a creator posts a code from their own X account. A person on our team checks that post, and from then on the agent displays the creator’s handle.</p>
    </div>
    {/* what the mark looks like on an agent */}
    <div className="relative flex aspect-[3/4] w-[min(240px,60vw)] -rotate-3 flex-col overflow-hidden rounded-xl bg-lime p-4 text-ink shadow-[0_24px_60px_rgb(0_0_0/.25)] max-md:justify-self-start" aria-hidden="true">
     <span className="relative z-10 flex items-center justify-between font-mono text-[10.5px] font-semibold tracking-[.1em] uppercase"><span>#01</span><span className="flex items-center gap-1 rounded-lg border border-current/25 px-2 py-0.5"><I id="check" className="i size-3"/>@you</span></span>
     <Thumb id="juno" eager className="pointer-events-none absolute inset-x-0 top-[12%] mx-auto h-[70%] w-auto object-contain"/>
     <span className="relative z-10 mt-auto font-display text-[21px] leading-[1.08] font-medium tracking-[-.03em]">Verified creator</span>
    </div>
   </div>
   <div className="grid gap-3 md:grid-cols-3">{STEPS.map(([t,x],i)=><div key={t} className="grid content-start gap-2 rounded-2xl border bg-card p-5">
    <span className="font-mono text-[11px] text-muted-foreground">0{i+1}</span><b className="font-display text-xl font-medium tracking-[-.02em]">{t}</b><p className="text-[14.5px] leading-relaxed text-muted-foreground">{x}</p></div>)}</div>
   <div className="grid gap-3 md:grid-cols-3">{MEANS.map(([t,x])=><div key={t} className="grid content-start gap-2 border-t pt-4">
    <b className="font-mono text-[11px] tracking-[.1em] uppercase">{t}</b><p className="text-[14.5px] leading-relaxed text-muted-foreground">{x}</p></div>)}</div>
   <div className="flex flex-wrap items-center gap-2">
    <Button size="lg" onClick={()=>onNavigate('profile')}>Verify my handle<I id="arrow"/></Button>
    <Button size="lg" variant="outline" onClick={()=>onNavigate('plaza')}>Go to the plaza</Button>
    <Button size="lg" variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
    <Button size="lg" variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
   </div>
   <p className="max-w-[80ch] text-[12.5px] text-muted-foreground">{open===null?'':open?'This server accepts verification requests. A person checks each one, so expect some waiting before the mark shows up. ':'This server does not accept verification requests yet, because no one has been appointed to check them. '}X is never read by the server: a person opens a single post, and that is the whole check. Leave your post online until the request has been confirmed.</p>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
