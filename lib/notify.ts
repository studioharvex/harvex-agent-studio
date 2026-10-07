/* Delivery: a schedule can send each finished run to a Discord channel or a Telegram chat of its owner (drizzle/0018).
   Discord: the owner pastes the webhook address of a channel (Server Settings → Integrations → Webhooks). Only
     discord.com webhook addresses are accepted, so the server never calls a host a user chose.
   Telegram: OFF until the operator sets TELEGRAM_BOT_TOKEN (a bot made with @BotFather). The owner opens the bot through
     a link that carries a one-time code and presses Start; the server reads the bot's updates (getUpdates, no public
     webhook needed) and ties that chat to the account. The bot must not have a webhook set elsewhere.
   What leaves the server: the report text, to Discord or Telegram, which are third parties. What never leaves it:
     an answer grounded with Google Search (Google's terms: only shown with its Search Suggestions, to the user who
     asked): for those the channel gets a notice with a link to History.
   Chat (drizzle/0019): the owner can let one of their agents answer in a linked Telegram chat. A private chat: any
     message; a group: /ask …. Each answer is a normal paid live run of that agent (guarded, without web search), with
     a daily limit per chat set by the owner and a short pause between questions. In the container a reader holds a
     long poll open (POST /api/notify/poll), so answers start within a second or two.
   Sending never fails a run and is never retried in a loop: a failed send is counted on the channel, a channel that is
   gone (webhook deleted, bot blocked) is marked and the page says so.
   Env (server only): TELEGRAM_BOT_TOKEN, NOTIFY_DISCORD (default true), NOTIFY_MAX (channels per account, default 4).
   NOTIFY_TEST_BASE (http://127.0.0.1:<port> only; local tests, never passed by the Docker entrypoint) sends both
   services to a local stand-in. */
import {env} from 'cloudflare:workers';
import {HttpError,safeMessage} from './server';
import {splitSearchWidget} from './grounding';
import {skillCatalog,type SkillId} from './agents';
import {performRun} from './runs';
import {TALK_SKILL,TALK_MESSAGE_MAX} from './talk';
import {limitsFor} from './tiers';

type Env={TELEGRAM_BOT_TOKEN?:string;NOTIFY_DISCORD?:string;NOTIFY_MAX?:string;NOTIFY_TEST_BASE?:string;APP_ORIGIN?:string};
const E=()=>env as unknown as Env;
const TOKEN=/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/;
const testBase=()=>{const b=E().NOTIFY_TEST_BASE||'';return /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(b)?b:'';};
const discordBase=()=>testBase()?`${testBase()}/discord`:'https://discord.com';
const telegramBase=()=>testBase()?`${testBase()}/telegram`:'https://api.telegram.org';
const botToken=()=>{const t=E().TELEGRAM_BOT_TOKEN||'';return TOKEN.test(t)?t:'';};
const origin=()=>(E().APP_ORIGIN||'').replace(/[/]+$/,'');

export function notifyConfig(){
 const max=Number(E().NOTIFY_MAX);
 return {discord:E().NOTIFY_DISCORD!=='false',telegram:!!botToken(),max:Number.isFinite(max)&&max>=1?Math.min(Math.round(max),20):4};
}

/** Channels this account may keep: NOTIFY_MAX, raised by its holder tier (lib/tiers.ts). */
export const channelLimit=async(db:D1Database,owner:string)=>(await limitsFor(db,owner,{schedules:0,dailyRuns:0,channels:notifyConfig().max})).channels;
export type Channel={id:string;kind:'discord'|'telegram';label:string;ok:boolean;lastSent:string|null;lastError:string|null;
 /** the agent that answers questions in this Telegram chat, and today's count. `skill` 'chat': it answers in its own
     voice (a conversation). `mine` false: an agent someone else published; `price` is then what its creator gets per
     message, as accepted when it was set up. `gone`: the agent is no longer there to answer. */
 chat:{agentId:string;skill:string;daily:number;used:number;name:string;mine:boolean;price:number;gone:boolean}|null};
type Row={id:string;owner:string;kind:string;target:string;label:string;fails:number;dead:number;last_error:string|null;last_sent:string|null;
 chat_agent:string|null;chat_skill:string|null;chat_daily:number;chat_day:string|null;chat_used:number;chat_price?:number|null;
 agent_name?:string|null;agent_owner?:string|null;agent_published?:number|null;agent_archived?:number|null};
/** A name from outside (webhook, chat) as shown on the page: no control or invisible formatting characters. */
const clean=(s:unknown,n=40)=>String(s??'').replace(/\p{C}/gu,'').trim().slice(0,n);

export async function channelsOf(db:D1Database,owner:string):Promise<Channel[]>{
 const rows=await db.prepare('SELECT c.id,c.kind,c.label,c.dead,c.last_error,c.last_sent,c.chat_agent,c.chat_skill,c.chat_daily,c.chat_day,c.chat_used,c.chat_price,a.name AS agent_name,a.owner AS agent_owner,a.published AS agent_published,a.archived AS agent_archived FROM notify_channels c LEFT JOIN agents a ON a.id=c.chat_agent WHERE c.owner=? ORDER BY c.created').bind(owner).all<Row>();
 const today=new Date().toISOString().slice(0,10);
 return rows.results.map(r=>({id:r.id,kind:r.kind as Channel['kind'],label:r.label,ok:!r.dead,lastSent:r.last_sent,lastError:r.last_error,
  chat:r.chat_agent&&r.chat_skill?{agentId:r.chat_agent,skill:r.chat_skill,daily:r.chat_daily,used:r.chat_day===today?r.chat_used:0,name:r.agent_name||'an agent',mine:r.agent_owner===owner,price:r.agent_owner===owner?0:Number(r.chat_price||0),
   gone:!r.agent_owner||!!r.agent_archived||(r.agent_owner!==owner&&!r.agent_published)}:null}));
}
export async function ownsChannel(db:D1Database,owner:string,id:string){
 return !!await db.prepare('SELECT 1 AS x FROM notify_channels WHERE id=? AND owner=?').bind(id,owner).first();
}
export async function removeChannel(db:D1Database,owner:string,id:string){
 const [del]=await db.batch([db.prepare('DELETE FROM notify_channels WHERE id=? AND owner=?').bind(id,owner),db.prepare('UPDATE schedules SET notify=NULL WHERE owner=? AND notify=?').bind(owner,id)]);
 if(!del.meta.changes)throw new HttpError(404,'Channel not found.');
}
/** Adds the channel, or brings a known one back (same account, same target). The count check runs inside the insert. */
async function saveChannel(db:D1Database,owner:string,kind:Channel['kind'],target:string,label:string){
 const known=await db.prepare('SELECT id FROM notify_channels WHERE owner=? AND kind=? AND target=?').bind(owner,kind,target).first<{id:string}>();
 if(known){await db.prepare('UPDATE notify_channels SET label=?,fails=0,dead=0,last_error=NULL WHERE id=?').bind(label,known.id).run();return known.id;}
 const id=crypto.randomUUID();
 const r=await db.prepare('INSERT OR IGNORE INTO notify_channels (id,owner,kind,target,label,created) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM notify_channels WHERE owner=?)<?')
  .bind(id,owner,kind,target,label,new Date().toISOString(),owner,await channelLimit(db,owner)).run();
 return r.meta.changes?id:null;
}
const full=(max:number)=>new HttpError(409,`You can keep up to ${max} channels. Remove one first.`);

/* ---- Discord ---- */
const HOOK=/^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/(?:v\d{1,2}\/)?webhooks\/(\d{15,22})\/([A-Za-z0-9_-]{40,120})\/?$/;
const hookUrl=(target:string)=>`${discordBase()}/api/webhooks/${target}`;
const call=(url:string,init:RequestInit={},ms=8000)=>fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(ms)});

export async function addDiscord(db:D1Database,owner:string,url:string){
 if(!notifyConfig().discord)throw new HttpError(503,'Discord delivery is switched off on this server.');
 const m=String(url||'').trim().match(HOOK);
 if(!m)throw new HttpError(400,'That is not a Discord webhook address. In Discord: channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL. It starts with https://discord.com/api/webhooks/.');
 const target=`${m[1]}/${m[2]}`;let name='';
 try{
  const r=await call(hookUrl(target));
  if(r.status===401||r.status===404)throw new HttpError(400,'Discord does not know this webhook (it may have been deleted). Copy the address again from the channel\'s Integrations.');
  if(!r.ok)throw new HttpError(502,'Discord did not accept the request right now. Try again in a moment.');
  name=clean(((await r.json().catch(()=>({}))) as {name?:string}).name);
 }catch(e){if(e instanceof HttpError)throw e;throw new HttpError(502,'Discord could not be reached right now. Try again in a moment.');}
 const id=await saveChannel(db,owner,'discord',target,`Discord · ${name||'webhook'}`);if(!id)throw full(await channelLimit(db,owner));
 return id;
}

/* ---- Telegram ---- */
type TgReply={ok?:boolean;result?:unknown;error_code?:number;description?:string;parameters?:{retry_after?:number}};
async function tg(method:string,payload:object,ms=8000):Promise<TgReply>{
 const r=await call(`${telegramBase()}/bot${botToken()}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},ms);
 return await r.json().catch(()=>({ok:false,error_code:r.status,description:'Unreadable answer'})) as TgReply;
}
const botId=()=>botToken().split(':')[0];
const state=async(db:D1Database,key:string)=>(await db.prepare('SELECT value FROM notify_state WHERE key=?').bind(key).first<{value:string}>())?.value??null;
async function botName(db:D1Database){
 const key=`tg:bot:${botId()}`;const known=await state(db,key);if(known)return known;
 let me:TgReply;try{me=await tg('getMe',{});}catch{throw new HttpError(502,'Telegram could not be reached right now. Try again in a moment.');}
 const name=clean((me.result as {username?:string}|undefined)?.username,64);
 if(!me.ok||!/^[A-Za-z0-9_]{3,64}$/.test(name)){console.error('Harvex delivery: Telegram getMe failed:',me.error_code,clean(me.description,120));throw new HttpError(503,'Telegram delivery is not set up correctly on this server.');}
 await db.prepare('INSERT INTO notify_state (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,name).run();
 return name;
}
const LINK_MS=10*60e3;
const links=(name:string,code:string)=>({link:`https://t.me/${name}?start=${code}`,group:`https://t.me/${name}?startgroup=${code}`});
/** A one-time code for this account; the chat that sends it to the bot becomes a channel. */
export async function startTelegram(db:D1Database,owner:string){
 if(!notifyConfig().telegram)throw new HttpError(503,'Telegram delivery is not set up on this server.');
 const max=await channelLimit(db,owner);
 if(((await db.prepare('SELECT COUNT(*) AS n FROM notify_channels WHERE owner=?').bind(owner).first<{n:number}>())?.n??0)>=max)throw full(max);
 const name=await botName(db);
 const code=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g,'-').replace(/\//g,'_');
 const expires=Date.now()+LINK_MS;
 await db.batch([db.prepare('DELETE FROM notify_links WHERE owner=? OR expires<?').bind(owner,Date.now()),db.prepare('INSERT INTO notify_links (code,owner,expires) VALUES (?,?,?)').bind(code,owner,expires)]);
 return {...links(name,code),expires};
}
export async function pendingTelegram(db:D1Database,owner:string){
 if(!notifyConfig().telegram)return null;
 const p=await db.prepare('SELECT code,expires FROM notify_links WHERE owner=? AND expires>? ORDER BY expires DESC LIMIT 1').bind(owner,Date.now()).first<{code:string;expires:number}>();
 return p?{...links(await botName(db),p.code),expires:p.expires}:null;
}
export async function telegramWaiting(db:D1Database){
 return notifyConfig().telegram&&!!await db.prepare('SELECT 1 AS x FROM notify_links WHERE expires>? LIMIT 1').bind(Date.now()).first();
}
type TgUpdate={update_id:number;message?:{message_id?:number;date?:number;text?:string;from?:{is_bot?:boolean};chat?:{id:number;type:string;username?:string;first_name?:string;title?:string}}};
type Ask={chatId:number;direct:boolean;messageId?:number;text:string};
/** Pause between two questions in one chat, and how old a message may be to still get an answer. */
const CHAT_PAUSE_MS=15e3,CHAT_MAX_AGE_S=300;
const help=(direct:boolean)=>direct?'Write your question and the agent connected to this chat answers. /help shows this text.'
 :'Ask the agent connected to this group with /ask and your question, for example: /ask what moved in HARVEX today?';

/** Reads the bot's new messages: ties chats that sent a valid one-time code to their account, and lets the agent of a
    chat answer questions (a private chat: any message; a group: /ask …). `wait` holds the request open that many
    seconds for a new message (long poll; only the container's reader uses it). Safe to call from several places at
    once: every update is recorded in tg_updates and only the reader that recorded it handles it. */
export async function pollTelegram(db:D1Database,{wait=0}:{wait?:number}={}){
 if(!notifyConfig().telegram)return {linked:0,answered:0};
 const key=`tg:offset:${botId()}`;let linked=0;const asks:Ask[]=[];
 for(let page=0;page<3;page++){
  const offset=Number(await state(db,key))||0;const hold=page?0:wait;
  let r:TgReply;try{r=await tg('getUpdates',{offset,limit:50,timeout:hold,allowed_updates:['message']},hold*1000+8000);}catch{return {linked,answered:0,error:'Telegram could not be reached.'};}
  if(!r.ok){
   // two readers asked at the same moment: Telegram ends one of them; the other has the messages
   if(r.error_code===409&&/terminated by other/i.test(r.description||''))return {linked,answered:0,busy:true};
   console.error('Harvex delivery: Telegram getUpdates failed:',r.error_code,clean(r.description,160));
   return {linked,answered:0,error:r.error_code===409?'The bot has a webhook set elsewhere; remove it (deleteWebhook) so this server can read its messages.':'Telegram refused the request.'};
  }
  const updates=(r.result as TgUpdate[])||[];if(!updates.length)break;
  // the offset moves first: a message is handled at most once, also when this request dies while an agent answers
  await db.prepare('INSERT INTO notify_state (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=CASE WHEN CAST(value AS INTEGER)<CAST(excluded.value AS INTEGER) THEN excluded.value ELSE value END').bind(key,String(updates[updates.length-1].update_id+1)).run();
  for(const u of updates){
   const msg=u.message,chat=msg?.chat;const text=(msg?.text||'').trim();
   if(!msg||!chat||!text||msg.from?.is_bot||!['private','group','supergroup'].includes(chat.type))continue;
   if(!(await db.prepare('INSERT OR IGNORE INTO tg_updates (update_id,at) VALUES (?,?)').bind(u.update_id,Date.now()).run()).meta.changes)continue;
   const direct=chat.type==='private';
   const say=(t:string)=>tg('sendMessage',{chat_id:chat.id,text:t}).catch(()=>null);
   const start=text.match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{16,64}))?\s*$/);
   if(start){
    const row=start[1]?await db.prepare('DELETE FROM notify_links WHERE code=? AND expires>? RETURNING owner').bind(start[1],Date.now()).first<{owner:string}>():null;
    if(!row){if(direct)await say(start[1]?'This link has expired or was already used. Create a new one in Harvex Agent Studio: Schedules → Delivery → Connect Telegram.':`This bot delivers reports from Harvex Agent Studio and lets your agent answer here. To connect this chat, open Schedules → Delivery → Connect Telegram${origin()?` on ${origin()}`:''}.`);continue;}
    const label=direct?`Telegram · ${chat.username?'@'+clean(chat.username):clean(chat.first_name)||'chat'}`:`Telegram group · ${clean(chat.title)||'group'}`;
    const id=await saveChannel(db,row.owner,'telegram',String(chat.id),label);
    if(id){linked++;await say('Connected to Harvex Agent Studio. Scheduled runs you point at this chat will arrive here, and you can let an agent answer questions here: Schedules → Delivery. Remove the channel there to stop.');}
    else await say('This account already has the maximum number of channels. Remove one in Schedules → Delivery, then connect again.');
    continue;
   }
   const cmd=text.match(/^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/);const name=cmd?cmd[1].toLowerCase():'';
   // a group only talks to the bot through /ask; other commands and ordinary group talk are not for it
   const question=cmd?(name==='ask'?(cmd[2]||'').trim():null):direct?text:null;
   if(name==='help'||question===''){await say(help(direct));continue;}
   if(question===null||(msg.date&&Date.now()/1000-msg.date>CHAT_MAX_AGE_S))continue;
   asks.push({chatId:chat.id,direct,messageId:msg.message_id,text:question.slice(0,4000)});
  }
  if(updates.length<50)break;
 }
 let answered=0;
 for(let i=0;i<asks.length;i+=3)answered+=(await Promise.all(asks.slice(i,i+3).map(a=>answer(db,a).catch(e=>{console.error('Harvex Telegram chat failed:',safeMessage((e as Error)?.message||e));return false;})))).filter(Boolean).length;
 return {linked,answered};
}

/** One question from a chat: a normal paid live run of the agent its owner chose, answered in the chat. The owner's
    numbers (credits, limits) are never written into the chat: other people may be reading.
    With chat_skill 'chat' the agent answers in its own voice, as a conversation (lib/talk.ts: the last turns of this
    chat are its context). That is also how an agent someone else published answers here: a chat message to it, paid by
    the account that linked the chat, at the creator's price that account accepted (chat_price). When the creator has
    changed the price since, nothing is sent to the AI and nothing is charged until the owner confirms the new price. */
async function answer(db:D1Database,a:Ask){
 const extra=a.messageId&&!a.direct?{reply_parameters:{message_id:a.messageId,allow_sending_without_reply:true}}:{};
 const reply=(text:string)=>tg('sendMessage',{chat_id:a.chatId,text,link_preview_options:{is_disabled:true},...extra}).catch(()=>null);
 const ch=await db.prepare("SELECT id,owner,chat_agent,chat_skill,chat_price,chat_thread FROM notify_channels WHERE kind='telegram' AND target=? AND dead=0 AND chat_agent IS NOT NULL ORDER BY created LIMIT 1").bind(String(a.chatId)).first<{id:string;owner:string;chat_agent:string;chat_skill:string;chat_price:number|null;chat_thread:string|null}>();
 if(!ch){await reply('No agent answers in this chat yet. Whoever connected it can choose one in Harvex Agent Studio: Schedules → Delivery.');return false;}
 // one statement takes the slot: not during the pause after the last question, and not beyond today's limit
 const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
 const take=await db.prepare('UPDATE notify_channels SET chat_used=CASE WHEN chat_day IS ?1 THEN chat_used+1 ELSE 1 END,chat_day=?1,chat_last=?2 WHERE id=?3 AND (chat_last IS NULL OR chat_last<?4) AND (chat_day IS NOT ?1 OR chat_used<chat_daily)').bind(day,now,ch.id,now-CHAT_PAUSE_MS).run();
 if(!take.meta.changes){
  // over the limit: say so once per pause; inside the pause: stay silent (a chat cannot make the bot talk in a loop)
  const full=await db.prepare('UPDATE notify_channels SET chat_last=?1 WHERE id=?2 AND (chat_last IS NULL OR chat_last<?3) RETURNING chat_daily').bind(now,ch.id,now-CHAT_PAUSE_MS).first<{chat_daily:number}>();
  if(full)await reply(`This chat has had its ${full.chat_daily} answers for today. More after 00:00 UTC.`);
  return false;
 }
 await tg('sendChatAction',{chat_id:a.chatId,action:'typing'}).catch(()=>null);
 try{
  // guard: people in a group are not the agent's owner, so its instructions stay unshown; no web search: a result
  // grounded with Google Search may not leave the Studio
  const talking=ch.chat_skill===TALK_SKILL;
  const run=talking
   ?await performRun(db,ch.owner,{id:crypto.randomUUID(),agentId:ch.chat_agent,prompt:a.text.slice(0,TALK_MESSAGE_MAX),skill:TALK_SKILL,mode:'live',talk:ch.chat_thread||ch.id,...(ch.chat_price!==null&&ch.chat_price!==undefined?{expectedPrice:ch.chat_price}:{})},undefined,{guard:true,search:false,label:'Telegram chat'})
   :await performRun(db,ch.owner,{id:crypto.randomUUID(),agentId:ch.chat_agent,prompt:a.text,skill:ch.chat_skill as SkillId,mode:'live'},undefined,{guard:true,search:false,label:'Telegram chat'});
  const {text,widget}=splitSearchWidget(run.output);
  const parts=messages('telegram',talking?clean(run.agent_name,60):`${clean(run.agent_name,60)} · ${skillName(run.skill)}`,widget?'This answer used Google Search and can only be shown inside the Studio.':text,'','… cut here: the answer was longer than a chat message allows.');
  for(const part of parts){const s=await sendTelegram(String(a.chatId),part,true,extra);if(!s.ok){if(s.gone)await db.prepare('UPDATE notify_channels SET dead=1,last_error=? WHERE id=?').bind(s.error,ch.id).run();break;}}
  return true;
 }catch(e){
  // nothing was produced: the slot goes back
  await db.prepare('UPDATE notify_channels SET chat_used=MAX(chat_used-1,0) WHERE id=?').bind(ch.id).run();
  const st=e instanceof HttpError?e.status:500;
  await reply(st===402?'The account behind this chat is out of credits.':st===429?'The limit for live AI has been reached for now. Try again later.'
   :st===409?'The price of the agent in this chat has changed. Whoever connected it can confirm the new price in Harvex Agent Studio: Schedules → Delivery. Nothing was charged.'
   :st===400||st===503?(e as Error).message:st===404||st===403?'The agent or skill of this chat is no longer available. Its owner can choose another in Schedules → Delivery.':'The agent could not answer this one. Nothing was charged.');
  return false;
 }
}

/** Lets an agent answer in a Telegram channel of this account (null: reports only). The route checks the agent. */
export async function setChat(db:D1Database,owner:string,id:string,chat:{agentId:string;skill:string;daily:number;/** the creator's price per message the owner accepted (someone else's agent) */price?:number|null}|null){
 // every save starts a new conversation: the agent, its voice or its price may have changed
 const r=await db.prepare("UPDATE notify_channels SET chat_agent=?,chat_skill=?,chat_daily=?,chat_price=?,chat_thread=? WHERE id=? AND owner=? AND kind='telegram'").bind(chat?.agentId??null,chat?.skill??null,chat?.daily??20,chat?.price??null,chat?crypto.randomUUID():null,id,owner).run();
 if(!r.meta.changes)throw new HttpError(404,'An agent can answer in Telegram chats only.');
}
/** Is there a chat an agent answers in? Then the bot's messages are read all the time, not only while a link is open. */
export async function chatActive(db:D1Database){
 return notifyConfig().telegram&&!!await db.prepare("SELECT 1 AS x FROM notify_channels WHERE kind='telegram' AND dead=0 AND chat_agent IS NOT NULL LIMIT 1").first();
}
/** The container's reader calls in every few seconds. While it does, the page and the scheduler leave the reading to it. */
export async function markReader(db:D1Database){await db.prepare("INSERT INTO notify_state (key,value) VALUES ('tg:reader',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(Date.now())).run();}
export async function readerFresh(db:D1Database){return Date.now()-(Number(await state(db,'tg:reader'))||0)<120e3;}

/* ---- message text ---- */
const stamp=(iso:string)=>iso.slice(0,16).replace('T',' ')+' UTC';
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
/** One line of the report's markdown as Telegram HTML (tags never span lines, so a message can be cut between lines). */
function tgLine(raw:string){
 if(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(raw))return '————';
 const h=raw.match(/^\s{0,3}#{1,6}\s+(.*)$/);
 let s=esc(h?h[1]:raw.replace(/^(\s*)[-*]\s+/,'$1• '));
 s=s.replace(/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,500})\)/g,(_,t:string,u:string)=>`<a href="${u.replace(/"/g,'&quot;')}">${t}</a>`)
  .replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>').replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/^_([^_\n]+)_$/,'<i>$1</i>');
 return h?`<b>${s.replace(/<\/?b>/g,'')}</b>`:s;
}
const plain=(html:string)=>html.replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
/** Packs lines into at most `max` messages of at most `size` characters; says whether something was left out. */
function pack(lines:string[],size:number,max:number){
 const parts:string[]=[];let cur='';let cut=false;
 for(const line of lines){
  if(cur&&cur.length+1+line.length>size){if(parts.length===max-1){cut=true;break;}parts.push(cur);cur='';}
  cur=cur?`${cur}\n${line}`:line;
 }
 if(cur.trim())parts.push(cur);
 return {parts,cut};
}
function messages(kind:string,head:string,body:string,foot:string,cutNote='… cut here: the full report is in History.'){
 const tgm=kind==='telegram';const size=tgm?3600:1800,max=tgm?2:3;
 // a line longer than a message is split first, so no tag is ever cut in half
 const raw=body.replace(/\r/g,'').split('\n').flatMap(l=>l.length>1200?l.match(/[\s\S]{1,1200}/g)||[]:[l]);
 const {parts,cut}=pack(raw.map(l=>tgm?tgLine(l):l),size,max);
 const title=tgm?`<b>${esc(head)}</b>`:`**${head}**`;
 const end=[cut?cutNote:'',foot].filter(Boolean).join('\n');
 if(!parts.length)parts.push('');
 parts[0]=`${title}\n${parts[0]}`.trimEnd();
 if(end)parts[parts.length-1]=`${parts[parts.length-1]}\n\n${tgm?esc(end):end}`;
 return parts;
}

/* ---- sending ---- */
type Sent={ok:true}|{ok:false;gone:boolean;error:string};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function sendDiscord(target:string,content:string,again=true):Promise<Sent>{
 // no pings (allowed_mentions), no link previews (flags 4): the text comes from a model
 const r=await call(`${hookUrl(target)}?wait=true`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:content.slice(0,2000),allowed_mentions:{parse:[]},flags:4})});
 if(r.ok)return {ok:true};
 if(r.status===401||r.status===404)return {ok:false,gone:true,error:'Discord no longer has this webhook. Connect the channel again.'};
 if(r.status===429&&again){const s=Number(((await r.json().catch(()=>({}))) as {retry_after?:number}).retry_after)||1;if(s<=3){await wait(s*1000+100);return sendDiscord(target,content,false);}}
 return {ok:false,gone:false,error:`Discord answered ${r.status}.`};
}
async function sendTelegram(target:string,html:string,again=true,extra:object={}):Promise<Sent>{
 const base={chat_id:target,link_preview_options:{is_disabled:true},...extra};
 let r=await tg('sendMessage',{...base,text:html,parse_mode:'HTML'});
 // text Telegram cannot parse as HTML is sent as plain text instead of being lost
 if(!r.ok&&r.error_code===400&&/parse|entit/i.test(r.description||''))r=await tg('sendMessage',{...base,text:plain(html)});
 if(r.ok)return {ok:true};
 if(r.error_code===403||(r.error_code===400&&/chat not found|deactivated|kicked/i.test(r.description||'')))return {ok:false,gone:true,error:'The bot was blocked or removed from this chat. Connect Telegram again.'};
 if(r.error_code===429&&again){const s=Number(r.parameters?.retry_after)||1;if(s<=3){await wait(s*1000+100);return sendTelegram(target,html,false,extra);}}
 return {ok:false,gone:false,error:`Telegram answered ${r.error_code??'an error'}.`};
}
async function send(db:D1Database,owner:string,channelId:string,head:string,body:string,foot:string):Promise<Sent>{
 const ch=await db.prepare('SELECT id,kind,target,dead FROM notify_channels WHERE id=? AND owner=?').bind(channelId,owner).first<Row>();
 if(!ch)return {ok:false,gone:true,error:'Channel not found.'};
 if(ch.dead)return {ok:false,gone:true,error:'This channel is disconnected.'};
 if(ch.kind==='telegram'&&!notifyConfig().telegram)return {ok:false,gone:false,error:'Telegram delivery is not set up on this server.'};
 if(ch.kind==='discord'&&!notifyConfig().discord)return {ok:false,gone:false,error:'Discord delivery is switched off on this server.'};
 let res:Sent={ok:true};
 try{for(const part of messages(ch.kind,head,body,foot)){res=ch.kind==='discord'?await sendDiscord(ch.target,part):await sendTelegram(ch.target,part);if(!res.ok)break;}}
 catch(e){console.error('Harvex delivery failed:',safeMessage((e as Error)?.message||e));res={ok:false,gone:false,error:`${ch.kind==='discord'?'Discord':'Telegram'} could not be reached.`};}
 const now=new Date().toISOString();
 if(res.ok)await db.prepare('UPDATE notify_channels SET fails=0,last_error=NULL,last_sent=? WHERE id=?').bind(now,ch.id).run();
 // ten failed sends in a row also stop a channel: nothing keeps knocking on a service that keeps refusing
 else await db.prepare('UPDATE notify_channels SET fails=fails+1,last_error=?,dead=CASE WHEN ?=1 OR fails>=9 THEN 1 ELSE dead END WHERE id=?').bind(res.error,res.gone?1:0,ch.id).run();
 return res;
}
const history=()=>origin()?`History: ${origin()}/dashboard/history`:'';
const skillName=(id:string)=>skillCatalog.find(s=>s.id===id)?.name||id;

/** A finished scheduled run. Never throws. */
export async function deliverRun(db:D1Database,owner:string,channelId:string,run:{agent_name:string;skill:string;output:string;created:string;mode:string}){
 const {text,widget}=splitSearchWidget(run.output);
 const head=`${clean(run.agent_name,60)} · ${skillName(run.skill)}${run.mode==='sample'?' · workflow sample':''} · ${stamp(run.created)}`;
 const body=widget?'This report used Google Search. Search results can only be shown inside the Studio, to the account that asked: open History to read it.':text;
 return send(db,owner,channelId,head,body,history()).catch(()=>({ok:false,gone:false,error:'Not sent.'} as Sent));
}
/** A schedule that stopped (out of credits, agent or skill removed): one short notice. Never throws. */
export async function deliverNotice(db:D1Database,owner:string,channelId:string,agent:string,text:string){
 return send(db,owner,channelId,`${clean(agent,60)||'Schedule'} · schedule stopped`,text,origin()?`Schedules: ${origin()}/dashboard/schedules`:'').catch(()=>({ok:false,gone:false,error:'Not sent.'} as Sent));
}
/** "Send a test": at most one every 10 seconds per channel (the conditional update is the lock). */
export async function testChannel(db:D1Database,owner:string,channelId:string){
 const now=Date.now();
 const lock=await db.prepare('UPDATE notify_channels SET last_sent=? WHERE id=? AND owner=? AND (last_sent IS NULL OR last_sent<?)').bind(new Date(now).toISOString(),channelId,owner,new Date(now-10e3).toISOString()).run();
 if(!lock.meta.changes){if(!await ownsChannel(db,owner,channelId))throw new HttpError(404,'Channel not found.');throw new HttpError(429,'A message was just sent here. Wait a few seconds.');}
 // a test may bring a stopped channel back when the service accepts it again
 await db.prepare('UPDATE notify_channels SET dead=0 WHERE id=? AND owner=?').bind(channelId,owner).run();
 const r=await send(db,owner,channelId,'Harvex Agent Studio · test','This channel is connected. Scheduled runs you point here arrive like this message.',history());
 if(!r.ok)throw new HttpError(r.gone?410:502,r.error);
}
