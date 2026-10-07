'use client';
/* Public page of agent teams (/teams): what a team is and the ready-made ones (lib/team-kits.ts). "Use this team"
   opens it on the Teams page of the dashboard, where one click makes its agents. A kit that reads the HARVEX token is
   marked; whether a server has the token is decided there, not here. Its link preview comes from app/teams/page.tsx
   and /api/og/page/teams. */
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import {copyText,I} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {Thumb} from '@/components/landing/mocks';
import {skillCatalog} from '@/lib/agents';
import {TEAM_KITS,TEAM_STEPS_MAX,TEAM_STEPS_MIN} from '@/lib/team-kits';
import type {CharacterId} from '@/lib/characters';
import type {View} from '@/lib/routes';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;
const skillName=(id:string)=>skillCatalog.find(s=>s.id===id)?.name||id;
const HOW:[string,string][]=[
 ['Set the order',`Choose ${TEAM_STEPS_MIN} or ${TEAM_STEPS_MAX} agents and give each a single skill. They can be yours or ones that other creators published in Discover.`],
 ['Write the task once','Agent one answers first. Every agent after that receives your task plus what the previous agent wrote.'],
 ['Follow each step','A step is an ordinary run. You pay that skill’s credits, the run shows up in History, and when the agent is a published one its creator receives their price.'],
];

export function TeamsInfoPage({onNavigate}:{onNavigate:Go}){
 const link=typeof location!=='undefined'?location.origin+'/teams':'/teams';
 const post=`https://x.com/intent/post?text=${encodeURIComponent('Agent teams on Harvex: put AI agents in a row and each one builds on the answer before it')}&url=${encodeURIComponent(link)}`;
 return <>
  <section className="mx-auto grid max-w-[1120px] gap-10 px-[clamp(16px,3vw,32px)] pt-10 pb-16">
   <div className="grid gap-3">
    <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Harvex · Agent teams</span>
    <h1 className="font-display text-[clamp(40px,7vw,84px)] leading-[.96] font-medium tracking-[-.05em]">Put your agents in a row</h1>
    <p className="max-w-[62ch] text-[17px] leading-relaxed text-muted-foreground">Each agent does a single job well. In a team they stand in a row, so research goes to a writer and the writing goes to a translator. You type the task once and receive what the full row produced.</p>
   </div>
   <div className="grid gap-3 md:grid-cols-3">{HOW.map(([t,x],i)=><div key={t} className="grid content-start gap-2 rounded-2xl border bg-card p-5">
    <span className="font-mono text-[11px] text-muted-foreground">0{i+1}</span><b className="font-display text-xl font-medium tracking-[-.02em]">{t}</b><p className="text-[14.5px] leading-relaxed text-muted-foreground">{x}</p></div>)}</div>
   <div className="grid gap-3 md:grid-cols-2">{TEAM_KITS.map(k=><div key={k.id} className="grid content-start gap-4 rounded-2xl border bg-card p-5">
    <div className="flex items-center gap-3">{k.steps.map((s,i)=><span key={i} className="flex items-center gap-3">
     {i>0&&<I id="arrow" className="i size-5 text-lime"/>}
     <span className="grid justify-items-center gap-1"><Thumb id={s.agent.skin as CharacterId} className="size-16 rounded-xl bg-t-lime object-[50%_18%]"/><span className="font-mono text-[10px] tracking-[.04em] text-muted-foreground uppercase">{s.agent.name}</span></span></span>)}</div>
    <b className="font-display text-2xl font-medium tracking-[-.03em]">{k.title}</b>
    <ol className="grid gap-1 text-[14.5px] text-muted-foreground">{k.steps.map((s,i)=><li key={i}><b className="text-foreground">{s.agent.name}</b> ({skillName(s.skill)}) {s.does}.</li>)}</ol>
    <div className="flex flex-wrap items-center justify-between gap-3">
     <span className="text-[12.5px] text-muted-foreground">{k.needs==='token'?'Needs the HARVEX token on BNB Smart Chain.':k.gives+'.'}</span>
     <Button asChild><a href={`/dashboard/teams?kit=${k.id}`}>Open this team<I id="arrow"/></a></Button>
    </div>
   </div>)}</div>
   <div className="flex flex-wrap gap-2">
    <Button size="lg" onClick={()=>onNavigate('teams')}>Make your own team<I id="arrow"/></Button>
    <Button size="lg" variant="outline" onClick={()=>onNavigate('discover')}>Browse Discover</Button>
    <Button size="lg" variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
    <Button size="lg" variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
   </div>
   <p className="max-w-[80ch] text-[12.5px] text-muted-foreground">What a team run costs is its steps added up, and every step counts toward your daily limits. When a step fails you get its credits back and may retry it, while the earlier steps remain done. For an agent published by someone else, the instructions are never shown. Agents created by a ready-made team belong to you: rename them or change their look.</p>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
