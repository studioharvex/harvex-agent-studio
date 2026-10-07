'use client';
/* The agent check in the publish dialog: the studio tries the creator's own saved agent with four real messages and
   shows, check by check, what happened (POST /api/agents/check, lib/agent-check.ts). An agent that passed shows
   "Checked" on its page for as long as its instructions stay the ones that were checked. */
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {api,I} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import type {Agent} from '@/lib/agents';
import {StatusBadge} from './parts';

type Check=NonNullable<Agent['check']>;
const day=(iso:string)=>new Date(iso).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});

export function AgentCheck({agent,balance,onDone}:{agent:Agent;balance:number|null;/** the workspace is read again: the balance and the agent's check changed */onDone:()=>void}){
 const [info,setInfo]=useState<{live:boolean;cost:number}|null>(null);const [busy,setBusy]=useState(false);const [fresh,setFresh]=useState<Check|null>(null);
 useEffect(()=>{let alive=true;api('/api/agents/check').then(d=>{if(alive)setInfo(d);}).catch(()=>null);return()=>{alive=false;};},[]);
 const check=fresh||agent.check||null;const good=!!check&&check.passed&&check.current;
 const poor=!!info&&balance!==null&&balance<info.cost;
 async function run(){
  if(busy||!info||!agent.id)return;setBusy(true);
  try{const d=await api('/api/agents/check',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),agentId:agent.id})});setFresh(d.check);onDone();
   toast[d.check.passed?'success':'message'](d.check.passed?`Every check went well for ${agent.name}`:`${agent.name} failed one check or more`);}
  catch(e:any){toast.error(e.message);}finally{setBusy(false);}
 }
 return <div className="grid gap-3 rounded-lg border bg-secondary/40 p-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm font-semibold">Agent check</b>
   <StatusBadge kind={good?'live':check&&!check.passed?'failed':'private'}>{good?`checked ${day(check!.at)}`:!check?'not checked':!check.passed?'not passed':'changed since the check'}</StatusBadge></div>
  <p className="text-[12.5px] text-muted-foreground">Four real messages go to your agent, and the studio reads what comes back. It looks for an answer, for instructions that are not repeated, for no advice to buy or sell, and for the statement that it is an AI. After a pass the agent’s page says “Checked” for as long as its instructions stay the same.</p>
  {check&&<ul className="grid gap-1.5">{check.items.map(i=><li key={i.id} className="flex items-start gap-2 text-[12.5px]">
   <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold',i.ok?'bg-lime text-ink':'bg-coral text-white')}>{i.ok?'✓':'!'}</span>
   <span><b className="font-medium text-foreground">{i.title}.</b> <span className="text-muted-foreground">{i.note}</span></span></li>)}</ul>}
  {check&&!check.current&&<p className="text-[12.5px] text-muted-foreground">Since this check the name, instructions, tone or notes were edited, and the result stopped counting. Run the check once more.</p>}
  <div className="flex flex-wrap items-center gap-3">
   <Button size="sm" variant={good?'outline':'default'} disabled={busy||!info||!info.live||poor} onClick={run}><I id="scan"/>{busy?'Talking to it…':check?'Check again':'Check this agent'}</Button>
   <span className="text-xs text-muted-foreground">{!info?'':!info.live?'This server has no AI connected, so no agent can be checked here.':poor?`You have ${balance} credits and a check costs ${info.cost}.`:`${info.cost} credits. This is a check, not a guarantee: the next answer of an AI may be different.`}</span></div>
 </div>;
}
