'use client';
/* /login (wallet only) and the not-found screen. proxy.ts sends signed-out visitors of private dashboard pages
   here with ?next=<path>; after signing in they go back there. */
import {Suspense,lazy} from 'react';
import {Chain} from '@/components/harvex/web3';
import {Button} from '@/components/ui/button';
import {I} from '@/app/ui';
import {ToneIcon,type View} from './navbar';
import {SiteFooter} from './site-footer';

const SignIn=lazy(()=>import('./sign-in').then(m=>({default:m.SignIn})));
type Go=(v:View,doc?:string)=>void;

export function LoginPage({auth,onDone,onNavigate}:{auth:boolean;onDone:()=>void;onNavigate:Go}){
 const points:[string,string,'lime'|'iris'|'sky'][]=[['wallet','Your wallet is your account: no email, no password.','lime'],['shield','Signing is free, sends no transaction and never asks for your recovery phrase.','sky'],['link','Works with MetaMask, Trust Wallet and any EVM wallet on BNB Smart Chain.','iris']];
 return <>
  <section className="mx-auto grid min-h-[calc(100svh-var(--top)-40px)] max-w-[1080px] items-center gap-10 px-[clamp(16px,3vw,32px)] py-12 md:grid-cols-[minmax(0,1fr)_420px]">
   <div className="grid gap-5">
    <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Sign in · <Chain/></span>
    <h1 className="font-display text-[clamp(36px,5vw,60px)] leading-[1.02] font-medium tracking-[-.045em]">Connect your wallet<br/><span className="font-light">to open your studio.</span></h1>
    <ul className="grid gap-3">{points.map(([ic,t,tone])=><li key={t} className="flex items-start gap-3 text-[14px] text-muted-foreground"><ToneIcon icon={ic} tone={tone} className="size-8"/><span className="pt-1">{t}</span></li>)}</ul>
   </div>
   <div className="grid gap-4 rounded-2xl border bg-card p-6 shadow-[0_30px_60px_-40px_rgb(0_0_0/.35)]">
    {auth?<div className="grid gap-3 text-center"><b className="font-display text-xl font-medium">You are signed in</b><Button onClick={onDone}>Open the dashboard<I id="arrow"/></Button></div>
    :<><div className="grid gap-1"><b className="font-display text-xl font-medium">Connect wallet</b><span className="text-sm text-muted-foreground">Choose a wallet, approve <Chain className="text-foreground"/> and sign the message.</span></div>
     <Suspense fallback={<div className="grid h-24 place-items-center text-sm text-muted-foreground">Loading…</div>}><SignIn onWalletDone={onDone}/></Suspense></>}
   </div>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}

export function NotFoundPage({onNavigate}:{onNavigate:Go}){
 return <>
  <section className="mx-auto grid min-h-[calc(100svh-var(--top)-40px)] max-w-[720px] place-content-center justify-items-center gap-5 px-4 py-16 text-center">
   <span className="font-mono text-[11px] tracking-[.1em] text-muted-foreground uppercase">Error 404</span>
   <h1 className="font-display text-[clamp(36px,6vw,64px)] leading-none font-medium tracking-[-.045em]">This page does not exist</h1>
   <p className="max-w-[46ch] text-muted-foreground">The link may be old or mistyped. Everything in Harvex is one click away from here.</p>
   <div className="flex flex-wrap justify-center gap-2"><Button onClick={()=>onNavigate('home')}>Go home</Button><Button variant="outline" onClick={()=>onNavigate('overview')}>Open the dashboard</Button><Button variant="ghost" onClick={()=>onNavigate('docs')}>Read the docs</Button></div>
  </section>
  <SiteFooter onNavigate={onNavigate}/>
 </>;
}
