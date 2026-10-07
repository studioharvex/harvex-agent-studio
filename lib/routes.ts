/* URL routes. Every screen has its own path; the app shell (app/studio.tsx, mounted once in the root layout)
   reads the pathname to decide what to render, so state such as the agent draft survives navigation.
   Public site:  /  /docs[/slug]  /whitepaper[/slug]  /roadmap  /login  /a/<agent id> (one published agent)
                 /whales (the HARVEX token's biggest transfers and holders)  /s/<id> (one shared answer)
                 /tiers (what each holder tier needs and gives)  /recipes (ready-made automations)
                 /r/<code> (an invite link)  /invite (what inviting a friend gives)
                 /teams (agents that hand their work to the next one)  /creators (an agent in your own voice)
                 /plaza (the published agents in one place; click one to talk)
                 /verified (how a creator's X handle gets on their agents)
                 /arena (two agents, one question)  /arena/<id> (one duel)
                 /top (the agents used most in the last seven days)
   Dashboard:    /dashboard  /dashboard/{studio,agents,teams,discover,skills,schedules,quests,history,credits,wallet,rewards,profile}
                 /dashboard/docs[/slug]  /dashboard/whitepaper[/slug]  /dashboard/roadmap
   Signed-in only (proxy.ts redirects to /login?next=...): see PROTECTED_PATHS. */
export type View='closed'|'home'|'login'|'notfound'|'agent'|'shared'|'whales'|'tiers'|'recipes'|'invite'|'referral'|'teamup'|'creators'|'plaza'|'verified'|'arena'|'duel'|'top'|'overview'|'profile'|'rewards'|'wallet'|'studio'|'agents'|'teams'|'discover'|'skills'|'schedules'|'quests'|'activity'|'credits'|'docs'|'paper'|'roadmap';
export type Area='site'|'dash';
export type Route={view:View;area:Area;doc?:string};

const DASH:Partial<Record<View,string>>={overview:'',studio:'studio',agents:'agents',teams:'teams',discover:'discover',skills:'skills',schedules:'schedules',quests:'quests',activity:'history',
 credits:'credits',wallet:'wallet',rewards:'rewards',profile:'profile',docs:'docs',paper:'whitepaper',roadmap:'roadmap'};
const DASH_BY_SEGMENT=Object.fromEntries(Object.entries(DASH).map(([v,s])=>[s,v as View])) as Record<string,View>;
/** Views that exist on the public site too (with a different, editorial layout). */
const SITE:Partial<Record<View,string>>={home:'/',login:'/login',docs:'/docs',paper:'/whitepaper',roadmap:'/roadmap'};

/** Paths that need a session. The proxy only checks that a session cookie exists; the APIs verify it. */
export const PROTECTED_PATHS=['/dashboard','/dashboard/agents','/dashboard/schedules','/dashboard/history','/dashboard/credits','/dashboard/wallet','/dashboard/profile'];
export const isProtectedPath=(p:string)=>{const n=p.replace(/\/+$/,'')||'/';return PROTECTED_PATHS.includes(n);};

/** Public page of one published agent: the link people post. The id is the agent's id (a UUID). */
const AGENT_PATH_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const agentPath=(id:string)=>`/a/${id}`;
/** Public page of one shared answer (lib/share.ts). Its id is case-sensitive: never lower-case it. */
const SHARE_PATH_ID=/^[A-Za-z0-9_-]{16}$/;
/** An invite link (lib/referrals.ts): eight letters and digits without the ones that read alike. */
const INVITE_PATH_CODE=/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

/** Path for a view. Docs, whitepaper and roadmap live in both areas; everything else has one home. */
export function pathFor(view:View,doc?:string,area:Area='dash'):string{
 if(view==='agent')return doc?agentPath(doc):'/dashboard/discover';
 if(view==='whales')return '/whales';
 if(view==='tiers')return '/tiers';
 if(view==='recipes')return '/recipes';
 if(view==='invite')return doc?`/r/${doc}`:'/';
 if(view==='referral')return '/invite';
 if(view==='teamup')return '/teams';
 if(view==='creators')return '/creators';
 if(view==='plaza')return '/plaza';
 if(view==='verified')return '/verified';
 if(view==='arena')return '/arena';
 if(view==='top')return '/top';
 if(view==='duel')return doc?`/arena/${doc}`:'/arena';
 if(view==='shared')return doc?`/s/${doc}`:'/';
 if(view==='home'||view==='login'||view==='notfound')return view==='login'?'/login':'/';
 const docs=view==='docs'||view==='paper';
 if(area==='site'&&SITE[view])return SITE[view]+(docs&&doc?`/${doc}`:'');
 const seg=DASH[view];if(seg===undefined)return '/';
 return '/dashboard'+(seg?`/${seg}`:'')+(docs&&doc?`/${doc}`:'');
}

export function parsePath(pathname:string):Route{
 const parts=(pathname||'/').split('?')[0].split('#')[0].split('/').filter(Boolean).map(decodeURIComponent);
 if(!parts.length)return {view:'home',area:'site'};
 const [a,b,c,...rest]=parts;
 if(a==='login'&&!b)return {view:'login',area:'site'};
 if((a==='docs'||a==='whitepaper')&&!c)return {view:a==='docs'?'docs':'paper',area:'site',doc:b};
 if(a==='roadmap'&&!b)return {view:'roadmap',area:'site'};
 if(a==='whales'&&!b)return {view:'whales',area:'site'};
 if(a==='tiers'&&!b)return {view:'tiers',area:'site'};
 if(a==='recipes'&&!b)return {view:'recipes',area:'site'};
 if(a==='invite'&&!b)return {view:'referral',area:'site'};
 if(a==='teams'&&!b)return {view:'teamup',area:'site'};
 if(a==='creators'&&!b)return {view:'creators',area:'site'};
 if(a==='plaza'&&!b)return {view:'plaza',area:'site'};
 if(a==='verified'&&!b)return {view:'verified',area:'site'};
 if(a==='arena'&&!b)return {view:'arena',area:'site'};
 if(a==='top'&&!b)return {view:'top',area:'site'};
 // a duel's id is case-sensitive, like a shared answer's
 if(a==='arena'&&b&&!c&&SHARE_PATH_ID.test(b))return {view:'duel',area:'site',doc:b};
 if(a==='r'&&b&&!c&&INVITE_PATH_CODE.test(b.toUpperCase()))return {view:'invite',area:'site',doc:b.toUpperCase()};
 if(a==='s'&&b&&!c&&SHARE_PATH_ID.test(b))return {view:'shared',area:'site',doc:b};
 if(a==='a'&&b&&!c&&AGENT_PATH_ID.test(b))return {view:'agent',area:'site',doc:b.toLowerCase()};
 if(a==='dashboard'){
  if(!b)return {view:'overview',area:'dash'};
  const v=DASH_BY_SEGMENT[b];
  if(v&&(v==='docs'||v==='paper')&&!rest.length)return {view:v,area:'dash',doc:c};
  if(v&&!c)return {view:v,area:'dash'};
 }
 return {view:'notfound',area:'site'};
}

/** Legacy hash links (#studio, #agents, ...) from before routes existed. */
export const LEGACY_HASH:Record<string,View>={studio:'studio',agents:'agents',teams:'teams',discover:'discover',skills:'skills',schedules:'schedules',quests:'quests',activity:'activity',credits:'credits',wallet:'wallet',rewards:'rewards',docs:'docs',paper:'paper',roadmap:'roadmap'};
