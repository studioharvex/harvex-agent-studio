'use client';
/* Account & workspace panel (inside the account Dialog): profile header, balance card, status
   tiles and shortcuts. Everything animates in; honest labels for anything that is not live. */
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import {I} from '@/app/ui';
import {cn} from '@/lib/utils';
import {ToneIcon} from '@/components/harvex/navbar';
import type {Tone} from '@/components/harvex/motion';
import {StatusBadge} from './parts';

type Go=(v:'credits'|'wallet'|'rewards'|'activity'|'agents')=>void;
export function AccountPanel({auth,email,wallet,balance,earned,ready,feeBps,loadError,onSignOut,onSignIn,onGo}:{auth:boolean;email:string;wallet:string;balance:number|null;earned:number;ready:boolean;feeBps:number;loadError:string;onSignOut:()=>void;onSignIn:()=>void;onGo:Go}){
 const label=wallet?`${wallet.slice(0,6)}…${wallet.slice(-4)}`:email;
 const initials=(wallet?wallet.slice(2,4):email.slice(0,2)||'?').toUpperCase();
 const tiles:[string,string,string,Tone,string][]=[
  ['AI service',ready?'Connected':'Samples only','sum',ready?'mint':'amber',ready?'live':'archived'],
  ['Platform fee',`${feeBps/100}%${feeBps===0?' · beta':''}`,'coins','iris','sample'],
  ['Storage',!auth?'Sign-in required':loadError?'Unavailable':'Workspace DB','save',loadError?'coral':'sky',loadError?'failed':'pending'],
  ['Holder rewards','Planned','hype','lime','archived'],
 ];
 if(!auth)return <div className="stagger grid gap-4">
  <div className="grid justify-items-center gap-3 rounded-2xl border bg-t-iris p-6 text-center"><ToneIcon icon="user" tone="iris" className="size-12 [&_svg]:size-6"/><b className="font-display text-lg font-medium">No wallet is signed in</b><p className="max-w-[34ch] text-sm text-muted-foreground">Saving agents, publishing them and running tasks start with a wallet: MetaMask, Trust Wallet or another EVM wallet.</p><Button onClick={onSignIn}><I id="wallet"/>Connect wallet</Button></div>
 </div>;
 return <div className="stagger grid gap-4">
  <div className="flex items-center gap-3">
   <span className="grid size-12 shrink-0 animate-[pop-in_.5s_var(--ease-smooth)_both] place-items-center rounded-lg bg-lime font-mono text-sm font-bold text-ink">{initials}</span>
   <div className="grid min-w-0 flex-1 gap-1"><b className="truncate text-[15px] font-semibold">{label||'Signed in'}</b><div className="flex flex-wrap gap-1.5"><StatusBadge kind={wallet?'sample':'pending'}>{wallet?'Wallet · BNB Smart Chain':'Legacy account'}</StatusBadge><StatusBadge kind="live">Preview workspace</StatusBadge></div></div>
  </div>

  <div className="grid gap-3 rounded-xl border bg-t-lime p-4">
   <div className="flex items-start justify-between gap-3">
    <div className="grid gap-1"><span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">Preview credits</span><b className="font-display text-4xl leading-none font-medium tracking-[-.04em] tabular-nums">{balance??'—'}<span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">CR</span></b></div>
    <div className="grid justify-items-end gap-1 text-right"><span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">Earned</span><b className="font-display text-xl font-medium tabular-nums">{earned} CR</b></div>
   </div>
   <Progress value={Math.min(100,(balance??0)/100*100)} className="h-2 bg-background [&>div]:bg-foreground [&>div]:transition-transform [&>div]:duration-1000"/>
   <span className="text-[11.5px] text-muted-foreground">Runs are paid with credits. Top-ups and claims of earnings happen on BNB Smart Chain, and only on servers where the operator has turned them on.</span>
  </div>

  <div className="stagger grid grid-cols-2 gap-2">{tiles.map(([k,v,ic,tone,badge])=><div key={k} className="lift grid gap-2 rounded-lg border bg-card p-3">
   <div className="flex items-center justify-between"><ToneIcon icon={ic} tone={tone} className="size-7 rounded-md [&_svg]:size-3.5"/><StatusBadge kind={badge}>{badge==='live'?'On':badge==='archived'?'Off':badge==='failed'?'Error':'Info'}</StatusBadge></div>
   <div className="grid"><span className="text-[11.5px] text-muted-foreground">{k}</span><b className="truncate text-sm font-semibold">{v}</b></div>
  </div>)}</div>

  <div className="grid grid-cols-3 gap-2">{([['credits','coins','Credits'],['wallet','wallet','Wallet'],['activity','clock','History']] as const).map(([v,ic,t])=><Button key={v} variant="outline" className="h-auto flex-col gap-1.5 py-3 text-[12.5px] [&_svg]:size-4" onClick={()=>onGo(v)}><I id={ic}/>{t}</Button>)}</div>

  <div className="flex items-center justify-between gap-3 border-t pt-4">
   <span className="flex items-center gap-2 text-xs text-muted-foreground"><I id="shield" className="i size-3.5"/>No API key is ever kept in this browser.</span>
   <Button variant="ghost" className={cn('text-destructive hover:text-destructive')} onClick={onSignOut}>Sign out</Button>
  </div>
 </div>;
}
