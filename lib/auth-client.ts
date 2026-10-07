'use client';
/* Wallet sign-in (the only sign-in). Discovers browser wallets with EIP-6963 (MetaMask, Trust, Rabby, OKX,
   Coinbase, ...), falls back to window.ethereum, offers to add/switch to BNB Smart
   Chain, then signs a Sign-In with Ethereum message for that chain. Signing is free and sends no transaction.
   Talks to Better Auth's SIWE endpoints with plain fetch (no auth client library in the bundle). */
import {getAddress,stringToHex} from 'viem';
import {createSiweMessage} from 'viem/siwe';

type Eip1193={request:(a:{method:string;params?:unknown[]})=>Promise<any>};
export type WalletInfo={id:string;name:string;icon?:string;rdns?:string;provider:Eip1193};
type ChainLite={chainId:number;name:string;rpc:string;explorer:string};

/** Lists installed browser wallets (EIP-6963), in the order they announce themselves. */
export function discoverWallets(onChange:(w:WalletInfo[])=>void){
 const found=new Map<string,WalletInfo>();
 const emit=()=>onChange([...found.values()]);
 const onAnnounce=(e:Event)=>{const d=(e as CustomEvent).detail;if(!d?.info||!d?.provider)return;
  found.set(d.info.uuid,{id:d.info.uuid,name:d.info.name,icon:d.info.icon,rdns:d.info.rdns,provider:d.provider});emit();};
 window.addEventListener('eip6963:announceProvider',onAnnounce);
 window.dispatchEvent(new Event('eip6963:requestProvider'));
 const t=setTimeout(()=>{const eth=(window as any).ethereum as Eip1193|undefined;
  if(!found.size&&eth){found.set('injected',{id:'injected',name:'Browser wallet',provider:eth});emit();}},400);
 return()=>{window.removeEventListener('eip6963:announceProvider',onAnnounce);clearTimeout(t);};
}

async function chain():Promise<ChainLite>{
 const c=await fetch('/api/chain').then(r=>r.json()).catch(()=>null) as ChainLite|null;
 if(!c?.chainId)throw new Error('Could not reach Harvex. Check your connection and try again.');
 return c;
}

/** Adds BNB Smart Chain to the wallet if needed and switches to it. Best effort: sign-in still works if the
    user declines, because the message itself names the chain. */
async function useAppChain(p:Eip1193,c:ChainLite){
 const id='0x'+c.chainId.toString(16);
 try{if(parseInt(await p.request({method:'eth_chainId'}),16)===c.chainId)return;}catch{return;}
 try{await p.request({method:'wallet_switchEthereumChain',params:[{chainId:id}]});}
 catch(e:any){
  if(e?.code===4001)return;
  try{await p.request({method:'wallet_addEthereumChain',params:[{chainId:id,chainName:c.name,nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},rpcUrls:[c.rpc],blockExplorerUrls:[c.explorer]}]});}catch{/* keep going */}
 }
}

async function post(path:string,body:unknown):Promise<{message?:string;error?:string;nonce?:string}>{
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({})) as {message?:string;error?:string;nonce?:string};
 if(!r.ok)throw new Error(data?.message||data?.error||'Wallet sign-in failed. Try again.');
 return data;
}

/** Readable wallet error: which step failed and what the wallet said. User rejection (4001) stays short. */
function walletError(step:string,e:any):Error{
 if(e?.code===4001||/reject|denied|cancel/i.test(e?.message||''))return Object.assign(new Error('You cancelled the request in your wallet.'),{code:4001});
 const msg=e?.data?.message||e?.shortMessage||e?.message||'Unknown error';
 return new Error(`${step} failed: ${msg}${e?.code!==undefined?` (code ${e.code})`:''}`);
}

/** Connects, signs a SIWE message and creates the session. The message names BNB Smart Chain; some wallets
    (e.g. Phantom) refuse messages for chains they do not list, so a non-rejection failure retries once with an
    Ethereum (chain 1) message, which the server also accepts. No network switch is needed to sign in. */
export async function signInWithWallet(provider:Eip1193){
 let accounts:string[];
 try{accounts=await provider.request({method:'eth_requestAccounts'});}catch(e){throw walletError('Connecting the wallet',e);}
 if(!accounts?.[0])throw new Error('No account was shared by the wallet.');
 const address=getAddress(accounts[0]);
 const c=await chain();
 const sign=async(chainId:number,label:string)=>{
  const {nonce}=await post('/api/auth/siwe/nonce',{});
  if(!nonce)throw new Error('Could not start wallet sign-in. Try again.');
  const message=createSiweMessage({address,chainId,domain:location.host,uri:location.origin,version:'1',nonce,
   statement:`Sign in to Harvex Agent Studio (${label}). This is free and does not send a transaction.`,issuedAt:new Date(),expirationTime:new Date(Date.now()+10*60e3)});
  const signature:string=await provider.request({method:'personal_sign',params:[stringToHex(message),address]});
  return {message,signature};
 };
 let signed:{message:string;signature:string};
 try{signed=await sign(c.chainId,c.name);}
 catch(e:any){
  if(e?.code===4001||/reject|denied|cancel/i.test(e?.message||''))throw walletError('Signing',e);
  try{signed=await sign(1,'BNB Smart Chain account');}catch(e2){throw walletError('Signing the sign-in message',e2);}
 }
 await post('/api/auth/siwe/verify',signed);
 return address;
}

/** Adds/switches the wallet to BNB Smart Chain. Used before transactions, not for sign-in. */
export async function switchToAppChain(provider:Eip1193){await useAppChain(provider,await chain());}

/** True on phones/tablets, where browser extensions do not exist and a wallet's in-app browser is needed. */
export const isMobileBrowser=()=>typeof navigator!=='undefined'&&/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
