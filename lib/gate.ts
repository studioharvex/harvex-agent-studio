/* What is not open yet (user, 7 Oct 2026, before a deploy: "parts of the UI are not opened yet; when someone tries
   to open them, the middleware shows restricted / under development, something professional").
   The server setting CLOSED_SECTIONS names the closed parts, separated by commas: chain, app, community, signin
   (or `all`). Empty = everything is open, which is what local development and the tests use.
     chain      Wallet & chain, Holder rewards, Holder tiers, Whale watch
     app        everything under /dashboard: Studio, My agents, Discover, Skills, History, Credits, Schedules, ...
     community  Plaza, Arena, This week, Recipes, Teams, Creators, Verified, Invite, an agent's page, a shared answer
     signin     the login page and signing in with a wallet
   A closed part is closed twice: proxy.ts refuses its API routes (403) and the app shell draws the "not open yet"
   page instead of the screen (app/studio.tsx, components/harvex/closed-page.tsx). There is no way in for anyone
   while a part is closed (asked through the question dialog: no access code). To open a part: take it out of
   CLOSED_SECTIONS and deploy again. Pure: no server imports, so the browser bundle can use it. */
export type Section='chain'|'app'|'community'|'signin';
export const SECTION_IDS:readonly Section[]=['chain','app','community','signin'];

/** The setting as a list, in a fixed order. Unknown words are ignored; `all` closes every part. */
export function parseClosed(value:unknown):Section[]{
 const words=String(value??'').toLowerCase().split(/[\s,;]+/).filter(Boolean);
 return words.includes('all')?[...SECTION_IDS]:SECTION_IDS.filter(s=>words.includes(s));
}

const COMMUNITY=['plaza','arena','top','recipes','teams','creators','verified','invite','r','a','s'];
/** The closed part a page belongs to, or null when the page is open. */
export function gateOf(pathname:string,closed:readonly Section[]):Section|null{
 if(!closed.length)return null;
 const [a='',b='']=pathname.split('?')[0].split('#')[0].split('/').filter(Boolean);
 let part:Section|null=null;
 if(a==='login')part='signin';
 else if(a==='tiers'||a==='whales')part='chain';
 else if(a==='dashboard')part=closed.includes('app')?'app':(b==='wallet'||b==='rewards')?'chain':null;
 else if(COMMUNITY.includes(a))part='community';
 return part&&closed.includes(part)?part:null;
}

/* API routes by part (the folder under /api). /api/chain stays open: it is the public network setting the open
   pages read. /api/og/page/<key> stays open: those cards are files. */
const API:Record<Section,string[]>={
 chain:['wallet','topups','claims','tier','tiers','rewards','whales','og/whales'],
 app:['agents','runs','workspace','schedules','notify','teams','quests','knowledge','voice','rate','creator','referrals','ai'],
 community:['market','board','arena','talk','share','og/agent','og/share','og/arena'],
 signin:['auth'],
};
/** The closed part an API route belongs to, or null. "Who am I" and signing out are never refused. */
export function gateOfApi(pathname:string,closed:readonly Section[]):Section|null{
 const p=pathname.split('?')[0].replace(/^\/api\//,'').replace(/\/+$/,'');
 if(p==='auth/me'||p==='auth/logout')return null;
 for(const s of closed)if(API[s].some(x=>p===x||p.startsWith(x+'/')))return s;
 return null;
}
export const CLOSED_ERROR='This part of Harvex is not open yet.';
