/* Skill catalog and shared types. Kept free of zod so the browser bundle stays small; the validation
   schemas live in ./agent-schema (loaded by the server, and lazily by the studio when saving/importing). */
import type {Agent} from './agent-schema';
export type {Agent};
export const skillIds=['research','write','document','summarize','translate','brainstorm','code','planner','monitor','whales'] as const;
export type SkillId=typeof skillIds[number];
export const MAX_SKILLS=4;
/** Agents answer in English: the studio is English only (client, 4 Oct 2026). An agent saved earlier with another
    answer language is read as English (lib/agent-schema.ts, lib/provider.ts, lib/economy.ts). */
export const ANSWER_LANGUAGE='English' as const;
/** What an agent may carry besides its instructions: an opening line, up to three questions to start from, and notes
    it answers from (lib/provider.ts adds them to every run). */
export const GREETING_MAX=200,STARTERS_MAX=3,STARTER_MAX=80,KNOWLEDGE_MAX=4000;
/** A mark of what an agent says and knows: its name, instructions, tone, notes and, once it has had sources
    (lib/knowledge.ts), how often they changed (`rev` = agents.kb_rev). The agent check (lib/agent-check.ts) stores it,
    and an agent counts as checked only while its current mark is still that one. An agent that never had a source
    keeps the mark it had before sources existed. */
export function configMark(a:{name?:string;personality?:string;tone?:string;knowledge?:string},rev?:number|null){
 const s=[a.name||'',a.personality||'',a.tone||'',a.knowledge||'',...(rev?[`kb${rev}`]:[])].join('\u0001');let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)+'.'+s.length.toString(36);
}
/** Skills open right now. A skill left out stays visible but locked (no equip, runs refused by /api/runs).
    Since 30 Sep 2026 all of them are open (the wallet monitor joined on 4 Oct 2026) and each user gets a few tries per skill (SKILL_TRIAL_LIMIT, default 2,
    enforced by /api/runs and reported by /api/workspace as `trials`). */
export const OPEN_SKILLS:readonly SkillId[]=skillIds;
/** Default tries per skill per user; the server reads SKILL_TRIAL_LIMIT (0 = unlimited). */
export const DEFAULT_TRIAL_LIMIT=2;
export type Trials={limit:number;used:Partial<Record<SkillId,number>>};
/** Tries left for a skill, or null when there is no limit. */
export const triesLeft=(t:Trials|null|undefined,id:string)=>!t||!t.limit?null:Math.max(t.limit-(t.used[id as SkillId]||0),0);
export const isOpenSkill=(id:string)=>(OPEN_SKILLS as readonly string[]).includes(id);
const SKILLS=[
 {id:'research',name:'Web research',description:'Compare sources and turn a question into a sourced brief.',category:'Research',icon:'Globe',cost:8},
 {id:'write',name:'Content writer',description:'Turn a brief into posts, threads, outlines and clear first drafts.',category:'Creative',icon:'PenLine',cost:3},
 {id:'document',name:'Document Q&A',description:'Answer questions from supplied text and quote the passages used.',category:'Knowledge',icon:'FileText',cost:5},
 {id:'summarize',name:'Summarizer',description:'Condense long text into a TL;DR, key points and action items.',category:'Knowledge',icon:'AlignLeft',cost:3},
 {id:'translate',name:'Translator',description:'Translate text while keeping tone, names and formatting.',category:'Language',icon:'Languages',cost:2},
 {id:'brainstorm',name:'Idea generator',description:'Generate ranked ideas with a one-line reason for each.',category:'Creative',icon:'Lightbulb',cost:3},
 {id:'code',name:'Code explainer',description:'Explain, review or comment a code snippet.',category:'Builder',icon:'Code2',cost:4},
 {id:'planner',name:'Task planner',description:'Break a goal into an ordered checklist with time estimates.',category:'Productivity',icon:'ListChecks',cost:3},
 {id:'monitor',name:'Wallet monitor',description:'Read a wallet on BNB Smart Chain: balances, HARVEX transfers and what changed since the last check.',category:'Automation',icon:'Activity',cost:5},
 {id:'whales',name:'Whale watch',description:'Report on the HARVEX token: the biggest transfers of the last 24 hours, new holders and the biggest holders.',category:'Automation',icon:'Radar',cost:5},
];
export const skillCatalog=SKILLS.map(s=>({...s,planned:!!('planned' in s&&s.planned),locked:!('planned' in s&&s.planned)&&!isOpenSkill(s.id)}));
export const openSkills=()=>skillCatalog.filter(s=>!s.planned&&!s.locked);
export type MarketAgent={id:string;name:string;skin:Agent['skin'];look?:Agent['look'];appearance?:Agent['appearance'];motion?:Agent['motion'];skills:Agent['skills'];tone:string;language:string;tagline:string;price:number;/** the creator's price for one chat message */talkPrice:number;uses:number;publishedAt:string|null;/** "@handle" of a verified creator, else an anonymous id */creator:string;verified:boolean;mine:boolean;
 /** the agent's opening line and questions to start from (its creator wrote them) */greeting:string;starters:string[];/** it carries notes or sources from its creator */knows:boolean;/** how many sources (lib/knowledge.ts) */sources?:number;
 /** the day it last passed the agent check with the instructions it has now, else null */checked:string|null;
 /** share of helpful marks from other accounts, once there are enough */rating:{percent:number;count:number}|null;
 /** only on the single-agent endpoint: answered runs among its last ones */health?:{ok:number;total:number}};
export type LedgerEntry={id:string;delta:number;kind:string;ref:string|null;note:string;created:string};
export const starter:Agent={name:'My Dorian',skin:'atlas',motion:'Idle',personality:'Be curious, precise, and helpful. Explain your findings clearly. Cite sources when available, and say when something is uncertain.',tone:'Friendly',language:'English',skills:['summarize']};
export type Run={id:string;agent_id:string;agent_name:string;prompt:string;output:string;mode:string;cost:number;status:string;created:string;skill?:string|null;schedule_id?:string|null;/** a step of a team run: the team run's id and the step's place in it */relay?:string|null;step?:number|null;/** a message of a conversation with the agent: the conversation's id */talk?:string|null};
