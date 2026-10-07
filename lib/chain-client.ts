'use client';
/* Browser side of the BNB Smart Chain features. Every transaction is built here and signed in the
   user's own wallet after its confirmation prompt; the server only reads the chain afterwards. */
import {encodeFunctionData,getAddress,parseAbi,parseUnits,toHex} from 'viem';
import {createSiweMessage} from 'viem/siwe';
import {api} from '@/app/ui';
import type {WalletInfo} from './auth-client';

export type ChainTier={id:string;name:string;min:string;feePermille:number;credits:number;slots:number};
export type ChainInfo={network:'testnet'|'mainnet';chainId:number;name:string;rpc:string;explorer:string;token:{address:string;symbol:string;decimals:number}|null;
 treasury:string|null;creditsPerToken:number;confirmations:number;finality:'soft'|'safe'|'finalized';topupEnabled:boolean;claimsEnabled:boolean;claimsContract:string|null;claimMin:number;
 harvexToken:string|null;tiersLive:boolean;tierBase:number;tiers:ChainTier[];
 rewards?:{live:boolean;token:{address:string;symbol:string;decimals:number}|null;contract:string|null;harvexPerUnit:string;usdPerUnitHour:string;priceSource:'chainlink'|'manual';priceFeed:string|null;periodHours:number;nextClose:number}};
type Eip1193=WalletInfo['provider'];

export const fetchChain=():Promise<ChainInfo>=>api('/api/chain');
export const explorerTx=(c:ChainInfo,h:string)=>`${c.explorer}/tx/${h}`;
export const explorerAddr=(c:ChainInfo,a:string)=>`${c.explorer}/address/${a}`;

async function account(p:Eip1193){const a:string[]=await p.request({method:'eth_requestAccounts'});if(!a?.[0])throw new Error('No account was shared by the wallet.');return getAddress(a[0]);}

/** Switches the wallet to BNB Smart Chain, adding the network first if the wallet does not know it. */
export async function ensureChain(p:Eip1193,c:ChainInfo){
 const id=toHex(c.chainId);
 if(parseInt(await p.request({method:'eth_chainId'}),16)===c.chainId)return;
 try{await p.request({method:'wallet_switchEthereumChain',params:[{chainId:id}]});}
 catch(e:any){if(e?.code!==4902&&e?.data?.originalError?.code!==4902)throw e;
  await p.request({method:'wallet_addEthereumChain',params:[{chainId:id,chainName:c.name,nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},rpcUrls:[c.rpc],blockExplorerUrls:[c.explorer]}]});}
}

/** Links another wallet to the signed-in account: sign a SIWE message for BNB Smart Chain (free, no transaction). */
export async function linkWallet(p:Eip1193,c:ChainInfo){
 const address=await account(p);const {nonce}=await api('/api/wallet',{method:'POST',body:JSON.stringify({action:'nonce'})});
 const message=createSiweMessage({address,chainId:c.chainId,domain:location.host,uri:location.origin,version:'1',nonce,
  statement:'Link this wallet to my Harvex account. This is free and does not send a transaction.',issuedAt:new Date(),expirationTime:new Date(Date.now()+10*60e3)});
 const signature:string=await p.request({method:'personal_sign',params:[toHex(message),address]});
 return api('/api/wallet',{method:'POST',body:JSON.stringify({message,signature})});
}

/** Sends `amount` PAY tokens to the treasury from the connected wallet. Returns the transaction hash. */
export async function payTopup(p:Eip1193,c:ChainInfo,amount:string){
 if(!c.token||!c.treasury)throw new Error('Top-ups are not switched on yet.');
 const from=await account(p);await ensureChain(p,c);
 const data=encodeFunctionData({abi:parseAbi(['function transfer(address to, uint256 value) returns (bool)']),functionName:'transfer',args:[getAddress(c.treasury),parseUnits(amount,c.token.decimals)]});
 return await p.request({method:'eth_sendTransaction',params:[{from,to:c.token.address,data}]}) as string;
}

/** Asks the server to credit a top-up. With the default "safe" finality this waits until the validators have
    justified the block (usually a few seconds); polling stops after 20 minutes. */
export async function confirmTopup(txHash:string,onWait?:(n:number,need:number,stage?:string)=>void){
 for(let i=0;i<240;i++){const r=await api('/api/topups',{method:'POST',body:JSON.stringify({txHash})});if(r.status==='credited')return r as {credits:number;already?:boolean};
  onWait?.(r.confirmations??0,r.needed??0,r.stage);await new Promise(res=>setTimeout(res,5000));}
 throw new Error('Still settling on BNB Smart Chain. Nothing else to do: the credits arrive on their own (the Wallet page shows it as settling).');
}

/** Claims earnings on-chain from HarvexClaims with the server-provided proof. The wallet pays gas. */
export async function claimOnchain(p:Eip1193,c:ChainInfo,claim:{address:string;cumulative:string;proof:string[]},contract=c.claimsContract){
 if(!contract)throw new Error('The claims contract is not deployed yet.');
 const from=await account(p);await ensureChain(p,c);
 const data=encodeFunctionData({abi:parseAbi(['function claim(address account, uint256 cumulativeAmount, bytes32[] proof)']),functionName:'claim',args:[getAddress(claim.address),BigInt(claim.cumulative),claim.proof as `0x${string}`[]]});
 return await p.request({method:'eth_sendTransaction',params:[{from,to:contract,data}]}) as string;
}
