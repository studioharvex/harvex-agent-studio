import {context,failure,HttpError} from '@/lib/server';
import {publicAgent} from '@/lib/economy';
import {publishedAgent} from '@/lib/market';
import {RATING_COLUMNS} from '@/lib/ratings';
type Row={id:string;owner:string;name:string;config:string;price:number;talk_price:number|null;uses:number;published_at:string|null;handle:string|null;checked_at:string|null;check_mark:string|null;check_passed:number|null;up:number;down:number;kb_rev:number;sources:number};
/** Public gallery of published agents. Sign-in optional; owners see which entries are theirs.
    ?id=<agent id> returns that one agent ({agent}) for its public page /a/<id>; 404 when it is not published. */
export async function GET(request:Request){try{
 let viewer:string|undefined;let db:D1Database;
 try{const c=await context(request);db=c.db;viewer=c.owner;}catch{const {env}=await import('cloudflare:workers');db=(env as {DB:D1Database}).DB;}
 const one=new URL(request.url).searchParams.get('id');
 if(one!==null){const agent=await publishedAgent(db,one,viewer);if(!agent)throw new HttpError(404,'This agent is not published.');return Response.json({agent},{headers:{'Cache-Control':'no-store'}});}
 const url=new URL(request.url);const q=(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,60);// the default order: how much an agent is used, lifted by helpful marks and lowered by unhelpful ones (lib/ratings.ts)
 const sort=url.searchParams.get('sort')==='new'?'published_at DESC':'(uses+3*up-5*down) DESC, published_at DESC';
 // search runs in SQL before the limit, on public fields only (never the private instructions)
 const like=`%${q.replace(/[\\%_]/g,m=>'\\'+m)}%`;
 const where=q?` AND (lower(name) LIKE ?1 ESCAPE '\\' OR lower(COALESCE(json_extract(config,'$.tagline'),'')) LIKE ?1 ESCAPE '\\' OR lower(json_extract(config,'$.skills')) LIKE ?1 ESCAPE '\\')`:'';
 const stmt=db.prepare(`SELECT id,owner,name,config,price,talk_price,uses,published_at,checked_at,check_mark,check_passed,kb_rev,(SELECT COUNT(*) FROM knowledge_sources WHERE knowledge_sources.agent_id=agents.id) AS sources,${RATING_COLUMNS},(SELECT handle FROM creators WHERE creators.owner=agents.owner AND creators.status='verified') AS handle FROM agents WHERE published=1 AND archived=0${where} ORDER BY ${sort} LIMIT 60`);
 const rows=await (q?stmt.bind(like):stmt).all<Row>();
 const list=rows.results.map(r=>publicAgent(r,viewer));
 return Response.json({agents:list},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
