/* The arena (drizzle/0031; GET/POST/DELETE /api/arena; pages /arena and /arena/<id>, components/harvex/arena-page.tsx).
   Someone puts ONE question to TWO published agents; both answers stand side by side on a public page, and readers
   pick the better one.
   Nothing new runs on the server for this. The page sends the question to each agent as a normal chat message
   (POST /api/talk: charged, limited, refunded and paid to the creator like any message), then asks for the duel with
   the two run ids. A duel is made only from two COMPLETED chat runs of the same account, with the same text, on two
   different agents that are both published. Nothing of a run is copied: the public page reads the runs as they are.
   What the page shows: the question, each agent's name and character, its answer, the picks. Never who asked, never
   an agent's instructions. Its maker can take it down at any time.
   Picks: one per signed-in account and duel, changeable. The creators of the two agents cannot pick in their own duel.
   A pick is an opinion of whoever opened the page, and one person can have several accounts: the count is shown for
   what it is and feeds nothing else (not Discover's order, not an agent's rating, no credits). */
import {HttpError} from './server';
import {splitSearchWidget} from './grounding';

export const DUEL_ID=/^[A-Za-z0-9_-]{16}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Duels one account may keep, and the longest question a duel is made from. */
export const MAX_DUELS=50,DUEL_QUESTION_MAX=300;
const newId=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replace(/\+/g,'-').replace(/\//g,'_');

export type DuelSide={name:string;skin:string;look:unknown;appearance:unknown;motion:string|null;/** set while the agent is published: the page links to it */agentId:string|null;text:string;votes:number};
export type Duel={id:string;question:string;created:string;/** answers are workflow samples (AI is not connected on this server) */sample:boolean;a:DuelSide;b:DuelSide;
 /** the viewer's own pick, whether the viewer may pick, and whether the viewer made this duel */mine:'a'|'b'|null;canVote:boolean;yours:boolean};

type RunRow={id:string;agent_id:string;prompt:string;output:string;status:string;talk:string|null;mode:string;published:number|null;archived:number|null};

/** Makes a duel from two chat runs of this account. The same pair again gives the same id. */
export async function createDuel(db:D1Database,owner:string,runA:unknown,runB:unknown){
 if(typeof runA!=='string'||typeof runB!=='string'||!UUID.test(runA)||!UUID.test(runB)||runA===runB)throw new HttpError(400,'A duel needs two answers.');
 const rows=(await db.prepare('SELECT r.id,r.agent_id,r.prompt,r.output,r.status,r.talk,r.mode,a.published,a.archived FROM runs r LEFT JOIN agents a ON a.id=r.agent_id WHERE r.owner=? AND r.id IN (?,?)').bind(owner,runA,runB).all<RunRow>()).results;
 const a=rows.find(r=>r.id===runA),b=rows.find(r=>r.id===runB);
 if(!a||!b)throw new HttpError(404,'Answer not found.');
 if(a.status!=='complete'||b.status!=='complete'||!a.output||!b.output)throw new HttpError(400,'Both agents have to answer before the duel can be made.');
 if(!a.talk||!b.talk)throw new HttpError(400,'A duel is made from two chat answers.');
 if(a.agent_id===b.agent_id)throw new HttpError(400,'Pick two different agents.');
 if(a.prompt.trim()!==b.prompt.trim())throw new HttpError(400,'Both agents have to get the same question.');
 if(a.prompt.trim().length>DUEL_QUESTION_MAX)throw new HttpError(400,`Keep the question under ${DUEL_QUESTION_MAX} characters.`);
 if(!a.published||a.archived||!b.published||b.archived)throw new HttpError(400,'Both agents have to be published.');
 if(splitSearchWidget(a.output).widget||splitSearchWidget(b.output).widget)throw new HttpError(400,'An answer that used Google Search can only be shown in the Studio, to the account that asked.');
 const known=async()=>(await db.prepare('SELECT id FROM duels WHERE owner=? AND run_a=? AND run_b=?').bind(owner,runA,runB).first<{id:string}>())?.id;
 const had=await known();if(had)return had;
 const id=newId();
 // the checks run inside the insert, so parallel requests cannot pass them: the limit per account, and a run being in
 // one duel at most, on either side (the unique indexes cover the same side)
 const r=await db.prepare('INSERT OR IGNORE INTO duels (id,owner,run_a,run_b,created) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM duels WHERE owner=?)<? AND NOT EXISTS (SELECT 1 FROM duels WHERE run_a IN (?,?) OR run_b IN (?,?))')
  .bind(id,owner,runA,runB,new Date().toISOString(),owner,MAX_DUELS,runA,runB,runA,runB).run();
 if(r.meta.changes)return id;
 const raced=await known();if(raced)return raced;
 const count=(await db.prepare('SELECT COUNT(*) AS n FROM duels WHERE owner=?').bind(owner).first<{n:number}>())?.n??0;
 throw new HttpError(409,count>=MAX_DUELS?`You can keep up to ${MAX_DUELS} duels. Take one down first.`:'One of these answers is already in a duel.');
}

export async function removeDuel(db:D1Database,owner:string,id:unknown){
 if(typeof id!=='string'||!DUEL_ID.test(id))throw new HttpError(404,'Duel not found.');
 const done=await db.batch([db.prepare('DELETE FROM duel_votes WHERE duel_id=? AND EXISTS (SELECT 1 FROM duels WHERE id=? AND owner=?)').bind(id,id,owner),db.prepare('DELETE FROM duels WHERE id=? AND owner=?').bind(id,owner)]);
 if(!done[1].meta.changes)throw new HttpError(404,'Duel not found.');
}

type Row={id:string;owner:string;created:string;prompt:string;mode:string;st_a:string;st_b:string;out_a:string;out_b:string;name_a:string;name_b:string;
 id_a:string|null;cfg_a:string|null;pub_a:number|null;arc_a:number|null;own_a:string|null;id_b:string|null;cfg_b:string|null;pub_b:number|null;arc_b:number|null;own_b:string|null};
const load=(db:D1Database,id:string)=>db.prepare(`SELECT d.id,d.owner,d.created,ra.prompt,ra.mode,ra.status AS st_a,rb.status AS st_b,ra.output AS out_a,rb.output AS out_b,ra.agent_name AS name_a,rb.agent_name AS name_b,
  aa.id AS id_a,aa.config AS cfg_a,aa.published AS pub_a,aa.archived AS arc_a,aa.owner AS own_a,ab.id AS id_b,ab.config AS cfg_b,ab.published AS pub_b,ab.archived AS arc_b,ab.owner AS own_b
  FROM duels d JOIN runs ra ON ra.id=d.run_a AND ra.owner=d.owner JOIN runs rb ON rb.id=d.run_b AND rb.owner=d.owner LEFT JOIN agents aa ON aa.id=ra.agent_id LEFT JOIN agents ab ON ab.id=rb.agent_id WHERE d.id=?`).bind(id).first<Row>();

/** A duel as the public sees it; null when the id is unknown or an answer can no longer be shown. `viewer` is the
    signed-in account opening the page, when there is one. */
export async function duelOf(db:D1Database,id:string,viewer?:string|null):Promise<Duel|null>{
 if(!DUEL_ID.test(id))return null;
 const r=await load(db,id);if(!r||r.st_a!=='complete'||r.st_b!=='complete')return null;
 const ta=splitSearchWidget(r.out_a),tb=splitSearchWidget(r.out_b);if(ta.widget||tb.widget||!ta.text.trim()||!tb.text.trim())return null;
 const votes=(await db.prepare('SELECT choice,COUNT(*) AS n FROM duel_votes WHERE duel_id=? GROUP BY choice').bind(id).all<{choice:string;n:number}>()).results;
 const n=(c:string)=>Number(votes.find(v=>v.choice===c)?.n||0);
 const mine=viewer?(await db.prepare('SELECT choice FROM duel_votes WHERE duel_id=? AND voter=?').bind(id,viewer).first<{choice:string}>())?.choice??null:null;
 const side=(name:string,agentId:string|null,cfg:string|null,pub:number|null,arc:number|null,text:string,count:number):DuelSide=>{
  let c:{skin?:string;look?:unknown;appearance?:unknown;motion?:string}={};try{c=cfg?JSON.parse(cfg):{};}catch{c={};}
  return {name,skin:c.skin||'atlas',look:c.look??null,appearance:c.appearance??null,motion:c.motion||null,agentId:agentId&&pub&&!arc?agentId:null,text,votes:count};};
 return {id:r.id,question:r.prompt.trim(),created:r.created,sample:r.mode==='sample',
  a:side(r.name_a,r.id_a,r.cfg_a,r.pub_a,r.arc_a,ta.text.trim(),n('a')),b:side(r.name_b,r.id_b,r.cfg_b,r.pub_b,r.arc_b,tb.text.trim(),n('b')),
  mine:mine==='a'||mine==='b'?mine:null,canVote:!!viewer&&viewer!==r.own_a&&viewer!==r.own_b,yours:!!viewer&&viewer===r.owner};
}

/** Picks the better answer of a duel ('a' or 'b'), changes the pick, or takes it back (null). */
export async function voteDuel(db:D1Database,voter:string,id:unknown,choice:unknown){
 if(typeof id!=='string'||!DUEL_ID.test(id))throw new HttpError(404,'Duel not found.');
 if(choice!=='a'&&choice!=='b'&&choice!==null)throw new HttpError(400,'Pick one of the two answers.');
 const r=await load(db,id);if(!r)throw new HttpError(404,'Duel not found.');
 if(voter===r.own_a||voter===r.own_b)throw new HttpError(403,'The creator of an agent in this duel cannot pick in it.');
 if(choice===null)await db.prepare('DELETE FROM duel_votes WHERE duel_id=? AND voter=?').bind(id,voter).run();
 else await db.prepare('INSERT INTO duel_votes (duel_id,voter,choice,created) VALUES (?,?,?,?) ON CONFLICT(duel_id,voter) DO UPDATE SET choice=excluded.choice,created=excluded.created').bind(id,voter,choice,new Date().toISOString()).run();
}

/** The account's own duels, newest first (the arena page lists them). */
export async function duelsOf(db:D1Database,owner:string){
 const rows=(await db.prepare(`SELECT d.id,d.created,ra.prompt,ra.agent_name AS name_a,rb.agent_name AS name_b,
  (SELECT COUNT(*) FROM duel_votes v WHERE v.duel_id=d.id) AS votes FROM duels d JOIN runs ra ON ra.id=d.run_a JOIN runs rb ON rb.id=d.run_b WHERE d.owner=? ORDER BY d.created DESC LIMIT ?`).bind(owner,MAX_DUELS)
  .all<{id:string;created:string;prompt:string;name_a:string;name_b:string;votes:number}>()).results;
 return rows.map(r=>({id:r.id,created:r.created,question:r.prompt.trim(),a:r.name_a,b:r.name_b,votes:Number(r.votes||0)}));
}
