'use client';
/* /dashboard/profile: who you are on Harvex (wallet identity), credits, holdings & allocation, and account actions. */
import {useEffect,useState} from 'react';
import {Chain} from '@/components/harvex/web3';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import {api,I,copyText} from '@/app/ui';
import {ToneIcon,type View} from '@/components/harvex/navbar';
import {DashPage,EmptyState,PageHeader,StatusBadge} from './parts';
import {HoldingsCard} from './holdings';
import {CreatorVerify} from './creator-verify';

export function ProfilePage({auth,label,wallet,balance,earned,feeBps,navigate,onSignIn,onSignOut}:{auth:boolean;label:string;wallet:string;balance:number|null;earned:number;feeBps:number;navigate:(v:View)=>void;onSignIn:()=>void;onSignOut:()=>void}){
 const [explorer,setExplorer]=useState('');
 useEffect(()=>{api('/api/chain').then(c=>setExplorer(c.explorer||'')).catch(()=>{});},[]);
 if(!auth)return <DashPage><PageHeader icon="user" tone="iris" title="Profile" text="Your wallet identity, credits and HARVEX position."/>
  <EmptyState title="Connect a wallet" text="Your profile is your wallet. Sign in with MetaMask, Trust Wallet or any EVM wallet." action={<Button onClick={onSignIn}><I id="wallet"/>Connect wallet</Button>}/></DashPage>;
 const id=wallet||label;const initials=(wallet?wallet.slice(2,4):label.slice(0,2)||'?').toUpperCase();
 return <DashPage>
  <PageHeader icon="user" tone="iris" title="Profile" text="Your wallet identity, credits and HARVEX position."
   actions={<Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onSignOut}>Sign out</Button>}/>
  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
   <div className="stagger grid gap-4">
    <section className="grid gap-4 rounded-2xl border bg-card p-6">
     <div className="flex items-center gap-4">
      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-lime font-mono text-base font-bold text-ink">{initials}</span>
      <div className="grid min-w-0 gap-1.5"><b className="truncate font-mono text-[14px]">{wallet?`${wallet.slice(0,10)}…${wallet.slice(-6)}`:label}</b>
       <div className="flex flex-wrap gap-1.5"><StatusBadge kind={wallet?'live':'archived'}>{wallet?<>Wallet · <Chain/></>:'Legacy account'}</StatusBadge></div></div>
     </div>
     {wallet&&<div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={()=>copyText(wallet,m=>toast.success(m),m=>toast.error(m))}><I id="copy"/>Copy address</Button>
      <Button size="sm" variant="outline" asChild><a href={`${explorer||'https://bscscan.com'}/address/${id}`} target="_blank" rel="noreferrer noopener"><I id="globe"/>Explorer</a></Button>
     </div>}
    </section>
    <section className="grid gap-4 rounded-2xl border bg-t-lime p-6">
     <div className="flex items-start justify-between gap-3">
      <div className="grid gap-1"><span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">Credits</span><b className="font-display text-4xl leading-none font-medium tracking-[-.04em] tabular-nums">{balance??'—'}</b></div>
      <div className="grid justify-items-end gap-1 text-right"><span className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">Earned</span><b className="font-display text-xl font-medium tabular-nums">{earned}</b></div>
     </div>
     <Progress value={Math.min(100,(balance??0)/100*100)} className="h-2 bg-background [&>div]:bg-foreground"/>
     <span className="text-[11.5px] text-muted-foreground">Platform fee {feeBps/100}%{feeBps===0?' · beta':''}. Credits pay for runs; earned credits can be claimed on the Wallet page when claims are on.</span>
    </section>
    <div className="grid grid-cols-3 gap-2">{([['credits','coins','Credits'],['wallet','wallet','Wallet'],['activity','clock','History']] as const).map(([v,ic,t])=><Button key={v} variant="outline" className="h-auto flex-col gap-1.5 py-3 text-[12.5px] [&_svg]:size-4" onClick={()=>navigate(v)}><I id={ic}/>{t}</Button>)}</div>
    <CreatorVerify auth={auth}/>
    <section className="flex items-start gap-3 rounded-xl border p-4 text-[12.5px] text-muted-foreground"><ToneIcon icon="shield" tone="sky" className="size-8"/><span>Harvex never asks for your recovery phrase and never moves funds for you. Every transaction is signed in your own wallet.</span></section>
   </div>
   <HoldingsCard auth={auth} onWallet={()=>navigate('wallet')} compact/>
  </div>
 </DashPage>;
}
