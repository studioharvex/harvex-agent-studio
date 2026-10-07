'use client';
/* Creator verification (Profile page): a creator shows that an X handle is theirs by posting a code from it, and a
   reviewer on the team confirms it; then the creator's published agents say "Verified creator · @handle".
   Data: /api/creator (lib/creators.ts). A reviewer (an account listed in CREATOR_ADMINS) also sees the requests
   that wait, each with the link to open and the code to look for, and can publish the starter cast
   (lib/starter-agents.ts) from their own account in one click, so Discover and the plaza are not empty. */
import {useCallback,useEffect,useState} from 'react';
import {toast} from 'sonner';
import {FieldError,useFormCheck} from './form';
import {FaXTwitter} from 'react-icons/fa6';
import {api,copyText,I,FieldLabel} from '@/app/ui';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {StatusBadge} from './parts';
import {STARTER_AGENTS,STARTER_PRICE} from '@/lib/starter-agents';

/** Reviewer only: saves and publishes the starter agents this account does not have yet. They become ordinary agents
    of this account (My agents): edit, reprice or unpublish them there. */
function StarterCast(){
 const [busy,setBusy]=useState(false);const [note,setNote]=useState('');
 async function add(){
  if(busy)return;setBusy(true);setNote('');
  try{
   const ws=await api('/api/workspace');const have=new Set((ws.agents as {name:string;archived?:number}[]).filter(a=>!a.archived).map(a=>a.name));let n=0;
   for(const a of STARTER_AGENTS){if(have.has(a.name))continue;
    const saved=await api('/api/agents',{method:'POST',body:JSON.stringify(a)});
    await api('/api/agents',{method:'PATCH',body:JSON.stringify({id:saved.id,published:true,...STARTER_PRICE})});n++;}
   setNote(n?`This account now has ${n} more published agent${n===1?'':'s'}. They are listed in My agents.`:'This account already has every one of them.');
  }catch(e:any){toast.error(e.message);}finally{setBusy(false);}
 }
 return <div className="grid gap-2 border-t pt-3">
  <b className="text-sm font-semibold">Starter cast</b>
  <p className="text-[12.5px] text-muted-foreground">This puts {STARTER_AGENTS.length} ready-made agents ({STARTER_AGENTS.map(a=>a.name).join(', ')}) into Discover and the plaza under this account, so neither is empty. Chatting with them is free and a task costs {STARTER_PRICE.price} credits. From then on they belong to you, and My agents is where you edit or unpublish them.</p>
  <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" disabled={busy} onClick={add}><I id="plus"/>{busy?'Publishing…':'Publish the starter cast'}</Button>{note&&<span className="text-[12.5px] text-muted-foreground">{note}</span>}</div>
 </div>;
}

type Mine={status:'none'|'pending'|'review'|'verified'|'rejected';handle?:string;code?:string;proof?:string|null;note?:string|null;post?:string};
type Item={owner:string;handle:string;code:string;post:string;proof:string;updated:string};
type Data={signedIn:boolean;enabled:boolean;admin:boolean;mine:Mine;review:Item[]};

export function CreatorVerify({auth}:{auth:boolean}){
 const [d,setD]=useState<Data|null>(null);const [handle,setHandle]=useState('');const [url,setUrl]=useState('');const [busy,setBusy]=useState(false);const hf=useFormCheck('handle'),pf=useFormCheck('proof');
 const load=useCallback(async()=>{try{setD(await api('/api/creator'));}catch{setD(null);}},[]);
 useEffect(()=>{load();},[load,auth]);
 const act=async(payload:object,ok?:string)=>{if(busy)return;setBusy(true);try{setD(await api('/api/creator',{method:'POST',body:JSON.stringify(payload)}));if(ok)toast.success(ok);}catch(e:any){toast.error(e.message);}finally{setBusy(false);}};
 if(!auth||!d)return null;
 const m=d.mine;const intent=m.post?`https://x.com/intent/post?text=${encodeURIComponent(m.post)}`:'#';
 return <>
  <section className="grid gap-4 rounded-2xl border bg-card p-6">
   <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-[15px] font-semibold">Creator verification</b>
    <StatusBadge kind={m.status==='verified'?'live':m.status==='review'?'pending':m.status==='rejected'?'failed':'private'}>{m.status==='none'?'not verified':m.status==='pending'?'code given':m.status==='review'?'in review':m.status}</StatusBadge></div>
   {m.status==='verified'?<>
     <p className="text-[13.5px] text-muted-foreground">Your verified handle is <a className="font-medium text-foreground underline underline-offset-4" href={`https://x.com/${m.handle}`} target="_blank" rel="noreferrer noopener">@{m.handle}</a>. It appears on every agent you publish.</p>
     <Button size="sm" variant="ghost" className="justify-self-start" disabled={busy} onClick={()=>{if(confirm('Remove your verification? Your agents will show an anonymous creator name again.'))act({action:'withdraw'},'Verification removed');}}>Remove verification</Button>
    </>
   :!d.enabled?<p className="text-[13.5px] text-muted-foreground">This server has not opened verification yet. Until it does, an anonymous creator name stands on your agents.</p>
   :m.status==='none'||m.status==='rejected'?<>
     {m.status==='rejected'&&<p className="rounded-lg bg-t-coral px-3 py-2 text-[13px] text-tx-coral">The request for @{m.handle} could not be confirmed{m.note?`: ${m.note}`:'.'} You are free to send a new one.</p>}
     <p className="text-[13.5px] text-muted-foreground">Prove that an X handle belongs to you. Your published agents then carry “Verified creator · @handle” where an anonymous name stood before.</p>
     <div className="grid gap-2"><FieldLabel htmlFor="cv-handle">Your X handle</FieldLabel>
      <div className="flex gap-2"><Input id="cv-handle" value={handle} maxLength={16} onChange={e=>{setHandle(e.target.value);hf.clear('handle');}} placeholder="@yourhandle" className="h-9 max-w-xs" {...hf.field('handle')}/>
       <Button className="h-9" disabled={busy} onClick={async()=>{const ok=await hf.check({handle});if(ok)act({action:'start',handle:ok.handle});}}>Get my code</Button></div><FieldError form={hf} field="handle"/></div>
    </>
   :m.status==='pending'?<>
     <p className="text-[13.5px] text-muted-foreground"><b className="text-foreground">1.</b> Publish the text below as a post from <b className="text-foreground">@{m.handle}</b>. <b className="text-foreground">2.</b> Put the link to the post in the field under it. Someone on the team will then look at it.</p>
     <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-secondary/50 p-3"><code className="min-w-0 flex-1 font-mono text-[12.5px] break-words">{m.post}</code>
      <Button size="sm" variant="outline" onClick={()=>copyText(m.post||'',toast.success,toast.error)}><I id="copy"/>Copy</Button>
      <Button size="sm" asChild><a href={intent} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button></div>
     <div className="grid gap-2"><FieldLabel htmlFor="cv-url">Link to your post</FieldLabel>
      <div className="flex gap-2"><Input id="cv-url" value={url} maxLength={200} onChange={e=>{setUrl(e.target.value);pf.clear('url');}} placeholder={`https://x.com/${m.handle}/status/…`} className="h-9 font-mono text-[12px]" {...pf.field('url')}/>
       <Button className="h-9" disabled={busy} onClick={async()=>{const ok=await pf.check({url},{handle:m.handle||''});if(ok)act({action:'proof',url:ok.url},'Sent for review');}}>Send</Button></div><FieldError form={pf} field="url"/></div>
     <button type="button" className="justify-self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={()=>act({action:'withdraw'})}>Use another handle</button>
    </>
   :<>
     <p className="text-[13.5px] text-muted-foreground">Someone on the team still has to look at <a className="underline underline-offset-4" href={m.proof||'#'} target="_blank" rel="noreferrer noopener">your post</a> for <b className="text-foreground">@{m.handle}</b>. Leave the post online until the request is confirmed.</p>
     <button type="button" className="justify-self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={()=>act({action:'withdraw'})}>Withdraw the request</button>
    </>}
   <p className="text-[12px] text-muted-foreground">Your X account is never read. You post a code and we look at that single post. One handle can be verified for one account only.<a href="/verified" className="underline underline-offset-4 hover:text-foreground">How it works</a></p>
  </section>
  {d.admin&&<section className="grid gap-4 rounded-2xl border border-lime bg-card p-6">
   <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-[15px] font-semibold">Creator requests to review</b><span className="font-mono text-[11px] text-muted-foreground">{d.review.length} waiting</span></div>
   {!d.review.length?<p className="text-[13px] text-muted-foreground">No request is waiting. This card is shown to you because your wallet is a reviewer on this server.</p>
   :d.review.map(r=><div key={r.owner} className="grid gap-2 rounded-lg border bg-secondary/40 p-3">
     <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-sm font-semibold">@{r.handle}</b><span className="font-mono text-[10.5px] text-muted-foreground">{new Date(r.updated).toLocaleString()}</span></div>
     <p className="text-[12.5px] text-muted-foreground">Two things must be true of the post: its author is <b className="text-foreground">@{r.handle}</b>, and the text includes <code className="font-mono text-foreground">{r.code}</code>.</p>
     <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" asChild><a href={r.proof} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Open the post</a></Button>
      <Button size="sm" disabled={busy} onClick={()=>act({action:'approve',owner:r.owner},`@${r.handle} verified`)}><I id="check"/>Approve</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={()=>{const note=prompt('A reason for the creator (optional). They will see this text.');if(note!==null)act({action:'reject',owner:r.owner,note},'Rejected');}}>Reject</Button>
     </div>
    </div>)}
   <StarterCast/>
  </section>}
 </>;
}
