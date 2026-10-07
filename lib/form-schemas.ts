/* One zod schema per form of the dashboard, so every form says in the same way what is wrong and where.
   - The server checks everything again: these mirror its rules (same limits, same patterns), they do not replace
     them. When a rule changes on the server, change it here too.
   - Loaded on the first check through components/app/form.tsx (useFormCheck). Never import this file statically
     from a page: zod stays out of the first load (see "Performance" in CLAUDE.md).
   - A schema is a function of its context (limits the page got from the server: a balance, a maximum). */
import {z} from 'zod';
import {VOICE_MAX,VOICE_MIN} from './voice-draft';
import {KB_SOURCE_MAX,KB_TITLE_MAX,KB_TOTAL_MAX} from './knowledge-text';
import {TEAM_NAME_MAX} from './team-kits';

const n=(v:number)=>v.toLocaleString('en-US');
/** lib/notify.ts HOOK: only real Discord webhook addresses */
const DISCORD_HOOK=/^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/(?:v\d{1,2}\/)?webhooks\/\d{15,22}\/[A-Za-z0-9_-]{40,120}\/?$/;
/** lib/creators.ts HANDLE */
const X_HANDLE=/^[A-Za-z0-9_]{1,15}$/;

export const FORMS={
 /** New schedule (app/api/schedules/route.ts `create`) */
 schedule:(_:Record<string,never>={})=>z.object({
  prompt:z.string().trim().min(3,'Say what the agent should do each time: at least 3 characters.').max(4000,'Keep the task under 4,000 characters.'),
  time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/,'Choose the time of the first run.'),
 }),
 /** Discord delivery channel */
 discord:(_:Record<string,never>={})=>z.object({
  url:z.string().trim().regex(DISCORD_HOOK,'That is not a Discord webhook address. In Discord: channel settings, Integrations, Webhooks, Copy Webhook URL.'),
 }),
 /** Top-up amount in the pay token */
 topup:(_:Record<string,never>={})=>z.object({
  amount:z.string().trim().min(1,'Enter how much you want to pay.').regex(/^\d+(\.\d+)?$/,'Use digits only, for example 5 or 2.5.').refine(v=>Number(v)>0,'The amount must be more than 0.').refine(v=>(v.split('.')[1]||'').length<=6,'Use at most 6 decimals.'),
 }),
 /** A transaction hash pasted by hand */
 txHash:(_:Record<string,never>={})=>z.object({
  hash:z.string().trim().regex(/^0x[0-9a-fA-F]{64}$/,'A transaction hash is 0x followed by 64 characters (0-9, a-f). Copy it from your wallet or the explorer.'),
 }),
 /** Earnings claim: between the server's minimum and what is claimable */
 claim:(c:{min:number;max:number})=>z.object({
  credits:z.number({error:'Enter how many credits to claim.'}).int('Claim whole credits.').min(c.min,`The smallest claim is ${n(c.min)} credits.`).max(c.max,c.max<c.min?`You have ${n(c.max)} claimable credits; a claim needs at least ${n(c.min)}.`:`You can claim up to ${n(c.max)} credits.`),
  address:z.string().regex(/^0x[0-9a-fA-F]{40}$/,'Choose the wallet that receives the payment.'),
 }),
 /** Creator verification, step 1 */
 handle:(_:Record<string,never>={})=>z.object({
  handle:z.string().trim().transform(s=>s.replace(/^@/,'')).pipe(z.string().min(1,'Enter your X handle.').regex(X_HANDLE,'An X handle has letters, numbers and underscores only, up to 15 characters.')),
 }),
 /** Creator verification, step 2: the post must be from the handle that was given the code */
 proof:(c:{handle:string})=>z.object({
  // lib/creators.ts POST
  url:z.string().trim().regex(/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{5,25}(?:[/?#].*)?$/i,`Paste the link to your post: https://x.com/${c.handle}/status/…`)
   .refine(u=>(u.match(/\.com\/([A-Za-z0-9_]{1,15})\//i)?.[1]||'').toLowerCase()===c.handle.toLowerCase(),`That post is from another account. It must be posted by @${c.handle}.`),
 }),
 /** Agent source (lib/knowledge.ts addSource) */
 source:(c:{max?:number;titleMax?:number;used?:number;total?:number}={})=>{
  const max=c.max??KB_SOURCE_MAX,titleMax=c.titleMax??KB_TITLE_MAX,room=(c.total??KB_TOTAL_MAX)-(c.used??0);
  return z.object({
   title:z.string().trim().min(1,'Give the source a title. It is shown under the answers that use it.').max(titleMax,`Keep the title under ${titleMax} characters.`),
   text:z.string().trim().min(40,'Paste at least a few sentences (40 characters or more).').max(max,`One source holds up to ${n(max)} characters. Split it into two.`)
    .refine(t=>t.length<=room,`This agent has room for ${n(Math.max(0,room))} more characters of sources. Shorten the text or remove a source.`),
  });
 },
 /** "Try a question" under the sources */
 question:(_:Record<string,never>={})=>z.object({question:z.string().trim().min(3,'Type a question someone might ask.').max(500,'Keep the question under 500 characters.')}),
 /** Creator voice (lib/voice.ts) */
 voice:(c:{min?:number;max?:number}={})=>{
  const min=c.min??VOICE_MIN,max=c.max??VOICE_MAX;
  return z.object({
   posts:z.string().trim().min(min,`Paste more of your posts: at least ${n(min)} characters are needed to hear a voice.`).max(max,`Keep it under ${n(max)} characters.`),
   own:z.literal(true,{error:'Confirm that these are your own posts.'}),
  });
 },
 /** Team: a name and two or three complete steps */
 team:(c:{nameMax?:number}={})=>z.object({
  name:z.string().trim().min(1,'Give the team a name.').max(c.nameMax??TEAM_NAME_MAX,`Keep the name under ${c.nameMax??TEAM_NAME_MAX} characters.`),
  steps:z.array(z.object({agentId:z.string().min(1,'Choose an agent for every step.'),skill:z.string().min(1,'Choose a skill for every step.')})).min(2,'A team has at least two steps.').max(3,'A team has at most three steps.'),
 }),
 /** The task a team (or an agent) is given */
 task:(c:{max?:number}={})=>z.object({task:z.string().trim().min(3,'Say what you want at the end: at least 3 characters.').max(c.max??6000,`Keep the task under ${n(c.max??6000)} characters.`)}),
} as const;

export type FormName=keyof typeof FORMS;
export type FormContext<K extends FormName>=Parameters<(typeof FORMS)[K]>[0];
export type FormValues<K extends FormName>=z.infer<ReturnType<(typeof FORMS)[K]>>;
export type FieldErrors=Record<string,string>;

/** Checks one form. The first message of each field is kept, under the field's name (the first step of its path). */
export function checkForm<K extends FormName>(name:K,values:unknown,context?:FormContext<K>):{ok:true;data:FormValues<K>}|{ok:false;errors:FieldErrors}{
 const schema=(FORMS[name] as (c?:unknown)=>z.ZodType)(context);
 const r=schema.safeParse(values);
 if(r.success)return {ok:true,data:r.data as FormValues<K>};
 const errors:FieldErrors={};
 for(const i of r.error.issues){const k=String(i.path[0]??'form');if(!errors[k])errors[k]=i.message;}
 return {ok:false,errors};
}
