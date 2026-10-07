'use client';
/* Who can get the holder reward, said once and in one place (user, 7 Oct 2026: "add a highlighted note on who is
   eligible for the NVDA reward"). Drawn on the home page's holder band and on the Rewards page. The four conditions
   are the server's own rules (lib/rewards.ts: complete units, the Transfer history, BLOCKED_COUNTRIES and the
   self-certification, REWARD_EXCLUDE), so change them there first. The line at the foot says what is true for the
   state the server reports: it must never read as "paying" while nothing is. */
import {I} from '@/app/ui';
import {cn} from '@/lib/utils';
import {REWARD_PLAN} from '@/lib/site';
import {Slab} from './motion';
import {Token} from './web3';
import {useTokenStage,type TokenStage} from './token-context';

const STATE:Record<TokenStage,[string,string]>={
 test:['Testnet','This is a testnet build. Nothing real is paid from here.'],
 none:['A plan','A plan, not a running program: HARVEX has not launched, no reward vault exists and nothing has been paid.'],
 token:['Not switched on','HARVEX exists, the holder reward is off and nothing has been paid.'],
 rewards:['Running','The holder reward is on. The Rewards page lists every hour that was settled.'],
};

export function RewardEligibility({per=3_000_000,rate='0.01',sym=REWARD_PLAN.symbol,className}:{per?:number;rate?:string;sym?:string;className?:string}){
 const stage=useTokenStage();const [chip,status]=STATE[stage];const n=per.toLocaleString('en-US');
 const rows:[string,string,string][]=[
  ['wallet',`${n} HARVEX or more`,`In a wallet of your own. Every complete ${n} is one unit at $${rate} an hour, and ${(per-1).toLocaleString('en-US')} earns nothing.`],
  ['clock','Held, hour by hour','No staking and no lock-up. HARVEX counts for the seconds it is in the wallet, and never in two wallets at once.'],
  ['shield','Allowed where you live','Before a first claim you name your country and confirm you are not a US person. Residents of the US, Canada, the UK, Switzerland and sanctioned countries cannot claim.'],
  ['users','Not a project wallet','Team, treasury and liquidity wallets earn nothing.'],
 ];
 return <Slab className={cn('text-left',className)} body="p-2 sm:p-2.5"
  tab={<>Eligibility<span aria-hidden="true" className="size-1 rounded-full bg-ink/40 shape-round"/>{sym} reward<span aria-hidden="true" className="size-1 rounded-full bg-ink/40 shape-round max-sm:hidden"/><span className="max-sm:hidden">{chip}</span></>}>
  <div className="grid gap-5 rounded-[20px] bg-card p-[clamp(16px,2.4vw,28px)] text-foreground shadow-[0_18px_36px_-26px_rgb(0_0_0/.55)]">
   <h3 className="max-w-[32ch] font-display text-[clamp(24px,3vw,38px)] leading-[1.2] font-medium tracking-[-.03em] text-balance">The {sym} reward starts at <mark className="rounded-md bg-lime px-1.5 whitespace-nowrap text-ink">{n} <Token symbol="HARVEX"/></mark> in your own wallet.</h3>
   <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
    {rows.map(([icon,title,text])=><li key={title} className="flex items-start gap-3">
     <span className="grid size-8 shrink-0 place-items-center rounded-md bg-lime text-ink [&_svg]:size-4"><I id={icon}/></span>
     <span className="grid gap-0.5"><b className="text-[14.5px] font-semibold">{title}</b><span className="text-[13px] leading-relaxed text-muted-foreground">{text}</span></span>
    </li>)}
   </ul>
   <p className="border-t pt-4 text-[12.5px] leading-relaxed text-muted-foreground"><b className="font-semibold text-foreground">{status}</b> {sym===REWARD_PLAN.symbol?`${sym} here means ${REWARD_PLAN.what} from a third-party issuer; which issuer's token has not been set, and Harvex is not affiliated with Nvidia or any issuer. `:''}Being eligible is a condition for the reward and promises no payment. No audit of the contract has been done and no legal review has been published.</p>
  </div>
 </Slab>;
}
