/* Scheduler heartbeat (Authorization: Bearer SCHEDULER_TOKEN). The Docker entrypoint calls it every minute; on other
   hosts point any cron at it. Order matters: the money steps (stuck runs, top-up settlement, holder recorder, reward
   periods) are short and run first; scheduled AI runs can take minutes and run last, so a slow or failing AI provider
   can never delay a top-up or a reward period. Every step is isolated: one failing step does not skip the others.
   SCHEDULER_TEST_CLOCK=true (local .dev.vars only; the Docker entrypoint never passes it) lets tests send {at: ISO time}. */
import {env} from 'cloudflare:workers';
import {failure,HttpError,safeMessage} from '@/lib/server';
import {runDue,tickAllowed} from '@/lib/schedules';
import {periodBounds,rewardConfig} from '@/lib/chain';
import {autoRewards,scanFundings,syncHolders} from '@/lib/rewards';
import {sweepStuckRuns} from '@/lib/runs';
import {settlePendingTopups} from '@/lib/topups';
import {chatActive,pollTelegram,readerFresh,telegramWaiting} from '@/lib/notify';

/** Rows that only pile up: expired sign-in nonces and sessions, used link nonces, old daily counters. */
async function housekeeping(db:D1Database,now:Date){
 const ms=now.getTime();const day=new Date(ms-3*864e5).toISOString().slice(0,10);
 await db.batch([
  db.prepare('DELETE FROM ba_verification WHERE expires_at<?').bind(ms),
  db.prepare('DELETE FROM ba_session WHERE expires_at<?').bind(ms),
  db.prepare('DELETE FROM chain_nonces WHERE expires<?').bind(ms),
  db.prepare('DELETE FROM notify_links WHERE expires<?').bind(ms),
  db.prepare('DELETE FROM tg_updates WHERE at<?').bind(ms-2*864e5),
  db.prepare("DELETE FROM ai_quotas WHERE (key LIKE 'u:%' OR key LIKE 'all:%' OR key LIKE 'free:%' OR key LIKE 't:%' OR key LIKE 'search:%') AND substr(key,-10)<?").bind(day),
  db.prepare("DELETE FROM ai_quotas WHERE key LIKE 'h:%' AND CAST(substr(key,-13) AS INTEGER)<?").bind(ms-3*864e5),
 ]);
}

export async function POST(request:Request){try{
 if(!tickAllowed(request))throw new HttpError(401,'Scheduler token required.');
 const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw new HttpError(503,'Storage is unavailable.');
 const b=await request.json().catch(()=>({})) as {at?:string};
 const testClock=(env as unknown as {SCHEDULER_TEST_CLOCK?:string}).SCHEDULER_TEST_CLOCK==='true'&&typeof b.at==='string'&&!Number.isNaN(Date.parse(b.at));
 const now=testClock?new Date(b.at!):new Date();const fail=(e:unknown)=>({error:safeMessage(e)});
 // runs cut off by a timeout or restart are failed and refunded before new ones start
 const stuck=await sweepStuckRuns(db).catch(()=>0);
 // top-ups whose block became safe while the buyer was away
 const topups=await settlePendingTopups(db).catch(fail);
 let holders:unknown=null;const rc=rewardConfig();
 if(rc.live&&rc.harvex){
  // hourly periods: keep the recorder within a couple of minutes, and at once when it has not reached the last close
  const s=await db.prepare('SELECT updated,last_ts FROM holder_sync WHERE token=?').bind(rc.harvex.toLowerCase()).first<{updated:string;last_ts:number}>();
  const behind=!s||s.last_ts<periodBounds(rc.periodHours).lastClose;
  if(!s||Date.now()-Date.parse(s.updated)>(behind?45e3:120e3))holders=await syncHolders(db,{maxBlocks:50_000}).catch(fail);
 }
 const rewards=await autoRewards(db,now).catch(fail);
 // refills of the reward vault are read from the chain (shown on the rewards page; nothing depends on them)
 if(rc.live)await scanFundings(db).catch(()=>null);
 if(new Date().getUTCMinutes()%10===3)await housekeeping(db,new Date()).catch(()=>null);
 // someone is connecting a Telegram chat, or an agent answers in one: read the bot's messages here when no reader
 // does it (the container runs one, POST /api/notify/poll; other hosts get an answer within a minute this way)
 if(!await readerFresh(db).catch(()=>false)&&(await telegramWaiting(db).catch(()=>false)||await chatActive(db).catch(()=>false)))await pollTelegram(db).catch(()=>null);
 const schedules=await runDue(db,testClock?{now}:{}).catch(fail);
 return Response.json({schedules,stuck,holders,rewards,topups});
}catch(e){return failure(e)}}
