'use client';
/* Scheduled agent work (/dashboard/schedules and the Studio "Automate" tab). The owner picks an agent, one of its
   skills, the task, how many times a day and the time of the first run. The server scheduler runs it on those slots
   and charges credits per run; results land in History and, when the schedule has a delivery channel, in the owner's
   Discord channel or Telegram chat. Data: /api/schedules (lib/schedules.ts), /api/notify (lib/notify.ts). */
import {useCallback,useEffect,useMemo,useState} from 'react';
import {toast} from 'sonner';
import {FieldError,useFormCheck} from './form';
import {Button} from '@/components/ui/button';
import {Switch} from '@/components/ui/switch';
import {Textarea} from '@/components/ui/textarea';
import {Input} from '@/components/ui/input';
import {NativeSelect,NativeSelectOptGroup,NativeSelectOption} from '@/components/ui/native-select';
import {FaDiscord,FaTelegram} from 'react-icons/fa6';
import {api,I,Options,FieldLabel} from '@/app/ui';
import {cn} from '@/lib/utils';
import {skillCatalog,type Agent,type MarketAgent} from '@/lib/agents';
import {Thumb} from '@/components/landing/mocks';
import type {CharacterId} from '@/lib/characters';
import {RECIPES,recipeTask,type Recipe} from '@/lib/recipes';
import {canWatch,watchLabel,watchText,WATCH_MIN_DEFAULT,WATCH_MIN_OPTIONS} from '@/lib/watch-options';
import {DashPage,EmptyState,Kpi,KpiRow,PageHeader,StatusBadge} from './parts';

export type Schedule={id:string;agent_id:string;agent_name:string|null;skin:string|null;skill:string;prompt:string;per_day:number;start_minute:number;mode:string;active:boolean;
 next_run:string;last_run:string|null;last_status:string|null;last_run_id:string|null;runs:number;created:string;notify?:string|null;
 /** reports only on change (lib/watch.ts): the smallest transfer for whale watch, the last look, looks without a change since the last report */on_change?:boolean;watch_min?:number|null;checked?:string|null;quiet?:number};
export type Channel={id:string;kind:'discord'|'telegram';label:string;ok:boolean;lastSent:string|null;lastError:string|null;chat?:{agentId:string;skill:string;daily:number;used:number;name:string;mine:boolean;price:number;gone:boolean}|null};
export type Delivery={discord:boolean;telegram:boolean;max:number};
export type Limits={enabled:boolean;runCost:number;max:number;dailyCap:number;perDay:number[];usedToday:number;mode:'live'|'sample';skillCosts?:Record<string,number>;
 /** the account's holder tier and every tier's limits (where the token is set) */tier?:string;tierName?:string;perks?:{id:string;name:string;min:string;schedules:number;dailyRuns:number;channels:number}[]|null};
/** Credits for one scheduled run of this skill (the server's price list, else the flat schedule cost). */
const runCostOf=(l:Limits|null|undefined,skill:string)=>l?.skillCosts?.[skill]??l?.runCost??5;
type Data={schedules:Schedule[];limits:Limits;channels?:Channel[];delivery?:Delivery};

const skillName=(id:string)=>skillCatalog.find(s=>s.id===id)?.name||id;
const pad=(n:number)=>String(n).padStart(2,'0');
/** Local "HH:MM" <-> UTC minute of day. */
const toUtcMinute=(hhmm:string)=>{const [h,m]=hhmm.split(':').map(Number);const d=new Date();d.setHours(h||0,m||0,0,0);return d.getUTCHours()*60+d.getUTCMinutes();};
const fromUtcMinute=(min:number)=>{const d=new Date();d.setUTCHours(Math.floor(min/60),min%60,0,0);return `${pad(d.getHours())}:${pad(d.getMinutes())}`;};
const slots=(perDay:number,startUtc:number)=>Array.from({length:perDay},(_,k)=>fromUtcMinute((startUtc+k*1440/perDay)%1440)).sort();
const when=(iso:string)=>{const d=new Date(iso);const today=new Date().toDateString()===d.toDateString();return (today?'today ':d.toLocaleDateString(undefined,{day:'numeric',month:'short'})+' ')+`${pad(d.getHours())}:${pad(d.getMinutes())}`;};
const freq=(n:number)=>n===1?'Once a day':n===24?'Every hour':`${n}× a day`;

export function useSchedules(auth:boolean){
 const [data,setData]=useState<Data|null>(null);
 const load=useCallback(async()=>{if(!auth){setData(null);return;}try{setData(await api('/api/schedules'));}catch{setData(null);}},[auth]);
 useEffect(()=>{load();},[load]);
 return {data,setData,load};
}

/** Create form. `agent` fixes the agent (Studio); otherwise the owner picks one of their saved agents. */
export function ScheduleForm({agents,agent,limits,balance,count,channels=[],onSaved,ensureSaved}:{agents:Agent[];agent?:Agent;limits:Limits|null;balance:number|null;count:number;channels?:Channel[];onSaved:(d:Data)=>void;ensureSaved?:()=>Promise<string|null>}){
 const saved=agents.filter(a=>a.id&&!a.archived);
 const [agentId,setAgentId]=useState(agent?.id||saved[0]?.id||'');
 const target=agent||saved.find(a=>a.id===agentId);
 const skills=(target?.skills||[]) as readonly string[];
 const [skill,setSkill]=useState(skills[0]||'');const sk=skills.includes(skill)?skill:skills[0]||'';
 const [prompt,setPrompt]=useState('');const [perDay,setPerDay]=useState('3');const [time,setTime]=useState('08:00');const [busy,setBusy]=useState(false);
 const [notify,setNotify]=useState<string|null>(null);const sendTo=channels.some(c=>c.id===notify)?notify:null;
 const [quietly,setQuietly]=useState(false);const [min,setMin]=useState(String(WATCH_MIN_DEFAULT));const onChange=quietly&&canWatch(sk);
 const n=Number(perDay);const each=runCostOf(limits,sk);const cost=each*n;const days=balance!==null&&cost>0?Math.floor(balance/cost):null;
 const full=!!limits&&count>=limits.max;const form=useFormCheck('schedule');
 async function save(){
  if(busy)return;if(!await form.check({prompt,time}))return;setBusy(true);
  try{
   const id=agent?(ensureSaved?await ensureSaved():agent.id):agentId;if(!id){setBusy(false);return;}
   const d=await api('/api/schedules',{method:'POST',body:JSON.stringify({agentId:id,skill:sk,prompt,perDay:n,startMinute:toUtcMinute(time),notify:sendTo,...(onChange?{onChange:true,...(sk==='whales'?{watchMin:Number(min)}:{})}:{})})});
   toast.success(`The schedule is set: ${freq(n).toLowerCase()}, starting ${when(d.schedules.find((s:Schedule)=>s.id===d.id)?.next_run||new Date().toISOString())}`);setPrompt('');onSaved(d);
  }catch(e:any){toast.error(e.message);}finally{setBusy(false);}
 }
 if(!agent&&!saved.length)return <p className="rounded-xl border border-dashed p-4 text-[13px] text-muted-foreground">A schedule needs a saved agent. Save one in the Studio, then come back here.</p>;
 return <div className="grid gap-4">
  {!agent&&<div className="grid gap-2"><FieldLabel>Agent</FieldLabel><div className="flex flex-wrap gap-1.5">{saved.map(a=><button key={a.id} onClick={()=>setAgentId(a.id!)} className={cn('flex h-9 items-center gap-2 rounded-full border bg-card pr-3 pl-1 text-[13px] font-medium transition-colors',agentId===a.id?'border-lime bg-lime/10':'hover:border-foreground/30')}>
   <Thumb id={a.skin as CharacterId} className="size-7 rounded-md object-[50%_18%]"/>{a.name}</button>)}</div></div>}
  {skills.length?<Options label="Skill" value={sk} options={skills.map(s=>[s,skillName(s)] as const)} onChange={setSkill}/>:<p className="text-[13px] text-muted-foreground">This agent has no skill yet. Add one first.</p>}
  <div className="grid gap-2"><FieldLabel htmlFor="sch-task">What should it do each time?</FieldLabel>
   <Textarea id="sch-task" value={prompt} onChange={e=>{setPrompt(e.target.value);form.clear('prompt');}} maxLength={4000} className="min-h-24" placeholder="e.g. Pick today's three main AI stories, sum each one up and give me one thing to do" {...form.field('prompt')}/><FieldError form={form} field="prompt"/></div>
  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
   <Options label="How often" value={perDay} options={(limits?.perDay||[1,2,3,4,6,8,12,24]).map(v=>[String(v),v===24?'Hourly':`${v}×/day`] as const)} onChange={setPerDay}/>
   <div className="grid gap-2"><FieldLabel htmlFor="sch-time">First run</FieldLabel><input id="sch-time" type="time" value={time} onChange={e=>{setTime(e.target.value);form.clear('time');}} className="h-8 rounded-full border bg-card px-3 text-[13px] tabular-nums aria-invalid:border-destructive" {...form.field('time')}/><FieldError form={form} field="time"/></div>
  </div>
  {canWatch(sk)&&<div className="grid gap-3 rounded-xl border p-4">
   <label className="flex items-start gap-3 text-[13px]"><Switch checked={quietly} onCheckedChange={setQuietly} aria-label="Report only when something changed"/><span><b className="font-medium">Report only when something changed</b><br/><span className="text-muted-foreground">The agent takes a look at each slot and writes a report only for {watchText(sk,Number(min))}. When nothing changed, the look is free.</span></span></label>
   {onChange&&sk==='whales'&&<Options label="Smallest transfer that counts" value={min} options={WATCH_MIN_OPTIONS.map(v=>[String(v),`${watchLabel(v)} HARVEX`] as const)} onChange={setMin}/>}
  </div>}
  <div className="grid gap-2"><FieldLabel htmlFor="sch-send">Send each result to</FieldLabel>
   {channels.length?<SendTo id="sch-send" value={sendTo} channels={channels} onChange={setNotify}/>
   :<p className="text-[12.5px] text-muted-foreground">Results go to History only. To get them sent to you, connect Discord or Telegram under Schedules → Delivery.</p>}</div>
  <div className="grid gap-1.5 rounded-xl border bg-secondary/40 p-4 text-[12.5px]">
   <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground"><I id="clock" className="i size-3.5"/>Runs at <b className="text-foreground tabular-nums">{slots(n,toUtcMinute(time)).join(' · ')}</b> (your time)</span>
   <span className="text-muted-foreground"><b className="text-foreground">{onChange?`Up to ${cost} credits/day`:`${cost} credits/day`}</b> ({each} per {onChange?'report; looks that find no change are free':'run'}){days!==null&&!onChange?` · enough in your balance for about ${days} day${days===1?'':'s'}`:''}. The schedule pauses when the credits run out. {limits?.mode==='sample'?'This server has no AI connected, so each run gives a labelled workflow sample.':''}</span>
  </div>
  <div className="flex flex-wrap items-center gap-3"><Button className="h-10" disabled={busy||!sk||full||limits?.enabled===false} onClick={save}><I id="clock"/>{busy?'Saving…':'Schedule it'}</Button>
   <span className="text-xs text-muted-foreground">{full?`${limits!.max} schedules is the limit and you have them all. Delete one to add another.`:limits?`${count}/${limits.max} schedules · ${limits.usedToday}/${limits.dailyCap} scheduled runs today`:''}</span></div>
 </div>;
}

/** One schedule: frequency, next run, last result, pause/resume and delete. */
export function ScheduleCard({s,onChange,compact,channels=[]}:{s:Schedule;onChange:(d:Data)=>void;compact?:boolean;channels?:Channel[]}){
 const [busy,setBusy]=useState(false);
 const call=async(method:string,payload:object)=>{setBusy(true);try{onChange(await api('/api/schedules',{method,body:JSON.stringify(payload)}));}catch(e:any){toast.error(e.message);}finally{setBusy(false);}};
 const failed=!!s.last_status&&/^(Paused|Failed|Skipped)/.test(s.last_status)&&s.last_status!=='Paused by you';
 return <div className={cn('grid gap-3 rounded-xl border bg-card p-4 transition-colors',!s.active&&'bg-secondary/30')}>
  <div className="flex items-start gap-3">
   {!compact&&<Thumb id={(s.skin||'atlas') as CharacterId} className="size-11 shrink-0 rounded-lg bg-t-lime object-[50%_18%]"/>}
   <div className="grid min-w-0 flex-1 gap-1">
    <b className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">{compact?skillName(s.skill):`${s.agent_name||'Removed agent'} · ${skillName(s.skill)}`}<StatusBadge kind={s.active?'live':'archived'}>{s.active?freq(s.per_day):'paused'}</StatusBadge>{s.on_change&&<StatusBadge kind="planned">only on change</StatusBadge>}</b>
    <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{s.prompt}</p>
   </div>
   <Switch checked={s.active} disabled={busy} aria-label={s.active?'Pause schedule':'Resume schedule'} onCheckedChange={v=>call('PATCH',{id:s.id,active:v})}/>
  </div>
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
   <span>{s.active?<>Next <b className="text-foreground">{when(s.next_run)}</b></>:'Not running'}</span>
   <span>{slots(s.per_day,s.start_minute).join(' · ')}</span>
   <span>{s.runs} run{s.runs===1?'':'s'}</span>
   {s.on_change&&s.checked&&<span>{s.quiet?`${s.quiet} quiet look${s.quiet===1?'':'s'} since the last report · `:''}last look <b className="text-foreground">{when(s.checked)}</b></span>}
  </div>
  {s.on_change&&<p className="text-[12px] text-muted-foreground">It reports once it sees {watchText(s.skill,s.watch_min)}. Looks that find no change are free.</p>}
  {s.last_status&&<p className={cn('rounded-lg px-2.5 py-1.5 text-[12px]',failed?'bg-t-coral text-tx-coral':'bg-secondary/60 text-muted-foreground')}>{s.last_status}{s.last_run?` · ${when(s.last_run)}`:''}</p>}
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
    {channels.length>0&&<label className="flex items-center gap-2 text-[12px] text-muted-foreground">Send to<SendTo value={channels.some(c=>c.id===s.notify)?s.notify!:null} channels={channels} disabled={busy} onChange={v=>call('PATCH',{id:s.id,notify:v})}/></label>}
    {canWatch(s.skill)&&<label className="flex items-center gap-2 text-[12px] text-muted-foreground"><Switch checked={!!s.on_change} disabled={busy} aria-label="Report only when something changed" onCheckedChange={v=>call('PATCH',{id:s.id,onChange:v})}/>Only on change</label>}
   </div>
   <Button size="sm" variant="ghost" disabled={busy} onClick={()=>{if(confirm('Delete this schedule? The runs it already made remain in History.'))call('DELETE',{id:s.id});}}><I id="archive"/>Delete</Button></div>
 </div>;
}

/** Limits by holder tier, the account's own tier marked. Shown only where the HARVEX token is set. */
function TierPerks({limits,onRefresh}:{limits:Limits;onRefresh:()=>void}){
 const [busy,setBusy]=useState(false);
 if(!limits.perks)return null;
 const refresh=async()=>{setBusy(true);try{await api('/api/tier');}catch{/* the page still shows the last known tier */}onRefresh();setBusy(false);};
 return <section className="grid gap-4 rounded-2xl border bg-card p-6">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-[15px] font-semibold">Holder perks</b>
   <span className="text-[12.5px] text-muted-foreground">Your tier: <b className="text-foreground">{limits.tierName||'Free'}</b> · <button type="button" disabled={busy} onClick={refresh} className="underline underline-offset-4 hover:text-foreground">{busy?'Checking…':'Check again'}</button></span></div>
  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{limits.perks.map(p=><div key={p.id} className={cn('grid gap-1 rounded-lg border p-3',p.id===limits.tier&&'border-lime bg-lime/10')}>
   <span className="flex items-baseline justify-between gap-2"><b className="text-sm font-semibold">{p.name}</b><span className="font-mono text-[10.5px] text-muted-foreground">{p.min==='0'?'no HARVEX needed':`${Number(p.min).toLocaleString('en-US')}+ HARVEX`}</span></span>
   <span className="text-[12.5px] text-muted-foreground tabular-nums">{p.schedules} schedules · {p.dailyRuns} runs a day · {p.channels} channels</span>
  </div>)}</div>
  <p className="text-xs text-muted-foreground">These limits follow the HARVEX held in your linked wallets. The server takes the balance from the chain and reads it again every few hours. A run costs the same credits whatever the tier.<a href="/tiers" className="underline underline-offset-4 hover:text-foreground">All tiers</a></p>
 </section>;
}

/** One channel's icon. */
const KindIcon=({kind,className}:{kind:string;className?:string})=>kind==='discord'?<FaDiscord className={className}/>:<FaTelegram className={className}/>;
type DeliveryView={config:Delivery;channels:Channel[];pending:{link:string;group:string;expires:number}|null;chatCosts?:Record<string,number>};

/** A Telegram channel's chat setting: which agent answers questions there, how (one of its skills, or its own voice),
    and how many a day. The agent is one of the account's own, or one someone else published: that one answers in its
    own voice, and each answer also pays its creator their price per message. `want`: an agent to offer first (the
    link "Add to my Telegram" on an agent's page, /dashboard/schedules?chat=<agent id>). */
function ChatSetup({c,agents,costs,busy,want,onSave}:{c:Channel;agents:Agent[];costs:Record<string,number>;busy:boolean;want?:string|null;onSave:(p:{agentId:string|null;skill?:string;daily?:number;expectedPrice?:number})=>Promise<boolean>}){
 const saved=agents.filter(a=>a.id&&!a.archived);
 const [open,setOpen]=useState(!!want);
 // agents other creators published, loaded when the setting is opened
 const [market,setMarket]=useState<MarketAgent[]|null>(null);
 // (the list is the sixty most used; the agent asked for by a link, or the one already answering here, is added
 // when it is not among them)
 useEffect(()=>{if(!open||market)return;let alive=true;const ask=want||c.chat?.agentId||'';
  (async()=>{let list:MarketAgent[]=[];try{list=((await api('/api/market?q=')).agents as MarketAgent[]).filter(a=>!a.mine);}catch{list=[];}
   if(ask&&!list.some(a=>a.id===ask)&&!saved.some(a=>a.id===ask)){try{const one=(await api(`/api/market?id=${ask}`)).agent as MarketAgent;if(one&&!one.mine)list=[one,...list];}catch{/* not published (anymore) */}}
   if(alive)setMarket(list);})();
  return()=>{alive=false;};},[open,market]); // eslint-disable-line react-hooks/exhaustive-deps
 const [agentId,setAgentId]=useState(want||c.chat?.agentId||'');
 // the choice: one of the account's own agents, or one someone else published; while that list loads a choice from
 // it is not known yet; nothing chosen (or the choice is gone) falls back to the first agent there is
 const chosen=saved.find(a=>a.id===agentId)||null;const picked=chosen?null:market?.find(a=>a.id===agentId)||null;
 const loading=!chosen&&!!agentId&&market===null;
 const agent=chosen||(!picked&&!loading?saved[0]||null:null);const other=picked||(!agent&&!loading?market?.[0]||null:null);
 const skills=agent?[...(agent.skills as readonly string[]),'chat']:['chat'];
 const [skill,setSkill]=useState(c.chat?.skill||'');const sk=other?'chat':skills.includes(skill)?skill:skills[0];
 const [daily,setDaily]=useState(String(c.chat?.daily||20));
 const id=other?.id||agent?.id||'';const message=costs.chat??3;const each=other?message+other.talkPrice:sk==='chat'?message:costs[sk]??null;
 const name=(k:string)=>k==='chat'?'Its own voice':skillName(k);
 return <div className="grid basis-full gap-2 border-t pt-2">
  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
   <span>{c.chat?<>Answers here: <b className="text-foreground">{c.chat.name}{c.chat.skill==='chat'?'':` · ${skillName(c.chat.skill)}`}</b>{!c.chat.mine&&<> · another creator’s agent, {c.chat.price} CR per answer to its creator</>} · {c.chat.used}/{c.chat.daily} today{c.chat.gone&&<span className="text-tx-coral"> · this agent can no longer be used</span>}</>:'This chat has no agent answering yet.'}</span>
   <Button size="sm" variant="ghost" onClick={()=>setOpen(o=>!o)}>{open?'Close':c.chat?'Change':'Let an agent answer'}</Button>
  </div>
  {open&&(loading||(!id&&market===null)?<p className="text-[12px] text-muted-foreground">Loading the agents…</p>:id?<div className="grid gap-2">
   <div className="grid gap-2 sm:grid-cols-3">
    <NativeSelect size="sm" value={id} onChange={e=>setAgentId(e.target.value)} aria-label="Agent that answers">
     {saved.length>0&&<NativeSelectOptGroup label="Your agents">{saved.map(a=><NativeSelectOption key={a.id} value={a.id!}>{a.name}</NativeSelectOption>)}</NativeSelectOptGroup>}
     {!!market?.length&&<NativeSelectOptGroup label="Published by others">{market.map(a=><NativeSelectOption key={a.id} value={a.id}>{a.name} · {a.talkPrice===0?'no creator fee':`${a.talkPrice} CR to its creator`}</NativeSelectOption>)}</NativeSelectOptGroup>}
    </NativeSelect>
    <NativeSelect size="sm" value={sk} disabled={!!other} onChange={e=>setSkill(e.target.value)} aria-label="How it answers">{(other?['chat']:skills).map(k=><NativeSelectOption key={k} value={k}>{name(k)}</NativeSelectOption>)}</NativeSelect>
    <NativeSelect size="sm" value={daily} onChange={e=>setDaily(e.target.value)} aria-label="Answers per day">{[5,20,50,100].map(n=><NativeSelectOption key={n} value={String(n)}>{n} answers a day</NativeSelectOption>)}</NativeSelect>
   </div>
   <p className="text-[12px] text-muted-foreground">A private chat treats each message as a question. In a group, a question starts with <b className="text-foreground">/ask</b>. {other?<><b className="text-foreground">{other.name}</b> was published by another creator, and each of its answers counts as a chat message: your balance pays <b className="text-foreground">{each} credits</b> ({message} for the message{other.talkPrice?`, ${other.talkPrice} to its creator`:''}).</>
    :sk==='chat'?<>The agent answers in its own voice and remembers the last turns of this chat. Every answer is a chat message that takes {each} credits from your balance.</>:<>Every answer is a live run of this skill and takes {each??'a few'} credits from your balance.</>} This chat gets no more than {daily} answers a day. Anyone in a group can ask: those questions are sent to the AI provider and saved in your History, and answers come without web search.{other?' Should its creator change the price, the agent goes silent until you accept the new price here.':''}</p>
   <div className="flex flex-wrap gap-2">
    <Button size="sm" disabled={busy||!id} onClick={async()=>{if(await onSave({agentId:id,skill:sk,daily:Number(daily),...(other?{expectedPrice:other.talkPrice}:{})}))setOpen(false);}}>Save</Button>
    {c.chat&&<Button size="sm" variant="outline" disabled={busy} onClick={async()=>{if(await onSave({agentId:null}))setOpen(false);}}>Turn off</Button>}
   </div>
  </div>:<p className="text-[12px] text-muted-foreground">There is no agent to choose yet. Save one in the Studio, or publish one, and it can answer here.</p>)}
 </div>;
}

/** Delivery channels of the account: connect Discord (webhook address) or Telegram (the server's bot), test, remove,
    and let an agent answer in a Telegram chat. */
export function DeliveryPanel({onChange,agents=[]}:{onChange:()=>void;agents?:Agent[]}){
 const [v,setV]=useState<DeliveryView|null>(null);const [url,setUrl]=useState('');const [busy,setBusy]=useState('');const hook=useFormCheck('discord');
 const sig=v?v.channels.map(c=>c.id+(c.ok?1:0)).join():null;
 // the schedule cards list the same channels: reload them when a channel was added, removed or stopped
 useEffect(()=>{if(sig!==null)onChange();},[sig,onChange]);
 // /dashboard/schedules?chat=<agent id> ("Add to my Telegram" on an agent's page): the first Telegram chat opens its
 // setting with that agent chosen
 const [want]=useState(()=>{try{const id=new URLSearchParams(location.search).get('chat');return id&&/^[0-9a-f-]{36}$/i.test(id)?id.toLowerCase():null;}catch{return null;}});
 const refresh=useCallback(()=>{api('/api/notify').then(setV).catch(()=>null);},[]);
 useEffect(()=>{refresh();},[refresh]);
 // while a Telegram link is open, ask the server every few seconds whether the chat pressed Start
 const waiting=!!v?.pending;
 useEffect(()=>{if(!waiting)return;const t=setInterval(refresh,3500);return ()=>clearInterval(t);},[waiting,refresh]);
 const act=async(key:string,init:RequestInit,done?:string)=>{if(busy)return false;setBusy(key);try{setV(await api('/api/notify',init));if(done)toast.success(done);return true;}catch(e:any){toast.error(e.message);refresh();return false;}finally{setBusy('');}};
 const post=(key:string,payload:object,done?:string)=>act(key,{method:'POST',body:JSON.stringify(payload)},done);
 const C=v?.config;const full=!!v&&!!C&&v.channels.length>=C.max;
 return <section className="grid gap-4 rounded-2xl border bg-card p-6">
  <div className="grid gap-1"><b className="text-[15px] font-semibold">Delivery</b>
   <p className="text-[13px] text-muted-foreground">A schedule can post every finished run to your Discord channel or Telegram chat, and an agent can answer questions in a Telegram chat. That text is then passed from Harvex to the service. A research answer that used Google Search is not sent: it stays in History and you get a notice.</p></div>
  {want&&v&&!v.channels.some(c=>c.kind==='telegram'&&c.ok)&&<p className="rounded-lg border border-lime bg-lime/10 px-3 py-2 text-[13px]">{v.config.telegram?'That agent needs a connected Telegram chat. Use Connect Telegram below, then pick the agent under the chat.':'This server has no Telegram connected, so no agent can answer in a chat here.'}</p>}
  {v&&v.channels.length>0&&<div className="grid gap-2">{v.channels.map(c=><div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-secondary/30 px-3 py-2">
   <KindIcon kind={c.kind} className="size-4 shrink-0 text-muted-foreground"/>
   <div className="grid min-w-40 flex-1"><b className="truncate text-[13px] font-medium">{c.label}</b>
    <span className={cn('text-[11.5px]',c.ok?'text-muted-foreground':'text-tx-coral')}>{c.ok?(c.lastError?`Last send failed: ${c.lastError}`:c.lastSent?`Last sent ${when(c.lastSent)}`:'Connected'):`Disconnected: ${c.lastError||'connect it again'}`}</span></div>
   <Button size="sm" variant="outline" disabled={!!busy} onClick={()=>post('t'+c.id,{action:'test',id:c.id},'A test message is on its way')}>{busy==='t'+c.id?'Sending…':'Send test'}</Button>
   <Button size="sm" variant="ghost" disabled={!!busy} onClick={()=>{if(confirm('Remove this channel? Any schedule that sends to it will keep its results in History only.'))act('d'+c.id,{method:'DELETE',body:JSON.stringify({id:c.id})});}}><I id="archive"/>Remove</Button>
   {c.kind==='telegram'&&c.ok&&<ChatSetup key={c.id+(c.chat?c.chat.agentId+c.chat.skill+c.chat.daily+c.chat.price:'')} c={c} agents={agents} costs={v.chatCosts||{}} busy={!!busy} want={want&&v.channels.find(x=>x.kind==='telegram'&&x.ok)?.id===c.id?want:null} onSave={p=>post('c'+c.id,{action:'chat',id:c.id,...p},p.agentId?'This chat is now answered by the agent':'The agent no longer answers in this chat')}/>}
  </div>)}</div>}
  <div className="grid gap-3 lg:grid-cols-2">
   <div className="grid content-start gap-2 rounded-lg border p-3">
    <span className="flex items-center gap-2 text-[13px] font-medium"><FaDiscord className="size-4"/>Discord</span>
    {C&&!C.discord?<p className="text-[12.5px] text-muted-foreground">This server has Discord delivery turned off.</p>:<>
     <p className="text-[12.5px] text-muted-foreground">In Discord: channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL. Whoever has that address can post to the channel. For that reason the server keeps it and never shows it again.</p>
     <div className="flex gap-2"><Input value={url} onChange={e=>{setUrl(e.target.value);hook.clear('url');}} placeholder="https://discord.com/api/webhooks/…" autoComplete="off" spellCheck={false} aria-label="Discord webhook address" className="h-9 text-[13px]" {...hook.field('url')}/>
      <Button className="h-9" disabled={!!busy||full} onClick={async()=>{const ok=await hook.check({url});if(ok&&await post('discord',{action:'discord',url:ok.url},'Your Discord channel is connected'))setUrl('');}}>{busy==='discord'?'Checking…':'Connect'}</Button></div><FieldError form={hook} field="url"/></>}
   </div>
   <div className="grid content-start gap-2 rounded-lg border p-3">
    <span className="flex items-center gap-2 text-[13px] font-medium"><FaTelegram className="size-4"/>Telegram</span>
    {C&&!C.telegram?<p className="text-[12.5px] text-muted-foreground">This server has no Telegram delivery set up yet.</p>
    :v?.pending?<>
     <p className="text-[12.5px] text-muted-foreground">Press <b className="text-foreground">Start</b> in the bot. There is no need to reload: this page sees it. The link is good for one use within 10 minutes.</p>
     <div className="flex flex-wrap gap-2"><Button asChild className="h-9"><a href={v.pending.link} target="_blank" rel="noopener noreferrer"><FaTelegram/>Open in Telegram</a></Button>
      <Button asChild variant="outline" className="h-9"><a href={v.pending.group} target="_blank" rel="noopener noreferrer">Add to a group</a></Button></div>
     <span className="text-[11.5px] text-muted-foreground">Waiting for your chat…</span></>
    :<>
     <p className="text-[12.5px] text-muted-foreground">The studio&apos;s bot can join a private chat or a group. Reports sent to a group are seen by all its members.</p>
     <Button variant="outline" className="h-9 justify-self-start" disabled={!!busy||full||!v} onClick={()=>post('telegram',{action:'telegram'})}>{busy==='telegram'?'Preparing…':'Connect Telegram'}</Button></>}
   </div>
  </div>
  {full&&<p className="text-xs text-muted-foreground">{C!.max} channels is the limit and you have them all. Remove one to add another.</p>}
 </section>;
}

/** Where a schedule sends its results: History only, or one of the account's channels. */
function SendTo({value,channels,onChange,disabled,id}:{value:string|null;channels:Channel[];onChange:(v:string|null)=>void;disabled?:boolean;id?:string}){
 return <NativeSelect id={id} size="sm" value={value||''} disabled={disabled} onChange={e=>onChange(e.target.value||null)} aria-label="Send each result to">
  <NativeSelectOption value="">History only</NativeSelectOption>
  {channels.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.label}{c.ok?'':' (disconnected)'}</NativeSelectOption>)}
 </NativeSelect>;
}

/** Recipes: a ready agent on a schedule in one click (lib/recipes.ts). Uses the same endpoints as doing it by hand. */
function RecipeStrip({agents,limits,channels,count,open,onDone,onAgents}:{agents:Agent[];limits:Limits|null;channels:Channel[];count:number;open:string|null;onDone:(d:Data)=>void;onAgents:()=>void}){
 const offered=RECIPES.filter(r=>r.needs!=='token'||!!limits?.perks);
 const [pick,setPick]=useState<string|null>(open);const r=offered.find(x=>x.id===pick)||null;
 const [time,setTime]=useState(()=>r?`${pad(r.hour)}:00`:'08:00');const [topic,setTopic]=useState('');const [notify,setNotify]=useState<string|null>(null);const [busy,setBusy]=useState(false);
 const choose=(x:Recipe)=>{setPick(p=>p===x.id?null:x.id);setTime(`${pad(x.hour)}:00`);setTopic('');setNotify(channels.find(c=>c.ok)?.id||null);};
 const full=!!limits&&count>=limits.max;const each=r?runCostOf(limits,r.skill):0;
 async function start(){
  if(!r||busy)return;setBusy(true);
  try{
   // an agent this recipe made before is used again; otherwise it is made now
   let id=agents.find(a=>a.id&&!a.archived&&a.name===r.agent.name&&(a.skills as readonly string[]).includes(r.skill))?.id;
   if(!id){id=(await api('/api/agents',{method:'POST',body:JSON.stringify({...r.agent,language:'English'})})).id;onAgents();}
   const d=await api('/api/schedules',{method:'POST',body:JSON.stringify({agentId:id,skill:r.skill,prompt:recipeTask(r,topic),perDay:r.perDay,startMinute:toUtcMinute(time),notify:channels.some(c=>c.id===notify)?notify:null,...(r.onChange?{onChange:true,...(r.watchMin?{watchMin:r.watchMin}:{})}:{})})});
   toast.success(`${r.title} has started`,{description:`${r.agent.name} · ${freq(r.perDay).toLowerCase()}, first run ${when(d.schedules.find((s:Schedule)=>s.id===d.id)?.next_run||new Date().toISOString())}`});
   setPick(null);onDone(d);
  }catch(e:any){toast.error(e.message);}finally{setBusy(false);}
 }
 if(!offered.length)return null;
 return <section className="grid gap-4 rounded-2xl border bg-card p-6">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-[15px] font-semibold">Recipes</b><span className="text-[12.5px] text-muted-foreground">Agent, schedule and delivery set up in a single click</span></div>
  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{offered.map(x=><button key={x.id} type="button" onClick={()=>choose(x)} aria-pressed={pick===x.id}
   className={cn('grid content-start gap-2 rounded-lg border p-3 text-left transition-colors',pick===x.id?'border-lime bg-lime/10':'hover:border-foreground/30')}>
   <span className="flex items-center gap-2"><Thumb id={x.agent.skin as CharacterId} className="size-8 shrink-0 rounded-md bg-t-lime object-[50%_18%]"/><b className="text-sm font-semibold">{x.title}</b></span>
   <span className="text-[12.5px] text-muted-foreground">{x.text}</span>
   <span className="font-mono text-[10.5px] tracking-[.04em] text-muted-foreground uppercase">{skillName(x.skill)} · {x.onChange?`looks ${freq(x.perDay).toLowerCase()} · ${runCostOf(limits,x.skill)} CR per report`:`${freq(x.perDay)} · ${runCostOf(limits,x.skill)*x.perDay} CR/day`}</span>
  </button>)}</div>
  {r&&<div className="grid gap-3 rounded-xl border bg-secondary/40 p-4">
   <p className="text-[13px] text-muted-foreground"><b className="text-foreground">{r.title}.</b> This creates the agent <b className="text-foreground">{r.agent.name}</b>, which you may rename and restyle afterwards, and gives it this task: “{recipeTask(r,topic||(r.ask?'…':''))}”</p>
   <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
    <div className="grid gap-2"><FieldLabel htmlFor="rec-time">First run</FieldLabel><input id="rec-time" type="time" value={time} onChange={e=>setTime(e.target.value)} className="h-8 rounded-full border bg-card px-2 text-[13px] tabular-nums"/></div>
    {r.ask&&<div className="grid gap-2"><FieldLabel htmlFor="rec-topic">{r.ask.label}</FieldLabel><Input id="rec-topic" value={topic} onChange={e=>setTopic(e.target.value)} maxLength={200} placeholder={r.ask.placeholder} className="h-8 text-[13px]"/></div>}
   </div>
   {channels.length>0&&<div className="grid gap-2"><FieldLabel htmlFor="rec-send">Send each result to</FieldLabel><SendTo id="rec-send" value={channels.some(c=>c.id===notify)?notify:null} channels={channels} onChange={setNotify}/></div>}
   <div className="flex flex-wrap items-center gap-3"><Button disabled={busy||full||(!!r.ask&&topic.trim().length<3)} onClick={start}><I id="play"/>{busy?'Starting…':'Start it'}</Button>
    <span className="text-xs text-muted-foreground">{full?`${limits!.max} schedules is the limit of your tier and you have them all. Delete one to add another.`:r.onChange?`A report costs ${each} credits and is written only after a change; looks that find none are free. You can pause or delete it below whenever you like.`:`That is ${each*r.perDay} credits a day, ${each} for each run. You can pause or delete it below whenever you like.`}{channels.length?'':' To get results sent to you, connect Discord or Telegram under Delivery.'}</span></div>
  </div>}
 </section>;
}

export function SchedulesPage({auth,agents,balance,onSignIn,onOpenHistory,onAgents}:{auth:boolean;agents:Agent[];balance:number|null;onSignIn:()=>void;onOpenHistory:()=>void;onAgents?:()=>void}){
 // a link from the recipes page opens its recipe: /dashboard/schedules?recipe=<id>
 const [recipe]=useState(()=>{try{return new URLSearchParams(location.search).get('recipe');}catch{return null;}});
 const {data,setData,load}=useSchedules(auth);const [adding,setAdding]=useState(false);const channels=data?.channels||[];
 const list=data?.schedules||[];const L=data?.limits||null;const active=list.filter(s=>s.active);
 // a schedule that reports only on change looks at every slot but runs (and costs) only when something changed
 const perDay=useMemo(()=>active.filter(s=>!s.on_change).reduce((a,s)=>a+s.per_day,0),[active]);const watching=useMemo(()=>active.filter(s=>s.on_change).length,[active]);
 const perDayCost=useMemo(()=>active.filter(s=>!s.on_change).reduce((a,s)=>a+s.per_day*runCostOf(L,s.skill),0),[active,L]);
 const costs=Object.values(L?.skillCosts||{});const lo=costs.length?Math.min(...costs):L?.runCost??5,hi=costs.length?Math.max(...costs):lo;
 if(!auth)return <DashPage><PageHeader icon="clock" tone="mint" title="Schedules" text="Agents can do a task without you. You choose the skill, the task and the number of runs a day."/><EmptyState title="Schedules need a signed-in account" text="The server runs your saved agents on a timetable, and every run is paid in credits." action={<Button onClick={onSignIn}><I id="wallet"/>Connect wallet</Button>}/></DashPage>;
 return <DashPage>
  <PageHeader icon="clock" tone="mint" title="Schedules" text="Put an agent on a timetable: choose the agent, a skill, the task and the number of runs a day. Every run is paid in credits and saved in History."
   actions={<><Button variant="outline" onClick={onOpenHistory}><I id="clock"/>History</Button><Button onClick={()=>setAdding(a=>!a)} disabled={!!L&&list.length>=L.max&&!adding}><I id="plus"/>New schedule</Button></>}/>
  <KpiRow>
   <Kpi label="Active" value={`${active.length}/${L?.max??3}`} hint="Of the schedules your account may have" tone="mint" icon="clock"/>
   <Kpi label="Runs per day" value={perDay} hint={`${perDayCost} credits/day${watching?` · ${watching} more only on change`:''}`} tone="lime" icon="coins"/>
   <Kpi label="Today" value={`${L?.usedToday??0}/${L?.dailyCap??24}`} hint="Scheduled runs against the daily cap" tone="iris" icon="layers"/>
   <Kpi label="Cost per run" value={lo===hi?`${lo} CR`:`${lo}–${hi} CR`} hint={L?.mode==='live'?'Live AI':'Workflow sample'} tone="amber" icon="hype"/>
  </KpiRow>
  {data&&<RecipeStrip agents={agents} limits={L} channels={channels} count={list.length} open={recipe} onDone={setData} onAgents={onAgents||(()=>{})}/>}
  {(adding||(!list.length&&data))&&<section className="grid gap-4 rounded-2xl border bg-card p-6">
   <b className="text-[15px] font-semibold">New schedule</b>
   <ScheduleForm agents={agents} limits={L} balance={balance} count={list.length} channels={channels} onSaved={d=>{setData(d);setAdding(false);}}/>
  </section>}
  {list.length>0&&<div className="stagger grid gap-3 lg:grid-cols-2">{list.map(s=><ScheduleCard key={s.id} s={s} onChange={setData} channels={channels}/>)}</div>}
  <DeliveryPanel onChange={load} agents={agents}/>
  {L&&<TierPerks limits={L} onRefresh={load}/>}
  <p className="text-xs text-muted-foreground">All times follow the clock of your device. If the server was down at a slot, that run is dropped and not made up later. A schedule pauses, and says why, when the credits are gone or its agent or skill was removed.</p>
 </DashPage>;
}

/** Studio "Automate" tab: schedules of the agent being edited. */
export function AgentSchedules({auth,agent,agents,balance,ensureSaved,onSignIn}:{auth:boolean;agent:Agent;agents:Agent[];balance:number|null;ensureSaved:()=>Promise<string|null>;onSignIn:()=>void}){
 const {data,setData}=useSchedules(auth);
 if(!auth)return <div className="grid gap-3"><p className="text-sm text-muted-foreground">This agent can do a task by itself several times a day. Setting that up needs a signed-in account.</p><Button variant="outline" className="justify-self-start" onClick={onSignIn}><I id="wallet"/>Connect wallet</Button></div>;
 const mine=(data?.schedules||[]).filter(s=>agent.id&&s.agent_id===agent.id);
 return <div className="grid gap-4">
  <p className="text-sm text-muted-foreground"><b className="text-foreground">{agent.name}</b> can use a skill without you. Set the task and the number of runs a day. Every run is paid in credits and saved in History.</p>
  {mine.map(s=><ScheduleCard key={s.id} s={s} onChange={setData} compact channels={data?.channels||[]}/>)}
  <ScheduleForm agents={agents} agent={agent} limits={data?.limits||null} balance={balance} count={data?.schedules.length||0} channels={data?.channels||[]} ensureSaved={ensureSaved} onSaved={setData}/>
 </div>;
}
