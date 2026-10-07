'use client';
/* Wallet & chain page: linked wallets, USDT top-ups, earnings claims and holder tiers on BNB Smart
   Chain. Each block reads its own API and says plainly when the operator has not switched it on.
   Every transaction is signed in the user's wallet; the server only verifies what landed on-chain. */
import {useCallback,useEffect,useMemo,useState,type ReactNode} from 'react';
import {Chain,Token} from '@/components/harvex/web3';
import {toast} from 'sonner';
import {FieldError,useFormCheck} from './form';
import {formatUnits} from 'viem';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {Progress} from '@/components/ui/progress';
import {api,I} from '@/app/ui';
import {cn} from '@/lib/utils';
import {ToneIcon} from '@/components/harvex/navbar';
import {useHarvexToken} from '@/components/harvex/token-context';
import {discoverWallets,type WalletInfo} from '@/lib/auth-client';
import {claimOnchain,confirmTopup,explorerAddr,explorerTx,fetchChain,linkWallet,payTopup,type ChainInfo} from '@/lib/chain-client';
import {DashPage,EmptyState,Kpi,KpiRow,PageHeader,StatusBadge} from './parts';

const short=(a:string)=>`${a.slice(0,6)}…${a.slice(-4)}`;
const whole=(raw:string|number|bigint,dec=18)=>Number(formatUnits(BigInt(raw),dec)).toLocaleString('en-US',{maximumFractionDigits:2});
const walletError=(e:any)=>e?.code===4001?'The request was cancelled in your wallet.':(e?.shortMessage||e?.message||'Your wallet did not complete the request.');

type Claims={enabled:boolean;contract:string|null;token:ChainInfo['token'];creditsPerToken:number;min:number;balance:number;earned:number;earnedFree?:number;claimed:number;claimable:number;wallets:string[];
 requests:{id:string;address:string;credits:number;amount:string;status:string;created:string}[];epoch:{id:number;root:string}|null;proofs:{address:string;cumulative:string;proof:string[];claimedOnchain:string|null}[]};
type TierState={live:boolean;wallets:string[];period:string;balance?:string;tier:string;next?:{id:string;name:string;min:string}|null;allotment:{credits:number;claimed:boolean;claimedCredits:number}|null};

function Card({title,icon,tone,badge,children,className}:{title:ReactNode;icon:string;tone:'lime'|'iris'|'coral'|'sky'|'amber'|'mint';badge?:ReactNode;children:ReactNode;className?:string}){
 return <section className={cn('grid content-start gap-4 rounded-2xl border bg-card p-6',className)}>
  <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><ToneIcon icon={icon} tone={tone}/><b className="text-[15px] font-semibold">{title}</b></div>{badge}</div>
  {children}
 </section>;
}
const Off=({children}:{children:ReactNode})=><p className="rounded-lg border border-dashed p-3 text-[13px] text-muted-foreground">{children}</p>;

/** Picks the browser wallet to use (EIP-6963). One wallet: used directly. */
function useProvider(){
 const [list,setList]=useState<WalletInfo[]>([]);const [pick,setPick]=useState('');
 useEffect(()=>discoverWallets(setList),[]);
 const current=list.find(w=>w.id===pick)||list[0];
 return {list,current,setPick};
}

export function WalletPage({auth,onSignIn,onChanged}:{auth:boolean;onSignIn:()=>void;onChanged:()=>void}){
 const [cfg,setCfg]=useState<ChainInfo|null>(null);const [wallets,setWallets]=useState<string[]>([]);const [claims,setClaims]=useState<Claims|null>(null);
 const [tier,setTier]=useState<TierState|null>(null);const [topups,setTopups]=useState<{tx_hash:string;from_address:string;amount:string;credits:number;created:string}[]>([]);const [pendingTopups,setPendingTopups]=useState<{tx_hash:string;created:string}[]>([]);
 const [busy,setBusy]=useState('');const {list,current,setPick}=useProvider();const token=useHarvexToken();
 const load=useCallback(async()=>{
  const c=await fetchChain().catch(()=>null);setCfg(c);if(!auth)return;
  const [w,cl,t,tp]=await Promise.allSettled([api('/api/wallet'),api('/api/claims'),api('/api/tier'),api('/api/topups')]);
  if(w.status==='fulfilled')setWallets(w.value.wallets);if(cl.status==='fulfilled')setClaims(cl.value);if(tp.status==='fulfilled'){setTopups(tp.value.topups);setPendingTopups(tp.value.pending||[]);}
  setTier(t.status==='fulfilled'?t.value:null);
 },[auth]);
 useEffect(()=>{load();},[load]);
 // a top-up is settling on the server: refresh every 30 s so the credits show up without a reload
 useEffect(()=>{if(!pendingTopups.length)return;const t=setInterval(load,30000);return()=>clearInterval(t);},[pendingTopups.length,load]);
 const run=async(key:string,fn:()=>Promise<unknown>)=>{if(busy)return;setBusy(key);try{await fn();await load();onChanged();}catch(e:any){toast.error(walletError(e));}finally{setBusy('');}};

 if(!auth)return <DashPage><PageHeader icon="wallet" tone="sky" title="Wallet & chain" text="A wallet linked on BNB Smart Chain is used for credit top-ups, claims of what you earn and holder tiers, wherever the operator has switched those on."/>
  <EmptyState title="This page needs a connected wallet" text="MetaMask, Trust Wallet and other EVM wallets all work. The signature costs nothing, and no one will ask for your recovery phrase." action={<Button onClick={onSignIn}><I id="wallet"/>Sign in</Button>}/></DashPage>;

 const tierInfo=cfg?.tiers.find(t=>t.id===(tier?.tier||'free'));
 // does the token exist on this server: the layout's answer until /api/chain has loaded, then the API's
 const tiersOn=cfg?cfg.tiersLive:!!token;
 return <DashPage>
  <PageHeader icon="wallet" tone="sky" title="Wallet & chain" text="USDT top-ups, claims of creator earnings and your holder tier in one place, each only where the operator has switched it on. You sign every transaction in your own wallet."
   actions={cfg&&<><StatusBadge kind={cfg.network==='mainnet'?'live':'pending'}><Chain name={cfg.name}/></StatusBadge><Button variant="outline" asChild><a href={cfg.explorer} target="_blank" rel="noreferrer"><I id="globe"/>Explorer</a></Button></>}/>
  {cfg&&cfg.network==='testnet'&&<div className="flex flex-wrap items-start gap-3 rounded-xl border bg-t-amber p-4 text-[13.5px]"><ToneIcon icon="shield" tone="amber" className="size-8"/>
   <div className="grid flex-1 gap-1"><b className="font-semibold">Testnet</b><span className="text-muted-foreground">{cfg.name} is the network of this server. Its tokens have no value. Do not send mainnet funds to a testnet address, and rely only on addresses the official explorer shows.</span></div></div>}
  {cfg&&cfg.network==='mainnet'&&<div className="flex flex-wrap items-start gap-3 rounded-xl border bg-t-coral p-4 text-[13.5px]"><ToneIcon icon="shield" tone="coral" className="size-8"/>
   <div className="grid flex-1 gap-1"><b className="font-semibold">Mainnet · real funds</b><span className="text-muted-foreground">A top-up moves real {cfg.token?.symbol||'USDT'} on {cfg.name}. The credits it gives pay for runs and can be neither refunded nor withdrawn to a wallet. Compare the treasury address with bscscan.com before paying, and keep your recovery phrase to yourself.</span></div></div>}
  <KpiRow>
   <Kpi label="Linked wallets" value={wallets.length} hint={wallets[0]?short(wallets[0]):'None yet'} tone="sky" icon="wallet"/>
   <Kpi label="Top-ups" value={cfg?.topupEnabled?'On':'Off'} hint={cfg?.token?`1 ${cfg.token.symbol} = ${cfg.creditsPerToken} credits`:'Not switched on'} tone="lime" icon="coins"/>
   <Kpi label="Claimable" value={claims?.claimable??0} hint={claims?.enabled?'Earned credits':'Claims not switched on'} tone="iris" icon="store"/>
   <Kpi label="Holder tier" value={tierInfo?.name??'Free'} hint={tiersOn?'Read from your HARVEX balance':'Starts with the token'} tone="coral" icon="hype"/>
  </KpiRow>

  <div className="grid items-start gap-4 lg:grid-cols-2">
   {/* wallets */}
   <Card title="Linked wallets" icon="link" tone="sky" badge={<StatusBadge kind="live">Free to link</StatusBadge>}>
    {wallets.length?<ul className="grid gap-2">{wallets.map(a=><li key={a} className="flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 font-mono text-[12.5px]">
     <I id="wallet" className="i size-4"/><a className="flex-1 truncate hover:underline" href={cfg?explorerAddr(cfg,a):undefined} target="_blank" rel="noreferrer">{short(a)}</a>
     <Button size="sm" variant="ghost" disabled={!!busy} onClick={()=>run('unlink'+a,()=>api('/api/wallet',{method:'DELETE',body:JSON.stringify({address:a})}).then(()=>toast.success('Wallet unlinked')))}>Unlink</Button></li>)}</ul>
     :<Off>You have not linked a wallet. A linked wallet pays top-ups, receives claims and has its HARVEX counted for tiers.</Off>}
    {list.length>1&&<Select value={current?.id} onValueChange={setPick}><SelectTrigger className="h-10"><SelectValue placeholder="Choose a wallet"/></SelectTrigger><SelectContent>{list.map(w=><SelectItem key={w.id} value={w.id}><span className="flex items-center gap-2">{w.icon&&<img src={w.icon} alt="" width={16} height={16} className="size-4 rounded-sm"/>}{w.name}</span></SelectItem>)}</SelectContent></Select>}
    {current?<Button disabled={!cfg||!!busy} onClick={()=>run('link',async()=>{const r=await linkWallet(current.provider,cfg!);toast.success(`Linked ${short(r.linked)}`);})}><I id="plus"/>{busy==='link'?'Check your wallet…':`Link a wallet with ${current.name}`}</Button>
     :<Off>This browser has no wallet. Add a wallet extension, for example MetaMask or Rabby.</Off>}
    <p className="text-xs text-muted-foreground">Linking is a signed message for BNB Smart Chain that proves you own the address. Nothing is sent and no gas is paid.</p>
   </Card>

   {/* top-up */}
   <Topup cfg={cfg} wallets={wallets} provider={current} busy={busy} run={run} topups={topups} pending={pendingTopups}/>

   {/* claims */}
   <ClaimsCard cfg={cfg} claims={claims} provider={current} busy={busy} run={run}/>

   {/* tiers */}
   <Card title="Holder tier" icon="hype" tone="coral" badge={<StatusBadge kind={tiersOn?'live':'archived'}>{tiersOn?'Live':'Starts with the token'}</StatusBadge>}>
    {cfg?.tiersLive&&tier?.live?<>
     <div className="grid gap-2 rounded-lg border bg-t-coral p-3"><div className="flex items-baseline justify-between"><b className="font-display text-2xl font-medium">{tierInfo?.name}</b><span className="font-mono text-[12px] text-muted-foreground">{whole(tier.balance||'0')} <Token symbol="HARVEX"/></span></div>
      {tier.next&&<><Progress value={Math.min(100,Number(BigInt(tier.balance||'0')/10n**18n)*100/Number(tier.next.min))}/><span className="text-xs text-muted-foreground">{Number(tier.next.min).toLocaleString('en-US')} HARVEX for {tier.next.name}</span></>}</div>
     <Button disabled={!!busy||!tier.allotment||tier.allotment.claimed||tier.allotment.credits===0} onClick={()=>run('allot',async()=>{const r=await api('/api/tier',{method:'POST'});toast.success(`${r.credits} credits added for ${r.period}`);})}>
      <I id="coins"/>{tier.allotment?.claimed?`Claimed ${tier.allotment.claimedCredits} credits for ${tier.period}`:tier.allotment?.credits?`Claim ${tier.allotment.credits} credits for ${tier.period}`:'No monthly credits on Free'}</Button>
     <p className="text-xs text-muted-foreground">The first claim of a month fixes a snapshot block, and balances are read at that block. Tokens that move later are counted the following month.</p>
    </>:<Off>A tier comes from the HARVEX in your linked wallets. {tiersOn?'That balance has not been read yet. Reload the page if this message stays.':'No HARVEX token exists yet, which puts every account on Free for now.'}</Off>}
    {cfg&&<Table><TableHeader><TableRow><TableHead>Tier</TableHead><TableHead>Hold</TableHead><TableHead>Fee</TableHead><TableHead className="text-right">Credits / mo</TableHead></TableRow></TableHeader>
     <TableBody>{cfg.tiers.map(t=><TableRow key={t.id} className={cn(t.id===(tier?.tier||'free')&&'bg-t-coral')}><TableCell className="font-medium">{t.name}</TableCell><TableCell className="font-mono text-[12px]">{Number(t.min).toLocaleString('en-US')}+</TableCell><TableCell className="font-mono text-[12px]">×{(t.feePermille/1000).toFixed(1)}</TableCell><TableCell className="text-right font-mono text-[12px]">{t.credits}</TableCell></TableRow>)}</TableBody></Table>}
    <p className="text-xs text-muted-foreground">These thresholds are a draft. The fee multiplier is applied to the platform fee on what you sell.</p>
   </Card>
  </div>
 </DashPage>;
}

type Run=(key:string,fn:()=>Promise<unknown>)=>Promise<void>;
function Topup({cfg,wallets,provider,busy,run,topups,pending}:{cfg:ChainInfo|null;wallets:string[];provider?:WalletInfo;busy:string;run:Run;topups:{tx_hash:string;from_address:string;amount:string;credits:number;created:string}[];pending:{tx_hash:string;created:string}[]}){
 const [amount,setAmount]=useState('5');const [hash,setHash]=useState('');const [wait,setWait]=useState('');const pay=useFormCheck('topup'),paid=useFormCheck('txHash');
 const credits=useMemo(()=>{const n=Number(amount);return cfg&&Number.isFinite(n)&&n>0?Math.floor(n*cfg.creditsPerToken):0;},[amount,cfg]);
 const sym=cfg?.token?.symbol||'USDT';
 const verify=(h:string)=>confirmTopup(h,(n,need,stage)=>setWait(stage==='safe'?'BNB Smart Chain is confirming the block, which mostly takes a few seconds. Leaving this page is fine: the credits are added without you.':stage==='finalized'?'The block is being finalized, mostly within a few seconds…':stage==='sent'?'Waiting for the transaction…':`Waiting for confirmations ${n}/${need}…`)).then(r=>{setWait('');toast.success(r.already?'Already credited':`${r.credits} credits added`);});
 return <Card title={<>Top up with <Token symbol={sym}/></>} icon="coins" tone="lime" badge={<StatusBadge kind={cfg?.topupEnabled?'live':'archived'}>{cfg?.topupEnabled?'On':'Off'}</StatusBadge>}>
  {!cfg?.topupEnabled?<Off>This server has not switched top-ups on yet. Once it does, {sym} sent on BNB Smart Chain from a linked wallet turns into credits after confirmation.</Off>
  :!wallets.length?<Off>Start by linking the wallet that will pay. A payment from a wallet that is not linked earns no credits.</Off>
  :<>
   <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="grid gap-1.5"><span className="text-[12.5px] font-medium text-muted-foreground">Amount</span>
    <div className="flex items-center gap-2"><Input inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);pay.clear('amount');}} className="h-10 tabular-nums" {...pay.field('amount')}/><Token symbol={sym} className="font-mono text-[11px] text-muted-foreground"/></div><FieldError form={pay} field="amount"/></label>
    <div className="grid content-end"><div className="rounded-lg border bg-t-lime px-3 py-2 text-right"><span className="block font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">You get</span><b className="font-display text-lg font-medium tabular-nums">{credits} credits</b></div></div></div>
   <Button disabled={!provider||!!busy} onClick={async()=>{const ok=await pay.check({amount});if(ok)await run('pay',async()=>{const h=await payTopup(provider!.provider,cfg,ok.amount);setHash(h);toast.message('Your payment is out. BNB Smart Chain is confirming it…');await verify(h);});}}>
    <I id="wallet"/>{busy==='pay'?(wait||'Confirm in your wallet…'):`Pay ${amount||0} ${sym} to the Harvex treasury`}</Button>
   <div className="grid gap-1.5"><span className="text-[12.5px] font-medium text-muted-foreground">Already paid? Paste the transaction hash</span>
    <div className="flex gap-2"><Input value={hash} onChange={e=>{setHash(e.target.value.trim());paid.clear('hash');}} placeholder="0x…" aria-label="Transaction hash" className="h-10 font-mono text-[12px]" {...paid.field('hash')}/><Button variant="outline" disabled={!!busy} onClick={async()=>{const ok=await paid.check({hash});if(ok)await run('verify',()=>verify(ok.hash));}}>{busy==='verify'?'Checking…':'Check'}</Button></div><FieldError form={paid} field="hash"/></div>
   {cfg.treasury&&<p className="text-xs text-muted-foreground">Treasury <a className="font-mono underline-offset-4 hover:underline" href={explorerAddr(cfg,cfg.treasury)} target="_blank" rel="noreferrer">{short(cfg.treasury)}</a> · credited {cfg.finality==='soft'?`after ${cfg.confirmations} blocks`:cfg.finality==='safe'?'when the validators confirm the block (automatic, takes seconds)':'when the block is final'} · credits are for runs and never go back to your wallet as a refund.</p>}
  </>}
  {!!pending.length&&cfg&&<ul className="grid gap-1.5 border-t pt-3">{pending.map(p=><li key={p.tx_hash} className="flex items-center justify-between gap-2 text-[12.5px]"><a className="font-mono text-muted-foreground hover:underline" href={explorerTx(cfg,p.tx_hash)} target="_blank" rel="noreferrer">{short(p.tx_hash)}</a><StatusBadge kind="pending">Settling · credits arrive on their own</StatusBadge></li>)}</ul>}
  {!!topups.length&&cfg&&<ul className="grid gap-1.5 border-t pt-3">{topups.slice(0,5).map(t=><li key={t.tx_hash} className="flex items-center justify-between gap-2 text-[12.5px]"><a className="font-mono text-muted-foreground hover:underline" href={explorerTx(cfg,t.tx_hash)} target="_blank" rel="noreferrer">{short(t.tx_hash)}</a><span>{cfg.token?whole(t.amount,cfg.token.decimals):''} {sym} → <b>+{t.credits}</b></span></li>)}</ul>}
 </Card>;
}

function ClaimsCard({cfg,claims,provider,busy,run}:{cfg:ChainInfo|null;claims:Claims|null;provider?:WalletInfo;busy:string;run:Run}){
 const [credits,setCredits]=useState('');const [to,setTo]=useState('');const claim=useFormCheck('claim');
 const sym=claims?.token?.symbol||'USDT';const dec=claims?.token?.decimals??6;
 useEffect(()=>{if(claims&&!to&&claims.wallets[0])setTo(claims.wallets[0]);},[claims,to]);
 // an empty field means "everything I can claim", so the common case is one click
 // a published request is paid out once the wallet has claimed its whole cumulative amount on-chain
 const paidOut=(a:string)=>{const p=claims?.proofs.find(x=>x.address.toLowerCase()===a.toLowerCase());return !!p&&p.claimedOnchain!==null&&BigInt(p.claimedOnchain??'0')>=BigInt(p.cumulative);};
 const n=credits===''?(claims?.claimable??0):Number(credits)||0;const payout=claims?n/(claims.creditsPerToken||100):0;
 const why=!claims?'':claims.claimable===0?(claims.claimed>0?'All your earnings are already in the queue for the next payout.':'When other people run agents you published, the credits you earn are listed here.'):claims.claimable<claims.min?`A claim starts at ${claims.min} earned credits, and you have ${claims.claimable}.`:n<claims.min?`The minimum is ${claims.min} credits.`:n>claims.claimable?`This claim can take ${claims.claimable} credits at most.`:'';
 return <Card title="Claim earnings" icon="store" tone="iris" badge={<StatusBadge kind={claims?.enabled?'live':'archived'}>{claims?.enabled?'On':'Maintenance'}</StatusBadge>}>
  <div className="grid grid-cols-3 overflow-hidden rounded-lg border text-center">{([['Earned',claims?.earned??0],['Queued',claims?.claimed??0],['Claimable',claims?.claimable??0]] as const).map(([l,v],k)=><div key={l} className={cn('grid gap-0.5 p-3',k&&'border-l',k===2&&'bg-t-iris')}><span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">{l}</span><b className="font-display text-xl font-medium tabular-nums">{v}</b></div>)}</div>
  {!claims?.enabled?<Off>Claims are in maintenance and cannot be made at the moment. What you earn when others run your agents still goes into your balance, where you can spend it in the studio.</Off>
  :!claims.wallets.length?<Off>Before you claim, link the wallet your {sym} should go to.</Off>
  :<>
   <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1.5"><span className="text-[12.5px] font-medium text-muted-foreground">Credits to claim (min {claims.min})</span><div className="flex gap-2"><Input inputMode="numeric" aria-label="Credits to claim" value={credits} onChange={e=>{setCredits(e.target.value.replace(/\D/g,''));claim.clear('credits');}} placeholder={`All: ${claims.claimable}`} className="h-10 tabular-nums" {...claim.field('credits')}/><Button type="button" variant="outline" className="h-10" disabled={!claims.claimable} onClick={()=>setCredits(String(claims.claimable))}>Max</Button></div></label>
    <label className="grid gap-1.5"><span className="text-[12.5px] font-medium text-muted-foreground">Pay to</span><Select value={to} onValueChange={setTo}><SelectTrigger className="h-10 font-mono text-[12px]"><SelectValue/></SelectTrigger><SelectContent>{claims.wallets.map(a=><SelectItem key={a} value={a} className="font-mono text-[12px]">{short(a)}</SelectItem>)}</SelectContent></Select></label></div>
   <FieldError form={claim} field="credits"/><FieldError form={claim} field="address"/>
   <Button disabled={!!busy||!claims.claimable} onClick={async()=>{const ok=await claim.check({credits:n,address:to},{min:claims.min,max:claims.claimable});if(ok)await run('claim',async()=>{await api('/api/claims',{method:'POST',body:JSON.stringify(ok)});setCredits('');toast.success('Your claim is in the queue for the next payout epoch');});}}>
    <I id="check"/>Queue {n||0} credits ≈ {payout.toLocaleString('en-US',{maximumFractionDigits:4})} {sym}</Button>
   {why&&<p className="text-xs text-muted-foreground">{why}</p>}
   {!!claims.earnedFree&&<p className="text-xs text-muted-foreground">Free credits (starting grants, tier allotments) paid for {claims.earnedFree} of the credits you earned. Those can be spent in the studio. A claim takes only earnings that were paid with bought credits.</p>}
   <p className="text-xs text-muted-foreground">Claims in the queue are collected into one payout epoch. After the Harvex multisig has put the root of that epoch on-chain, you claim on this page and pay the gas from your wallet.</p>
  </>}
  {!!claims?.proofs.length&&cfg&&<div className="grid gap-2 border-t pt-3">{claims.proofs.map(p=>{const left=BigInt(p.cumulative)-BigInt(p.claimedOnchain??'0');return <div key={p.address} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-t-mint p-3 text-[13px]">
   <span>{left>0n?<><b>{whole(left,dec)} {sym}</b> ready for</>:<><b>{whole(BigInt(p.cumulative),dec)} {sym}</b> claimed to</>} <span className="font-mono">{short(p.address)}</span></span>
   <Button size="sm" disabled={left<=0n||!provider||!!busy} onClick={()=>run('onchain',async()=>{const h=await claimOnchain(provider!.provider,cfg,p);toast.success('Claim sent',{description:short(h)});})}>{busy==='onchain'?'Check your wallet…':left>0n?'Claim on-chain':'Claimed'}</Button></div>;})}
   {!provider&&claims.proofs.some(p=>BigInt(p.cumulative)>BigInt(p.claimedOnchain??'0'))&&<p className="text-xs text-muted-foreground">To claim, open this page where your wallet is: a browser with the extension, or the browser inside the wallet app.</p>}</div>}
  {!!claims?.requests.length&&<ul className="grid gap-1.5 border-t pt-3">{claims.requests.slice(0,5).map(r=><li key={r.id} className="flex items-center justify-between gap-2 text-[12.5px]"><span>{r.credits} credits → <span className="font-mono">{short(r.address)}</span></span><StatusBadge kind={r.status==='published'?'live':'pending'}>{r.status==='queued'?'Queued':r.status==='in_root'?'In epoch':paidOut(r.address)?'Paid out':'Ready to claim'}</StatusBadge></li>)}</ul>}
 </Card>;
}
