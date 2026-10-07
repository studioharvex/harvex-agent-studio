/* Agent teams, the part the page, the public gallery and the tests share (no server imports; the rules that need the
   database are in lib/teams.ts).
   A team is a line of two or three steps. A step is one agent and one of its skills. Running a team runs the steps in
   order with the same task: the first agent answers it, and each next agent gets the task together with the answer of
   the one before it. Every step is a normal run (POST /api/runs with `relay`), so prices, limits, refunds, History and
   the creator's share of a published agent work exactly as for a run made by hand.
   A kit is a ready-made team: one click makes the agents it needs (an agent of that name with the skill is used again)
   and saves the team. To add a kit: add an entry. `agent` must pass lib/agent-schema.ts, `task` is the example put in
   the task box, `needs: 'token'` shows the kit only where the HARVEX token is set. Keep ids stable: links to
   /dashboard/teams?kit=<id> open that kit. */
import type {SkillId} from './agents';
import {RECIPES} from './recipes';

export const TEAM_STEPS_MIN=2,TEAM_STEPS_MAX=3;
/** Saved teams per account. */
export const TEAM_MAX=12;
export const TEAM_NAME_MAX=40;
/** Characters of an answer handed to the next step; a longer answer is cut there and the next agent is told so. */
export const HANDOVER_MAX=8000;

export type TeamStep={agentId:string;skill:SkillId};
type KitAgent={name:string;skin:string;personality:string;tone:'Friendly'|'Professional'|'Concise';skills:SkillId[]};
export type TeamKit={id:string;title:string;/** titles this kit had before: a team saved under one of them is still this kit's team */was?:string[];text:string;/** what comes out, in a few words */gives:string;
 steps:{agent:KitAgent;skill:SkillId;/** this step's part, in a few words */does:string}[];task:string;needs?:'token'};

// agents a recipe also makes are the same agent here: one "Draft Desk" serves the daily post and the teams
const fromRecipe=(id:string):KitAgent=>RECIPES.find(r=>r.id===id)!.agent;
const RESEARCHER:KitAgent={name:'Fact Finder',skin:'atlas',personality:'You answer with what the sources say. Give the answer first, then the three findings that carry it, each with where it comes from. Say plainly when something could not be checked.',tone:'Professional',skills:['research','summarize','document']};
const IDEAS:KitAgent={name:'Idea Bench',skin:'felix',personality:'You come up with ideas that differ from each other, not ten versions of one. Rank them by impact against effort and say in one line why the first one wins.',tone:'Friendly',skills:['brainstorm','write','summarize']};
const BRIEFER:KitAgent={name:'Digest Writer',skin:'mira',personality:'You shorten text without changing what it says. A one-line summary, then the points that matter, in the order a busy reader needs them.',tone:'Concise',skills:['summarize','document']};
const TRANSLATOR:KitAgent={name:'Language Bridge',skin:'ines',personality:'You translate so it reads as if written in the target language. Keep names, numbers and formatting. Flag a phrase that has no direct equivalent.',tone:'Professional',skills:['translate','summarize']};

export const TEAM_KITS:TeamKit[]=[
 {id:'research-thread',title:'Findings into a thread',was:['Research, then a thread'],text:'First the Fact Finder works out an answer and lists what supports it. Then the Draft Desk rewrites that brief as a thread that is ready to post.',gives:'A brief with sources, plus a thread built on it',
  steps:[{agent:RESEARCHER,skill:'research',does:'finds the answer'},{agent:fromRecipe('daily-post'),skill:'write',does:'turns the brief into a thread'}],
  task:'What changed for AI agents this year, and why does it matter for a small team? Then a thread of five posts for X about it.'},
 {id:'whales-post',title:'Token moves into a post',was:['Token report, then a post'],text:'First the Holder Lookout reports on the HARVEX transfers of the past 24 hours. Then the Draft Desk writes a single post based on that report.',gives:'A report on the token, plus one post built on it',needs:'token',
  steps:[{agent:fromRecipe('whale-brief'),skill:'whales',does:'reports on the token'},{agent:fromRecipe('daily-post'),skill:'write',does:'turns the report into a post'}],
  task:'What moved in HARVEX in the last 24 hours? Then one post for X about it, with the numbers exactly as read and no talk of price.'},
 {id:'idea-plan',title:'Ideas into a plan',was:['Ideas, then a plan'],text:'First the Idea Bench ranks several ideas for your goal. Then the Day Mapper breaks the top idea into steps and estimates the time for each.',gives:'A ranked list of ideas, plus a plan for the top one',
  steps:[{agent:IDEAS,skill:'brainstorm',does:'ranks the ideas'},{agent:fromRecipe('morning-plan'),skill:'planner',does:'plans the top idea'}],
  task:'Ways to get the first 100 users for a small product. Then a one-week plan for the best idea.'},
 {id:'brief-translate',title:'Summary in a second language',was:['Summary, then a translation'],text:'First the Digest Writer reduces a long text to its main points. Then the Language Bridge puts that summary into a different language.',gives:'The same summary in two languages',
  steps:[{agent:BRIEFER,skill:'summarize',does:'condenses the text'},{agent:TRANSLATOR,skill:'translate',does:'puts the summary in another language'}],
  task:'Summarize the text below in five points, then translate the summary into Spanish.\n\n(paste your text here)'},
];
/** the saved team that belongs to a kit: saved under its title today, or under a title the kit had earlier */
export const kitTeam=<T extends {name:string}>(k:TeamKit,teams:T[]):T|undefined=>teams.find(t=>t.name===k.title||!!k.was?.includes(t.name));
export const kitById=(id:string|null|undefined)=>TEAM_KITS.find(k=>k.id===id)||null;
