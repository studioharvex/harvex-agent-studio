'use client';
/* Closing sections:
   - TokenBand: ZATS "rule" band as a clean light panel (no wave) with a tilted solid note.
   - Faq: the headline beside a yellow slab that holds the questions five at a time (a pager, not one long list);
     the questions come from the FAQ section of the docs content.
   - Closing: the headline beside a folder whose six files (the steps) come out one by one, then the footer. */
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Card} from '@/components/ui/card';
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger} from '@/components/ui/accordion';
import {CONTENT} from '@/lib/harvex3d/content';
import {I} from '@/app/ui';
import {cn} from '@/lib/utils';
import {BracketLink,CutButton,DashedRule,Eyebrow,Reveal,Slab,reduced,useInView} from '@/components/harvex/motion';
import {Logo} from '@/components/harvex/navbar';
import {Headline} from './features';
import {SiteFooter} from '@/components/harvex/site-footer';
import {useTokenStage,type TokenStage} from '@/components/harvex/token-context';
import {RewardEligibility} from '@/components/harvex/reward-eligibility';
import {REWARD_PLAN} from '@/lib/site';

import type {View} from '@/lib/routes';
type Go=(v:View,doc?:string)=>void;

/* What the reward band says for each state the server reports: [note under the card, status sentence]. */
const REWARD_STATE:Record<TokenStage,[string,string]>={
 test:['Testnet. No real reward is paid from here.','You are looking at a testnet build, and it pays no real reward.'],
 none:['A plan. No payment before a token and a vault exist.','HARVEX has not launched and no reward vault exists, so not one payment has been made.'],
 token:['Token out. Holder rewards still off.','HARVEX has launched, yet the holder reward is off, so no period has been paid.'],
 rewards:['Running. Claims are on the Rewards page.','The holder reward is on, and the Rewards page lists each period that was paid.'],
};

export function TokenBand({onNavigate}:{onNavigate:Go}){
 const stage=useTokenStage();const [note,status]=REWARD_STATE[stage];
 // before the token exists: what has not happened. Afterwards only what the design never needs stays true.
 const [sticker,crossed]=stage==='none'?['Has not happened',['token sale','airdrop','staking']]:['Never required',['staking','lock-up']];
 return <section className="px-2 pt-[clamp(60px,8vw,110px)] max-[820px]:px-0">
  <div className="rounded-xl border bg-surface px-4 pt-[clamp(64px,8vw,110px)] pb-[clamp(56px,7vw,96px)] text-center max-[820px]:rounded-none">
   <div className="grid justify-items-center gap-6">
    <Eyebrow tone="amber">{stage==='rewards'?'For holders':'For holders · a plan'}</Eyebrow>
    <Reveal><h2 className="text-[clamp(46px,8vw,118px)] leading-[.95]"><span className="font-display font-medium tracking-[-.05em]">In your wallet.</span><br/><span className="font-display font-light tracking-[-.05em] text-muted-foreground">By the hour.</span></h2></Reveal>
    <Reveal className="relative mt-4 flex items-start justify-center max-sm:flex-col max-sm:items-center">
     <div className="grid w-[270px] gap-1">
      <Card className="items-center gap-3 rounded-2xl p-6 text-center shadow-[0_30px_60px_-36px_rgb(0_0_0/.35)]">
       <span className="flex rounded-lg border p-0.5 text-xs"><span className="rounded-lg bg-foreground px-3 py-0.5 text-background">Status</span><span className="px-3 py-0.5 text-muted-foreground">Chain</span></span>
       <b className="mt-2 font-display text-6xl leading-none font-medium tracking-[-.05em]">{REWARD_PLAN.symbol}</b>
       <span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">The planned reward · a BEP-20 token</span>
       <CutButton size="sm" variant="lime" className="mt-1" onClick={()=>onNavigate('paper')}>Read the design <I id="arrow"/></CutButton>
      </Card>
      <div className="rounded-2xl border border-dashed bg-card px-4 py-3 font-mono text-[10px] tracking-[.06em] uppercase">{note}</div>
     </div>
     <div className="mt-12 -ml-7 w-[170px] rotate-[8deg] rounded-xl bg-sky px-4 pt-4 pb-5 text-center text-[#0a0a0a] shadow-[0_30px_60px_-36px_rgb(0_0_0/.4)] transition-transform duration-700 ease-smooth hover:rotate-[2deg] max-sm:mt-[-24px] max-sm:ml-36">
      <span className="font-mono text-[10px] font-bold tracking-[.1em] uppercase">{sticker}</span>
      <ul className="mt-3 grid gap-0.5 font-mono text-[11px] uppercase line-through">{crossed.map(x=><li key={x}>{x}</li>)}</ul>
     </div>
    </Reveal>
   </div>
  </div>
  <Reveal className="mx-auto max-w-[1180px] px-4 pt-[clamp(28px,4vw,48px)]"><RewardEligibility/></Reveal>
  <div className="mx-auto grid max-w-[1180px] items-start gap-8 px-4 pt-16 pb-6 md:grid-cols-[240px_1fr]">
   <Eyebrow tone="amber">{stage==='none'?'What it is meant to add':'What it adds'}</Eyebrow>
   <Reveal className="grid max-w-[640px] gap-6">
    <p className="text-[clamp(20px,2vw,27px)] leading-snug font-medium tracking-[-.02em]">Running agents already earns their creators credits. Holding HARVEX is meant to add two things on top: a lower platform fee, and a holder reward at a fixed rate per 3,000,000 HARVEX, paid in {REWARD_PLAN.symbol}, {REWARD_PLAN.what}, out of a vault each holder claims from directly.</p>
    <p className="text-sm text-muted-foreground">{status} No audit of the contract has been done and no legal review has been published. Before any claim, a holder would have to confirm they are eligible. None of this is financial advice.</p>
    <div className="flex flex-wrap gap-2"><CutButton onClick={()=>onNavigate('paper')}>Token design</CutButton><CutButton variant="outline" onClick={()=>onNavigate('roadmap')}>Roadmap</CutButton></div>
   </Reveal>
  </div>
 </section>;
}

function faqItems(){
 const faq=CONTENT.docs.find(d=>d.id==='faq');if(!faq)return [];
 return faq.body.split('\n').map(l=>l.match(/^\*\*(.+?)\*\*\s*(.+)$/)).filter(Boolean).map(m=>({q:m![1],a:m![2]}));
}
/* The FAQ in the closing panel's layout (user, 6 Oct 2026: "like the CTA below, but as a FAQ: still a list going
   down, only not this long"): the headline on the left, and on the right a slab with a white sheet of FAQ_PAGE
   questions; the rest are a step away with the arrows, so the section keeps one height whatever the docs hold. */
const FAQ_PAGE=5;
export function Faq({onNavigate}:{onNavigate:Go}){
 const items=faqItems();const pages=Math.max(1,Math.ceil(items.length/FAQ_PAGE));
 const [page,setPage]=useState(0);const from=page*FAQ_PAGE;const shown=items.slice(from,from+FAQ_PAGE);
 const two=(n:number)=>String(n).padStart(2,'0');
 return <section className="tone-flip mt-[clamp(60px,8vw,110px)] px-4 py-[clamp(72px,9vw,120px)]">
  <div className="mx-auto grid max-w-[1180px] items-start gap-[clamp(40px,6vw,88px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
   <Reveal className="grid gap-5 lg:sticky lg:top-28">
    <Eyebrow tone="iris">Before you start</Eyebrow>
    <Headline lead="The short answers," rest={<span className="block">all in one place.</span>} className="text-[clamp(32px,3.5vw,48px)]"/>
    <p className="max-w-[42ch] text-[clamp(15px,1.15vw,17px)] leading-relaxed text-muted-foreground">{items.length} questions people ask about the studio, credits and the token, each answered in a few lines. The docs go deeper.</p>
    <div className="flex flex-wrap gap-2"><CutButton variant="lime" className="magnetic" onClick={()=>onNavigate('studio')}>Make an agent</CutButton><CutButton variant="outline" onClick={()=>onNavigate('docs','faq')}>Open the FAQ</CutButton></div>
   </Reveal>
   <Reveal delay={120}>
    <Slab tab={<>Questions<span aria-hidden="true" className="size-1 rounded-full bg-ink/40"/><span className="tabular-nums">{two(from+1)}–{two(from+shown.length)} of {two(items.length)}</span></>} body="p-2 sm:p-2.5">
     {/* the sheet: always as tall as a full page of closed questions, so the last page does not make the slab jump */}
     <div className="tone-light min-h-[calc(var(--rows)*57px)] rounded-[20px] px-[clamp(14px,2vw,22px)] py-1.5 shadow-[0_18px_36px_-26px_rgb(0_0_0/.55)]" style={{'--rows':FAQ_PAGE} as CSSProperties}>
      <Accordion key={page} type="single" collapsible className="w-full animate-view">
       {shown.map((f,k)=><AccordionItem key={f.q} value={String(k)} className="border-[#0a0a0a]/10">
        <AccordionTrigger className="gap-4 py-[17px] text-[15.5px] leading-snug font-medium text-foreground hover:no-underline [&>svg]:text-muted-foreground"><span className="flex items-start gap-3.5"><span className="pt-[3px] font-mono text-[10.5px] text-muted-foreground tabular-nums">{two(from+k+1)}</span>{f.q}</span></AccordionTrigger>
        <AccordionContent className="pr-6 pb-5 pl-[34px] text-[14.5px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
       </AccordionItem>)}
      </Accordion>
     </div>
     <div className="flex items-center gap-2 px-1.5 pt-2.5 pb-0.5 text-ink">
      <span className="font-mono text-[10.5px] font-semibold tracking-[.1em] uppercase tabular-nums">Page {two(page+1)} / {two(pages)}</span>
      {pages>1&&<span className="ml-auto flex gap-1.5">
       <button type="button" onClick={()=>setPage(x=>(x-1+pages)%pages)} aria-label="Earlier questions" className="grid size-10 place-items-center rounded-full bg-ink/10 transition-colors hover:bg-ink/20 [&_svg]:size-4"><I id="arrow" className="i rotate-180"/></button>
       <button type="button" onClick={()=>setPage(x=>(x+1)%pages)} aria-label="More questions" className="grid size-10 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-ink/85 [&_svg]:size-4"><I id="arrow"/></button>
      </span>}
     </div>
    </Slab>
   </Reveal>
  </div>
 </section>;
}

/* The six steps as files in a folder (user, 6 Oct 2026, about the closing panel: "the layout is still too much the
   same; the horizontal list could be files in a folder that come out one by one"). The files stand between the
   folder's back and its pocket. Until the folder is seen every file is out (so the server's HTML shows them all);
   then they go in and come out one at a time, rest, and start again. Pointing at the folder holds it; pointing at a
   file names it on the pocket; a click opens that part of the app. */
const FILES:{word:string;text:string;dot:string;go:View}[]=[
 {word:'Cast',text:'Choose one of 25 people and give the agent a name.',dot:'bg-lime',go:'studio'},
 {word:'Style',text:'Adjust the body and the face, then hair and clothes.',dot:'bg-iris',go:'studio'},
 {word:'Brief',text:'Write what it should care about and set its tone.',dot:'bg-coral',go:'studio'},
 {word:'Skills',text:'Hand it up to four skills that return something.',dot:'bg-sky',go:'skills'},
 {word:'List',text:'Pass it on as a link, or list it in Discover.',dot:'bg-amber',go:'agents'},
 {word:'Collect',text:'When others run it, the price less the fee is yours, in credits.',dot:'bg-mint',go:'credits'},
];
function FolderStack({onNavigate}:{onNavigate:Go}){
 const N=FILES.length,mid=(N-1)/2;
 const [ref,inView]=useInView<HTMLDivElement>(true,'0px 0px -18% 0px');
 const [out,setOut]=useState(N);const [hot,setHot]=useState<number|null>(null);const hold=useRef(false);
 useEffect(()=>{if(!inView||reduced())return;
  let n=0,t:ReturnType<typeof setTimeout>;
  const tick=()=>{
   if(hold.current){t=setTimeout(tick,400);return;}
   if(n<N){n++;setOut(n);t=setTimeout(tick,n===N?3400:480);}
   else{n=0;setOut(0);t=setTimeout(tick,1000);}
  };
  t=setTimeout(()=>{n=0;setOut(0);t=setTimeout(tick,800);},150);
  return()=>clearTimeout(t);},[inView,N]);
 const cur=hot??Math.max(0,out-1);const f=FILES[cur];
 return <div ref={ref} className="relative mx-auto h-[clamp(320px,34vw,440px)] w-full max-w-[560px] [--fw:clamp(104px,25%,146px)] [--back:color-mix(in_srgb,var(--lime)_80%,#000)]"
  onPointerEnter={()=>{hold.current=true;}} onPointerLeave={()=>{hold.current=false;setHot(null);}}>
  {/* the back of the folder, with its tab */}
  <span aria-hidden="true" className="absolute bottom-[62%] left-0 flex h-8 w-[38%] max-w-[200px] items-center rounded-t-[16px] bg-[var(--back)] px-4 font-mono text-[10px] font-semibold tracking-[.1em] whitespace-nowrap text-ink/70 uppercase after:absolute after:bottom-0 after:left-full after:size-4 after:bg-[radial-gradient(circle_at_100%_0,transparent_15.5px,var(--back)_16px)]">Your agent</span>
  <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[62%] rounded-[28px] rounded-tl-none bg-[var(--back)]"/>
  {/* the files: cut off under the folder, free above it */}
  <div className="absolute inset-0 [clip-path:inset(-60px_-40px_0_-40px)]">
   {FILES.map((x,k)=>{const isOut=k<out;
    return <button key={x.word} type="button" onClick={()=>onNavigate(x.go)} onPointerEnter={()=>setHot(k)} onFocus={()=>setHot(k)} onBlur={()=>setHot(null)}
     aria-label={`${x.word}: ${x.text}`} tabIndex={isOut?0:-1}
     className="group/file absolute top-0 h-[66%] w-[var(--fw)] text-left outline-none transition-transform duration-700 ease-[cubic-bezier(.22,1,.3,1.08)]"
     style={{left:`calc(${k} * (100% - var(--fw)) / ${N-1})`,zIndex:k+1,transform:isOut?`translateY(${Math.round(Math.abs(k-mid)*8)}px) rotate(${((k-mid)*2.6).toFixed(1)}deg)`:'translateY(80%)',transitionDelay:isOut?'0ms':`${(N-1-k)*45}ms`}}>
     <span className={cn('flex size-full flex-col gap-2 rounded-[16px] border border-black/10 bg-white p-3 text-ink shadow-[0_-6px_22px_-14px_rgb(0_0_0/.45)] transition-transform duration-300 ease-smooth group-hover/file:-translate-y-3 group-focus-visible/file:-translate-y-3',cur===k&&isOut&&'-translate-y-2')}>
      <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[.08em] text-ink/55"><i className={cn('size-2.5 rounded-[3px]',x.dot)}/>{String(k+1).padStart(2,'0')}</span>
      <b className="font-display text-[clamp(18px,1.6vw,21px)] leading-none font-medium tracking-[-.03em] max-sm:self-start max-sm:[writing-mode:vertical-rl]">{x.word}</b>
     </span>
    </button>;})}
  </div>
  {/* the pocket: names the file that came out last, or the one pointed at */}
  <div className="absolute inset-x-0 bottom-0 z-20 flex h-[46%] flex-col justify-between rounded-[28px] bg-lime p-[clamp(16px,2.2vw,24px)] text-ink shadow-[0_-14px_30px_-20px_rgb(0_0_0/.55)]">
   <div className="flex items-center justify-between gap-3 font-mono text-[10px] font-semibold tracking-[.1em] text-ink/60 uppercase"><span>Six files, one agent</span><span className="tabular-nums">{String(cur+1).padStart(2,'0')} / {String(N).padStart(2,'0')}</span></div>
   <div key={cur} className="grid animate-view gap-1"><b className="font-display text-[clamp(28px,3.4vw,44px)] leading-none font-medium tracking-[-.04em]">{f.word}</b><span className="max-w-[40ch] text-[clamp(13px,1.1vw,14.5px)] leading-snug text-ink/70">{f.text}</span></div>
  </div>
 </div>;
}

export function Closing({onNavigate}:{onNavigate:Go}){
 return <section className="p-2 max-[820px]:p-0">
  <div className="overflow-hidden rounded-xl border bg-background max-[820px]:rounded-none">
   <div className="mx-auto grid max-w-[1280px] items-center gap-[clamp(44px,6vw,88px)] px-[clamp(16px,4vw,56px)] pt-[clamp(64px,8vw,112px)] pb-[clamp(44px,6vw,88px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
    <div className="grid justify-items-start gap-7 max-lg:justify-items-center max-lg:text-center">
     <Eyebrow tone="lime">Free during private preview</Eyebrow>
     <Reveal><h2 className="text-[clamp(48px,7.4vw,116px)] leading-[.9]"><span className="font-display font-medium tracking-[-.055em]">The stage is empty.</span><br/><span className="font-display font-light tracking-[-.055em]">Go fill it.</span></h2></Reveal>
     <p className="max-w-[44ch] text-[clamp(15px,1.15vw,17px)] leading-relaxed text-muted-foreground">Six files lie between a bare stage and an agent other people can hire. They are all in this folder, in order.</p>
     <div className="flex flex-wrap gap-2 max-lg:justify-center"><CutButton size="lg" variant="lime" className="magnetic" onClick={()=>onNavigate('studio')}>Enter the studio <I id="arrow"/></CutButton><CutButton size="lg" variant="outline" onClick={()=>onNavigate('docs','start')}>Read the manual</CutButton></div>
    </div>
    <FolderStack onNavigate={onNavigate}/>
   </div>
   <div className="mt-[clamp(12px,2vw,28px)]"><SiteFooter onNavigate={onNavigate}/></div>
  </div>
 </section>;
}
