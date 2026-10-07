/* Ratings of answers (drizzle/0029 run_ratings; POST /api/rate). The account a run belongs to can mark its answer
   helpful or not helpful, once per run, and change or remove that mark. An agent's public score is the share of
   helpful marks among the marks OTHER accounts gave it: a creator rating their own agent's answers is stored (they see
   their own marks) but never counts. A score is shown from MIN_RATINGS marks on, so one mark does not make "100%".
   Discover and the plaza order agents by use and by these marks (app/api/market/route.ts). */
import {HttpError} from './server';

/** Marks an agent needs before its score is shown. */
export const MIN_RATINGS=3;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sets (1 / -1) or removes (0) the mark of the caller's own completed run. */
export async function rateRun(db:D1Database,owner:string,runId:unknown,value:unknown){
 if(typeof runId!=='string'||!UUID.test(runId)||(value!==1&&value!==-1&&value!==0))throw new HttpError(400,'Choose helpful or not helpful.');
 const run=await db.prepare('SELECT agent_id,status FROM runs WHERE id=? AND owner=?').bind(runId,owner).first<{agent_id:string;status:string}>();
 if(!run)throw new HttpError(404,'Run not found.');
 if(run.status!=='complete')throw new HttpError(400,'Only a completed answer can be rated.');
 if(value===0)await db.prepare('DELETE FROM run_ratings WHERE run_id=? AND owner=?').bind(runId,owner).run();
 else await db.prepare('INSERT INTO run_ratings (run_id,owner,agent_id,value,created) VALUES (?,?,?,?,?) ON CONFLICT(run_id) DO UPDATE SET value=excluded.value WHERE run_ratings.owner=excluded.owner')
  .bind(runId,owner,run.agent_id,value,new Date().toISOString()).run();
 return {runId,value};
}

/** SQL for the two counts of an agent row (alias `agents`): marks by accounts other than its creator. */
export const RATING_COLUMNS="(SELECT COUNT(*) FROM run_ratings rr WHERE rr.agent_id=agents.id AND rr.value=1 AND rr.owner!=agents.owner) AS up,(SELECT COUNT(*) FROM run_ratings rr WHERE rr.agent_id=agents.id AND rr.value=-1 AND rr.owner!=agents.owner) AS down";
/** The public score of an agent, or null while it has too few marks. */
export const scoreOf=(up:number,down:number)=>up+down>=MIN_RATINGS?{percent:Math.round(up*100/(up+down)),count:up+down}:null;
