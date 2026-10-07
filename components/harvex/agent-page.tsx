'use client';
/* Public page of one published agent (/a/<id>): the link people post on X or send to a friend. It shows what
   Discover shows (name, character, skills, price, how often it ran); the creator's instructions are never part of
   the data. Under it is the chat (agent-talk.tsx): anyone signed in can talk to the agent, paid per message; the
   character thinks while it answers and nods when the answer is there. At the bottom is the agent's card
   (/api/og/agent/<id>, the same picture a link to this page shows): post it, or download it to post yourself. Its link preview comes from
   app/a/[id]/page.tsx and /api/og/agent/<id>. */
import {useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import Avatar from '@/app/avatar';
import {api,copyText,I,SKILL_ICON} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {StatusBadge} from '@/components/app/parts';
import {getCharacter} from '@/lib/characters';
import {skillCatalog,type MarketAgent} from '@/lib/agents';
import {agentPath,type View} from '@/lib/routes';
import {SiteFooter} from './site-footer';
import {AgentTalk} from './agent-talk';

type Go=(v:View,doc?:string)=>void;
const skill=(id:string)=>skillCatalog.find(s=>s.id===id);

export function AgentPage({id,auth,onSignIn,onSpent,onRun,onNavigate}:{id:string;auth:boolean;onSignIn:()=>void;onSpent:()=>void;onRun:(a:MarketAgent)=>void;onNavigate:Go}){
 const [mood,setMood]=useState<'think'|'answer'|'idle'>('idle');const calm=useRef<ReturnType<typeof setTimeout>|null>(null);const talk=useRef<HTMLDivElement|null>(null);
 const onMood=(m:'think'|'answer'|'idle')=>{if(calm.current)clearTimeout(calm.current);setMood(m);if(m==='answer')calm.current=setTimeout(()=>setMood('idle'),3500);};
 useEffect(()=>()=>{if(calm.current)clearTimeout(calm.current);},[]);
 const [saving,setSaving]=useState(false);
 /** Saves the agent's card as a PNG file. */
 async function downloadCard(src:string,name:string){
  if(saving)return;setSaving(true);
  try{const r=await fetch(src);if(!r.ok||!(r.headers.get('content-type')||'').startsWith('image/'))throw new Error();
   const url=URL.createObjectURL(await r.blob());const el=document.createElement('a');el.href=url;el.download=`harvex-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'agent'}-card.png`;document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
  }catch{toast.error('The card could not be downloaded. Try again in a moment.');}finally{setSaving(false);}
 }
 const [agent,setAgent]=useState<MarketAgent|null>(null);const [state,setState]=useState<'loading'|'ready'|'missing'>('loading');
 useEffect(()=>{let alive=true;setState('loading');setAgent(null);
  api(`/api/market?id=${encodeURIComponent(id)}`).then(d=>{if(!alive)return;setAgent(d.agent);setState('ready');}).catch(()=>{if(alive)setState('missing');});
  return()=>{alive=false;};},[id]);

 if(state==='missing')return <>
  <section className="mx-auto grid min-h-[calc(100svh-var(--top)-40px)] max-w-[720px] place-content-center justify-items-center gap-5 px-4 py-16 text-center">
   <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Agent</span>
   <h1 className="font-display text-[clamp(32px,5vw,56px)] leading-none font-medium tracking-[-.045em]">This agent is not available</h1>
   <p className="max-w-[46ch] text-muted-foreground">Its creator may have taken it out of Discover, or the link is mistyped.</p>
   <div className="flex flex-wrap justify-center gap-2"><Button onClick={()=>onNavigate('discover')}>Browse Discover</Button><Button variant="outline" onClick={()=>onNavigate('home')}>Go home</Button></div>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;

 const c=agent?getCharacter(agent.skin):null;
 const link=typeof location!=='undefined'?location.origin+agentPath(id):agentPath(id);
 const post=agent?`https://x.com/intent/post?text=${encodeURIComponent(agent.mine?`Meet ${agent.name}, my AI agent on Harvex. Chat with it:`:`${agent.name}, an AI agent on Harvex. Chat with it:`)}&url=${encodeURIComponent(link)}`:'#';
 return <>
  <section className="mx-auto grid max-w-[1120px] items-start gap-8 px-[clamp(16px,3vw,32px)] pt-10 pb-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
   <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border bg-stage max-md:aspect-[4/4.2]">
    {agent?<Avatar skin={agent.skin} appearance={agent.appearance} look={agent.look} animation={mood==='think'?'Think':mood==='answer'?'Nod':agent.motion||'Idle'}/>:<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading…</div>}
   </div>
   <div className="grid gap-6 md:pt-6">
    <div className="grid gap-3">
     <div className="flex flex-wrap items-center gap-2">
      <StatusBadge kind="live">Published</StatusBadge>
      {c&&<span className="font-mono text-[11px] tracking-[.08em] text-muted-foreground uppercase">{c.name} · {c.role}</span>}
     </div>
     <h1 className="font-display text-[clamp(34px,5vw,60px)] leading-[1.02] font-medium tracking-[-.045em] break-words">{agent?.name||' '}</h1>
     {agent?.tagline&&<p className="max-w-[52ch] text-[17px] leading-relaxed text-muted-foreground">{agent.tagline}</p>}
    </div>

    {agent&&(agent.checked||agent.rating||agent.knows||(agent.health&&agent.health.total>=5))&&<div className="flex flex-wrap gap-1.5">
     {agent.checked&&<span className="flex items-center gap-1.5 rounded-lg border border-lime bg-lime/10 px-2.5 py-1 text-[12.5px] font-medium" title="It passed the agent check with the instructions it has now: it answers, keeps its instructions private, gives no buy or sell advice and says it is an AI."><I id="scan" className="i size-3.5"/>Checked {new Date(agent.checked).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</span>}
     {agent.rating&&<span className="rounded-lg border px-2.5 py-1 text-[12.5px]"><b className="font-medium">{agent.rating.percent}% helpful</b> <span className="text-muted-foreground">· {agent.rating.count} marks</span></span>}
     {agent.health&&agent.health.total>=5&&<span className="rounded-lg border px-2.5 py-1 text-[12.5px]"><b className="font-medium">Answered {agent.health.ok} of its last {agent.health.total}</b></span>}
     {agent.knows&&<span className="rounded-lg border px-2.5 py-1 text-[12.5px] text-muted-foreground" title="Its creator gave it text to answer from. For each message it is given the passages that match, and the sources are named under the answer.">{agent.sources?`Answers from ${agent.sources} ${agent.sources===1?'source':'sources'} of its creator`:'Answers from its creator’s notes'}</span>}
    </div>}
    {agent&&<div className="grid gap-2">
     <span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">What it does</span>
     <ul className="grid gap-2">{agent.skills.map(s=>{const k=skill(s);return <li key={s} className="flex items-start gap-3 rounded-xl border bg-card p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary"><I id={SKILL_ICON[k?.icon||'']||'globe'}/></span>
      <span className="grid gap-0.5"><b className="text-sm font-semibold">{k?.name||s}</b>{k?.description&&<span className="text-[13px] text-muted-foreground">{k.description}</span>}</span>
     </li>;})}</ul>
    </div>}

    {agent&&<div className="grid grid-cols-3 overflow-hidden rounded-xl border text-center">
     {([['Chat',agent.talkPrice===0?'Free':`${agent.talkPrice} CR`,agent.talkPrice===0?'the creator asks nothing':'per message, to its creator'],['Task',agent.price===0?'Free':`${agent.price} CR`,agent.price===0?'per run':'per run, plus the skill'],['Runs',String(agent.uses),'so far']] as const).map(([l,v,h],k)=>
      <div key={l} className={k?'grid gap-0.5 border-l p-3':'grid gap-0.5 p-3'}><span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">{l}</span><b className="font-display text-xl font-medium tabular-nums">{v}</b><span className="text-[11.5px] text-muted-foreground">{h}</span></div>)}
    </div>}

    <div className="flex flex-wrap gap-2">
     <Button size="lg" disabled={!agent} onClick={()=>talk.current?.scrollIntoView({behavior:'smooth',block:'start'})}>Chat with it<I id="arrow"/></Button>
     <Button size="lg" variant="outline" disabled={!agent} onClick={()=>agent&&onRun(agent)}>Run a task</Button>
     {agent&&<Button size="lg" variant="outline" asChild><a href={`/arena?a=${agent.id}`}><I id="target"/>Put it in a duel</a></Button>}
     <Button size="lg" variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
     <Button size="lg" variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
    </div>
    {agent?.verified&&<a href={`https://x.com/${agent.creator.slice(1)}`} target="_blank" rel="noreferrer noopener nofollow" className="flex items-center gap-2 justify-self-start rounded-lg border border-lime bg-lime/10 px-3 py-2 text-[13px] font-medium"><I id="check" className="i size-4 text-lime"/>Verified creator · {agent.creator}</a>}
    <p className="text-[12.5px] text-muted-foreground">{agent?`By ${agent.mine?'you':agent.creator}${agent.verified?', a creator the team verified on X':''}. `:''}You pay in credits when you chat with it or run it. The creator's instructions are never shown.</p>
   </div>
  </section>
  <div ref={talk} className="mx-auto max-w-[1120px] scroll-mt-24 px-[clamp(16px,3vw,32px)] pb-8">{agent&&<AgentTalk agent={agent} auth={auth} onSignIn={onSignIn} onSpent={onSpent} onMood={onMood}/>}</div>
  {agent&&(()=>{const card=`/api/og/agent/${agent.id}?v=${agent.uses}-${agent.price}-${agent.talkPrice}-${agent.verified?1:0}`;
   return <section className="mx-auto grid max-w-[1120px] items-center gap-6 px-[clamp(16px,3vw,32px)] pb-16 md:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]" aria-label={`The card of ${agent.name}`}>
    <img src={card} alt={`The card of ${agent.name}: its character, its name, runs and prices`} width={1200} height={630} loading="lazy" className="h-auto w-full rounded-2xl border"/>
    <div className="grid gap-3">
     <span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">Its card</span>
     <b className="font-display text-[clamp(26px,3vw,36px)] leading-[1.02] font-medium tracking-[-.04em]">{agent.mine?'Show it off':'Pass it on'}</b>
     <p className="max-w-[44ch] text-[14.5px] text-muted-foreground">{agent.mine?'This is the card a link to your agent shows.':'This is the card a link to this agent shows.'} Post the link and the card comes with it, or download the picture and post it yourself.</p>
     <div className="flex flex-wrap gap-2">
      <Button asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
      <Button variant="outline" disabled={saving} onClick={()=>downloadCard(card,agent.name)}><I id="download"/>{saving?'Preparing…':'Download card'}</Button>
      <Button variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
     </div>
    </div>
   </section>;})()}
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
