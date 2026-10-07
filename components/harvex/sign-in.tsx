'use client';
/* Connect-wallet picker (account Modal and /login). Wallet is the only sign-in: any EIP-1193 wallet signs a
   Sign-In with Ethereum message for BNB Smart Chain. Compact tile grid instead of a long list:
   - wallets found in the browser (EIP-6963) connect directly and are marked with a dot;
   - well-known wallets that are not installed open their app (phones: in-app dApp browser deep link) or
     their download page (desktop). Installed wallets come first.
   More than eight tiles collapse behind a "+N" tile so the dialog stays short. */
import {useEffect,useMemo,useState} from 'react';
import {Chain} from '@/components/harvex/web3';
import {toast} from 'sonner';
import {I} from '@/app/ui';
import {cn} from '@/lib/utils';
import {discoverWallets,isMobileBrowser,signInWithWallet,type WalletInfo} from '@/lib/auth-client';

/** `logo`: the wallet's own published icon in public/wallets (vendor sources: public/licenses/wallet-logos.txt).
    `plain`: the icon has no background of its own, so it sits on a white tile. */
type Known={key:string;name:string;match:RegExp;logo:string;plain?:boolean;install:string;open?:(url:string)=>string};
const logo=(k:Known)=>`/wallets/${k.logo}`;
const enc=encodeURIComponent;
/** Links are the wallets' own documented download pages and dApp-browser deep links. */
const KNOWN:Known[]=[
 {key:'metamask',name:'MetaMask',match:/metamask|io\.metamask/i,logo:'metamask.svg',install:'https://metamask.io/download/',open:u=>`https://metamask.app.link/dapp/${u.replace(/^https?:\/\//,'')}`},
 {key:'coinbase',name:'Coinbase',match:/coinbase/i,logo:'coinbase.svg',install:'https://www.coinbase.com/wallet/downloads',open:u=>`https://go.cb-w.com/dapp?cb_url=${enc(u)}`},
 {key:'trust',name:'Trust',match:/trust/i,logo:'trust.svg',plain:true,install:'https://trustwallet.com/download',open:u=>`https://link.trustwallet.com/open_url?coin_id=20000714&url=${enc(u)}`},
 {key:'rabby',name:'Rabby',match:/rabby/i,logo:'rabby.png',install:'https://rabby.io/'},
 {key:'okx',name:'OKX',match:/okx|okex/i,logo:'okx.png',install:'https://www.okx.com/web3',open:u=>`okx://wallet/dapp/url?dappUrl=${enc(u)}`},
];
type Tile={id:string;name:string;icon?:string;fallback?:string;plain?:boolean;detected?:WalletInfo;known?:Known};
const LIMIT=8;

export function SignIn({onWalletDone}:{onWalletDone:()=>void}){
 const [wallets,setWallets]=useState<WalletInfo[]|null>(null);const [busy,setBusy]=useState('');const [mobile,setMobile]=useState(false);
 const [more,setMore]=useState(false);
 useEffect(()=>{setMobile(isMobileBrowser());const stop=discoverWallets(setWallets);const t=setTimeout(()=>setWallets(w=>w??[]),600);return()=>{stop();clearTimeout(t);};},[]);

 const tiles=useMemo(()=>{
  const found=wallets||[];const used=new Set<string>();
  const detected:Tile[]=found.map(w=>{const k=KNOWN.find(x=>x.match.test(w.name)||x.match.test(w.rdns||''));if(k)used.add(k.key);
   return {id:w.id,name:w.name.replace(/\s*wallet$/i,'')||w.name,icon:w.icon||(k&&logo(k)),fallback:k&&logo(k),detected:w,known:k};});
  const rest:Tile[]=KNOWN.filter(k=>!used.has(k.key)).map(k=>({id:k.key,name:k.name,icon:logo(k),plain:k.plain,known:k}));
  // installed wallets first, then the others
  return [...detected,...rest];
 },[wallets]);
 const shown=more||tiles.length<=LIMIT?tiles:tiles.slice(0,LIMIT-1);const hidden=tiles.length-shown.length;

 async function connect(w:WalletInfo){
  setBusy(w.id);
  try{await signInWithWallet(w.provider);onWalletDone();}
  catch(e:any){toast.error(e?.code===4001?'The request was cancelled in your wallet.':(e?.message||'Signing in with the wallet did not work.'));}
  finally{setBusy('');}
 }
 function pick(t:Tile){
  if(busy)return;
  if(t.detected){connect(t.detected);return;}
  const k=t.known!;const url=location.href.split('#')[0];
  window.open(mobile&&k.open?k.open(url):k.install,'_blank','noopener,noreferrer');
 }

 return <div className="grid gap-3">
  {wallets===null?<div className="grid grid-cols-4 gap-2">{Array.from({length:4},(_,k)=><div key={k} className="h-[74px] animate-pulse rounded-xl bg-secondary"/>)}</div>
  :<div className="grid grid-cols-4 gap-2 max-[360px]:grid-cols-3" role="list" aria-label="Wallets">
   {shown.map(t=>{const hint=t.detected?'Connect':mobile&&t.known?.open?'Open app':'Get';
    return <button key={t.id} role="listitem" onClick={()=>pick(t)} disabled={!!busy&&busy!==t.id} title={`${t.name} · ${hint}`}
     className={cn('group relative grid h-[74px] min-w-0 content-center justify-items-center gap-1.5 rounded-xl border bg-card px-1 transition-[border-color,transform,opacity] duration-200 hover:-translate-y-px hover:border-foreground/30 disabled:opacity-50',
      busy===t.id&&'border-lime')}>
     <WalletLogo src={t.icon} fallback={t.fallback} plain={t.plain&&!t.detected}/>
     <span className="max-w-full truncate text-[11.5px] font-medium">{busy===t.id?'Sign…':t.name}</span>
     {t.detected&&<i className="absolute top-1.5 right-1.5 size-1.5 rounded-full shape-round bg-lime ring-2 ring-card" aria-label="installed"/>}
     {!t.detected&&<span className="absolute top-1 right-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 [&_svg]:size-3"><I id="arrow"/></span>}
     {busy===t.id&&<span className="absolute inset-x-3 bottom-1.5 h-0.5 overflow-hidden rounded-full shape-round bg-secondary"><i className="block h-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-lime"/></span>}
    </button>;})}
   {hidden>0&&<button onClick={()=>setMore(true)} className="grid h-[74px] content-center justify-items-center gap-1.5 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
    <span className="font-display text-lg font-semibold">+{hidden}</span><span className="text-[11.5px]">More</span></button>}
  </div>}


  <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><i className="mt-1.5 size-1.5 shrink-0 rounded-full shape-round bg-lime"/>
   <span>{wallets?.length?'A dot marks a wallet that is installed and connects at once. ':mobile?'This browser has no wallet. Tap one and Harvex opens inside its app. ':'No wallet extension was detected. Choose one and install it. '}
   Signing in means signing a message for <b className="text-foreground"><Chain/></b>, which costs nothing. It is not a transaction, and your recovery phrase is never asked for.</span></p>
 </div>;
}

/** Wallet logo: the wallet's own image; if it is missing or fails to load, the known logo, then a neutral wallet glyph. */
function WalletLogo({src,fallback,plain}:{src?:string;fallback?:string;plain?:boolean}){
 const [url,setUrl]=useState(src);useEffect(()=>setUrl(src),[src]);
 if(!url)return <span className="grid size-8 place-items-center rounded-md bg-secondary text-muted-foreground [&_svg]:size-4"><I id="wallet"/></span>;
 return <img src={url} alt="" width={32} height={32} decoding="async" className={cn('size-8 rounded-md object-contain',plain&&'bg-white p-1')} onError={()=>setUrl(u=>u!==fallback&&fallback?fallback:undefined)}/>;
}
