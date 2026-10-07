/* Report only on change (drizzle/0032; lib/schedules.ts runDue). A schedule of the wallet monitor or of whale watch
   can be set to stay quiet until something changed. At each slot the server then first looks, without any AI:
   - wallet monitor: reads the address (lib/monitor.ts readWallet) and compares the BNB balance, the number of
     transactions sent and the balances of the tokens this server knows with what the last report saw;
   - whale watch: reads the server's own record of the HARVEX token (the holder recorder's tables, no chain call) for a
     transaction that moved at least `watch_min` HARVEX since the last check, or an address that is new among the ten
     biggest holders.
   Nothing changed: nothing runs, nothing is charged, nothing is sent; the schedule shows when it last looked. Something
   changed: the schedule runs as usual (paid, in History, delivered to its channel), and the report says what set it
   off. The first slot always reports, so there is something to compare with.
   What it is not: an alarm in real time. It looks at the schedule's slots (at most once an hour), the token record
   follows the chain a few minutes behind, and a change that came and went between two slots can be missed (a balance
   that went up and back down). The texts say "at the next check", never "instantly". */
import {chainConfig,rewardConfig} from './chain';
import {HttpError} from './server';
import {monitorTarget,readWallet,amount} from './monitor';
import {settleTransfers,asMove,moveLine,topHolders,when,short,OFF,type TransferRow} from './whales';

import {watchMin} from './watch-options';
export {WATCH_SKILLS,WATCH_MIN_DEFAULT,WATCH_MIN_OPTIONS,canWatch,watchMin} from './watch-options';
const MAX_ROWS=5000;

export type Watch={/** something changed since the mark (always true at the first check) */changed:boolean;first:boolean;
 /** what this check saw: stored on the schedule, compared at the next check */mark:string;
 /** what set the report off: facts for the AI after the task, and a note under the answer */extra:{facts:string;note:string}|null};

/** Looks whether what the schedule's skill reads has changed since `mark`. Throws 400 when there is nothing to read
    (no address), 503 when the chain or the token record cannot be read right now. Charges nothing, runs no AI. */
export async function watchCheck(db:D1Database,s:{owner:string;skill:string;prompt:string;watch_mark?:string|null;watch_min?:number|null}):Promise<Watch>{
 return s.skill==='whales'?watchToken(db,s.watch_mark??null,watchMin(s.watch_min)):watchWallet(db,s.owner,s.prompt,s.watch_mark??null);
}

async function watchWallet(db:D1Database,owner:string,prompt:string,before:string|null):Promise<Watch>{
 const r=await readWallet(db,owner,await monitorTarget(db,owner,prompt));
 // the address is part of the mark: a task pointed at another wallet starts over
 const mark=JSON.stringify({a:r.address.toLowerCase(),c:r.chainId,eth:r.stored.eth,n:r.stored.nonce,t:Object.fromEntries(Object.entries(r.stored.tokens).sort(([x],[y])=>x<y?-1:1).map(([k,v])=>[k,v.v]))});
 const first=!before,changed=first||mark!==before;
 return {changed,first,mark,extra:changed&&!first?{
  facts:'WHY THIS REPORT WAS SENT: this schedule reports only on change, and at this check a balance or the number of transactions sent by the address differed from the last report. Lead with what changed.',
  note:'_This schedule reports only on change: a balance or the number of transactions sent differed from its last report._'}:null};
}

async function watchToken(db:D1Database,before:string|null,min:number):Promise<Watch>{
 const c=chainConfig();const token=c.harvex?.toLowerCase();
 const sync=token?await db.prepare('SELECT last_block,last_ts FROM holder_sync WHERE token=?').bind(token).first<{last_block:number;last_ts:number}>():null;
 if(!token||!sync)throw new HttpError(503,'The HARVEX token record is not available on this server right now.');
 const top=(await topHolders(db,token)).map(h=>h.address.toLowerCase());
 const mark=JSON.stringify({b:sync.last_block,top});
 let prev:{b:number;top:string[]}|null=null;try{const p=before?JSON.parse(before):null;prev=p&&typeof p.b==='number'&&Array.isArray(p.top)?p:null;}catch{prev=null;}
 if(!prev)return {changed:true,first:true,mark,extra:null};
 const rows=(await db.prepare('SELECT tx_hash,from_addr,to_addr,value,ts,block,log_index FROM holder_transfers WHERE token=? AND block>? ORDER BY block DESC,log_index DESC LIMIT ?').bind(token,prev.b,MAX_ROWS).all<TransferRow>()).results;
 const off=new Set(rewardConfig(c).exclude.map(a=>a.toLowerCase()));const floor=BigInt(min)*10n**18n;
 const big=settleTransfers(rows).list.filter(t=>t.moved>=floor).sort((x,y)=>x.moved===y.moved?y.ts-x.ts:x.moved>y.moved?-1:1);
 const entered=top.filter(a=>!prev!.top.includes(a));
 if(!big.length&&!entered.length)return {changed:false,first:false,mark,extra:null};
 const least=`${amount(floor,18)} HARVEX`;const shown=big.slice(0,6).map(t=>asMove(t,off));
 const moved=big.length?`${big.length} transaction${big.length===1?'':'s'} moved at least ${least} since block ${prev.b.toLocaleString('en-US')}${big.length>shown.length?` (the ${shown.length} biggest are listed)`:''}:`:'';
 const fresh=entered.length?`New among the 10 biggest holders since the last report: ${entered.map(a=>short(a)+(off.has(a)?OFF:'')).join(', ')}`:'';
 return {changed:true,first:false,mark,extra:{
  facts:['WHY THIS REPORT WAS SENT: this schedule reports only on change. Lead with this, then the rest of the reading.',...(moved?[moved,...shown.map(m=>`- ${when(m.ts)} · ${moveLine(m)}`)]:[]),...(fresh?[fresh]:[]),
   'A transfer is not a buy or a sell, and an address is not a person: the record says neither.'].join('\n'),
  note:['**What set this report off** (this schedule reports only on change)','',...(moved?[moved,'',...shown.map(m=>`- ${when(m.ts)} · ${moveLine(m)} · [tx](${c.explorer}/tx/${m.tx})`)]:[]),...(fresh?[...(moved?['']:[]),fresh]:[])].join('\n')}};
}
