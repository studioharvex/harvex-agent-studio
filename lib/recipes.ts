/* Recipes: ready-made automations. One click makes the agent (a character, a persona, the skills), puts one of its
   skills on a schedule and, when the account has a delivery channel, sends each result there. Nothing here is special
   on the server: a recipe is used through the same endpoints as doing it by hand (POST /api/agents, POST
   /api/schedules), so every limit, price and check applies as usual.
   To add a recipe: add an entry. `agent` must pass lib/agent-schema.ts (name up to 40 characters, a known character
   and skills), `task` must be a task that makes sense every time it runs, and `needs` says what the server must have
   (`token`: the HARVEX token and its record; nothing: works everywhere). `ask` adds one text field whose value replaces
   {topic} in the task. Keep ids stable: links to /dashboard/schedules?recipe=<id> open that recipe.
   This file has no server imports: the page, the public gallery and the tests read it. */
import type {SkillId} from './agents';

export type Recipe={id:string;title:string;text:string;/** what arrives, in a few words */gives:string;
 agent:{name:string;skin:string;personality:string;tone:'Friendly'|'Professional'|'Concise';skills:SkillId[]};
 skill:SkillId;task:string;perDay:number;/** local hour of the first run */hour:number;needs?:'token';
 /** the schedule reports only on change (lib/watch.ts); watchMin: whale watch's smallest transfer, whole HARVEX */onChange?:boolean;watchMin?:number;
 ask?:{label:string;placeholder:string}};

export const RECIPES:Recipe[]=[
 {id:'whale-brief',title:'Morning whale report',text:'A report each morning on the past 24 hours of HARVEX: the largest transfers, holders that are new, and whatever stands out.',gives:'One short report on the token per day',
  agent:{name:'Holder Lookout',skin:'scout',personality:'You report on the HARVEX token from the numbers you are given. Be short and exact. Say what stands out and why it might matter, never guess who is behind an address, and never call a transfer a buy or a sell.',tone:'Concise',skills:['whales','monitor','summarize']},
  skill:'whales',task:'Write a short brief of what moved in HARVEX in the last 24 hours: the biggest transfers, new holders, and anything unusual against the supply.',perDay:1,hour:8,needs:'token'},
 {id:'wallet-watch',title:'Wallet reading every six hours',text:'Four times a day the agent reads your linked wallet and reports its balances and any change since the previous reading.',gives:'What the wallet holds and what changed, four times a day',
  agent:{name:'Address Keeper',skin:'guardian',personality:'You watch one wallet and report only what the reading shows. Lead with what changed. If nothing changed, say so in one line.',tone:'Concise',skills:['monitor','whales','summarize']},
  skill:'monitor',task:'Check my wallet and tell me what changed since the last check.',perDay:4,hour:8,needs:'token'},
 {id:'whale-alarm',title:'Whale alarm',text:'Checks once an hour. You get a report only if a single transaction moved at least 1,000,000 HARVEX, or an address is new among the ten largest holders.',gives:'A report only after a big change was found',
  agent:{name:'Holder Bell',skin:'vesper',personality:'You report on the HARVEX token from the numbers you are given, and only when something set the report off. Lead with what happened, in one or two lines, then the numbers. Never guess who is behind an address, and never call a transfer a buy or a sell.',tone:'Concise',skills:['whales','monitor','summarize']},
  skill:'whales',task:'Report what just happened in HARVEX: the big transfers and any new address among the biggest holders, against the supply.',perDay:24,hour:8,needs:'token',onChange:true,watchMin:1000000},
 {id:'wallet-alarm',title:'Wallet alarm',text:'Reads your linked wallet once an hour. A report is written only if a balance is different or the wallet has sent a transaction.',gives:'A report only after your wallet changed',
  agent:{name:'Address Bell',skin:'volt',personality:'You watch one wallet and report only what the reading shows, and only when something changed. Lead with what changed and by how much, in one or two lines, then the numbers.',tone:'Concise',skills:['monitor','whales','summarize']},
  skill:'monitor',task:'Check my wallet and tell me what changed since the last report.',perDay:24,hour:8,needs:'token',onChange:true},
 {id:'daily-post',title:'Daily post draft',text:'Each morning you receive a draft post on your topic, built around an opening line and a single point, ready for your edits.',gives:'A post draft every day',
  agent:{name:'Draft Desk',skin:'nova',personality:'You write short social posts that sound like a person, not an ad. One idea per post, a first line that earns the second, no hashtags unless asked, no invented facts or numbers.',tone:'Friendly',skills:['write','brainstorm','summarize']},
  skill:'write',task:'Write one post for X about {topic}. A strong first line, one clear point, under 280 characters. Give two alternatives for the first line.',perDay:1,hour:9,
  ask:{label:'Which topic should the posts cover?',placeholder:'e.g. AI agents at work, a product update, one lesson a week'}},
 {id:'morning-plan',title:'Plan for the day',text:'Starts each day with three priorities and a brief checklist, both worked out from your goal.',gives:'One day plan each morning',
  agent:{name:'Day Mapper',skin:'kira',personality:'You turn a goal into a realistic plan for one day. Three priorities at most, each with a first step small enough to start now. Flag one risk.',tone:'Professional',skills:['planner','brainstorm','summarize']},
  skill:'planner',task:'Plan my day toward this goal: {topic}. Three priorities, a short checklist with time estimates, and one risk to watch.',perDay:1,hour:7,
  ask:{label:'Which goal is this for?',placeholder:'e.g. get the beta out by Friday'}},
];
export const recipeById=(id:string|null|undefined)=>RECIPES.find(r=>r.id===id)||null;
/** The task as it will run: the topic put in, or the bare task when the recipe asks nothing. */
export const recipeTask=(r:Recipe,topic:string)=>r.task.replace('{topic}',topic.trim());
