/* Link previews per page. A link to the site used to show the same picture whatever page it pointed at; a post
   about one feature now carries that feature's own card. Each entry gives a page its title, description and picture
   (/api/og/page/<key>: the text below next to a different character each). To give another page its own card, add an
   entry here and use pageMetadata() in that page's route marker.
   Pages behind sign-in redirect a visitor without a session to /login?next=<path>; the login page takes the card of
   the page it leads to (cardForPath), so a link to such a page still previews as that page.
   The rewards card is filled with the live numbers by the picture route; the text here is what it shows when the
   program is not running on a server. Nothing here may promise a return: it names what the page shows. */
import type {Metadata} from 'next';
import {CARD_FILES} from './page-card-files';

export type PageCard={path:string;title:string;kicker:string;headline:string;lines:string[];character:string;description:string;
 /** 'left': the character stands on the left and the text on the right (the tiers card) */layout?:'left'};
export const PAGE_CARDS={
 rewards:{path:'/dashboard/rewards',title:'Holder rewards',kicker:'HOLDER REWARDS',headline:'What the vault holds, straight from the chain',
  lines:['The balance and each refill','Hour by hour, as settled','The claim that is yours'],character:'vesper',
  description:'A reading of the reward vault on BNB Smart Chain: what it holds, when it was refilled, which hours are settled and what you can claim.'},
 schedules:{path:'/dashboard/schedules',title:'Schedules',kicker:'SCHEDULES · DELIVERY · CHAT',headline:'Set the timer. The agent reports back.',
  lines:['One skill, as often as hourly','Results land in Telegram or Discord','It answers /ask in your Telegram group'],character:'volt',
  description:'Give an agent a timetable, receive every result in Telegram or Discord, and have it answer questions inside your Telegram chat.'},
 skills:{path:'/dashboard/skills',title:'Skills',kicker:'SKILLS',headline:'Choose four of ten.',
  lines:['Research, drafts, documents, code','A wallet monitor and a whale watch','Each run priced in credits'],character:'kira',
  description:'The ten skills on offer: research, writing, document answers, summaries, translation, ideas, code, plans, a wallet monitor and a whale watch. An agent carries up to four.'},
 studio:{path:'/dashboard/studio',title:'Studio',kicker:'STUDIO',headline:'Shape a character. Hand it the work.',
  lines:['25 people and a full wardrobe','33 motions, 6 powers','Up to four skills each'],character:'nova',
  description:'Choose one of 25 people, restyle it, write its brief, add skills and send it off on tasks.'},
 quests:{path:'/dashboard/quests',title:'Quests',kicker:'QUESTS',headline:'A few things to try, credits for each',
  lines:['The server confirms every quest','One reward per account','The list grows over time'],character:'zara',
  description:'Short tasks that show what your agent can do. Finishing one pays free credits, a single time per account.'},
 tiers:{path:'/tiers',title:'Holder tiers',kicker:'HOLDER TIERS',headline:'A bigger balance, wider limits',
  lines:['Extra schedules','Extra scheduled runs each day','Extra delivery channels'],character:'lumi',layout:'left',
  description:'The holder tiers side by side: what balance each one asks for and what it adds in schedules, daily scheduled runs, delivery channels and monthly credits. Balances are read from the chain and nothing is locked up.'},
 recipes:{path:'/recipes',title:'Recipes',kicker:'RECIPES',headline:'Automations that set themselves up',
  lines:['A whale brief each morning','A wallet check four times daily','One post or one plan a day'],character:'orbit',layout:'left',
  description:'Automations prepared in advance. A single click creates the agent, schedules its skill and routes every result to your Telegram or Discord.'},
 verified:{path:'/verified',title:'Verified creators',kicker:'VERIFIED CREATORS',headline:'The handle on the agent is checked.',
  lines:['The creator posts a code from their X account','A team member opens the post and confirms','Only then does the agent show the handle'],character:'juno',layout:'left',
  description:'How creators are verified on Harvex: they post a code from their own X account, someone on the team looks at the post, and after that their agents show the handle.'},
 plaza:{path:'/plaza',title:'Plaza',kicker:'PLAZA',headline:'One floor, every listed agent.',
  lines:['All of them standing side by side','Choose one and it comes forward','It answers in its own voice'],character:'juno',layout:'left',
  description:'The plaza gathers every agent listed on Harvex on a single floor. Choose one and it comes forward in 3D, ready to answer you in its own voice.'},
 top:{path:'/top',title:'This week',kicker:'THIS WEEK',headline:'Who was used most this week',
  lines:['Ranked across all listed agents','People first, runs second','Newcomers and climbers marked'],character:'juno',layout:'left',
  description:'A seven-day ranking of the agents listed on Harvex. Each is counted by the number of different people who used it, and the list marks who entered and who changed place.'},
 arena:{path:'/arena',title:'Arena',kicker:'ARENA',headline:'Same question, two answers.',
  lines:['Choose any two listed agents','Send them one question','Readers say which answer wins'],character:'juno',layout:'left',
  description:'In the arena you send one question to two agents on Harvex. Their answers appear next to each other on a page you can share, and readers choose between them.'},
 creators:{path:'/creators',title:'Creator agents',kicker:'CREATOR AGENTS',headline:'An agent that writes like you.',
  lines:['Bring posts you wrote yourself','The Studio turns them into a brief','Each message it answers pays you'],character:'echo',layout:'left',
  description:'Make an agent on Harvex that sounds like you. Paste posts you wrote, let the Studio draft its instructions from them, and earn for every message people send it. Nothing is used unless you paste it yourself.'},
 teams:{path:'/teams',title:'Agent teams',kicker:'AGENT TEAMS',headline:'Agents in a relay',
  lines:['First research, then a draft. First a summary, then a translation.','Use yours or agents that others listed','Each step shows up in History as its own run'],character:'atlas',layout:'left',
  description:'Put two or three agents on Harvex in a row. Each applies its skill and passes the answer along. The line can mix your own agents with ones listed by other creators.'},
 invite:{path:'/r',title:'You are invited',kicker:'INVITATION',headline:'Someone saved you a place on the stage',
  lines:['A person you restyle from head to shoes','Skills that hand back real work','Free credits once your first run is done'],character:'juno',layout:'left',
  description:'You have been invited to Harvex Agent Studio. Shape a character into an AI agent, give it skills and send it off on tasks. New accounts receive free credits after their first run.'},
 referral:{path:'/invite',title:'Invite friends',kicker:'INVITE FRIENDS',headline:'Bring a friend along',
  lines:['You both receive free credits','Your holder reward gets a boost','Find your link on the Quests page'],character:'juno',layout:'left',
  description:'Share your Harvex Agent Studio link with a friend. After their first run you both receive free credits, and your holder reward is boosted for as long as your friends hold HARVEX.'},
 discover:{path:'/dashboard/discover',title:'Discover',kicker:'DISCOVER',headline:'Agents for hire, by the message or the task',
  lines:['Chat with one, paying per message','Or hand it a whole task','List yours and collect per run'],character:'juno',
  description:'The agents creators have listed on Harvex. Chat with one in its own voice or hand it a task, paying in credits. You can list your own and collect on every run.'},
} satisfies Record<string,PageCard>;
export type PageCardKey=keyof typeof PAGE_CARDS;
export const isPageCard=(k:string):k is PageCardKey=>Object.prototype.hasOwnProperty.call(PAGE_CARDS,k);

/** The card of the page a path leads to (exact path, with or without a trailing slash), or null. */
export function cardForPath(path:string):PageCardKey|null{
 const p=String(path||'').split('?')[0].split('#')[0].replace(/\/+$/,'');
 return (Object.keys(PAGE_CARDS) as PageCardKey[]).find(k=>PAGE_CARDS[k].path===p)??null;
}
/** Title, description and preview picture of a page. The picture is the FILE public/og/<key>.png that
    scripts/render-page-cards.mjs wrote (user, 6 Oct 2026: the host's free plan cannot draw a card inside a request);
    its address carries the file's own mark, so a new picture has a new address. Only a card without a file falls
    back to the drawing route, where `version` changes the address. */
export function pageMetadata(key:PageCardKey,version='1'):Metadata{
 const c=PAGE_CARDS[key];const title=`${c.headline} · Harvex`;const file=(CARD_FILES as Record<string,string>)[key];const image=file?`/og/${key}.png?v=${file}`:`/api/og/page/${key}?v=${version}`;
 return {
  title:c.title,description:c.description,
  openGraph:{type:'website',siteName:'Harvex Agent Studio',title,description:c.description,url:c.path,images:[{url:image,width:1200,height:630,alt:`${c.title}: ${c.headline}`}]},
  twitter:{card:'summary_large_image',title,description:c.description,images:[image]},
 };
}
