/* The owner's scheduled agent work (lib/schedules.ts). GET lists schedules and limits; POST creates; PATCH pauses,
   resumes or edits; DELETE removes. Runs happen in /api/schedules/tick, never from the browser. */
import {z} from 'zod';
import {context,failure,body,HttpError,aiReady} from '@/lib/server';
import {skillIds} from '@/lib/agents';
import {PER_DAY,accountLimits,checkTarget,nextRun,scheduleConfig,scheduledRunCost,tierPerks,usedToday,type ScheduleRow} from '@/lib/schedules';
import {channelsOf,notifyConfig,ownsChannel} from '@/lib/notify';
import {canWatch,watchMin,WATCH_MIN_DEFAULT,WATCH_MIN_OPTIONS} from '@/lib/watch';

const perDay=z.number().int().refine(n=>(PER_DAY as readonly number[]).includes(n),'Choose how many times a day.');
const create=z.object({agentId:z.string().uuid(),skill:z.enum(skillIds),prompt:z.string().trim().min(3).max(4000),perDay,startMinute:z.number().int().min(0).max(1439),mode:z.enum(['auto','sample']).default('auto'),notify:z.string().uuid().nullable().optional(),
 /** report only on change (wallet monitor, whale watch); watchMin: whale watch's smallest transfer in whole HARVEX */onChange:z.boolean().optional(),watchMin:z.number().int().optional()});
const patch=z.object({id:z.string().uuid(),active:z.boolean().optional(),prompt:z.string().trim().min(3).max(4000).optional(),perDay:perDay.optional(),startMinute:z.number().int().min(0).max(1439).optional(),skill:z.enum(skillIds).optional(),notify:z.string().uuid().nullable().optional(),onChange:z.boolean().optional(),watchMin:z.number().int().optional()});
const NO_WATCH='Only the wallet monitor and Whale watch can report on change: they are the skills that read something to compare.';
const checkMin=(v:number|undefined)=>{if(v!==undefined&&!(WATCH_MIN_OPTIONS as readonly number[]).includes(v))throw new HttpError(400,'Choose one of the listed amounts.');};
/** A schedule only sends to a channel of its own account. */
const checkNotify=async(db:D1Database,owner:string,id:string|null|undefined)=>{if(id&&!await ownsChannel(db,owner,id))throw new HttpError(404,'That delivery channel was removed. Choose another one.');};

async function list(db:D1Database,owner:string){
 const cfg=scheduleConfig();
 const L=await accountLimits(db,owner);
 const [rows,used,channels]=await Promise.all([db.prepare('SELECT s.*,a.name AS agent_name,a.config AS agent_config FROM schedules s LEFT JOIN agents a ON a.id=s.agent_id WHERE s.owner=? ORDER BY s.created DESC').bind(owner).all<ScheduleRow&{agent_name:string|null;agent_config:string|null}>(),usedToday(db,owner),channelsOf(db,owner)]);
 return {channels,delivery:notifyConfig(),watch:{skills:['monitor','whales'],min:[...WATCH_MIN_OPTIONS],minDefault:WATCH_MIN_DEFAULT},
  // watch_mark is the server's own note of what the last check saw: not part of the answer
  schedules:rows.results.map(({agent_config,watch_mark:_mark,...r})=>{let skin:string|null=null;try{skin=agent_config?JSON.parse(agent_config).skin:null;}catch{skin=null;}return {...r,active:!!r.active,on_change:!!r.on_change,watch_min:r.skill==='whales'&&r.on_change?watchMin(r.watch_min):null,skin};}),
  // credits per run for each skill (live runs cost the skill's price, at least SCHEDULE_RUN_COST)
  limits:{...cfg,max:L.schedules,dailyCap:L.dailyRuns,tier:L.tier,tierName:L.tierName,perks:tierPerks(),usedToday:used,mode:aiReady()?'live':'sample',skillCosts:Object.fromEntries(skillIds.map(k=>[k,scheduledRunCost(cfg.runCost,k,aiReady()?'live':'sample')]))}};
}

export async function GET(request:Request){try{const {db,owner}=await context(request);return Response.json(await list(db,owner),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const cfg=scheduleConfig();if(!cfg.enabled)throw new HttpError(503,'Schedules are switched off on this server.');
 const p=create.safeParse(await body(request));if(!p.success)throw new HttpError(400,p.error.issues[0]?.message||'Check the schedule and try again.');const d=p.data;
 await checkTarget(db,owner,d.agentId,d.skill);await checkNotify(db,owner,d.notify);
 if(d.onChange&&!canWatch(d.skill))throw new HttpError(400,NO_WATCH);checkMin(d.watchMin);
 const max=(await accountLimits(db,owner)).schedules;
 const now=new Date().toISOString();const id=crypto.randomUUID();
 // the count check runs inside the insert, so parallel requests cannot pass the limit
 const r=await db.prepare('INSERT INTO schedules (id,owner,agent_id,skill,prompt,per_day,start_minute,mode,active,next_run,runs,created,updated,notify,on_change,watch_min) SELECT ?,?,?,?,?,?,?,?,1,?,0,?,?,?,?,? WHERE (SELECT COUNT(*) FROM schedules WHERE owner=?)<?')
  .bind(id,owner,d.agentId,d.skill,d.prompt,d.perDay,d.startMinute,d.mode,nextRun(d.perDay,d.startMinute,new Date()).toISOString(),now,now,d.notify??null,d.onChange?1:0,d.onChange&&d.skill==='whales'?watchMin(d.watchMin):null,owner,max).run();
 if(!r.meta.changes)throw new HttpError(409,`You can keep up to ${max} schedules. Delete one first.`);
 return Response.json({id,...await list(db,owner)});
}catch(e){return failure(e)}}

export async function PATCH(request:Request){try{
 const {db,owner}=await context(request,true);const p=patch.safeParse(await body(request));if(!p.success)throw new HttpError(400,p.error.issues[0]?.message||'Check the schedule and try again.');const d=p.data;
 const s=await db.prepare('SELECT * FROM schedules WHERE id=? AND owner=?').bind(d.id,owner).first<ScheduleRow>();if(!s)throw new HttpError(404,'Schedule not found.');
 const skill=d.skill??s.skill;const per=d.perDay??s.per_day;const start=d.startMinute??s.start_minute;const active=d.active??!!s.active;
 if(active)await checkTarget(db,owner,s.agent_id,skill);
 if(d.notify!==undefined)await checkNotify(db,owner,d.notify);
 // report only on change: kept only on a skill that can watch; whatever changes what is watched starts it over (the
 // next slot reports, and later ones compare with that)
 if(d.onChange&&!canWatch(skill))throw new HttpError(400,NO_WATCH);checkMin(d.watchMin);
 const onChange=canWatch(skill)&&(d.onChange??!!s.on_change);const min=onChange&&skill==='whales'?watchMin(d.watchMin??s.watch_min):null;
 const restart=onChange!==!!s.on_change||skill!==s.skill||(d.prompt!==undefined&&d.prompt!==s.prompt)||min!==(s.watch_min??null);
 const retime=d.perDay!==undefined||d.startMinute!==undefined||(d.active===true&&!s.active);
 // next_run and last_status are only written when this request changes them: the scheduler may have claimed the slot
 // since the row was read, and writing the old values back would run (and charge) that slot a second time
 const status=d.active===true&&!s.active?'Resumed':d.active===false?'Paused by you':null;
 await db.prepare(`UPDATE schedules SET skill=?,prompt=?,per_day=?,start_minute=?,active=?,updated=?,on_change=?,watch_min=?${restart?',watch_mark=NULL,quiet=0,checked=NULL':''}${retime?',next_run=?':''}${status?',last_status=?':''}${d.notify!==undefined?',notify=?':''} WHERE id=? AND owner=?`)
  .bind(skill,d.prompt??s.prompt,per,start,active?1:0,new Date().toISOString(),onChange?1:0,min,...(retime?[nextRun(per,start,new Date()).toISOString()]:[]),...(status?[status]:[]),...(d.notify!==undefined?[d.notify]:[]),d.id,owner).run();
 return Response.json(await list(db,owner));
}catch(e){return failure(e)}}

export async function DELETE(request:Request){try{
 const {db,owner}=await context(request,true);const {id}=await body(request) as {id?:string};
 const r=await db.prepare('DELETE FROM schedules WHERE id=? AND owner=?').bind(String(id||''),owner).run();if(!r.meta.changes)throw new HttpError(404,'Schedule not found.');
 return Response.json(await list(db,owner));
}catch(e){return failure(e)}}
