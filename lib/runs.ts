/* One agent run: reserve credits (and a skill try) in a single D1 batch, execute the skill, refund on failure.
   The creator of a published agent is paid only once the run has completed (in the same batch that marks it complete),
   so a failed run never has to take credits back from a creator who may have spent them.
   Runs cut off mid-execution (timeout, restart) are failed and refunded by sweepStuckRuns.
   A failed run always gets its credits back. Its daily and window counts come back only when the provider produced
   nothing (an HTTP error): a run that failed after the provider generated something, or that was cut off mid-way, was
   billed to the operator, so it keeps its counts. Otherwise failing on purpose would be free AI without limit.
   Used by POST /api/runs (manual runs) and by the scheduler (lib/schedules.ts). Scheduled runs:
   - only on the owner's own agents, never on someone else's published agent;
   - cost the skill's live price, at least SCHEDULE_RUN_COST, credits each (the credit side of the schedule limit)
     and do not use skill tries;
   - are tagged with schedule_id so History shows where they came from. */
import {runtime,aiReady,HttpError,safeMessage} from './server';
import {sampleResult} from './runner';
import {runAI,AIError,searchesWeb} from './provider';
import {isOpenSkill,skillCatalog,type Agent,type SkillId} from './agents';
import {monitorTarget,readWallet,saveReading} from './monitor';
import {whaleReading} from './whales';
import {handover,type Relay} from './teams';
import {talkContext,talkCost,TALK_SKILL} from './talk';
import {voiceCost,VOICE_SKILL,VOICE_WRITER} from './voice';
import {runCheck,checkReport,checkCost,CHECK_SKILL} from './agent-check';
import {harvexFacts} from './harvex-facts';
import {recall,lastAsked} from './knowledge';
import {withNote} from './grounding';
import {SAMPLE_COST,liveRunCost,aiDailyRuns,aiDailyFreeRuns,liveDailyPerUser,quotaKeys,quotaStep,ensureWallet,ledgerRow,split,tierFeePermille,skillTrialLimit,refillFree,heavyWindow,heavyKey,searchForFreeCredits,takeSearchSlot,returnSearchSlot} from './economy';
/** Heavy skills on manual live runs count against the 5-hour window (lib/economy.ts heavyWindow). */
const isHeavy=(mode:string,skill:string,scheduled:boolean)=>mode==='live'&&!scheduled&&heavyWindow().skills.includes(skill);

const TIMED_OUT='The task took too long and was cancelled. Any credits were returned.';

/** `expectedPrice`: the creator price the buyer saw. When the creator changed it meanwhile, the run is refused. */
export type RunInput={id:string;agentId:string;prompt:string;skill:SkillId|typeof TALK_SKILL|typeof VOICE_SKILL|typeof CHECK_SKILL;mode:'sample'|'live';expectedPrice?:number;
 /** a message of a conversation with the agent (lib/talk.ts): the id of the conversation. The run then uses no skill. */talk?:string;
 /** a draft of the agent's instructions from its creator's own posts (lib/voice.ts): own agents only, no skill used */voice?:boolean;
 /** the agent check (lib/agent-check.ts): the studio tries the creator's own agent with a few messages */check?:boolean;
 /** a step of a team run (lib/teams.ts): the run works from the answer of the step before it */relay?:Relay};
type AgentRow={owner:string;config:string;name:string;published:number;price:number;talk_price:number|null;archived:number};
export type RunRow={id:string;agent_id:string;agent_name:string;prompt:string;output:string;mode:string;cost:number;status:string;created:string;skill:string;schedule_id?:string|null;relay?:string|null;step?:number|null;talk?:string|null};

/** `opts` (runs started for the owner from outside the Studio, lib/notify.ts): `guard` keeps the agent's instructions
    unshown even on the owner's own agent, `search:false` answers without web search, `label` names the run in the ledger.
    `schedule.extra` (a schedule that reports only on change, lib/watch.ts): what set the report off, for the AI after
    the task and as a note under the answer. */
export async function performRun(db:D1Database,owner:string,data:RunInput,schedule?:{id:string;cost:number;extra?:{facts:string;note:string}|null},opts:{guard?:boolean;search?:boolean;label?:string}={}):Promise<RunRow>{
 const previous=await db.prepare('SELECT * FROM runs WHERE id=? AND owner=?').bind(data.id,owner).first<RunRow>();
 if(previous){if(previous.agent_id!==data.agentId||previous.prompt!==data.prompt||previous.mode!==data.mode)throw new HttpError(409,'This request ID is already in use.');return previous;}
 const record=await db.prepare('SELECT owner,config,name,published,price,talk_price,archived FROM agents WHERE id=?').bind(data.agentId).first<AgentRow>();
 if(!record||record.archived)throw new HttpError(404,'Save this agent before running a task.');
 const mine=record.owner===owner;
 if(!mine&&(schedule||!record.published))throw new HttpError(404,schedule?'Schedules run your own agents only.':'This agent is not published.');
 // the buyer agreed to the price shown in Discover: a creator who raised it meanwhile does not get the higher amount
 // a chat message has the creator's chat price (drizzle/0026); the task price when the creator set none
 const asked=data.talk&&!schedule?record.talk_price??record.price:record.price;
 if(!mine&&data.expectedPrice!==undefined&&data.expectedPrice!==asked)throw new HttpError(409,`The creator changed the price of ${record.name} to ${asked} credits. Check the new price and ${data.talk?'send it':'run'} again.`);
 // a message of a conversation is answered in the agent's own voice and needs none of its skills
 const talk=!schedule&&data.talk?data.talk:null;if(!!talk!==(data.skill===TALK_SKILL))throw new HttpError(400,'Choose one of the agent\u2019s skills.');
 // a voice draft is written for the creator's own agent by a neutral writer, from the posts in the task
 const check=!schedule&&!!data.check;
 // `voice` below also stands for the check: both run on the creator's own agent and use none of its skills
 const voice=(!schedule&&!!data.voice)||check;if((voice&&!check)!==(data.skill===VOICE_SKILL)||check!==(data.skill===CHECK_SKILL)||(voice&&(!mine||!!talk)))throw new HttpError(voice&&!mine?404:400,voice&&!mine?'Save this agent first.':'Choose one of the agent\u2019s skills.');
 const agent=JSON.parse(record.config) as Agent;if(!talk&&!voice&&!agent.skills.includes(data.skill as SkillId))throw new HttpError(400,'Equip this skill on your agent first.');
 if(!talk&&!voice&&!isOpenSkill(data.skill))throw new HttpError(403,`This skill is locked for now. Open skills: ${skillCatalog.filter(s=>isOpenSkill(s.id)).map(s=>s.name).join(', ')}.`);
 // skill tries apply to manual runs; scheduled runs are paid with credits instead
 const limit=schedule||talk||voice?0:skillTrialLimit();const skillName=skillCatalog.find(s=>s.id===data.skill)?.name||data.skill;
 const tryUsed=async()=>limit?((await db.prepare('SELECT used FROM skill_trials WHERE owner=? AND skill=?').bind(owner,data.skill).first<{used:number}>())?.used??0):0;
 const tryLimitError=()=>new HttpError(429,`You have used your ${limit} ${limit===1?'try':'tries'} of ${skillName}. Other skills still have tries left, and schedules run any skill with credits.`);
 if(limit&&await tryUsed()>=limit)throw tryLimitError();
 if(data.mode==='live'&&!aiReady())throw new HttpError(503,'AI is not connected yet. Try a workflow sample.');
 // price: platform sample or live AI cost + creator price when running someone else's agent; schedules have their own cost
 const base=schedule?schedule.cost:data.mode==='sample'?SAMPLE_COST:talk?talkCost():check?checkCost():voice?voiceCost():liveRunCost(data.skill);const price=mine?0:asked;const cost=base+price;const {fee,creator}=split(price,price>0?await tierFeePermille(db,record.owner):1000);
 const created=new Date().toISOString();await ensureWallet(db,owner);await refillFree(db,owner);
 const w=await db.prepare('SELECT balance,paid FROM preview_wallets WHERE owner=?').bind(owner).first<{balance:number;paid:number}>();if((w?.balance??0)<cost)throw new HttpError(402,`This run costs ${cost} credits and you have ${w?.balance??0}. You can still edit and export agents.`);
 // The wallet monitor reads the chain before anything is charged: a task without an address, or a chain that does not
 // answer, costs nothing. What it read goes to the model with the task and is attached under the answer.
 const wallet=data.skill==='monitor'?await readWallet(db,owner,await monitorTarget(db,owner,data.prompt)):null;
 // Whale watch works the same way with the server's record of the HARVEX token (lib/whales.ts): no record, no charge.
 const reading=wallet||(data.skill==='whales'?await whaleReading(db):null);
 // A step of a team run works from the answer of the step before it. Checked here, before anything is charged: a
 // step whose predecessor did not complete (or belongs to another account or team run) costs nothing.
 const relay=!schedule&&!talk&&!voice&&data.relay?data.relay:null;const handed=relay?await handover(db,owner,relay):null;
 // a conversation: the last turns this account had with this agent in it go to the model as context
 const spoken=talk?await talkContext(db,owner,data.agentId,talk):null;
 // what the agent knows: the passages of its creator's sources that bear on this message or task (lib/knowledge.ts).
 // Reading them never stops a run: an agent without sources, or a question none of them covers, runs as before.
 const known=async()=>{if(data.mode!=='live'||voice)return null;
  try{return await recall(db,data.agentId,data.prompt,talk?await lastAsked(db,owner,data.agentId,talk):null);}
  catch(e){console.error('Harvex knowledge: sources not read:',safeMessage((e as Error)?.message||e));return null;}};
 // an account that holds bought credits is on the paid tier: more heavy runs, and not limited by the free pool
 const holdsPaid=(w?.paid??0)>0;
 const statements=[
  db.prepare('INSERT INTO runs (id,owner,agent_id,agent_name,prompt,output,mode,cost,status,created,skill,schedule_id,relay,step,talk) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(data.id,owner,data.agentId,record.name,data.prompt,'',data.mode,cost,'running',created,data.skill,schedule?.id??null,relay?.id??null,relay?.step??null,talk),
  // free credits are spent first; the part taken from bought credits (paid) is fixed here, from the balance at this
  // moment inside the batch, so parallel runs cannot misstate it (drizzle/0014)
  db.prepare('UPDATE runs SET paid_cost=(SELECT CAST(MIN(?,MAX(0,?-(balance-paid))) AS INTEGER) FROM preview_wallets WHERE owner=?) WHERE id=? AND owner=?').bind(cost,cost,owner,data.id,owner),
  // only the part of the creator's share paid with bought credits becomes claimable earnings; D1 binds JS numbers as
  // REAL, so the division is made integer explicitly (rounded down: a creator never claims a fraction of a credit)
  ...(!mine&&price>0?[db.prepare('UPDATE runs SET creator_paid=CAST(CAST(? AS INTEGER)*MIN(CAST(? AS INTEGER),paid_cost)/CAST(? AS INTEGER) AS INTEGER) WHERE id=? AND owner=?').bind(creator,price,price,data.id,owner)]:[]),
  // the CHECK on the balance aborts the whole batch when it would go below zero: two parallel runs can never overdraw
  db.prepare('UPDATE preview_wallets SET balance=balance-?,paid=paid-(SELECT paid_cost FROM runs WHERE id=? AND owner=?) WHERE owner=?').bind(cost,data.id,owner,owner),
 ];
 if(cost>0)statements.push(ledgerRow(db,owner,-cost,'run',schedule?`Scheduled run · ${record.name}`:mine?`${opts.label||(check?'Agent check':voice?'Voice draft':talk?'Chat':relay?`Team run, step ${relay.step}`:data.mode==='sample'?'Workflow sample':'Live run')} · ${record.name}`:`${talk?'Talked to':'Ran'} ${record.name} (${price} to creator${base?`, ${base} sample`:''})`,data.id,created));
 // every run by someone else counts as a use, free agents included (Discover sorts by it)
 if(!mine){if(price>0)await ensureWallet(db,record.owner);statements.push(db.prepare('UPDATE agents SET uses=uses+1 WHERE id=?').bind(data.agentId));}
 // one try used; at the limit the counter becomes -1, the CHECK fails and the whole batch rolls back (no race)
 if(limit)statements.push(db.prepare('INSERT INTO skill_trials (owner,skill,used) VALUES (?,?,1) ON CONFLICT(owner,skill) DO UPDATE SET used=CASE WHEN used<? THEN used+1 ELSE -1 END').bind(owner,data.skill,limit));
 // daily live AI limits (drizzle/0013): per account for manual runs, for the whole studio for every live run, and a
 // smaller shared pool for accounts without bought credits (so free sign-ups cannot use up what paying users need)
 const keys=quotaKeys(owner,created);const perUser=liveDailyPerUser(),studio=aiDailyRuns(),freePool=aiDailyFreeRuns();
 const pooled=data.mode==='live'&&!holdsPaid;
 if(data.mode==='live'){if(!schedule)statements.push(quotaStep(db,keys.user,perUser));statements.push(quotaStep(db,keys.all,studio));if(pooled)statements.push(quotaStep(db,keys.free,freePool));}
 // heavy skills: per 5-hour window, more while the account holds bought credits (paid tier)
 const heavy=isHeavy(data.mode,data.skill,!!schedule);const hw=heavyWindow(),hk=heavyKey(owner,created);
 const paidTier=heavy&&holdsPaid;
 const heavyLimit=paidTier?hw.paid:hw.free;if(heavy)statements.push(quotaStep(db,hk.key,heavyLimit));
 try{await db.batch(statements);}catch{
  const duplicate=await db.prepare('SELECT * FROM runs WHERE id=? AND owner=?').bind(data.id,owner).first<RunRow>();if(duplicate)return duplicate;
  if(limit&&await tryUsed()>=limit)throw tryLimitError();
  if(data.mode==='live'){const used=async(k:string)=>(await db.prepare('SELECT used FROM ai_quotas WHERE key=?').bind(k).first<{used:number}>())?.used??0;
   if(!schedule&&await used(keys.user)>=perUser)throw new HttpError(429,`You have used your ${perUser} live AI runs for today. Workflow samples still work; live AI opens again after 00:00 UTC.`);
   if(await used(keys.all)>=studio)throw new HttpError(429,'Live AI has reached its daily limit for the whole studio. Try a workflow sample now, or live AI again after 00:00 UTC.');
   if(pooled&&await used(keys.free)>=freePool)throw new HttpError(429,'Free live AI is used up for today across the studio. Accounts with bought credits can still run live AI, and workflow samples still work; free live runs open again after 00:00 UTC.');
   if(heavy&&await used(hk.key)>=heavyLimit)throw new HttpError(429,`You have used your ${heavyLimit} heavy runs (${hw.skills.map(k=>skillCatalog.find(x=>x.id===k)?.name||k).join(', ')}) for this ${hw.hours}-hour window. Other skills still work; heavy runs open again at ${hk.resets.slice(11,16)} UTC.${paidTier?'':` With bought credits the window allows ${hw.paid}.`}`);}
  // a parallel run of the same account took the credits first (the balance CHECK aborted this batch)
  const left=(await db.prepare('SELECT balance FROM preview_wallets WHERE owner=?').bind(owner).first<{balance:number}>())?.balance??0;
  if(left<cost)throw new HttpError(402,`This run costs ${cost} credits and you have ${left}. You can still edit and export agents.`);
  throw new HttpError(409,'Unable to reserve this run. Refresh your balance and try again.');}
 const reserved={id:data.id,owner,agentId:data.agentId,note:`Refund · ${record.name}`,cost,skill:data.skill,mode:data.mode,created,scheduleId:schedule?.id??null,foreign:!mine,trial:!!limit,pooled};
 // safety net should a database ever lack the balance CHECK: an overdrawn reservation is undone at once
 if(cost>0&&((await db.prepare('SELECT balance FROM preview_wallets WHERE owner=?').bind(owner).first<{balance:number}>())?.balance??0)<0){
  await failRun(db,reserved,'Not enough credits.',false);throw new HttpError(402,`This run costs ${cost} credits. Top up or wait for more credits.`);
 }
 let output:string;
 // a live run paid entirely with free credits (starting grant, allotments) may use a cheaper model (AI_MODEL_FREE)
 const free=data.mode==='live'&&((await db.prepare('SELECT paid_cost FROM runs WHERE id=? AND owner=?').bind(data.id,owner).first<{paid_cost:number}>())?.paid_cost??0)===0;
 // web search is billed per query on top of the tokens, so the research skill takes one of today's studio-wide slots
 // (AI_DAILY_SEARCH_RUNS). Without a slot, or for an account that holds no bought credits when
 // AI_SEARCH_FREE_CREDITS=false, it answers without browsing and says so. The slot comes back when the provider did not
 // search after all. (The account counts, not the run: free credits are spent first, and someone who bought credits
 // must not lose the search on the runs their daily free credits happen to pay.)
 const search=opts.search!==false&&!talk&&data.mode==='live'&&data.skill==='research'&&searchesWeb(runtime())&&(holdsPaid||searchForFreeCredits())&&await takeSearchSlot(db,created);
 // A run that searches the web answers from the web and is shown as the provider returned it (Google's terms for a
 // grounded answer), so it is not given the sources.
 const kb=search?null:await known();
 // guard: someone else's published agent keeps its instructions private from the person running it
 try{
  if(data.mode==='sample')output=sampleResult(agent,data.prompt,data.skill);
  else if(check)output=checkReport(await runCheck(runtime(),agent,data.id,free,harvexFacts()));
  else{const r=await runAI(runtime(),voice?VOICE_WRITER:agent,data.skill,[data.prompt,spoken,schedule?.extra?.facts,kb?.facts,handed?.facts,reading?.facts].filter(Boolean).join('\n\n'),data.id,{free,guard:!mine||!!opts.guard||!!talk,search,about:talk?harvexFacts():null});output=r.output;if(search&&!r.searched)await returnSearchSlot(db,created).catch(()=>null);}
  if(kb)output=kb.finish(output);
  if(schedule?.extra)output=withNote(output,schedule.extra.note);
  if(reading)output=withNote(output,reading.note);
  if(handed)output=withNote(output,handed.note);
 }
 catch(e){
  if(search&&e instanceof AIError&&!e.billed)await returnSearchSlot(db,created).catch(()=>null);
  // the reason goes to the server log (Coolify → Logs), never to the page: it can name the provider or model
  console.error('Harvex AI run failed:',safeMessage((e as Error)?.message||e));
  await failRun(db,reserved,'The AI service could not complete this task. Please try again.',e instanceof AIError?e.billed:true);
  throw new HttpError(502,'The task failed. Any credits were returned.');
 }
 // complete the run and pay the creator together; both only if the run is still 'running' (not swept meanwhile)
 const done="EXISTS (SELECT 1 FROM runs WHERE id=? AND owner=? AND status='complete')";
 const settle=[db.prepare("UPDATE runs SET output=?,status='complete' WHERE id=? AND owner=? AND status='running'").bind(output,data.id,owner)];
 if(!mine&&price>0){
  const backed='(SELECT creator_paid FROM runs WHERE id=? AND owner=?)';
  settle.push(db.prepare(`UPDATE preview_wallets SET balance=balance+?,earned=earned+?,paid=paid+${backed},earned_paid=earned_paid+${backed} WHERE owner=? AND ${done}`).bind(creator,creator,data.id,owner,data.id,owner,record.owner,data.id,owner));
  const paid=(who:string,delta:number,kind:string,note:string)=>db.prepare(`INSERT INTO credit_ledger (id,owner,delta,kind,ref,note,created) SELECT ?,?,?,?,?,?,? WHERE ${done}`).bind(crypto.randomUUID(),who,delta,kind,data.id,note,new Date().toISOString(),data.id,owner);
  settle.push(paid(record.owner,creator,'earning',`${record.name} was used by another creator${fee?` (fee ${fee})`:''}`));
  if(fee>0)settle.push(paid('platform',fee,'fee',`Platform fee · ${record.name}`));
 }
 const [completed]=await db.batch(settle);
 if(!completed.meta.changes)throw new HttpError(504,TIMED_OUT);
 // the reading becomes "the last check" only once its report exists
 if(wallet)await saveReading(db,owner,wallet).catch(e=>console.error('Harvex wallet monitor: reading not saved:',safeMessage((e as Error)?.message||e)));
 return {id:data.id,agent_id:data.agentId,agent_name:record.name,prompt:data.prompt,output,mode:data.mode,cost,status:'complete',created,skill:data.skill,schedule_id:schedule?.id??null,relay:relay?.id??null,step:relay?.step??null,talk};
}

type Reserved={id:string;owner:string;agentId:string;note:string;cost:number;skill:string;mode:string;created:string;scheduleId:string|null;foreign:boolean;trial:boolean;pooled:boolean};
/** Fails a run that is still 'running' and gives back what it reserved, in ONE batch: every statement only acts while
    the run is still running and the status flip comes last. So a run is never refunded twice (a sweep and a late
    failure can both arrive) and never marked failed without its refund. The creator was not paid yet.
    `keepCounts`: the provider was (or may have been) billed, so the daily and window counts stay used. */
async function failRun(db:D1Database,r:Reserved,reason:string,keepCounts:boolean){
 const running="EXISTS (SELECT 1 FROM runs WHERE id=? AND owner=? AND status='running')";const at=[r.id,r.owner];
 const undo=[db.prepare(`UPDATE preview_wallets SET balance=balance+?,paid=paid+COALESCE((SELECT paid_cost FROM runs WHERE id=? AND owner=?),0) WHERE owner=? AND ${running}`).bind(r.cost,r.id,r.owner,r.owner,...at)];
 if(r.trial)undo.push(db.prepare(`UPDATE skill_trials SET used=MAX(used-1,0) WHERE owner=? AND skill=? AND ${running}`).bind(r.owner,r.skill,...at));
 if(r.cost>0)undo.push(db.prepare(`INSERT INTO credit_ledger (id,owner,delta,kind,ref,note,created) SELECT ?,?,?,?,?,?,? WHERE ${running}`).bind(crypto.randomUUID(),r.owner,r.cost,'refund',r.id,r.note,new Date().toISOString(),...at));
 if(r.foreign)undo.push(db.prepare(`UPDATE agents SET uses=MAX(uses-1,0) WHERE id=? AND ${running}`).bind(r.agentId,...at));
 if(!keepCounts){
  const back=(key:string)=>db.prepare(`UPDATE ai_quotas SET used=MAX(used-1,0) WHERE key=? AND ${running}`).bind(key,...at);
  if(r.mode==='live'){const k=quotaKeys(r.owner,r.created);if(!r.scheduleId)undo.push(back(k.user));undo.push(back(k.all));if(r.pooled)undo.push(back(k.free));}
  if(isHeavy(r.mode,r.skill,!!r.scheduleId))undo.push(back(heavyKey(r.owner,r.created).key));
 }
 undo.push(db.prepare("UPDATE runs SET status='failed',output=? WHERE id=? AND owner=? AND status='running'").bind(reason,r.id,r.owner));
 const done=await db.batch(undo);
 return !!done[done.length-1].meta.changes;
}

/** Runs left in 'running' longer than `minutes` were cut off (request timeout, restart): mark them failed and refund
    them. The provider may already have generated (and billed) their answer, so their daily counts stay used.
    Called by the scheduler tick (everyone) and by /api/workspace (the signed-in owner). */
export async function sweepStuckRuns(db:D1Database,{owner,minutes=5}:{owner?:string;minutes?:number}={}){
 const cutoff=new Date(Date.now()-minutes*60e3).toISOString();
 const rows=await db.prepare(`SELECT r.id,r.owner,r.agent_id,r.agent_name,r.cost,r.skill,r.schedule_id,r.mode,r.created,a.owner AS agent_owner FROM runs r LEFT JOIN agents a ON a.id=r.agent_id WHERE r.status='running' AND r.created<?${owner?' AND r.owner=?':''} LIMIT 25`)
  .bind(...(owner?[cutoff,owner]:[cutoff])).all<{id:string;owner:string;agent_id:string;agent_name:string;cost:number;skill:string;schedule_id:string|null;mode:string;created:string;agent_owner:string|null}>();
 let swept=0;
 for(const r of rows.results){
  const flipped=await failRun(db,{id:r.id,owner:r.owner,agentId:r.agent_id,note:`Refund · ${r.agent_name} (timed out)`,cost:r.cost,skill:r.skill,mode:r.mode,created:r.created,scheduleId:r.schedule_id,
   foreign:!!r.agent_owner&&r.agent_owner!==r.owner,trial:!r.schedule_id&&!!skillTrialLimit(),pooled:false},TIMED_OUT,true);
  if(!flipped)continue;
  if(r.schedule_id)await db.prepare('UPDATE schedules SET last_status=?,updated=? WHERE id=?').bind('Failed, credits returned. Tries again at the next slot.',new Date().toISOString(),r.schedule_id).run();
  swept++;
 }
 return swept;
}
