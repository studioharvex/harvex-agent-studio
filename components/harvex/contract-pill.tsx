'use client';
/* "CA" pill with a copy button (ZATS pattern). The address comes from the server (HARVEX_TOKEN_ADDRESS, mainnet only,
   see components/harvex/token-context.tsx): until a real contract exists it says "Not deployed yet" and the copy button
   is disabled, so nothing fake can be copied. With a contract the short address links to the explorer and Copy copies
   the full address. A testnet build shows no address and makes no claim about the real token. */
import {useState} from 'react';
import {toast} from 'sonner';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@/components/ui/tooltip';
import {copyText} from '@/app/ui';
import {shortAddress} from '@/lib/token';
import {useHarvexToken,useTokenStage} from './token-context';
import {cn} from '@/lib/utils';

export function ContractPill({className}:{className?:string}){
 const [done,setDone]=useState(false);const c=useHarvexToken();const test=useTokenStage()==='test';
 const copy=()=>{if(!c)return;copyText(c.address,m=>{toast.success(m);setDone(true);setTimeout(()=>setDone(false),1600);},toast.error);};
 const pill=<div className={cn('inline-flex h-11 max-w-full items-center gap-3 rounded-lg bg-secondary py-1 pr-1 pl-4 font-mono text-[12.5px]',className)}>
  <span className="font-semibold tracking-[.06em] text-muted-foreground">CA</span>
  {c?<a href={c.explorer} target="_blank" rel="noreferrer noopener" title={`${c.address} · open on the BNB Smart Chain explorer`} className="min-w-0 flex-1 truncate tracking-[.02em] text-foreground underline-offset-4 hover:underline">{shortAddress(c.address)}</a>
   :<span className="min-w-0 flex-1 truncate tracking-[.02em] text-muted-foreground">{test?'Testnet build':'Not deployed yet'}</span>}
  <button type="button" onClick={copy} disabled={!c} aria-label={c?'Copy contract address':test?'No contract address on a testnet build':'No contract to copy yet'}
   className="h-9 shrink-0 rounded-lg bg-foreground px-4 text-[11.5px] font-semibold tracking-[.08em] text-background uppercase transition-colors duration-300 hover:bg-foreground/85 disabled:cursor-not-allowed disabled:bg-foreground/25">{done?'Copied':'Copy'}</button>
 </div>;
 if(c)return pill;
 return <TooltipProvider delayDuration={150}><Tooltip><TooltipTrigger asChild><span className={cn('inline-flex max-w-full',className?.includes('w-full')&&'w-full sm:w-auto')} tabIndex={0}>{pill}</span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[240px] text-center">{test?'This build runs on BNB Smart Chain Testnet, so it shows no contract address. The HARVEX address is published only on the main site.':'No HARVEX contract exists yet. Any address shared as “HARVEX” today is not ours.'}</TooltipContent></Tooltip></TooltipProvider>;
}
