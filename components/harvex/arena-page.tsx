'use client';
/* The arena (lib/arena.ts). Two pages:
   /arena        pick two published agents, type one question, start the duel. The question goes to each agent as a
                 normal chat message (POST /api/talk); when both have answered, POST /api/arena makes the duel and the
                 page moves to it. A side that failed was refunded and can be tried again on its own.
   /arena/<id>   the duel: the question, both agents on cards of the hero deck, both answers, and the pick.
   Nothing runs or is charged until "Start the duel". Picks need a sign-in; the creators of the two agents cannot pick
   in their own duel. /arena?a=<agent id>&b=<agent id> opens with the agents chosen. */
import {useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import {useThumb} from '@/app/avatar';
import {api,copyText,I,TextOut,FieldLabel} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {cn} from '@/lib/utils';
import {getCharacter,lookFor} from '@/lib/characters';
import type {MarketAgent} from '@/lib/agents';
import type {Duel,DuelSide} from '@/lib/arena';
import type {View} from '@/lib/routes';
import {SiteFooter} from './site-footer';

type Go=(v:View,doc?:string)=>void;
type Info={signedIn:boolean;mode:'live'|'sample';message:number;balance:number|null};
type Mine={id:string;created:string;question:string;a:string;b:string;votes:number};
const QUESTION_MAX=300;
/** The two corners: the lime card and the iris card of the hero deck. */
const CORNER={a:['bg-lime','text-ink','A'],b:['bg-iris','text-white','B']} as const;
const IDEAS=['Where would you start a new project?','Describe a blockchain so a child gets it.','Name one habit that improves a morning.'];

/** One agent to choose from: its picture and name; the corner it stands in when chosen. */
function Pick({a,corner,onPick}:{a:MarketAgent;corner:'a'|'b'|null;onPick:()=>void}){
 const src=useThumb(lookFor(a.skin,a.look,a.appearance),a.skin,true);
 return <button type="button" onClick={onPick} aria-pressed={!!corner} aria-label={`${corner?'Remove':'Pick'} ${a.name}`}
  className={cn('group relative flex items-center gap-3 rounded-xl border bg-card p-2.5 pr-3 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/40',corner&&'border-foreground')}>
  <span className={cn('relative grid size-14 shrink-0 place-items-end overflow-hidden rounded-lg',corner?CORNER[corner][0]:'bg-secondary')}><img src={src} alt="" draggable={false} className="h-full w-full origin-[50%_14%] scale-[1.7] object-cover object-[50%_12%]"/></span>
  <span className="grid min-w-0 gap-0.5"><b className="truncate text-[14.5px] font-medium">{a.name}</b>
   <span className="truncate font-mono text-[10.5px] tracking-[.04em] text-muted-foreground uppercase">{a.verified?a.creator:getCharacter(a.skin).role} · {a.talkPrice===0?'no creator fee':`${a.talkPrice} CR`}</span></span>
  {corner&&<span className={cn('ml-auto grid size-6 shrink-0 place-items-center rounded-md font-mono text-[11px] font-semibold',CORNER[corner][0],CORNER[corner][1])}>{CORNER[corner][2]}</span>}
 </button>;
}

export function ArenaPage({auth,onSignIn,onSpent,onNavigate}:{auth:boolean;onSignIn:()=>void;onSpent:()=>void;onNavigate:Go}){
 const [agents,setAgents]=useState<MarketAgent[]|null>(null);const [info,setInfo]=useState<Info|null>(null);const [mine,setMine]=useState<Mine[]>([]);
 const [a,setA]=useState<string|null>(null);const [b,setB]=useState<string|null>(null);const [question,setQuestion]=useState('');const [busy,setBusy]=useState(false);
 // answers already paid for in this attempt: a side that failed is tried again without asking the other one twice
 const done=useRef<{key:string;a?:string;b?:string}>({key:''});
 useEffect(()=>{let alive=true;
  api('/api/market?q=').then(d=>{if(!alive)return;const list=d.agents as MarketAgent[];setAgents(list);
   try{const p=new URLSearchParams(location.search);const wa=p.get('a'),wb=p.get('b'),q=p.get('q');if(wa&&list.some(x=>x.id===wa))setA(wa);if(wb&&wb!==wa&&list.some(x=>x.id===wb))setB(wb);if(q)setQuestion(q.slice(0,QUESTION_MAX));}catch{/* no link */}}).catch(()=>{if(alive)setAgents([]);});
  return()=>{alive=false;};},[]);
 useEffect(()=>{let alive=true;api('/api/talk').then(d=>{if(alive)setInfo(d);}).catch(()=>null);api('/api/arena').then(d=>{if(alive)setMine(d.duels||[]);}).catch(()=>null);return()=>{alive=false;};},[auth]);

 const A=agents?.find(x=>x.id===a)||null,B=agents?.find(x=>x.id===b)||null;
 const pick=(id:string)=>{if(busy)return;if(a===id)setA(null);else if(b===id)setB(null);else if(!a)setA(id);else if(!b)setB(id);else setB(id);};
 const q=question.trim();const cost=info&&A&&B?info.message*2+(A.mine?0:A.talkPrice)+(B.mine?0:B.talkPrice):null;
 const poor=auth&&cost!==null&&info?.balance!==null&&info?.balance!==undefined&&info.balance<cost;
 async function start(){
  if(busy||!A||!B||q.length<3)return;if(!auth){onSignIn();return;}
  const key=`${A.id}|${B.id}|${q}`;if(done.current.key!==key)done.current={key};
  setBusy(true);
  const ask=async(side:'a'|'b',agent:MarketAgent)=>{if(done.current[side])return;
   const r=await api('/api/talk',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),agentId:agent.id,thread:crypto.randomUUID(),message:q,expectedPrice:agent.mine?0:agent.talkPrice})});done.current[side]=r.id;};
  try{
   const res=await Promise.allSettled([ask('a',A),ask('b',B)]);onSpent();
   const failed=res.map((r,i)=>r.status==='rejected'?[i?B.name:A.name,(r.reason as Error)?.message||'It sent no answer.'] as const:null).filter(Boolean) as (readonly [string,string])[];
   if(failed.length){toast.error(`No answer from ${failed.map(f=>f[0]).join(' and ')}`,{description:`${failed[0][1]} That side cost you nothing. Start the duel again and only ${failed.length>1?'they are':'that agent is'} asked.`});return;}
   const d=await api('/api/arena',{method:'POST',body:JSON.stringify({runA:done.current.a,runB:done.current.b})});
   done.current={key:''};onNavigate('duel',d.id);
  }catch(e:any){toast.error(e.message);}finally{setBusy(false);}
 }
 return <>
  <section className="mx-auto grid max-w-[1120px] gap-8 px-[clamp(16px,3vw,32px)] pt-10 pb-16">
   <div className="grid gap-3">
    <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Harvex · Arena</span>
    <h1 className="font-display text-[clamp(38px,6.4vw,76px)] leading-[.96] font-medium tracking-[-.05em]"><span className="text-muted-foreground">Ask once.</span> Compare two answers.</h1>
    <p className="max-w-[60ch] text-[17px] leading-relaxed text-muted-foreground">Choose a pair of agents and send both one question. You get a page with the two answers next to each other. Post it, and whoever reads it can pick the answer they find better.</p>
   </div>

   {agents===null&&<p className="grid h-40 place-items-center rounded-2xl border text-sm text-muted-foreground">Loading the arena…</p>}
   {agents&&agents.length<2&&<div className="grid place-content-center justify-items-center gap-3 rounded-2xl border px-6 py-14 text-center">
    <b className="font-display text-2xl font-medium tracking-[-.02em]">It takes two published agents</b><p className="max-w-[46ch] text-sm text-muted-foreground">{agents.length===0?'This server has no published agent so far.':'This server has a single published agent so far.'} Once yours is published, it can take a corner.</p>
    <Button onClick={()=>onNavigate('studio')}>Make an agent<I id="arrow"/></Button></div>}
   {agents&&agents.length>=2&&<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
    <div className="grid gap-3">
     <FieldLabel>1 · Choose two agents <span className="font-normal">({[a,b].filter(Boolean).length} of 2)</span></FieldLabel>
     <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 [scrollbar-width:thin] sm:grid-cols-2">{agents.map(x=><Pick key={x.id} a={x} corner={a===x.id?'a':b===x.id?'b':null} onPick={()=>pick(x.id)}/>)}</div>
    </div>
    <div className="grid gap-4 rounded-2xl border bg-card p-5">
     <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      {(['a','b'] as const).map((s,i)=>{const x=s==='a'?A:B;return [i===1&&<span key="vs" className="font-mono text-[11px] tracking-[.14em] text-muted-foreground">VS</span>,
       <div key={s} className={cn('grid min-h-16 content-center gap-0.5 rounded-xl px-3 py-2.5',x?[CORNER[s][0],CORNER[s][1]]:'border border-dashed text-muted-foreground')}>
        <span className="font-mono text-[10px] tracking-[.1em] uppercase opacity-80">Corner {CORNER[s][2]}</span><b className="truncate text-[15px] font-medium">{x?x.name:'Choose an agent'}</b></div>];})}
     </div>
     <div className="grid gap-2"><FieldLabel htmlFor="duel-q">2 · One question for both</FieldLabel>
      <Textarea id="duel-q" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={QUESTION_MAX} disabled={busy} className="min-h-24 text-[15px]" placeholder="Type a question each of them can answer in its own style."/>
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1.5">{!q&&IDEAS.map(t=><button key={t} type="button" onClick={()=>setQuestion(t)} className="rounded-lg border px-2.5 py-1 text-[12.5px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground">{t}</button>)}</div>
       <span className="ml-auto text-xs text-muted-foreground tabular-nums">{question.length} / {QUESTION_MAX}</span></div></div>
     <Button size="lg" disabled={busy||!A||!B||q.length<3||!!poor} onClick={start}>{busy?'Waiting for both answers…':'Start the duel'}{!busy&&<I id="arrow"/>}</Button>
     <p className="text-[12.5px] text-muted-foreground">{info?.mode==='sample'?'This server has no AI connected, so the two answers will carry the label workflow sample. ':''}
      {cost===null?'The question reaches each agent as a single chat message.':poor?`You have ${info?.balance} credits and this duel needs ${cost}.`:`Total ${cost} credits, covering two chat messages${(A&&!A.mine&&A.talkPrice)||(B&&!B.mine&&B.talkPrice)?' and the price each creator set per message':''}. You pay nothing for an agent that fails to answer.`} Anyone who has the link can open the duel page, and you may remove it later.</p>
    </div>
   </div>}

   {mine.length>0&&<div className="grid gap-2">
    <span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">Your duels</span>
    <ul className="grid gap-1.5">{mine.map(d=><li key={d.id}><a href={`/arena/${d.id}`} onClick={e=>{e.preventDefault();onNavigate('duel',d.id);}} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-foreground/40">
     <b className="min-w-0 flex-1 basis-56 truncate text-[14.5px] font-medium">{d.question}</b><span className="text-[13px] text-muted-foreground">{d.a} vs {d.b}</span><span className="font-mono text-[11px] text-muted-foreground tabular-nums">{d.votes} pick{d.votes===1?'':'s'}</span></a></li>)}</ul>
   </div>}
   <p className="max-w-[80ch] text-[12.5px] text-muted-foreground">The two agents are AI characters, and each answers in a voice of its own. The instructions their creators wrote are never shown. A pick is the opinion of someone who opened the page, limited to one per account, and it affects nothing else on Harvex. AI makes mistakes, so verify anything important before you depend on it.</p>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}

/** One corner of a duel: the agent on a card of the deck, then its answer and the pick. */
function Corner({s,side,total,show,mine,canVote,busy,onVote,onOpen}:{s:'a'|'b';side:DuelSide;total:number;show:boolean;mine:boolean;canVote:boolean;busy:boolean;onVote:()=>void;onOpen:()=>void}){
 const src=useThumb(lookFor(side.skin,side.look as never,side.appearance as never),side.skin,true);const [bg,fg,letter]=CORNER[s];
 const pct=total?Math.round(side.votes*100/total):0;
 return <div className={cn('grid content-start gap-3 rounded-2xl border bg-card p-4',mine&&'border-foreground')}>
  <div className={cn('relative flex h-32 items-end overflow-hidden rounded-xl p-3.5',bg,fg)}>
   <span className="absolute top-3 left-3.5 font-mono text-[10.5px] font-semibold tracking-[.1em] uppercase">Corner {letter} · {getCharacter(side.skin).role}</span>
   <img src={src} alt="" draggable={false} className="pointer-events-none absolute top-[4%] right-1 h-[210%] w-auto object-contain"/>
   <b className="relative z-10 max-w-[68%] font-display text-[clamp(19px,2.2vw,26px)] leading-[1.05] font-medium tracking-[-.03em] break-words">{side.name}</b>
  </div>
  <div className="min-h-24"><TextOut text={side.text}/></div>
  <div className="mt-auto grid gap-2 border-t pt-3">
   {show&&<div className="grid gap-1"><div className="flex items-baseline justify-between text-[13px]"><b className="font-medium tabular-nums">{pct}%</b><span className="text-muted-foreground tabular-nums">{side.votes} pick{side.votes===1?'':'s'}</span></div>
    <div className="h-1.5 overflow-hidden rounded-full shape-round bg-secondary"><div className={cn('h-full rounded-full shape-round transition-[width] duration-500',bg)} style={{width:`${pct}%`}}/></div></div>}
   <div className="flex flex-wrap gap-2">
    {canVote&&<Button size="sm" variant={mine?'default':'outline'} disabled={busy} aria-pressed={mine} onClick={onVote}>{mine?<><I id="check"/>Your pick</>:'I prefer this answer'}</Button>}
    {side.agentId&&<Button size="sm" variant="ghost" onClick={onOpen}>Chat with {side.name}<I id="arrow"/></Button>}
   </div>
  </div>
 </div>;
}

export function DuelPage({id,auth,onSignIn,onNavigate}:{id:string;auth:boolean;onSignIn:()=>void;onNavigate:Go}){
 const [d,setD]=useState<Duel|null>(null);const [state,setState]=useState<'loading'|'ready'|'missing'>('loading');const [busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;
  api(`/api/arena?id=${encodeURIComponent(id)}`).then(r=>{if(!alive)return;setD(r.duel);setState('ready');}).catch(()=>{if(alive)setState('missing');});
  return()=>{alive=false;};},[id,auth]);
 async function vote(choice:'a'|'b'){
  if(busy||!d)return;setBusy(true);
  try{const r=await api('/api/arena',{method:'POST',body:JSON.stringify({action:'vote',id,choice:d.mine===choice?null:choice})});if(r.duel)setD(r.duel);}
  catch(e:any){toast.error(e.message);}finally{setBusy(false);}
 }
 async function remove(){
  if(busy)return;setBusy(true);
  try{await api('/api/arena',{method:'DELETE',body:JSON.stringify({id})});toast.success('Duel removed');onNavigate('arena');}catch(e:any){toast.error(e.message);setBusy(false);}
 }
 if(state==='missing')return <>
  <section className="mx-auto grid min-h-[calc(100svh-var(--top)-40px)] max-w-[720px] place-content-center justify-items-center gap-5 px-4 py-16 text-center">
   <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Arena</span>
   <h1 className="font-display text-[clamp(32px,5vw,56px)] leading-none font-medium tracking-[-.045em]">No duel at this link</h1>
   <p className="max-w-[46ch] text-muted-foreground">Either the person who made it removed it, or the address has a typo.</p>
   <div className="flex flex-wrap justify-center gap-2"><Button onClick={()=>onNavigate('arena')}>Make a new duel</Button><Button variant="outline" onClick={()=>onNavigate('home')}>Go home</Button></div>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
 const link=typeof location!=='undefined'?location.origin+'/arena/'+id:'/arena/'+id;
 const post=d?`https://x.com/intent/post?text=${encodeURIComponent(`${d.a.name} vs ${d.b.name}: one question put to two AI agents on Harvex. Whose answer do you prefer?`)}&url=${encodeURIComponent(link)}`:'#';
 const total=d?d.a.votes+d.b.votes:0;
 // someone who can still pick sees the count only after picking, so the pick is their own
 const show=!!d&&(!d.canVote||!!d.mine);
 return <>
  <section className="mx-auto grid max-w-[1120px] gap-7 px-[clamp(16px,3vw,32px)] pt-10 pb-16">
   <div className="grid gap-3">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[.08em] text-muted-foreground uppercase"><span>Arena · two agents, one question</span>{d&&<span>{new Date(d.created).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</span>}{d?.sample&&<span>Workflow samples</span>}</div>
    <h1 className="max-w-[24ch] font-display text-[clamp(28px,4.6vw,56px)] leading-[1.02] font-medium tracking-[-.04em] break-words">{d?d.question:' '}</h1>
   </div>
   {d?<div className="grid items-stretch gap-4 md:grid-cols-2">
    {(['a','b'] as const).map(s=><Corner key={s} s={s} side={d[s]} total={total} show={show} mine={d.mine===s} canVote={d.canVote} busy={busy} onVote={()=>vote(s)} onOpen={()=>onNavigate('agent',d[s].agentId!)}/>)}
   </div>:<p className="grid h-48 place-items-center rounded-2xl border text-sm text-muted-foreground">Loading…</p>}
   {d&&<p className="text-[13.5px] text-muted-foreground" aria-live="polite">
    {d.canVote?(d.mine?`Your pick is ${d[d.mine].name}. Click the same button once more to undo it.`:'Which of the two answers do you prefer? Choose first, then the count appears.')
     :auth?'One of these agents is yours, so picking is closed to you in this duel.':<>Prefer one of the answers? <button type="button" onClick={onSignIn} className="underline underline-offset-4 hover:text-foreground">Sign in</button> to pick it.</>}</p>}
   <div className="flex flex-wrap gap-2">
    <Button size="lg" onClick={()=>onNavigate('arena')}>Make a duel of your own<I id="arrow"/></Button>
    <Button size="lg" variant="outline" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy link</Button>
    <Button size="lg" variant="outline" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
    {d?.yours&&<Button size="lg" variant="ghost" disabled={busy} onClick={remove}>Remove this duel</Button>}
   </div>
   <p className="max-w-[80ch] text-[12.5px] text-muted-foreground">Two AI agents in Harvex Agent Studio wrote these answers to one and the same question. The person who asked put the page up and can remove it whenever they choose. A pick is the opinion of someone who opened the page, limited to one per account. AI makes mistakes, so verify anything important before you depend on it.</p>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
