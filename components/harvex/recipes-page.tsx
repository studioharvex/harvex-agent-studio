'use client';
/* Public gallery of recipes (/recipes): ready-made automations (lib/recipes.ts), each a character with a persona and
   one skill on a schedule. "Use this recipe" opens it on the Schedules page, where one click starts it. A recipe that
   needs the HARVEX token is marked; whether a server has it is decided there, not here. Its link preview comes from
   app/recipes/page.tsx and /api/og/page/recipes. */
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import {copyText,I} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {Thumb} from '@/components/landing/mocks';
import {skillCatalog} from '@/lib/agents';
import {RECIPES} from '@/lib/recipes';
import type {CharacterId} from '@/lib/characters';
import type {View} from '@/lib/routes';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;
const skillName=(id:string)=>skillCatalog.find(s=>s.id===id)?.name||id;
const freq=(n:number)=>n===1?'Once a day':n===24?'Every hour':`${n} times a day`;

export function RecipesPage({onNavigate}:{onNavigate:Go}){
 const link=typeof location!=='undefined'?location.origin+'/recipes':'/recipes';
 const post=`https://x.com/intent/post?text=${encodeURIComponent('Recipes on Harvex: pick a ready-made automation and an AI agent repeats it on a schedule')}&url=${encodeURIComponent(link)}`;
 return <>
  <section className="mx-auto grid max-w-[1120px] gap-10 px-[clamp(16px,3vw,32px)] pt-10 pb-16">
   <div className="grid gap-3">
    <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Harvex · Recipes</span>
    <h1 className="font-display text-[clamp(40px,7vw,84px)] leading-[.96] font-medium tracking-[-.05em]">Ready-made jobs for your agent</h1>
    <p className="max-w-[62ch] text-[17px] leading-relaxed text-muted-foreground">Choose a recipe. A single click then creates the agent and schedules its skill. If you have connected Telegram or Discord, every result is delivered there.</p>
   </div>
   <div className="grid gap-3 md:grid-cols-2">{RECIPES.map(r=><div key={r.id} className="grid content-start gap-4 rounded-2xl border bg-card p-5">
    <div className="flex items-start gap-4"><Thumb id={r.agent.skin as CharacterId} className="size-16 shrink-0 rounded-xl bg-t-lime object-[50%_18%]"/>
     <div className="grid gap-1"><b className="font-display text-2xl font-medium tracking-[-.03em]">{r.title}</b>
      <span className="font-mono text-[11px] tracking-[.06em] text-muted-foreground uppercase">{r.agent.name} · {skillName(r.skill)} · {r.onChange?`checks ${freq(r.perDay).toLowerCase()}, writes only after a change`:freq(r.perDay)}</span></div></div>
    <p className="text-[15px] leading-relaxed text-muted-foreground">{r.text}</p>
    <p className="rounded-xl border bg-secondary/50 p-3 text-[13px] break-words text-muted-foreground">“{r.task.replace('{topic}','your topic')}”</p>
    <div className="flex flex-wrap items-center justify-between gap-3">
     <span className="text-[12.5px] text-muted-foreground">{r.needs==='token'?'Needs the HARVEX token on BNB Smart Chain.':'Takes whatever topic you set.'}</span>
     <Button asChild><a href={`/dashboard/schedules?recipe=${r.id}`}>Open this recipe<I id="arrow"/></a></Button>
    </div>
   </div>)}</div>
   <div className="flex flex-wrap gap-2">
    <Button size="lg" variant="outline" onClick={()=>onNavigate('schedules')}>Open Schedules<I id="arrow"/></Button>
    <Button size="lg" variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
    <Button size="lg" variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
   </div>
   <p className="max-w-[80ch] text-[12.5px] text-muted-foreground">Under the hood a recipe is an ordinary schedule. Every run is charged the skill&apos;s price in credits and counts toward your limits, and you are free to pause, edit or delete it whenever you like. The agent it creates belongs to you: rename it or give it a new look. The list of recipes will grow.</p>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
