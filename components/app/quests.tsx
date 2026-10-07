'use client';
/* Quests (/dashboard/quests): a short list of things to try, each done when the server sees it happened, each worth a
   few free credits once per account. Data: /api/quests (lib/quests.ts). Signed out, the list is shown without progress. */
import {useCallback,useEffect,useState} from 'react';
import {toast} from 'sonner';
import {FaXTwitter} from 'react-icons/fa6';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {api,copyText,I} from '@/app/ui';
import {cn} from '@/lib/utils';
import type {View} from '@/lib/routes';
import {DashPage,EmptyState,Kpi,KpiRow,PageHeader,StatusBadge} from './parts';

type Quest={id:string;title:string;text:string;go:string;icon:string;credits:number;done:boolean;claimed:boolean};
type Data={signedIn:boolean;enabled:boolean;credits:number;earned:number;quests:Quest[]};

type Invite={enabled:boolean;code?:string;credits?:number;max?:number;invited?:number;active?:number;earned?:number;invitedBy?:'waiting'|'paid'|null;
 boost?:{percent:number;maxFriends:number;unit:string;holding:number;multiplier:number;token:string}|null};
/** The account's invite link and how its invitations are doing (/api/referrals, lib/referrals.ts). */
function InviteCard({auth}:{auth:boolean}){
 const [d,setD]=useState<Invite|null>(null);
 useEffect(()=>{if(!auth)return;let alive=true;api('/api/referrals').then(x=>{if(alive)setD(x);}).catch(()=>null);return()=>{alive=false;};},[auth]);
 if(!auth||!d||!d.enabled||!d.code)return null;
 const link=`${location.origin}/r/${d.code}`;const credits=d.credits||0;
 const post=`https://x.com/intent/post?text=${encodeURIComponent(credits>0?`Harvex lets you build an AI agent with a character of its own. Join through my invite and each of us gets ${credits} free credits once your first run is done:`:'Harvex lets you build an AI agent with a character of its own:')}&url=${encodeURIComponent(link)}`;
 return <section className="grid gap-4 rounded-2xl border bg-card p-6">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-[15px] font-semibold">Invite a friend</b>
   <span className="text-[12.5px] text-muted-foreground tabular-nums">{d.invited||0} invited · {d.active||0} ran a task · {d.earned||0} credits earned</span></div>
  <p className="text-[13px] text-muted-foreground">{credits>0?<>A friend who opens your link, signs in with a new account and finishes a first run brings <b className="text-foreground">{credits} free credits</b> to each of you. The reward is paid for {d.max} invitations at most.</>:'Pass your link on. Invitations are recorded on this server, but no credits are given for them.'}</p>
  <div className="flex gap-2"><Input readOnly value={link} aria-label="Your invite link" onFocus={e=>e.currentTarget.select()} className="h-9 font-mono text-[12px]"/>
   <Button variant="outline" className="h-9" onClick={()=>copyText(link,toast.success,toast.error)}><I id="copy"/>Copy</Button>
   <Button className="h-9" asChild><a href={post} target="_blank" rel="noreferrer noopener"><FaXTwitter aria-hidden="true"/>Post on X</a></Button></div>
  {d.boost&&<div className="grid gap-1 rounded-lg border bg-secondary/40 p-3">
   <span className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-[13px] font-semibold">Holder reward boost</b>
    <span className="font-mono text-[12px] tabular-nums"><b className="text-foreground">×{(d.boost.multiplier/100).toFixed(1)}</b> now · {d.boost.holding} of your friends hold {Number(d.boost.unit).toLocaleString('en-US')} HARVEX</span></span>
   <p className="text-[12.5px] text-muted-foreground">For each hour in which an invited friend holds {Number(d.boost.unit).toLocaleString('en-US')} HARVEX from start to end, your own {d.boost.token} holder reward for that hour is {d.boost.percent}% higher. At most {d.boost.maxFriends} friends count (×{(1+d.boost.percent*d.boost.maxFriends/100).toFixed(1)}). The boost multiplies what your wallets earn, so without a reward of your own there is nothing to raise. A friend who stops holding stops counting.<a href="/invite" className="underline underline-offset-4 hover:text-foreground">How it works</a></p>
  </div>}
  {d.invitedBy&&<p className="text-xs text-muted-foreground">{d.invitedBy==='paid'?'A friend invited you, and your welcome bonus is in your balance.':'A friend invited you. Your welcome bonus comes once your first run is complete.'}</p>}
 </section>;
}

export function QuestsPage({auth,onSignIn,onGo,onClaimed}:{auth:boolean;onSignIn:()=>void;onGo:(v:View)=>void;onClaimed:()=>void}){
 const [data,setData]=useState<Data|null>(null);const [busy,setBusy]=useState('');
 const load=useCallback(()=>{api('/api/quests').then(setData).catch(()=>null);},[]);
 useEffect(()=>{load();},[load,auth]);
 async function claim(q:Quest){
  if(busy)return;setBusy(q.id);
  try{const d=await api('/api/quests',{method:'POST',body:JSON.stringify({id:q.id})});setData(cur=>cur?{...cur,...d}:d);
   toast.success(d.credits>0?`+${d.credits} credits`:'Quest claimed',{description:q.title});onClaimed();}
  catch(e){toast.error((e as Error).message);load();}finally{setBusy('');}
 }
 const list=data?.quests||[];const done=list.filter(q=>q.done).length,claimed=list.filter(q=>q.claimed).length,open=list.filter(q=>q.done&&!q.claimed).length;
 const head=<PageHeader icon="target" tone="lime" title="Quests" text="A short list of things to try with your agent. The server marks a quest done when it sees the action, and each one pays free credits a single time per account."
  actions={!auth?<Button onClick={onSignIn}><I id="wallet"/>Connect wallet</Button>:undefined}/>;
 if(data&&!data.enabled)return <DashPage>{head}<EmptyState title="This server has quests turned off" text="The rest of the studio is not affected."/></DashPage>;
 return <DashPage>
  {head}
  <KpiRow>
   <Kpi label="Done" value={data?`${done}/${list.length}`:'—'} hint={open?`${open} ready to claim`:'Quests you completed'} tone="lime" icon="check"/>
   <Kpi label="Claimed" value={data?`${claimed}/${list.length}`:'—'} hint="One claim per account" tone="mint" icon="target"/>
   <Kpi label="Credits from quests" value={data?data.earned:'—'} hint="Free credits" tone="amber" icon="coins"/>
   <Kpi label="Per quest" value={data?(data.credits>0?`+${data.credits} CR`:'—'):'—'} hint={data&&data.credits===0?'This server gives none':'Yours once you claim it'} tone="iris" icon="hype"/>
  </KpiRow>
  <ol className="stagger grid gap-3 lg:grid-cols-2">{list.map((q,i)=><li key={q.id} className={cn('grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-xl border bg-card p-4 transition-colors',q.claimed&&'bg-secondary/30')}>
   <span className={cn('grid size-10 place-items-center rounded-lg',q.done?'bg-lime/20 text-foreground':'bg-secondary text-muted-foreground')}><I id={q.done?'check':q.icon}/></span>
   <div className="grid gap-1">
    <b className="flex flex-wrap items-center gap-2 text-sm font-semibold"><span className="font-mono text-[11px] text-muted-foreground tabular-nums">{String(i+1).padStart(2,'0')}</span>{q.title}
     {q.claimed?<StatusBadge kind="archived">claimed</StatusBadge>:q.done?<StatusBadge kind="live">done</StatusBadge>:null}</b>
    <p className="text-[13px] text-muted-foreground">{q.text}</p>
   </div>
   <div className="col-start-2 flex flex-wrap items-center justify-between gap-2">
    <span className="font-mono text-[11px] tracking-[.04em] text-muted-foreground">{q.credits>0?`+${q.credits} free credits`:'no credits on this server'}</span>
    {q.claimed?<span className="text-[12.5px] text-muted-foreground">Already in your balance</span>
     :q.done?<Button size="sm" disabled={!!busy} onClick={()=>claim(q)}>{busy===q.id?'Claiming…':q.credits>0?`Claim +${q.credits}`:'Claim'}</Button>
     :<Button size="sm" variant="outline" onClick={()=>auth?onGo(q.go as View):onSignIn()}>{auth?'Go':'Connect wallet'}<I id="arrow"/></Button>}
   </div>
  </li>)}</ol>
  {!data&&<p className="text-sm text-muted-foreground">Loading quests…</p>}
  <InviteCard auth={auth}/>
  <p className="max-w-[80ch] text-xs text-muted-foreground">What a quest pays is free credits, the same kind a new account starts with. They pay for runs and are used up before any bought credits. They never count as claimable earnings and cannot be withdrawn. The list of quests grows over time.</p>
 </DashPage>;
}
