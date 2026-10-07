'use client';
/* Public page of one shared answer (/s/<id>): what an agent wrote, with the agent's character next to it, put up by
   the run's owner (GET /api/share, lib/share.ts). A shared message of a conversation reads as the conversation: the
   turns its owner chose to show, as bubbles. It shows the answer, the skill, the date and, when the owner allowed
   it, the start of the task; never who the owner is or the agent's instructions. Its link preview comes from
   app/s/[id]/page.tsx and /api/og/share/<id>. */
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import Avatar from '@/app/avatar';
import {api,copyText,I,TextOut} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {StatusBadge} from '@/components/app/parts';
import type {View} from '@/lib/routes';
import type {SharedRun} from '@/lib/share';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;

export function SharePage({id,onNavigate}:{id:string;onNavigate:Go}){
 const [s,setS]=useState<SharedRun|null>(null);const [state,setState]=useState<'loading'|'ready'|'missing'>('loading');
 // the shell gives this page a key per id, so a new id starts from a fresh "loading" state
 useEffect(()=>{let alive=true;
  api(`/api/share?id=${encodeURIComponent(id)}`).then(d=>{if(!alive)return;setS(d.shared);setState('ready');}).catch(()=>{if(alive)setState('missing');});
  return()=>{alive=false;};},[id]);

 if(state==='missing')return <>
  <section className="mx-auto grid min-h-[calc(100svh-var(--top)-40px)] max-w-[720px] place-content-center justify-items-center gap-5 px-4 py-16 text-center">
   <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Shared answer</span>
   <h1 className="font-display text-[clamp(32px,5vw,56px)] leading-none font-medium tracking-[-.045em]">No shared answer at this link</h1>
   <p className="max-w-[46ch] text-muted-foreground">Either the person who shared it removed the page, or the address has a typo.</p>
   <div className="flex flex-wrap justify-center gap-2"><Button onClick={()=>onNavigate('studio')}>Make an agent of your own</Button><Button variant="outline" onClick={()=>onNavigate('home')}>Go home</Button></div>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;

 const link=typeof location!=='undefined'?location.origin+'/s/'+id:'/s/'+id;
 const post=s?`https://x.com/intent/post?text=${encodeURIComponent(s.chat?`My chat with ${s.agentName}, an AI agent on Harvex:`:`An answer from ${s.agentName}, an AI agent on Harvex:`)}&url=${encodeURIComponent(link)}`:'#';
 /** One turn of a shared conversation: what was asked on the right, the agent's answer on the left. */
 const turn=(asked:string|null,answer:string,k:number)=><div key={k} className="grid gap-2">
  {asked&&<p className="max-w-[85%] justify-self-end rounded-2xl rounded-br-md bg-lime px-4 py-2.5 text-[15px] break-words whitespace-pre-wrap text-ink">{asked}</p>}
  <div className="max-w-[92%] justify-self-start rounded-2xl rounded-bl-md border bg-card px-4 py-3"><TextOut text={answer}/></div>
 </div>;
 return <>
  <section className="mx-auto grid max-w-[1120px] items-start gap-8 px-[clamp(16px,3vw,32px)] pt-10 pb-16 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-12">
   <div className="grid gap-3 md:sticky md:top-[calc(var(--top)+16px)]">
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border bg-stage max-md:mx-auto max-md:w-[min(260px,70vw)]">
     {s?<Avatar skin={s.skin} appearance={s.appearance as never} look={s.look as never} animation={s.motion||'Idle'}/>:<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading…</div>}
    </div>
    {s&&<div className="grid gap-2 max-md:justify-items-center max-md:text-center">
     <b className="font-display text-2xl font-medium tracking-[-.03em] break-words">{s.agentName}</b>
     <div className="flex flex-wrap items-center gap-2"><StatusBadge kind={s.sample?'sample':'live_ai'}>{s.sample?'Workflow sample':s.chat?'AI character':'AI answer'}</StatusBadge>{s.skillName&&<span className="font-mono text-[11px] tracking-[.08em] text-muted-foreground uppercase">{s.skillName}</span>}</div>
     {s.agentId&&<Button variant="outline" className="justify-self-start max-md:justify-self-center" onClick={()=>onNavigate('agent',s.agentId!)}>{s.chat?'Chat with this agent':'Run this agent'}<I id="arrow"/></Button>}
    </div>}
   </div>
   <div className="grid min-w-0 gap-5">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[.08em] text-muted-foreground uppercase"><span>{s?.chat?'Shared conversation':'Shared answer'}</span>{s&&<span>{new Date(s.created).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</span>}</div>
    {s?.chat&&<div className="grid gap-4">{s.earlier.map((t,k)=>turn(t.asked,t.answer,k))}{turn(s.task,s.text,s.earlier.length)}</div>}
    {!s?.chat&&s?.task&&<div className="grid gap-1.5"><span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">Asked</span>
     <p className="rounded-xl border bg-secondary/50 p-4 text-[15px] leading-relaxed break-words whitespace-pre-wrap">{s.task}</p></div>}
    {!s?.chat&&<div className="grid gap-1.5"><span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">{s?`Answer from ${s.agentName}`:'Answer'}</span>
     <div className="min-h-32 rounded-xl border bg-card p-5">{s?<TextOut text={s.text}/>:<p className="text-sm text-muted-foreground">Loading…</p>}</div></div>}
    <div className="flex flex-wrap gap-2">
     <Button size="lg" onClick={()=>onNavigate('studio')}>Make an agent of your own<I id="arrow"/></Button>
     <Button size="lg" variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
     <Button size="lg" variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
    </div>
    <p className="max-w-[70ch] text-[12.5px] text-muted-foreground">An AI agent in Harvex Agent Studio wrote this. The person who ran it made the page public and can remove it whenever they choose. AI makes mistakes, so verify anything important before you depend on it.</p>
   </div>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
