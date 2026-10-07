/* What an agent knows about Harvex itself when someone asks it in a chat (client, 5 Oct 2026). Before this an agent
   treated $HARVEX like any unknown token ("what problem does it even solve?"), which on Harvex's own site read as doubt
   about the product. Now every chat run on a server where the token is set carries a short fact sheet, built from this
   server's own settings (so it always says what is live here and nothing else), and one rule for the question "should
   I buy?": the decision is the visitor's and the agent will not make it; it says what holding does today, that it is
   not audited, and where to see it.
   It is NOT a sales line and must not become one: no price talk, no promised return, never "buy". The agent check
   (lib/agent-check.ts) still asks that question and still fails an answer that tells people to buy, sell or hold.
   The sentences here must stay true to the live server: they repeat what the docs and the rewards page say, including
   what is not done (no independent audit, no published legal review). */
import {env} from 'cloudflare:workers';
import {chainConfig,rewardConfig,TIERS,fromE8} from './chain';
import {referralConfig} from './referrals';

const n=(v:bigint|number)=>Number(v).toLocaleString('en-US');

/** The fact sheet for a chat's system prompt, or null where the HARVEX token is not set (then nothing is added). */
export function harvexFacts():string|null{
 const c=chainConfig();if(!c.harvex)return null;
 const rc=rewardConfig(c);const ref=referralConfig();const tier=TIERS.find(t=>t.min>0n);
 // the public address of this site (APP_ORIGIN; without it the same fallback as app/layout.tsx)
 const host=String((env as unknown as {APP_ORIGIN?:string}).APP_ORIGIN||'https://harvex.studio').replace(/^https?:\/\//,'').replace(/\/+$/,'');
 const facts=[
  'Harvex Agent Studio is where people shape characters into AI agents, and others pay credits to chat with them or hand them tasks.',
  `The HARVEX token is live on ${c.name}.`,
  rc.live&&rc.token?`Wallets that hold at least ${n(rc.perUnitWhole)} HARVEX earn ${rc.token.symbol} holder rewards, settled every ${rc.periodHours===1?'hour':`${rc.periodHours} hours`}: $${fromE8(rc.rateE8)} per ${n(rc.perUnitWhole)} HARVEX per hour.`:null,
  tier?`Holder tiers start at ${n(tier.min)} HARVEX and raise the limits of an account's agents (schedules, scheduled runs a day, delivery channels).`:null,
  rc.live&&ref.enabled&&ref.boostPercent>0&&ref.boostFriends>0?`An inviter's holder reward goes up ${ref.boostPercent}% for every invited friend who also holds, for up to ${ref.boostFriends} friends.`:null,
  `Not done: no independent audit${rc.live?', and no published legal review of the reward payouts':''}.`,
 ].filter((x):x is string=>!!x);
 return ['About Harvex itself. Use this only when the user asks about Harvex, its token, or whether to buy, sell or hold it. These are facts from this server:',...facts.map(f=>`- ${f}`),
  `When someone asks whether to buy, sell or hold: say the decision is theirs and that you will not make it for them. Then say plainly, in your own voice, what holding HARVEX does today from the facts above, say that it is not audited, and point them to ${host}/dashboard/rewards to see it for themselves. Do not doubt or praise the token beyond these facts. Never predict a price, never promise a return, and never tell anyone to buy, sell or hold.`].join('\n');
}
