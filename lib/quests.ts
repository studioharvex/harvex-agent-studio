/* Quests: a short list of things to try in the Studio. Each one is done when the server can SEE that it happened (an
   agent exists, a run completed, a schedule exists, a channel is connected...), never because a browser says so. A done
   quest can be claimed once per account for a few FREE credits (drizzle/0021).
   Free credits are the kind an account also gets at sign-up: they pay for runs, they are spent before bought credits,
   and they are never part of claimable earnings and cannot be withdrawn (lib/economy.ts). So a quest reward can only be
   used to run agents here.
   To add a quest: add an entry to QUESTS with a check that reads the database. Keep ids stable: they are the claim key.
   A quest whose feature is off on this server (Telegram without a bot, the token without a recorder) is left out.
   Env (server only): QUESTS_ENABLED (default true), QUEST_CREDITS (free credits per quest, default 5; 0 = no credits). */
import {env} from 'cloudflare:workers';
import {HttpError,aiReady} from './server';
import {ensureWallet,ledgerRow} from './economy';
import {notifyConfig} from './notify';
import {chainConfig} from './chain';

type Env={QUESTS_ENABLED?:string;QUEST_CREDITS?:string};
const E=()=>env as unknown as Env;
export function questConfig(){
 const n=Number(E().QUEST_CREDITS);
 return {enabled:E().QUESTS_ENABLED!=='false',credits:E().QUEST_CREDITS!==undefined&&E().QUEST_CREDITS!==''&&Number.isFinite(n)?Math.min(Math.max(Math.round(n),0),100):5};
}

type Quest={id:string;title:string;text:string;/** where the quest is done: a view of the app (lib/routes.ts) */go:string;icon:string;
 /** false: the feature is off on this server, the quest is not offered */on?:()=>boolean;
 check:(db:D1Database,owner:string)=>Promise<boolean>};
const has=async(db:D1Database,sql:string,...args:unknown[])=>!!await db.prepare(sql).bind(...args).first();

export const QUESTS:Quest[]=[
 {id:'agent',title:'Create your first agent',text:'In the Studio, choose a character, type a name and save. That is your first agent.',go:'studio',icon:'cube',
  check:(db,o)=>has(db,'SELECT 1 AS x FROM agents WHERE owner=? LIMIT 1',o)},
 {id:'run',title:'Get a first result',text:'Give the agent a task with one of its skills and wait for the answer.',go:'studio',icon:'play',
  check:(db,o)=>has(db,"SELECT 1 AS x FROM runs WHERE owner=? AND status='complete' LIMIT 1",o)},
 {id:'team',title:'Run a team of two',text:'On the Teams page, put two agents in a row and start the run. Agent two builds on what agent one answered.',go:'teams',icon:'link',
  check:(db,o)=>has(db,"SELECT 1 AS x FROM runs WHERE owner=? AND status='complete' AND relay IS NOT NULL AND step>=2 LIMIT 1",o)},
 {id:'talk',title:'Chat with a published agent',text:'Find a published agent in Discover, open its page and send one message there.',go:'discover',icon:'users',
  check:(db,o)=>has(db,"SELECT 1 AS x FROM runs WHERE owner=? AND status='complete' AND talk IS NOT NULL LIMIT 1",o)},
 {id:'voice',title:'Draft a persona from your posts',text:'Go to Persona in the Studio and paste posts that you wrote. The Studio then drafts instructions that match your style.',go:'studio',icon:'pen',
  on:()=>aiReady(),
  check:(db,o)=>has(db,"SELECT 1 AS x FROM runs WHERE owner=? AND status='complete' AND skill='voice' LIMIT 1",o)},
 {id:'schedule',title:'Schedule a skill',text:'Set a skill to repeat on a schedule. The agent then runs it while you are away.',go:'schedules',icon:'clock',
  check:(db,o)=>has(db,'SELECT 1 AS x FROM schedules WHERE owner=? LIMIT 1',o)},
 {id:'deliver',title:'Have results delivered',text:'Open Schedules → Delivery and link a Discord channel or a Telegram chat.',go:'schedules',icon:'share',
  on:()=>notifyConfig().discord||notifyConfig().telegram,
  check:(db,o)=>has(db,'SELECT 1 AS x FROM notify_channels WHERE owner=? AND dead=0 LIMIT 1',o)},
 {id:'chat',title:'Ask your agent on Telegram',text:'Set an agent to reply in a Telegram chat of yours. Then send it a question in that chat.',go:'schedules',icon:'users',
  on:()=>notifyConfig().telegram,
  check:(db,o)=>has(db,"SELECT 1 AS x FROM notify_channels WHERE owner=? AND kind='telegram' AND chat_agent IS NOT NULL AND chat_used>0 LIMIT 1",o)},
 {id:'chain',title:'Look at the chain',text:'Do a single run with either the Wallet monitor skill or the Whale watch skill.',go:'studio',icon:'scan',
  on:()=>!!chainConfig().harvex,
  check:(db,o)=>has(db,"SELECT 1 AS x FROM runs WHERE owner=? AND status='complete' AND skill IN ('monitor','whales') LIMIT 1",o)},
 {id:'share',title:'Make an answer public',text:'Pick a run in History and share the answer. It gets a public page of its own.',go:'activity',icon:'share',
  check:(db,o)=>has(db,'SELECT 1 AS x FROM run_shares WHERE owner=? LIMIT 1',o)},
 {id:'publish',title:'Publish an agent',text:'List one of your agents in Discover. From then on other people can run it.',go:'agents',icon:'store',
  check:(db,o)=>has(db,'SELECT 1 AS x FROM agents WHERE owner=? AND published=1 AND archived=0 LIMIT 1',o)},
];
const offered=()=>QUESTS.filter(q=>!q.on||q.on());

export type QuestView={id:string;title:string;text:string;go:string;icon:string;credits:number;done:boolean;claimed:boolean};
/** The quests of this server; with an account: which are done and which were claimed. */
export async function questList(db:D1Database,owner?:string){
 const cfg=questConfig();if(!cfg.enabled)return {enabled:false,credits:0,quests:[] as QuestView[],earned:0};
 const list=offered();
 const claims=owner?(await db.prepare('SELECT quest,credits FROM quest_claims WHERE owner=?').bind(owner).all<{quest:string;credits:number}>()).results:[];
 const claimed=new Map(claims.map(c=>[c.quest,c.credits]));
 const done=owner?await Promise.all(list.map(q=>claimed.has(q.id)?true:q.check(db,owner).catch(()=>false))):list.map(()=>false);
 return {enabled:true,credits:cfg.credits,earned:claims.reduce((a,c)=>a+c.credits,0),
  quests:list.map((q,i)=>({id:q.id,title:q.title,text:q.text,go:q.go,icon:q.icon,credits:claimed.get(q.id)??cfg.credits,done:done[i],claimed:claimed.has(q.id)}))};
}

/** Claims a finished quest: the claim row, the credits and the ledger line go in ONE batch. The claim row comes first
    and its primary key fails the batch on a second claim, so two clicks or two tabs can never add credits twice. */
export async function claimQuest(db:D1Database,owner:string,id:string){
 const cfg=questConfig();if(!cfg.enabled)throw new HttpError(503,'This server has quests turned off.');
 const q=offered().find(x=>x.id===id);if(!q)throw new HttpError(404,'There is no such quest.');
 if(await has(db,'SELECT 1 AS x FROM quest_claims WHERE owner=? AND quest=?',owner,id))throw new HttpError(409,'This quest was claimed already.');
 if(!await q.check(db,owner))throw new HttpError(400,'Finish this quest first, then claim it.');
 await ensureWallet(db,owner);const now=new Date().toISOString();
 const batch=[db.prepare('INSERT INTO quest_claims (owner,quest,credits,created) VALUES (?,?,?,?)').bind(owner,id,cfg.credits,now)];
 // free credits: the balance grows, the bought part (paid) does not
 if(cfg.credits>0)batch.push(db.prepare('UPDATE preview_wallets SET balance=balance+? WHERE owner=?').bind(cfg.credits,owner),ledgerRow(db,owner,cfg.credits,'quest',`Quest · ${q.title}`,id,now));
 try{await db.batch(batch);}catch{throw new HttpError(409,'This quest was claimed already.');}
 return {claimed:id,credits:cfg.credits};
}
