/* One published agent, as the public sees it (Discover, the agent page /a/<id>, link previews). Only public fields
   leave the database: instructions are never part of publicAgent(). */
import {publicAgent} from '@/lib/economy';
import {skillCatalog} from '@/lib/agents';
import {RATING_COLUMNS} from '@/lib/ratings';

type Row={id:string;owner:string;name:string;config:string;price:number;talk_price:number|null;uses:number;published_at:string|null;handle:string|null;checked_at:string|null;check_mark:string|null;check_passed:number|null;up:number;down:number;kb_rev:number;sources:number};
export type PublicAgent=ReturnType<typeof publicAgent>&{/** answered runs among its last fifty */health?:{ok:number;total:number}};
export const AGENT_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The agent when it is published and not archived, otherwise null (unknown, private and archived look the same). */
export async function publishedAgent(db:D1Database,id:string,viewer?:string):Promise<PublicAgent|null>{
 if(!AGENT_ID.test(id))return null;
 const row=await db.prepare(`SELECT id,owner,name,config,price,talk_price,uses,published_at,checked_at,check_mark,check_passed,kb_rev,(SELECT COUNT(*) FROM knowledge_sources WHERE knowledge_sources.agent_id=agents.id) AS sources,${RATING_COLUMNS},(SELECT handle FROM creators WHERE creators.owner=agents.owner AND creators.status='verified') AS handle FROM agents WHERE id=? AND published=1 AND archived=0`).bind(id).first<Row>();
 if(!row)return null;
 // how it has been doing: answered runs among its last fifty (failed ones were refunded)
 const h=await db.prepare("SELECT COALESCE(SUM(CASE WHEN status='complete' THEN 1 ELSE 0 END),0) AS ok,COUNT(*) AS total FROM (SELECT status FROM runs WHERE agent_id=? AND status!='running' ORDER BY created DESC LIMIT 50)").bind(id).first<{ok:number;total:number}>();
 return {...publicAgent(row,viewer),health:{ok:Number(h?.ok||0),total:Number(h?.total||0)}};
}

export const skillLabel=(id:string)=>skillCatalog.find(s=>s.id===id)?.name||id;
export const priceLabel=(price:number)=>price>0?`${price} credits per run`:'Free to run';
/** One line for link previews and the page header: what the agent does and what it costs. */
export function agentSummary(a:{tagline:string;skills:string[];price:number}){
 const skills=a.skills.map(skillLabel).join(', ');
 return [a.tagline,skills&&`Skills: ${skills}`,priceLabel(a.price)].filter(Boolean).join(' · ');
}
/** Changes whenever what the preview shows changes, so X and Telegram fetch a new picture instead of a cached one. */
export function previewVersion(a:{name:string;tagline:string;skin:string;skills:string[];price:number;talkPrice?:number;creator?:string;verified?:boolean}){
 // 'card3' is the picture's design (the card to show off, 4 Oct 2026; logo and deck colours 6 Oct 2026): raise it when the drawing changes
 const s=['card3',a.name,a.tagline,a.skin,a.skills.join(','),a.price,a.talkPrice??'',a.verified?a.creator:''].join('|');let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36);
}
