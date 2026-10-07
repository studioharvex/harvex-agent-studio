/* Operator endpoint for holder rewards (Authorization: Bearer CLAIMS_ADMIN_TOKEN). Never signs or sends a transaction.
   GET      : recorder cursor, latest periods, the reward-token price and the open-period estimate with the vault check
   sync     : holder recorder, reads new HARVEX Transfer logs up to the settled head (the scheduler does this every 2 min)
   rebuild  : recompute balances and earning starts from stored transfers (after changing REWARD_HARVEX_PER_UNIT)
   price    : with REWARD_PRICE_FEED (Chainlink, mainnet) the price is live; {fromFeed:true, confirm:true} accepts a feed
              move of 50% or more that paused the rewards. Without a feed: {price:"182.35", note?, confirm?} USD per
              whole token, 8 decimals max; a move of 50% or more needs confirm. No period is built with a price older than
              REWARD_PRICE_MAX_AGE_HOURS.
   fund     : {txHash, note?} record reward-token transfers into REWARD_CONTRACT (the vault), verified on-chain
   preview  : dry run of the open period: accrual per holder in USD and tokens, and whether the vault can pay it
   build    : {label?, end?} build the next period (refused while the vault cannot pay everything owed, and when the
              existing periods were built for another vault). The start is never chosen: no pay for the time before the
              program was switched on.
   discard  : {period} drop a built period that was not published
   publish  : {period, txHash?} after the multisig called setMerkleRoot(root) on the vault
   ack      : clear the alert raised when a root this server did not build was posted to the vault (check the vault first)
   What this token can NOT do: set a price while the feed is on, post an arbitrary root, publish a root that is not
   on-chain, record funding that did not happen, or move any token.
   With REWARD_AUTO (default) the scheduler builds each closed hour and publishes it once the root is on-chain. */
import {env} from 'cloudflare:workers';
import {failure,body,HttpError} from '@/lib/server';
import {adminAllowed} from '@/lib/chain';
import {ackRootAlert,adminStatus,buildPeriod,discardPeriod,previewPeriod,publishPeriod,rebuildHolders,recordFunding,setPrice,syncHolders} from '@/lib/rewards';

const db=()=>{const d=(env as unknown as {DB?:D1Database}).DB;if(!d)throw new HttpError(503,'Storage is unavailable.');return d;};

export async function GET(request:Request){try{
 if(!adminAllowed(request))throw new HttpError(401,'Admin token required.');
 const [sync,periods,status]=await Promise.all([db().prepare('SELECT token,last_block,last_ts,updated FROM holder_sync').all(),
  db().prepare('SELECT id,label,start_ts,end_ts,end_block,usd_total,price_e8,distributed,eligible,root,status,tx_hash,created FROM reward_periods ORDER BY id DESC LIMIT 20').all(),adminStatus(db())]);
 return Response.json({sync:sync.results,periods:periods.results,...status},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 if(!adminAllowed(request))throw new HttpError(401,'Admin token required.');
 const b=await body(request) as {action?:string;txHash?:string;note?:string;label?:string;end?:number;period?:number;price?:string|number;confirm?:boolean;fromFeed?:boolean};
 switch(b.action){
  case 'sync':return Response.json(await syncHolders(db()));
  case 'rebuild':return Response.json(await rebuildHolders(db()));
  case 'price':return Response.json(await setPrice(db(),{price:b.price,note:b.note,confirm:b.confirm===true,fromFeed:b.fromFeed===true}));
  case 'fund':return Response.json(await recordFunding(db(),String(b.txHash||''),b.note));
  case 'preview':return Response.json(await previewPeriod(db()));
  case 'build':return Response.json(await buildPeriod(db(),{label:typeof b.label==='string'?b.label:undefined,end:b.end===undefined?undefined:Number(b.end)}));
  case 'discard':return Response.json(await discardPeriod(db(),Number(b.period)));
  case 'publish':return Response.json(await publishPeriod(db(),Number(b.period),b.txHash));
  // after the vault was checked by hand: clears the alert raised when a root the server did not build was posted
  case 'ack':return Response.json(await ackRootAlert(db()));
 }
 throw new HttpError(400,'Use action sync, rebuild, price, fund, preview, build, discard, publish or ack.');
}catch(e){return failure(e)}}
