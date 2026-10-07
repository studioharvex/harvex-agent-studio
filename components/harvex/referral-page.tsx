'use client';
/* Public page of the invitation program (/invite): what inviting a friend gives on this server, read live from
   GET /api/referrals?info=1 (lib/referrals.ts referralProgram): free credits for both sides, and the inviter's holder
   reward boost where holder rewards run. It states the rule and promises no return. A visitor's own link is on the
   Quests page. Its link preview comes from app/invite/page.tsx and /api/og/page/referral. */
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import {api,copyText,I} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import type {View} from '@/lib/routes';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;
type Program={enabled:boolean;credits:number;max:number;boost:{percent:number;maxFriends:number;unit:string;token:string}|null};
const n=(v:number|string)=>Number(v).toLocaleString('en-US');

export function ReferralPage({onNavigate}:{onNavigate:Go}){
 const [p,setP]=useState<Program|null>(null);
 useEffect(()=>{let alive=true;api('/api/referrals?info=1').then(d=>{if(alive)setP(d);}).catch(()=>{if(alive)setP({enabled:false,credits:0,max:0,boost:null});});return()=>{alive=false;};},[]);
 const link=typeof location!=='undefined'?location.origin+'/invite':'/invite';
 const b=p?.boost||null;const top=b?(1+b.percent*b.maxFriends/100).toFixed(1):'';
 const post=`https://x.com/intent/post?text=${encodeURIComponent(b?`Invite friends on Harvex: free credits for both, and up to ${top}x on your ${b.token} holder reward`:'Invite friends on Harvex: free credits for both of you')}&url=${encodeURIComponent(link)}`;
 return <>
  <section className="mx-auto grid max-w-[1120px] gap-10 px-[clamp(16px,3vw,32px)] pt-10 pb-16">
   <div className="grid gap-3">
    <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Harvex · Invitations</span>
    <h1 className="font-display text-[clamp(40px,7vw,84px)] leading-[.96] font-medium tracking-[-.05em]">{b?<>Invite friends, earn up to {top}x</>:'Invite friends'}</h1>
    <p className="max-w-[62ch] text-[17px] leading-relaxed text-muted-foreground">{p&&!p.enabled?'Invitations are switched off on this server.':'Every account has an invite link. A friend who joins through it brings something for both of you.'}</p>
   </div>
   {(!p||p.enabled)&&<div className="grid gap-3 md:grid-cols-2">
    <div className="grid content-start gap-3 rounded-2xl border bg-card p-6">
     <span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">For both of you</span>
     <b className="font-display text-3xl font-medium tracking-[-.03em]">{p?(p.credits>0?`${n(p.credits)} free credits each`:'Recorded, no credits here'):' '}</b>
     <p className="text-[15px] leading-relaxed text-muted-foreground">Your friend signs in through your link with a new account. When they complete their first run, you each get the bonus{p&&p.credits>0?`, for up to ${n(p.max)} invitations per account`:''}.</p>
     <p className="text-[12.5px] text-muted-foreground">Free credits pay for runs. They cannot be withdrawn or claimed as earnings.</p>
    </div>
    <div className={cn('grid content-start gap-3 rounded-2xl border bg-card p-6',b&&'border-lime')}>
     <span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">For you, as a holder</span>
     <b className="font-display text-3xl font-medium tracking-[-.03em]">{p?(b?`+${b.percent}% ${b.token} reward per friend`:'No reward boost here'):' '}</b>
     {b?<>
      <p className="text-[15px] leading-relaxed text-muted-foreground">Every friend you invited who holds {n(b.unit)} HARVEX through a whole hour raises your own {b.token} holder reward for that hour by {b.percent}%, for up to {b.maxFriends} friends.</p>
      <div className="flex flex-wrap gap-1.5">{Array.from({length:b.maxFriends},(_,i)=><span key={i} className={cn('rounded-lg border px-2.5 py-1.5 text-center',i===b.maxFriends-1&&'border-lime bg-lime/10')}>
       <b className="block font-display text-lg leading-none font-medium tabular-nums">×{(1+b.percent*(i+1)/100).toFixed(1)}</b><span className="font-mono text-[10px] text-muted-foreground">{i+1} {i?'friends':'friend'}</span></span>)}</div>
      <p className="text-[12.5px] text-muted-foreground">It multiplies what your own wallets earn, so you need at least {n(b.unit)} HARVEX yourself. A friend counts only while they keep holding, and their own reward does not change.</p>
     </>:<p className="text-[15px] leading-relaxed text-muted-foreground">Holder rewards are not running on this server, so there is nothing to boost.</p>}
    </div>
   </div>}
   <div className="flex flex-wrap gap-2">
    <Button size="lg" onClick={()=>onNavigate('quests')}>Get your invite link<I id="arrow"/></Button>
    {b&&<Button size="lg" variant="outline" onClick={()=>onNavigate('rewards')}>Holder rewards</Button>}
    <Button size="lg" variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
    <Button size="lg" variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
   </div>
   <p className="max-w-[80ch] text-[12.5px] text-muted-foreground">This page states what the server does today; it can change.{b?` The boost is paid from the same reward vault as every holder reward. That contract has no independent audit and there is no published legal review of the ${b.token} payouts; the restrictions are in the whitepaper.`:''} Holding a token is a risk of its own. Not financial advice.</p>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
