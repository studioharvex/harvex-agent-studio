'use client';
/* Agent teams (/dashboard/teams): a line of two or three agents. Running a team runs the steps in order with the same
   task; each step is a normal run (POST /api/runs with `relay`) that works from the answer of the step before it, so
   credits, limits, refunds and History behave as for any run, and a published agent's creator is paid its price.
   Kits (lib/team-kits.ts) make the agents and the team in one click. Saved teams: /api/teams (lib/teams.ts). */
import {useCallback,useEffect,useMemo,useState} from 'react';
import {toast} from 'sonner';
import {FieldError,useFormCheck} from './form';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {NativeSelect,NativeSelectOptGroup,NativeSelectOption} from '@/components/ui/native-select';
import {api,copyText,I,FieldLabel,TextOut,outputText} from '@/app/ui';
import {cn} from '@/lib/utils';
import {skillCatalog,type Agent,type MarketAgent,type Run} from '@/lib/agents';
import {Thumb} from '@/components/landing/mocks';
import type {CharacterId} from '@/lib/characters';
import {TEAM_KITS,kitTeam,type TeamKit} from '@/lib/team-kits';
import {DashPage,EmptyState,Kpi,KpiRow,PageHeader,StatusBadge} from './parts';

type Step={agentId:string;skill:string;name:string;skin:string;mine:boolean;price:number;ok:boolean};
type Team={id:string;name:string;steps:Step[];runs:number;updated:string};
type Costs={mode:'live'|'sample';sample:number;live:number;skills:Record<string,number>};
type Data={signedIn:boolean;token:boolean;teams:Team[];limits:{max:number;minSteps:number;maxSteps:number};costs:Costs};
type Draft={id?:string;name:string;steps:{agentId:string;skill:string}[]};
type StepState={status:'waiting'|'working'|'done'|'failed';run?:Run;error?:string};
type Live={team:Team;relay:string;task:string;states:StepState[]};

const skillName=(id:string)=>skillCatalog.find(s=>s.id===id)?.name||id;
/** Credits for one step: the platform's price for the skill (or the sample price) plus the creator's price. */
const stepCost=(c:Costs|undefined,s:{skill:string;price:number})=>(c?(c.mode==='sample'?c.sample:c.skills[s.skill]??c.live):0)+s.price;
const teamCost=(c:Costs|undefined,t:{steps:{skill:string;price:number}[]})=>t.steps.reduce((a,s)=>a+stepCost(c,s),0);

/** The agents of a line, in order, with an arrow between them. */
export function TeamLine({steps,size='size-10'}:{steps:{name:string;skin:string;skill:string}[];size?:string}){
 return <div className="flex flex-wrap items-center gap-2">{steps.map((s,i)=><span key={i} className="flex items-center gap-2">
  {i>0&&<I id="arrow" className="i size-3.5 text-muted-foreground"/>}
  <span className="flex items-center gap-2 rounded-lg border bg-background py-1 pr-3 pl-1"><Thumb id={s.skin as CharacterId} className={cn(size,'shrink-0 rounded-md bg-t-lime object-[50%_18%]')}/>
   <span className="grid leading-tight"><b className="text-[13px] font-semibold">{s.name}</b><span className="font-mono text-[10.5px] text-muted-foreground">{skillName(s.skill)}</span></span></span>
 </span>)}</div>;
}

/** Ready-made teams: one click makes the agents a kit needs and saves the team. */
function KitStrip({kits,open,busy,onUse}:{kits:TeamKit[];open:string|null;busy:string|null;onUse?:(k:TeamKit)=>void}){
 return <section className="grid gap-4 rounded-2xl border bg-card p-6">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-[15px] font-semibold">Ready-made teams</b><span className="text-[12.5px] text-muted-foreground">Agents and team set up in a single click</span></div>
  <div className="grid gap-2 md:grid-cols-2">{kits.map(k=><div key={k.id} className={cn('grid content-start gap-3 rounded-lg border p-3',open===k.id&&'border-lime bg-lime/10')}>
   <b className="text-sm font-semibold">{k.title}</b>
   <TeamLine steps={k.steps.map(s=>({name:s.agent.name,skin:s.agent.skin,skill:s.skill}))} size="size-8"/>
   <p className="text-[12.5px] text-muted-foreground">{k.text}</p>
   {onUse&&<Button size="sm" variant="outline" className="justify-self-start" disabled={!!busy} onClick={()=>onUse(k)}><I id="plus"/>{busy===k.id?'Setting up…':'Use this team'}</Button>}
  </div>)}</div>
 </section>;
}

export function TeamsPage({auth,agents,balance,onSignIn,onOpenHistory,onChanged}:{auth:boolean;agents:Agent[];balance:number|null;onSignIn:()=>void;onOpenHistory:()=>void;onChanged:()=>void}){
 // a link from the public page opens its kit: /dashboard/teams?kit=<id>
 const [kit]=useState(()=>{try{return new URLSearchParams(location.search).get('kit');}catch{return null;}});
 const [data,setData]=useState<Data|null>(null);const [market,setMarket]=useState<MarketAgent[]>([]);
 const [pick,setPick]=useState<string|null>(null);const [task,setTask]=useState('');const [draft,setDraft]=useState<Draft|null>(null);
 const [busy,setBusy]=useState<string|null>(null);const [live,setLive]=useState<Live|null>(null);const [running,setRunning]=useState(false);
 const load=useCallback(async()=>{try{const d=await api('/api/teams');setData(d);return d as Data;}catch{return null;}},[]);
 useEffect(()=>{load();},[load,auth]);
 // agents published by others can be a step too; the list is only needed once a team is being edited
 useEffect(()=>{if(!draft||market.length)return;api('/api/market?q=').then(d=>setMarket((d.agents as MarketAgent[]).filter(a=>!a.mine))).catch(()=>null);},[draft,market.length]);

 const own=useMemo(()=>agents.filter(a=>a.id&&!a.archived),[agents]);
 const teams=useMemo(()=>data?.teams||[],[data]);const C=data?.costs;const L=data?.limits;
 const kits=TEAM_KITS.filter(k=>k.needs!=='token'||!!data?.token);
 const team=teams.find(t=>t.id===pick)||null;
 // every agent a step can use: the account's own, published ones, and the ones already in the team being edited
 const pool=useMemo(()=>{
  const m=new Map<string,{name:string;skills:string[];price:number;mine:boolean}>();
  for(const t of teams)for(const s of t.steps)if(s.ok&&!m.has(s.agentId))m.set(s.agentId,{name:s.name,skills:[s.skill],price:s.price,mine:s.mine});
  for(const a of market)m.set(a.id,{name:a.name,skills:[...a.skills],price:a.price,mine:false});
  for(const a of own)m.set(a.id!,{name:a.name,skills:[...a.skills],price:0,mine:true});
  return m;},[teams,market,own]);

 async function startKit(k:TeamKit){
  if(busy)return;setBusy(k.id);
  try{
   const known=[...own];const steps:{agentId:string;skill:string}[]=[];let made=false;
   for(const s of k.steps){
    // an agent of that name with the skill (made by this kit, another kit or a recipe) is used again
    let id=known.find(a=>a.name===s.agent.name&&(a.skills as readonly string[]).includes(s.skill))?.id;
    if(!id){id=(await api('/api/agents',{method:'POST',body:JSON.stringify({...s.agent,language:'English'})})).id as string;known.push({...s.agent,language:'English',id} as unknown as Agent);made=true;}
    steps.push({agentId:id,skill:s.skill});
   }
   const had=kitTeam(k,teams);
   const d=had?null:await api('/api/teams',{method:'POST',body:JSON.stringify({name:k.title,steps})});
   if(d)setData(d);setPick(had?had.id:d.id);setTask(k.task);setDraft(null);if(made)onChanged();
   toast.success(had?`${k.title} is ready`:`${k.title} saved`,{description:'Adjust the task, then run the team.'});
  }catch(e:any){toast.error(e.message);}finally{setBusy(null);}
 }
 async function save(){
  if(!draft||busy)return;if(!await teamForm.check({name:draft.name,steps:draft.steps}))return;setBusy('save');
  try{const d=await api('/api/teams',{method:'POST',body:JSON.stringify(draft)});setData(d);setPick(d.id);setDraft(null);toast.success('Team saved');}
  catch(e:any){toast.error(e.message);}finally{setBusy(null);}
 }
 async function remove(t:Team){
  if(!confirm(`Delete the team “${t.name}”? Nothing happens to its agents or to the runs it made.`))return;
  try{setData(await api('/api/teams',{method:'DELETE',body:JSON.stringify({id:t.id})}));if(pick===t.id)setPick(null);}catch(e:any){toast.error(e.message);}
 }
 /** Runs the team's steps in order from `from`; a step that fails stops the line and can be tried again. */
 async function run(t:Team,from=0){
  if(running||!C)return;
  const prior=from>0?live:null;const text=prior?prior.task:task.trim();const relay=prior?prior.relay:crypto.randomUUID();
  let states:StepState[]=t.steps.map((_,i)=>prior&&i<from?prior.states[i]:{status:'waiting'});
  let after=from>0?states[from-1].run?.id:undefined;
  setRunning(true);
  for(let i=from;i<t.steps.length;i++){
   const s=t.steps[i];const set=(st:StepState)=>{states=states.map((x,j)=>j===i?st:x);setLive({team:t,relay,task:text,states});};
   set({status:'working'});
   try{
    const r=await api('/api/runs',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),agentId:s.agentId,prompt:text,skill:s.skill,mode:C.mode,
     relay:{id:relay,step:i+1,...(after?{after}:{})},...(i===0?{team:t.id}:{}),...(s.mine?{}:{expectedPrice:s.price})})}) as Run;
    after=r.id;set({status:'done',run:r});
   }catch(e:any){set({status:'failed',error:e.message});if(e.status===409)load();break;}
  }
  setRunning(false);onChanged();load();
 }

 const header=<PageHeader icon="link" tone="iris" title="Teams" text="A team is two or three agents in a row. Every agent uses its skill and passes the answer on: research goes to a writer, the draft to a translator."
  actions={auth?<><Button variant="outline" onClick={onOpenHistory}><I id="clock"/>History</Button><Button disabled={!!L&&teams.length>=L.max} onClick={()=>setDraft({name:'',steps:[{agentId:'',skill:''},{agentId:'',skill:''}]})}><I id="plus"/>New team</Button></>:undefined}/>;
 if(!auth)return <DashPage>{header}<KitStrip kits={kits} open={kit} busy={null}/>
  <EmptyState title="Teams need a signed-in account" text="A team works through agents in order: ones you saved or ones another creator published. Every step is paid in credits, the same as a single run." chars={['atlas','nova','ines']} action={<Button onClick={onSignIn}><I id="wallet"/>Connect wallet</Button>}/></DashPage>;

 const setStep=(i:number,patch:Partial<{agentId:string;skill:string}>)=>setDraft(d=>d&&{...d,steps:d.steps.map((s,j)=>{if(j!==i)return s;const next={...s,...patch};const skills=pool.get(next.agentId)?.skills||[];return {...next,skill:skills.includes(next.skill)?next.skill:skills[0]||''};})});
 const teamForm=useFormCheck('team'),taskForm=useFormCheck('task');
 const cost=team?teamCost(C,team):0;const broken=!!team&&team.steps.some(s=>!s.ok);const last=live?.states[live.states.length-1];
 const failedAt=live?live.states.findIndex(s=>s.status==='failed'):-1;
 return <DashPage>
  {header}
  <KpiRow>
   <Kpi label="Teams" value={`${teams.length}/${L?.max??12}`} hint="Agent lines you saved" tone="iris" icon="link"/>
   <Kpi label="Team runs" value={teams.reduce((a,t)=>a+t.runs,0)} hint="Runs you started here" tone="lime" icon="play"/>
   <Kpi label="Steps" value={`${L?.minSteps??2}–${L?.maxSteps??3}`} hint="Agents a line can hold" tone="mint" icon="users"/>
   <Kpi label="Each step" value={C?.mode==='sample'?`${C.sample} CR`:'Skill price'} hint={C?.mode==='live'?'Live AI, and the creator’s price if any':'Workflow sample'} tone="amber" icon="coins"/>
  </KpiRow>
  {data&&<KitStrip kits={kits} open={kit} busy={busy} onUse={startKit}/>}

  {draft&&<section className="grid gap-4 rounded-2xl border bg-card p-6">
   <b className="text-[15px] font-semibold">{draft.id?'Change team':'New team'}</b>
   <div className="grid gap-2"><FieldLabel htmlFor="team-name">Name</FieldLabel><Input id="team-name" value={draft.name} maxLength={40} onChange={e=>{setDraft({...draft,name:e.target.value});teamForm.clear('name');}} placeholder="e.g. Find and draft" className="h-9 max-w-sm" {...teamForm.field('name')}/><FieldError form={teamForm} field="name"/></div>
   <div className="grid gap-2">{draft.steps.map((s,i)=>{const a=pool.get(s.agentId);return <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border bg-secondary/40 p-3">
    <span className="grid size-7 place-items-center rounded-md bg-background font-mono text-[11px] font-bold">{i+1}</span>
    <NativeSelect size="sm" value={s.agentId} aria-label={`Agent of step ${i+1}`} onChange={e=>setStep(i,{agentId:e.target.value})}>
     <NativeSelectOption value="">Choose an agent</NativeSelectOption>
     <NativeSelectOptGroup label="Your agents">{own.map(o=><NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}</NativeSelectOptGroup>
     {[...pool].some(([,p])=>!p.mine)&&<NativeSelectOptGroup label="Published by others">{[...pool].filter(([,p])=>!p.mine).map(([id,p])=><NativeSelectOption key={id} value={id}>{p.name} · {p.price>0?`${p.price} CR to its creator`:'free'}</NativeSelectOption>)}</NativeSelectOptGroup>}
    </NativeSelect>
    <NativeSelect size="sm" value={s.skill} disabled={!a} aria-label={`Skill of step ${i+1}`} onChange={e=>setStep(i,{skill:e.target.value})}>
     {!a&&<NativeSelectOption value="">Skill</NativeSelectOption>}
     {(a?.skills||[]).map(k=><NativeSelectOption key={k} value={k}>{skillName(k)}</NativeSelectOption>)}
    </NativeSelect>
    <span className="text-[12px] text-muted-foreground">{i===0?'takes the task itself':'builds on the previous answer'}{a?` · ${stepCost(C,{skill:s.skill,price:a.price})} CR`:''}</span>
    {draft.steps.length>(L?.minSteps??2)&&<Button size="sm" variant="ghost" className="ml-auto" onClick={()=>setDraft({...draft,steps:draft.steps.filter((_,j)=>j!==i)})}>Remove</Button>}
   </div>;})}</div>
   {!own.length&&<p className="text-[12.5px] text-muted-foreground">No agent is saved on your account yet. Pick a ready-made team above or save one in the Studio.</p>}
   <FieldError form={teamForm} field="steps"/>
   <div className="flex flex-wrap items-center gap-2">
    <Button disabled={!!busy} onClick={save}><I id="save"/>{busy==='save'?'Saving…':'Save team'}</Button>
    {draft.steps.length<(L?.maxSteps??3)&&<Button variant="outline" onClick={()=>setDraft({...draft,steps:[...draft.steps,{agentId:'',skill:''}]})}><I id="plus"/>Add a step</Button>}
    <Button variant="ghost" onClick={()=>setDraft(null)}>Cancel</Button>
   </div>
  </section>}

  {teams.length>0&&<div className="stagger grid gap-3 lg:grid-cols-2">{teams.map(t=><div key={t.id} className={cn('grid gap-3 rounded-xl border bg-card p-4 transition-colors',pick===t.id&&'border-lime')}>
   <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-sm font-semibold">{t.name}</b>
    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{teamCost(C,t)} CR per run · {t.runs} run{t.runs===1?'':'s'}</span></div>
   <TeamLine steps={t.steps}/>
   {t.steps.some(s=>!s.ok)&&<p className="rounded-lg bg-t-coral px-2.5 py-1.5 text-[12px] text-tx-coral">One agent in this team was removed or no longer has its skill. The team runs again after you change it.</p>}
   <div className="flex flex-wrap items-center gap-2">
    <Button size="sm" onClick={()=>{setPick(t.id);setDraft(null);}}><I id="play"/>Run</Button>
    <Button size="sm" variant="outline" onClick={()=>setDraft({id:t.id,name:t.name,steps:t.steps.map(s=>({agentId:s.agentId,skill:s.skill}))})}><I id="edit"/>Change</Button>
    <Button size="sm" variant="ghost" className="ml-auto" onClick={()=>remove(t)}><I id="archive"/>Delete</Button>
   </div>
  </div>)}</div>}
  {data&&!teams.length&&!draft&&<EmptyState title="You have no team yet" text="Take one of the ready-made teams above, or put your saved agents in a line of your own." chars={['atlas','nova','ines']}/>}

  {team&&<section className="grid gap-4 rounded-2xl border bg-card p-6">
   <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-[15px] font-semibold">Run {team.name}</b>
    <span className="text-[12.5px] text-muted-foreground tabular-nums">{cost} credits for the whole line{balance!==null?` · you have ${balance}`:''}</span></div>
   <div className="grid gap-2"><FieldLabel htmlFor="team-task">The task for the team</FieldLabel>
    <Textarea id="team-task" value={task} onChange={e=>{setTask(e.target.value);taskForm.clear('task');}} maxLength={6000} className="min-h-28" placeholder="Describe the result you are after. Agent one takes the task, and every later agent builds on the answer it is handed." {...taskForm.field('task')}/><FieldError form={taskForm} field="task"/></div>
   <div className="flex flex-wrap items-center gap-3"><Button className="h-10" disabled={running||broken||(balance!==null&&balance<cost)} onClick={async()=>{if(await taskForm.check({task}))run(team);}}><I id="play"/>{running?'Working…':'Run the team'}</Button>
    <span className="text-xs text-muted-foreground">{broken?'One of the agents cannot run. Change the team before you start it.':balance!==null&&balance<cost?'Your credits do not cover the whole line.':`${team.steps.map(s=>`${s.name} ${stepCost(C,s)}`).join(' + ')} credits. A step is charged at its start and refunded if it fails.`}{C?.mode==='sample'?' This server has no AI connected, so every step gives a labelled workflow sample.':''}</span></div>
  </section>}

  {live&&<section className="grid gap-3" aria-live="polite">
   {live.states.map((st,i)=>{const s=live.team.steps[i];const final=i===live.states.length-1;return <div key={i} className={cn('grid gap-3 rounded-xl border bg-card p-4',st.status==='working'&&'border-lime')}>
    <div className="flex flex-wrap items-center gap-3">
     <Thumb id={s.skin as CharacterId} className="size-11 shrink-0 rounded-lg bg-t-lime object-[50%_18%]"/>
     <div className="grid min-w-0 flex-1 leading-tight"><b className="text-sm font-semibold">Step {i+1} · {s.name}</b><span className="font-mono text-[11px] text-muted-foreground">{skillName(s.skill)}{i>0?` · from ${live.team.steps[i-1].name}'s answer`:''}</span></div>
     <StatusBadge kind={st.status==='done'?'complete':st.status==='failed'?'failed':st.status==='working'?'pending':'private'}>{st.status==='done'?`done · ${st.run?.cost??0} CR`:st.status==='working'?'working':st.status}</StatusBadge>
    </div>
    {st.status==='working'&&<p className="text-[13px] text-muted-foreground">{s.name} is working{i>0?` from what ${live.team.steps[i-1].name} handed over`:''}…</p>}
    {st.status==='failed'&&<div className="flex flex-wrap items-center gap-3"><p className="text-[13px] text-tx-coral">{st.error}</p>
     {!running&&<Button size="sm" variant="outline" onClick={()=>run(teams.find(t=>t.id===live.team.id)||live.team,i)}><I id="reset"/>Try this step again</Button>}</div>}
    {st.run&&(final?<div className="rounded-xl border bg-background p-4"><TextOut text={st.run.output}/></div>
     :<details className="rounded-lg border bg-background p-3 text-[13px]"><summary className="cursor-pointer text-muted-foreground">Show what {s.name} handed over</summary><div className="pt-3"><TextOut text={st.run.output}/></div></details>)}
   </div>;})}
   {!running&&last?.run&&<div className="flex flex-wrap gap-2">
    <Button variant="outline" onClick={()=>copyText(outputText(last.run!.output),toast.success,toast.error)}><I id="copy"/>Copy the final answer</Button>
    <Button variant="outline" onClick={onOpenHistory}><I id="clock"/>Every step in History</Button></div>}
   {!running&&failedAt>0&&<p className="text-xs text-muted-foreground">Every step ahead of the failed one is finished and kept in History. The refund covers the failed step only.</p>}
  </section>}
  <p className="text-xs text-muted-foreground">Running a team means {L?.minSteps??2} to {L?.maxSteps??3} ordinary runs, one after the other. Each step has the price of its skill, is counted in your daily limits and is saved in History. If a step uses another creator’s published agent, that creator gets their price as well, and the agent’s instructions are never shown. Of a very long answer only the first part is passed on.</p>
 </DashPage>;
}
