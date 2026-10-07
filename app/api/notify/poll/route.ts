/* The Telegram reader (Authorization: Bearer SCHEDULER_TOKEN). The Docker entrypoint keeps calling it: each call holds
   a long poll on the bot's messages for up to 20 seconds, links chats that sent a one-time code and lets agents answer
   the questions that came in (lib/notify.ts pollTelegram). While nothing needs reading (no chat with an agent, no link
   waiting) it answers {idle:true} at once and the entrypoint asks again half a minute later. A call that reads marks the
   reader as alive, so the page and the scheduler tick leave the reading to it. */
import {env} from 'cloudflare:workers';
import {failure,HttpError} from '@/lib/server';
import {tickAllowed} from '@/lib/schedules';
import {chatActive,markReader,notifyConfig,pollTelegram,telegramWaiting} from '@/lib/notify';

export async function POST(request:Request){try{
 if(!tickAllowed(request))throw new HttpError(401,'Scheduler token required.');
 const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw new HttpError(503,'Storage is unavailable.');
 if(!notifyConfig().telegram)return Response.json({idle:true});
 if(!(await chatActive(db)||await telegramWaiting(db)))return Response.json({idle:true});
 await markReader(db);
 return Response.json(await pollTelegram(db,{wait:20}));
}catch(e){return failure(e)}}
