'use client';
/* "Write it from my posts" (Studio → Persona): the creator pastes posts they wrote, and gets a draft of the agent's
   instructions in their own style plus a tagline (POST /api/voice, lib/voice.ts). The draft is shown first; nothing
   changes on the agent until the creator presses "Use this". Opt-in: the box asks the creator to confirm the posts
   are their own, and the server refuses the request without that. */
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {FieldError,useFormCheck} from './form';
import {api,I,FieldLabel} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {Switch} from '@/components/ui/switch';
import {Textarea} from '@/components/ui/textarea';

type Info={live:boolean;cost:number;min:number;max:number};
type Draft={persona:string;tagline:string;cost:number};

export function VoiceBox({auth,balance,open:startOpen,onSignIn,ensureSaved,onUse,onSpent}:{auth:boolean;balance:number|null;/** opened by a link (/dashboard/studio?voice=1) */open?:boolean;onSignIn:()=>void;
 /** saves the agent being edited when it is new and gives its id */ensureSaved:()=>Promise<string|null>;onUse:(persona:string,tagline:string)=>void;onSpent:()=>void}){
 const [open,setOpen]=useState(!!startOpen);const [info,setInfo]=useState<Info|null>(null);
 const [posts,setPosts]=useState('');const [own,setOwn]=useState(false);const [busy,setBusy]=useState(false);const [draft,setDraft]=useState<Draft|null>(null);
 useEffect(()=>{if(!open||info)return;let alive=true;api('/api/voice').then(d=>{if(alive)setInfo(d);}).catch(()=>null);return()=>{alive=false;};},[open,info]);
 const n=posts.trim().length;const short=!!info&&n<info.min;const poor=!!info&&balance!==null&&balance<info.cost;const form=useFormCheck('voice');
 async function write(){
  if(busy||!info)return;if(!auth){onSignIn();return;}
  if(!await form.check({posts,own},{min:info.min,max:info.max}))return;
  setBusy(true);
  try{
   const agentId=await ensureSaved();if(!agentId)return;
   const d=await api('/api/voice',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),agentId,posts,own:true})});
   setDraft({persona:d.persona,tagline:d.tagline,cost:d.cost});onSpent();
  }catch(e:any){toast.error(e.message);}finally{setBusy(false);}
 }
 if(!open)return <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={()=>setOpen(true)}><I id="pen"/>Write it from my posts</Button><span className="text-xs text-muted-foreground">Your own posts go in, and instructions that sound like you come out.</span></div>;
 return <div className="grid gap-3 rounded-xl border bg-secondary/40 p-4">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-sm font-semibold">A voice drawn from your posts</b><button type="button" onClick={()=>setOpen(false)} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Close</button></div>
  {info&&!info.live?<p className="text-[13px] text-muted-foreground">This server has no AI connected, which means no voice draft can be written here.</p>:<>
   <div className="grid gap-2"><FieldLabel htmlFor="voice-posts">Posts you wrote</FieldLabel>
    <Textarea id="voice-posts" {...form.field('posts')} value={posts} onChange={e=>{setPosts(e.target.value);form.clear('posts');}} maxLength={info?.max??12000} disabled={busy} className="min-h-36 text-[13px]" placeholder={'Put in 10 to 30 posts you wrote, each after the last. Replies are fine as well. The draft gets better the more they sound like you.'}/>
    <span className="text-xs text-muted-foreground tabular-nums">{n.toLocaleString('en-US')} / {(info?.max??12000).toLocaleString('en-US')} characters{short?` · at least ${info!.min} needed`:''}</span><FieldError form={form} field="posts"/></div>
   <label className="flex items-start gap-3 text-[13px]"><Switch checked={own} onCheckedChange={v=>{setOwn(v);form.clear('own');}} disabled={busy} aria-label="These are my own posts" {...form.field('own')}/><span>These are my own posts. <span className="text-muted-foreground">Posts by another person must not be used to copy their voice.</span></span></label>
   <FieldError form={form} field="own"/>
   <div className="flex flex-wrap items-center gap-3"><Button disabled={busy||!info||(auth&&poor)} onClick={write}><I id="pen"/>{busy?'Reading your posts…':draft?'Draft it again':'Draft my voice'}</Button>
    <span className="text-xs text-muted-foreground">{!info?'':auth&&poor?`You have ${balance} credits and a draft costs ${info.cost}.`:`Each draft costs ${info.cost} credits and is kept in History. Nothing changes on your agent until you press Use this.`}</span></div>
   {draft&&<div className="grid gap-3 rounded-xl border bg-card p-4">
    {draft.tagline&&<div className="grid gap-1"><span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">Tagline</span><p className="text-[14px]">{draft.tagline}</p></div>}
    <div className="grid gap-1"><span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">Instructions</span><p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{draft.persona}</p></div>
    <div className="flex flex-wrap gap-2"><Button onClick={()=>{onUse(draft.persona,draft.tagline);setDraft(null);setOpen(false);toast.success('The draft is now in the instructions',{description:'Go through it, fix what does not fit, and save the agent.'});}}><I id="check"/>Use this</Button>
     <Button variant="ghost" onClick={()=>setDraft(null)}>Discard</Button></div>
   </div>}
   <p className="text-[12px] text-muted-foreground">What the draft describes is an AI character that writes like you. It is not you, and it says so when someone asks. Private details from the posts do not go into the draft. Read it through before you publish.</p>
  </>}
 </div>;
}
