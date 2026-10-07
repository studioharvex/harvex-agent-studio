'use client';
/* "Share" block of a run (the run sheet in History and the Studio): makes the answer public under /s/<id>, shows the
   link, and takes it down again. Data: /api/share (lib/share.ts). An answer that used Google Search cannot be shared:
   it may only be shown in the Studio, to the account that asked. */
import {useState} from 'react';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Switch} from '@/components/ui/switch';
import {api,copyText,I} from '@/app/ui';
import {splitSearchWidget} from '@/lib/grounding';
import type {Run} from '@/lib/agents';
import {StatusBadge} from './parts';

export type ShareState={id:string;task:boolean};

export function ShareAnswer({run,share,onChange}:{run:Run;share:ShareState|null;onChange:(s:ShareState|null)=>void}){
 const [busy,setBusy]=useState(false);const [task,setTask]=useState(share?.task??true);
 if(run.status!=='complete'||!run.output)return null;
 const grounded=!!splitSearchWidget(run.output).widget;
 const link=share?`${location.origin}/s/${share.id}`:'';
 const post=`https://x.com/intent/post?text=${encodeURIComponent(`An answer from ${run.agent_name}, the AI agent I run on Harvex:`)}&url=${encodeURIComponent(link)}`;
 async function save(showTask:boolean){
  if(busy)return;setBusy(true);
  try{const d=await api('/api/share',{method:'POST',body:JSON.stringify({runId:run.id,showTask})});onChange({id:d.id,task:d.task});
   if(!share)copyText(`${location.origin}/s/${d.id}`,()=>toast.success('The public link is ready and copied'),()=>toast.success('The public link is ready'));}
  catch(e){toast.error((e as Error).message);setTask(share?.task??true);}finally{setBusy(false);}
 }
 async function stop(){
  if(busy)return;setBusy(true);
  try{await api('/api/share',{method:'DELETE',body:JSON.stringify({runId:run.id})});onChange(null);toast.success('The answer has been taken off its public page');}
  catch(e){toast.error((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="grid gap-2.5 rounded-lg border p-3">
  <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase">Share</span>{share&&<StatusBadge kind="live">Public</StatusBadge>}</div>
  {grounded?<p className="text-[12.5px] text-muted-foreground">Google Search was used for this answer. For that reason it is shown only here and only to you.</p>:<>
   {share?<div className="flex gap-2"><Input readOnly value={link} aria-label="Public link" onFocus={e=>e.currentTarget.select()} className="h-9 font-mono text-[12px]"/>
     <Button variant="outline" className="h-9" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy</Button></div>
    :<p className="text-[12.5px] text-muted-foreground">A public page can carry this answer next to your agent&apos;s character, for you to post or send. Your account and the agent&apos;s instructions are never shown on it, and the page can be taken down at any time.</p>}
   <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Switch checked={task} disabled={busy} onCheckedChange={v=>{setTask(v);if(share)save(v);}} aria-label="Show my task on the page"/>Show the start of my task on the page</label>
   <div className="flex flex-wrap gap-2">{share?<>
     <Button asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button>
     <Button variant="outline" asChild><a href={link} target="_blank" rel="noreferrer noopener">Open page</a></Button>
     <Button variant="ghost" disabled={busy} onClick={stop}>Stop sharing</Button></>
    :<Button disabled={busy} onClick={()=>save(task)}><I id="share"/>{busy?'Creating…':'Create public link'}</Button>}</div>
  </>}
 </div>;
}
