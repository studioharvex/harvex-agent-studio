// Container entrypoint (Docker / Coolify). Runs the built Worker on workerd through `wrangler dev --local`,
// with D1 stored as SQLite under HARVEX_DATA_DIR (a persistent volume). Steps:
//   1. refuse unsafe settings (missing secret, dev-only auth flags, http origin in production)
//   2. write the Worker's variables to dist/server/.dev.vars from an allow-list of environment variables
//      (nothing else from the container environment reaches the Worker)
//   3. apply drizzle/*.sql migrations that have not run yet (tracked in the d1_migrations table)
//   4. start the server on 0.0.0.0:PORT and forward stop signals
//   5. every minute: call the scheduler (scheduled agent runs, holder recorder); every day: back up the database
import {spawn,spawnSync} from 'node:child_process';
import http from 'node:http';
import {mkdirSync,readFileSync,readdirSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const E=process.env;const DATA=(E.HARVEX_DATA_DIR||'/data').split(path.sep).join('/');const PORT=String(E.PORT||8787);
const devFlags=E.HARVEX_ALLOW_DEV_FLAGS==='true';
const fail=m=>{console.error(`[harvex] ${m}`);process.exit(1);};
const log=m=>console.log(`[harvex] ${m}`);

// 1. safety checks
const origin=(E.APP_ORIGIN||'').replace(/[/]+$/,'');
if(!/^https?:\/\/[^/\s]+$/.test(origin))fail('Set APP_ORIGIN to the public URL of the site, for example https://harvex.example (no path).');
if(origin.startsWith('http:')&&!devFlags)fail('APP_ORIGIN must use https on a public server. Set HARVEX_ALLOW_DEV_FLAGS=true only for a local test.');
if((E.BETTER_AUTH_SECRET||'').length<32||/\s/.test(E.BETTER_AUTH_SECRET||''))fail('Set BETTER_AUTH_SECRET to 32+ random characters: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"');
for(const k of ['AUTH_TRUST_SITES_HEADERS'])
 if(E[k]==='true'&&!devFlags)fail(`${k}=true lets anyone sign in as anyone on a public server. Remove it (HARVEX_ALLOW_DEV_FLAGS=true is for local tests only).`);
if(E.CLAIMS_ADMIN_TOKEN&&E.CLAIMS_ADMIN_TOKEN.length<32)fail('CLAIMS_ADMIN_TOKEN must be 32+ characters (or leave it empty).');
// numbers that scale money: a typo here mis-prices every top-up, claim or reward, so they are checked before anything starts
const DECIMALS=/^(?:\d|[12]\d|3[0-6])$/;
for(const k of ['PAY_TOKEN_DECIMALS','REWARD_TOKEN_DECIMALS'])if(E[k]&&!DECIMALS.test(E[k]))fail(`${k} must be a whole number from 0 to 36 (USDT on BNB Smart Chain: 18).`);
if(E.CREDITS_PER_TOKEN&&!/^[1-9]\d{0,6}$/.test(E.CREDITS_PER_TOKEN))fail('CREDITS_PER_TOKEN must be a whole number of credits per token, at least 1 (default 100).');
for(const k of ['REWARD_PERIOD_HOURS','REWARD_PRICE_MAX_AGE_HOURS'])if(E[k]&&!/^[1-9]\d{0,3}$/.test(E[k]))fail(`${k} must be a whole number of hours, at least 1.`);
for(const k of ['TOPUP_MIN_CONFIRMATIONS','CLAIM_MIN_CREDITS','TIER_BASE_CREDITS','REWARD_START_BLOCK','PLATFORM_FEE_BPS','SKILL_TRIAL_LIMIT','SCHEDULE_RUN_COST','SCHEDULE_MAX','SCHEDULE_DAILY_RUNS','AI_DAILY_FREE_RUNS','AI_DAILY_SEARCH_RUNS'])
 if(E[k]&&!/^\d{1,12}$/.test(E[k]))fail(`${k} must be a whole number.`);
// an entry with a typo would silently stop being excluded and start earning holder rewards
if(E.REWARD_EXCLUDE)for(const a of E.REWARD_EXCLUDE.split(',').map(x=>x.trim()).filter(Boolean))if(!/^0x[0-9a-fA-F]{40}$/.test(a))fail(`REWARD_EXCLUDE: "${a.slice(0,50)}" is not a 0x address (40 hex characters). Fix or remove it.`);
// BNB Smart Chain mainnet moves real money: only the official USDT, a treasury, and settled (not soft) top-ups.
// Binance-Peg BSC-USD (USDT), 18 decimals: bscscan.com/token/0x55d398326f99059fF775485246999027B3197955
const USDT_MAINNET='0x55d398326f99059ff775485246999027b3197955';
for(const k of ['PAY_TOKEN_ADDRESS','TOPUP_TREASURY','CLAIMS_CONTRACT','HARVEX_TOKEN_ADDRESS','REWARD_TOKEN_ADDRESS','REWARD_CONTRACT','REWARD_PRICE_FEED'])
 if(E[k]&&!/^0x[0-9a-fA-F]{40}$/.test(E[k]))fail(`${k} must be a 0x address (40 hex characters) or empty.`);
if(E.CHAIN_NETWORK==='mainnet'){
 if(devFlags)fail('HARVEX_ALLOW_DEV_FLAGS=true is for local tests only and is refused on mainnet.');
 if(E.CHAIN_ID&&E.CHAIN_ID!=='56')fail('CHAIN_ID does not match BNB Smart Chain mainnet (56). Remove CHAIN_ID.');
 for(const k of ['CHAIN_RPC_URL','CHAIN_LOGS_RPC_URL'])if(E[k]&&!/^https:\/\/\S+$/.test(E[k]))fail(`${k} must be an https URL on mainnet.`);
 if(E.PAY_TOKEN_ADDRESS?.toLowerCase()===USDT_MAINNET&&E.PAY_TOKEN_DECIMALS&&E.PAY_TOKEN_DECIMALS!=='18')fail('USDT on BNB Smart Chain has 18 decimals: set PAY_TOKEN_DECIMALS=18 or leave it empty. Another value mis-prices every top-up.');
 if(E.REWARD_TOKEN_ADDRESS?.toLowerCase()===USDT_MAINNET&&E.REWARD_TOKEN_DECIMALS&&E.REWARD_TOKEN_DECIMALS!=='18')fail('REWARD_TOKEN_DECIMALS must be 18 for USDT on BNB Smart Chain. Another value mis-prices every reward.');
 if(E.PAY_TOKEN_ADDRESS&&E.PAY_TOKEN_ADDRESS.toLowerCase()!==USDT_MAINNET&&E.HARVEX_ALLOW_CUSTOM_PAY_TOKEN!=='true')
  fail(`On mainnet PAY_TOKEN_ADDRESS must be USDT (${USDT_MAINNET}, check it on bscscan.com).`);
 if(E.PAY_TOKEN_ADDRESS&&!E.TOPUP_TREASURY)fail('Mainnet top-ups need TOPUP_TREASURY (your multisig address).');
 if(E.TOPUP_FINALITY==='soft')fail('TOPUP_FINALITY=soft is for tests only. Use safe (default) or finalized on mainnet.');
 if(E.CLAIMS_ENABLED==='true'&&!E.CLAIMS_CONTRACT)fail('CLAIMS_ENABLED=true needs CLAIMS_CONTRACT.');
 if(E.REWARDS_ENABLED==='true'&&!(E.HARVEX_TOKEN_ADDRESS&&E.REWARD_TOKEN_ADDRESS&&E.REWARD_CONTRACT))fail('REWARDS_ENABLED=true needs HARVEX_TOKEN_ADDRESS, REWARD_TOKEN_ADDRESS and REWARD_CONTRACT.');
 // no reward token is fixed for this project: any BEP-20 passes, but its symbol and decimals must be stated, because
 // the defaults (USDT, 18) would mislabel and mis-price another token
 if(E.REWARD_TOKEN_ADDRESS&&E.REWARD_TOKEN_ADDRESS.toLowerCase()!==USDT_MAINNET&&!(E.REWARD_TOKEN_SYMBOL&&/^\d{1,2}$/.test(E.REWARD_TOKEN_DECIMALS||'')))
  fail('REWARD_TOKEN_ADDRESS is not USDT: set REWARD_TOKEN_SYMBOL and REWARD_TOKEN_DECIMALS to what the token contract says.');
 if(E.REWARD_CONTRACT&&E.CLAIMS_CONTRACT&&E.REWARD_CONTRACT.toLowerCase()===E.CLAIMS_CONTRACT.toLowerCase())fail('REWARD_CONTRACT must be a separate HarvexClaims instance, not CLAIMS_CONTRACT.');
 if(E.REWARDS_ENABLED==='true'&&!E.REWARD_PRICE_FEED)log('warning: no REWARD_PRICE_FEED; the reward token price must be set by hand (/api/rewards/admin {"action":"price"}).');
 // the public RPC refuses eth_getLogs and keeps no old state (measured 5 Oct 2026): the holder record reads Transfer
 // logs, and monthly tier snapshots and the vault's deploy-block search read older blocks
 if(E.REWARDS_ENABLED==='true'&&!E.CHAIN_RPC_URL&&!E.CHAIN_LOGS_RPC_URL)fail('REWARDS_ENABLED=true needs CHAIN_RPC_URL (or CHAIN_LOGS_RPC_URL) from an RPC provider: the public RPC refuses eth_getLogs, so holders could not be recorded.');
 if(!E.CHAIN_RPC_URL)log('warning: no CHAIN_RPC_URL; using the public mainnet RPC, which is rate-limited, refuses eth_getLogs and keeps no old state. Tier snapshots, Whale watch and rewards need a provider RPC with archive access.');
 log(`MAINNET: top-ups ${E.PAY_TOKEN_ADDRESS?'ON (real USDT)':'off'}, claims ${E.CLAIMS_ENABLED==='true'?'ON':'off'}, tiers ${E.HARVEX_TOKEN_ADDRESS?'ON':'off'}, holder rewards ${E.REWARDS_ENABLED==='true'?'ON':'off'}`);
}

// 2. Worker variables: allow-list only
const KEYS=['APP_ORIGIN','BETTER_AUTH_SECRET','AUTH_TRUST_SITES_HEADERS',
 'AI_ENABLED','CLOSED_SECTIONS','ANTHROPIC_API_KEY','ANTHROPIC_MODEL','ANTHROPIC_EFFORT','ANTHROPIC_MAX_TOKENS','ANTHROPIC_BASE_URL','LIVE_RUN_COST','TALK_COST','VOICE_COST','CHECK_COST','CREATOR_ADMINS','LIVE_DAILY_PER_USER','AI_DAILY_RUNS','AI_DAILY_FREE_RUNS','AI_DAILY_SEARCH_RUNS','AI_SEARCH_FREE_CREDITS','OPENAI_API_KEY','OPENAI_MODEL','AI_GATEWAY_URL','AI_GATEWAY_KEY','AI_BASE_URL','AI_API_KEY','AI_MODEL','AI_REASONING_EFFORT','AI_WEB_SEARCH','AI_MAX_TOKENS','AI_MODEL_FREE','STARTING_CREDITS','LIVE_SKILL_COSTS','FREE_REFILL_CREDITS','FREE_REFILL_HOURS','LIMIT_WINDOW_HOURS','FREE_HEAVY_PER_WINDOW','PAID_HEAVY_PER_WINDOW','HEAVY_SKILLS','REWARD_ROOT_POSTER_KEY','PLATFORM_FEE_BPS','SKILL_TRIAL_LIMIT',
 'SCHEDULES_ENABLED','SCHEDULE_RUN_COST','SCHEDULE_MAX','SCHEDULE_DAILY_RUNS','SCHEDULER_TOKEN','NOTIFY_DISCORD','NOTIFY_MAX','TELEGRAM_BOT_TOKEN','QUESTS_ENABLED','QUEST_CREDITS','REFERRALS_ENABLED','REFERRAL_CREDITS','REFERRAL_MAX','REFERRAL_BOOST_PERCENT','REFERRAL_BOOST_FRIENDS',
 'CHAIN_NETWORK','CHAIN_ID','CHAIN_RPC_URL','CHAIN_LOGS_RPC_URL','PAY_TOKEN_ADDRESS','PAY_TOKEN_SYMBOL','PAY_TOKEN_DECIMALS','TOPUP_TREASURY','CREDITS_PER_TOKEN',
 'TOPUP_MIN_CONFIRMATIONS','TOPUP_FINALITY','CLAIMS_ENABLED','CLAIMS_CONTRACT','CLAIM_MIN_CREDITS','CLAIMS_ADMIN_TOKEN','HARVEX_TOKEN_ADDRESS','TIER_BASE_CREDITS',
 'REWARDS_ENABLED','REWARD_TOKEN_ADDRESS','REWARD_TOKEN_SYMBOL','REWARD_TOKEN_DECIMALS','REWARD_CONTRACT','REWARD_HARVEX_PER_UNIT','REWARD_USD_PER_UNIT_HOUR','REWARD_PRICE_FEED','REWARD_PRICE_MAX_AGE_HOURS',
 'REWARD_START_BLOCK','REWARD_EXCLUDE','REWARD_PERIOD_HOURS','REWARD_AUTO'];
// earlier reward rules (weekly, then % of circulating) were replaced by the fixed rate: say so
for(const old of ['REWARD_MIN_HOLD','REWARD_MIN_HOLD_DAYS','REWARD_PERIOD_DAYS','REWARD_MIN_HOLD_PCT','REWARD_MIN_HOLD_HOURS','REWARD_DRIP_HOURS','REWARD_SPLIT'])
 if(E[old])log(`warning: ${old} is no longer used; remove it. The rule is REWARD_HARVEX_PER_UNIT (default 3000000) HARVEX = REWARD_USD_PER_UNIT_HOUR (default 0.01) USD per hour.`);
if(E.REWARD_HARVEX_PER_UNIT&&!/^[1-9]\d{0,14}$/.test(E.REWARD_HARVEX_PER_UNIT))fail('REWARD_HARVEX_PER_UNIT must be a whole number of HARVEX, for example 3000000.');
if(E.REWARD_USD_PER_UNIT_HOUR&&!(/^\d{1,12}(\.\d{1,8})?$/.test(E.REWARD_USD_PER_UNIT_HOUR)&&Number(E.REWARD_USD_PER_UNIT_HOUR)>0))fail('REWARD_USD_PER_UNIT_HOUR must be a USD amount with at most 8 decimals, for example 0.01.');
// Claude needs a Console API key (sk-ant-api...). A subscription token (Claude Pro/Max, sk-ant-oat...) is for the
// subscriber's own use in Claude apps, not for serving other people from a server: refuse it instead of failing later.
if(E.ANTHROPIC_API_KEY&&/^sk-ant-oat/.test(E.ANTHROPIC_API_KEY))fail('ANTHROPIC_API_KEY is a Claude subscription token (sk-ant-oat...). Create an API key at console.anthropic.com (Settings → API keys) and set a spend limit there.');
if(E.ANTHROPIC_API_KEY&&!/^sk-ant-api/.test(E.ANTHROPIC_API_KEY))log('warning: ANTHROPIC_API_KEY does not look like a Console API key (sk-ant-api...).');
const SKILLS=['research','write','document','summarize','translate','brainstorm','code','planner','monitor','whales'];
if(E.LIVE_SKILL_COSTS&&E.LIVE_SKILL_COSTS!=='flat'&&!E.LIVE_SKILL_COSTS.split(',').every(p=>{const [k,v,...rest]=p.split('=').map(x=>x.trim());return !rest.length&&SKILLS.includes(k)&&/^\d{1,3}$/.test(v||'');}))fail('LIVE_SKILL_COSTS must look like research=12,document=6 (skills: '+SKILLS.join(', ')+') or be flat.');
if(E.HEAVY_SKILLS&&!E.HEAVY_SKILLS.split(',').every(k=>SKILLS.includes(k.trim())))fail('HEAVY_SKILLS must be a comma-separated list of skills: '+SKILLS.join(', ')+'.');
if(E.REWARD_ROOT_POSTER_KEY&&!/^0x[0-9a-fA-F]{64}$/.test(E.REWARD_ROOT_POSTER_KEY))fail('REWARD_ROOT_POSTER_KEY must be 0x followed by 64 hex characters (a dedicated key that only posts reward roots).');
if(E.AI_WEB_SEARCH&&E.AI_WEB_SEARCH!=='google')fail('AI_WEB_SEARCH must be google (Gemini Grounding with Google Search for the research skill) or empty.');
if(E.AI_SEARCH_FREE_CREDITS&&!['true','false'].includes(E.AI_SEARCH_FREE_CREDITS))fail('AI_SEARCH_FREE_CREDITS must be true or false (false: only runs paid with bought credits use web search).');
if(E.AI_WEB_SEARCH==='google'&&!(E.AI_BASE_URL||'').startsWith('https://generativelanguage.googleapis.com/'))fail('AI_WEB_SEARCH=google needs AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai');
if(E.AI_REASONING_EFFORT&&!['none','minimal','low','medium','high'].includes(E.AI_REASONING_EFFORT))fail('AI_REASONING_EFFORT must be none, minimal, low, medium or high (Gemini Flash-Lite: minimal to high).');
if(E.ANTHROPIC_EFFORT&&!['low','medium','high','xhigh','max'].includes(E.ANTHROPIC_EFFORT))fail('ANTHROPIC_EFFORT must be low, medium, high, xhigh or max.');
if(E.CREATOR_ADMINS&&!/^0x[0-9a-fA-F]{40}(?:\s*,\s*0x[0-9a-fA-F]{40})*$/.test(E.CREATOR_ADMINS.trim()))fail('CREATOR_ADMINS must be one or more wallet addresses (0x + 40 hex characters), separated by commas: the accounts that may confirm a creator\'s X handle.');
if(E.CHECK_COST&&!/^(?:[1-9]\d?|[1-4]\d\d|500)$/.test(E.CHECK_COST))fail('CHECK_COST must be a whole number from 1 to 500 (credits for one agent check, which makes four AI calls; default 8).');
if(E.VOICE_COST&&!/^(?:[1-9]\d?|[1-4]\d\d|500)$/.test(E.VOICE_COST))fail('VOICE_COST must be a whole number from 1 to 500 (credits for one draft of an agent\'s voice from its creator\'s posts, default 8).');
if(E.TALK_COST&&!/^(?:[1-9]\d?|[1-4]\d\d|500)$/.test(E.TALK_COST))fail('TALK_COST must be a whole number from 1 to 500 (credits for one chat message with an agent, default 3).');
for(const k of ['LIVE_RUN_COST','LIVE_DAILY_PER_USER','AI_DAILY_RUNS','ANTHROPIC_MAX_TOKENS','AI_MAX_TOKENS','STARTING_CREDITS','FREE_REFILL_CREDITS','FREE_REFILL_HOURS','LIMIT_WINDOW_HOURS','FREE_HEAVY_PER_WINDOW','PAID_HEAVY_PER_WINDOW'])if(E[k]&&!/^\d{1,7}$/.test(E[k]))fail(`${k} must be a whole number.`);
// delivery of scheduled results (lib/notify.ts). A token that is not shaped like one leaves Telegram off instead of stopping the site.
if(E.NOTIFY_DISCORD&&!['true','false'].includes(E.NOTIFY_DISCORD))fail('NOTIFY_DISCORD must be true or false.');
if(E.QUESTS_ENABLED&&!['true','false'].includes(E.QUESTS_ENABLED))fail('QUESTS_ENABLED must be true or false.');
if(E.REFERRALS_ENABLED&&!['true','false'].includes(E.REFERRALS_ENABLED))fail('REFERRALS_ENABLED must be true or false.');
if(E.REFERRAL_CREDITS&&!/^(?:\d{1,2}|100)$/.test(E.REFERRAL_CREDITS))fail('REFERRAL_CREDITS must be a whole number from 0 to 100 (free credits for each side of an invitation, default 10; 0 gives none).');
if(E.REFERRAL_MAX&&!/^\d{1,4}$/.test(E.REFERRAL_MAX))fail('REFERRAL_MAX must be a whole number from 0 to 1000 (rewarded invitations per account, default 20).');
// these two scale what the reward vault pays: a typo must not start
if(E.REFERRAL_BOOST_PERCENT&&!/^(?:[0-9]|[1-4][0-9]|50)$/.test(E.REFERRAL_BOOST_PERCENT))fail('REFERRAL_BOOST_PERCENT must be a whole number from 0 to 50 (holder reward boost per invited friend who holds a reward unit, default 10; 0 turns the boost off).');
if(E.REFERRAL_BOOST_FRIENDS&&!/^(?:[0-9]|1[0-9]|20)$/.test(E.REFERRAL_BOOST_FRIENDS))fail('REFERRAL_BOOST_FRIENDS must be a whole number from 0 to 20 (how many friends count for the boost, default 5).');
if(E.QUEST_CREDITS&&!/^(?:\d{1,2}|100)$/.test(E.QUEST_CREDITS))fail('QUEST_CREDITS must be a whole number from 0 to 100 (free credits per finished quest, default 5; 0 gives none).');
if(E.NOTIFY_MAX&&!/^(?:[1-9]|1\d|20)$/.test(E.NOTIFY_MAX))fail('NOTIFY_MAX must be a whole number from 1 to 20 (channels per account, default 4).');
if(E.TELEGRAM_BOT_TOKEN&&!/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(E.TELEGRAM_BOT_TOKEN)){log('warning: TELEGRAM_BOT_TOKEN does not look like a bot token from @BotFather (digits, a colon, 35 characters); Telegram delivery stays off.');delete E.TELEGRAM_BOT_TOKEN;}
// the scheduler token only has to be shared between this process and the Worker: a fresh one per start is enough
if(!E.SCHEDULER_TOKEN||E.SCHEDULER_TOKEN.length<32)E.SCHEDULER_TOKEN=randomBytes(32).toString('base64url');
const vars={...Object.fromEntries(KEYS.filter(k=>E[k]!==undefined&&E[k]!=='').map(k=>[k,E[k]])),APP_ORIGIN:origin};
writeFileSync('dist/server/.dev.vars',Object.entries(vars).map(([k,v])=>`${k}=${JSON.stringify(String(v))}`).join('\n')+'\n',{mode:0o600});
log(`worker variables: ${Object.keys(vars).filter(k=>k!=='SCHEDULER_TOKEN').join(', ')} (+ scheduler token)`);

// preview deployments (preview.<domain> or HARVEX_NOINDEX=true) ask search engines to stay away
const noindex=E.HARVEX_NOINDEX?E.HARVEX_NOINDEX==='true':new URL(origin).hostname.startsWith('preview.');
writeFileSync('dist/client/robots.txt',noindex?'User-agent: *\nDisallow: /\n':'User-agent: *\nAllow: /\n');
const headers=readFileSync('dist/client/_headers','utf8').replace(/\n# harvex-noindex[\s\S]*$/,'');
writeFileSync('dist/client/_headers',noindex?`${headers.trimEnd()}\n# harvex-noindex\n/*\n  X-Robots-Tag: noindex, nofollow\n`:headers);
log(noindex?'preview mode: robots.txt disallows crawling, X-Robots-Tag noindex':'indexing allowed');

// runtime config next to the build output so its relative paths (main, assets) still resolve
const cfg=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
cfg.d1_databases=(cfg.d1_databases||[]).map(d=>({...d,migrations_dir:'../../drizzle'}));
const INTERNAL=Number(PORT)+1; // workerd listens here; the front proxy below owns PORT
cfg.dev={...(cfg.dev||{}),ip:'127.0.0.1',port:INTERNAL,local_protocol:'http',enable_containers:false};
const CONFIG='dist/server/wrangler.container.json';writeFileSync(CONFIG,JSON.stringify(cfg));
mkdirSync(DATA,{recursive:true});

const wrangler=createRequire(import.meta.url).resolve('wrangler/bin/wrangler.js');
// X_LOCAL_EXPLORER=false: the dev runtime ships a data explorer (/cdn-cgi/explorer, raw SQL on the database) that is on
// by default and guarded only by a Host check. It is never wanted on a server (the front proxy also refuses /cdn-cgi/).
const env={...E,CI:'1',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_WRITE_LOGS:'false',X_LOCAL_EXPLORER:'false'};

// 3. migrations
log(`applying migrations to ${DATA}`);
const mig=spawnSync(process.execPath,[wrangler,'d1','migrations','apply','DB','--local','--config',CONFIG,'--persist-to',DATA],{stdio:'inherit',env});
if(mig.status!==0)fail('migrations failed; the server was not started.');

// 4. serve. request.url is rewritten to the public origin so origin checks match behind the proxy.
const pub=new URL(origin);
const args=[wrangler,'dev','--config',CONFIG,'--local','--persist-to',DATA,'--ip','127.0.0.1','--port',String(INTERNAL),'--inspector-port','0',
 '--local-upstream',pub.host,'--upstream-protocol',pub.protocol.replace(':',''),'--show-interactive-dev-session=false','--live-reload=false'];
log(`starting on 0.0.0.0:${PORT} for ${origin}`);
const child=spawn(process.execPath,args,{stdio:'inherit',env});

// 5. front proxy. The local runtime stalls the NEXT request on a keep-alive connection when a handler answers
// without reading the request body (e.g. a 401/404/405 to a POST). Reverse proxies (Coolify's Traefik) reuse
// connections, so one such request could hang or 503 other users. Every request is therefore forwarded to the
// runtime on its own short-lived connection; clients keep normal keep-alive with this proxy.
// Other hostnames pointed at this container (www., an old preview domain) go to the public origin: wallet sign-in
// is bound to that one domain, so the app cannot work anywhere else. Health checks, IPs and container names pass through.
const foreign=h=>{const n=String(h||'').toLowerCase().replace(/:\d+$/,'');return n.includes('.')&&n!==pub.hostname&&!/^[\d.]+$/.test(n)&&!n.startsWith('[')&&!n.endsWith('.localhost');};
// The runtime behind this proxy is developer tooling, so the proxy is the security boundary:
// - /cdn-cgi/* (the runtime's own endpoints: data explorer, scheduled triggers) is never forwarded;
// - the Host the runtime sees is always the public one, so its "local request" shortcuts cannot be reached from another
//   container or the host by sending Host: localhost;
// - headers a client must not choose are replaced: the runtime's internal mf-* headers, Cloudflare's cf-* headers (there
//   is no Cloudflare in front unless HARVEX_TRUST_CF_HEADERS=true) and platform identity headers. The client address is the
//   one the nearest reverse proxy appended (last X-Forwarded-For entry), which is what the sign-in rate limit keys on;
// - a request body is cut off at 1 MB (every API body is JSON under 18,000 characters).
const MAX_BODY=1_000_000;
const trustCf=E.HARVEX_TRUST_CF_HEADERS==='true';
const looksLikeIp=s=>/^[0-9a-fA-F:.]{3,45}$/.test(s);
const clientIp=req=>{
 const cf=String(req.headers['cf-connecting-ip']||'').trim();if(trustCf&&looksLikeIp(cf))return cf;
 const hops=String(req.headers['x-forwarded-for']||'').split(',').map(s=>s.trim()).filter(Boolean);const last=hops[hops.length-1]||'';
 return looksLikeIp(last)?last:String(req.socket.remoteAddress||'').replace(/^::ffff:/,'')||'0.0.0.0';
};
/** Path as the runtime will read it (absolute-form targets, dot segments, encoded and repeated slashes resolved), or null. */
const runtimePath=raw=>{
 let s=String(raw||'/');const abs=s.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(.*)$/i);if(abs)s=abs[1]||'/';
 if(!s.startsWith('/'))s='/'+s;
 try{return decodeURIComponent(new URL('http://x'+s.replace(/^[/\\]+/,'/')).pathname).replace(/\\/g,'/').replace(/\/{2,}/g,'/').toLowerCase();}catch{return null;}
};
const reply=(res,status,error,extra={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...extra});res.end(JSON.stringify({error}));};
const front=http.createServer((req,res)=>{
 // origin-form only: an absolute-form target ("GET http://other/…") must not choose the upstream's idea of the host
 const abs=String(req.url||'/').match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(.*)$/i);const target=abs?(abs[1]||'/'):String(req.url||'/');
 if(!target.startsWith('/'))return reply(res,400,'Invalid request.');
 if(foreign(req.headers.host)){res.writeHead(308,{location:pub.origin+target,'cache-control':'no-store'});res.end();return;}
 const p=runtimePath(target);
 if(p===null)return reply(res,400,'Invalid request.');
 if(p==='/cdn-cgi'||p.startsWith('/cdn-cgi/'))return reply(res,404,'Not found.');
 if(Number(req.headers['content-length']||0)>MAX_BODY)return reply(res,413,'Request too large.',{connection:'close'});
 const ip=clientIp(req);const headers={};
 for(const [k,v] of Object.entries(req.headers)){const n=k.toLowerCase();
  if(n.startsWith('mf-')||n.startsWith('cf-')||n.startsWith('oai-authenticated-user')||n==='upgrade'||n==='x-forwarded-host'||n==='forwarded')continue;
  headers[k]=v;}
 Object.assign(headers,{host:pub.host,connection:'close','cf-connecting-ip':ip,'x-real-ip':ip,'x-forwarded-for':ip,'x-forwarded-proto':pub.protocol.replace(':','')});
 let cut=false;
 const up=http.request({host:'127.0.0.1',port:INTERNAL,method:req.method,path:target,headers,agent:false},r=>{
  if(cut){r.resume();return;}
  const h={...r.headers};delete h.connection;delete h['keep-alive'];
  if(noindex)h['x-robots-tag']='noindex, nofollow';
  res.writeHead(r.statusCode||502,h);r.pipe(res);
 });
 up.setTimeout(120000,()=>up.destroy(new Error('upstream timeout')));
 up.on('error',()=>{if(cut)return;if(!res.headersSent){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({error:'The server is starting. Try again in a moment.'}));}else res.destroy();});
 // bodies without a Content-Length (chunked) are counted as they arrive
 let size=0;
 req.on('data',chunk=>{size+=chunk.length;if(size<=MAX_BODY||cut)return;cut=true;req.unpipe(up);up.destroy();
  // answer, discard what is still arriving for two seconds so the client can read the answer, then hang up
  if(!res.headersSent)reply(res,413,'Request too large.');
  setTimeout(()=>req.destroy(),2000).unref();});
 req.pipe(up);
});
front.keepAliveTimeout=65000;front.headersTimeout=66000;
front.listen(Number(PORT),'0.0.0.0',()=>log(`front proxy on 0.0.0.0:${PORT} → runtime 127.0.0.1:${INTERNAL}`));
// 6. scheduler heartbeat: due schedules run, the holder recorder keeps up (both are no-ops when nothing is set up)
let ticking=false,lastNote='';
const tick=async()=>{if(ticking)return;ticking=true;
 try{const r=await fetch(`http://127.0.0.1:${INTERNAL}/api/schedules/tick`,{method:'POST',headers:{Authorization:`Bearer ${E.SCHEDULER_TOKEN}`},signal:AbortSignal.timeout(240000)});
  const d=await r.json().catch(()=>({}));if(!r.ok)log(`scheduler: HTTP ${r.status} ${d.error||''}`);else if(d.schedules?.ran||d.schedules?.paused)log(`scheduler: ran ${d.schedules.ran}, paused ${d.schedules.paused}`);
  // holder rewards, the recorder and top-up settlement report problems here; each distinct message is logged once
  const note=[['rewards',d.rewards?.error||d.rewards?.posterError||d.rewards?.skipped||(d.rewards?.stalled&&`period ${d.rewards.stalled} is stalled: ${d.rewards.why||''}`)],['recorder',d.holders?.error],['top-ups',d.topups?.error]].filter(x=>x[1]).map(x=>`${x[0]}: ${String(x[1]).slice(0,300)}`).join(' | ');
  if(note!==lastNote){lastNote=note;if(note)log(`scheduler: ${note}`);else log('scheduler: back to normal');}}
 catch{/* runtime still starting */}finally{ticking=false;}};
// idle only when nothing needs it: no schedules, no holder rewards and no top-ups to settle
const ticker=E.SCHEDULES_ENABLED==='false'&&E.REWARDS_ENABLED!=='true'&&!(E.PAY_TOKEN_ADDRESS&&E.TOPUP_TREASURY)?null:setInterval(tick,60000);

// 6b. Telegram reader: keeps one request open to the Worker, which holds a long poll on the bot's messages (lib/notify.ts).
// A question in a chat is then answered within a second or two instead of at the next minute. Idle while no chat is
// linked for answers and no link is waiting: it then asks again every half minute, which costs one local request
// (a link opened meanwhile is read by the page itself until the reader takes over).
let reader=null,lastReader='';
const readTelegram=async()=>{let pause=30000;
 try{const r=await fetch(`http://127.0.0.1:${INTERNAL}/api/notify/poll`,{method:'POST',headers:{Authorization:`Bearer ${E.SCHEDULER_TOKEN}`},signal:AbortSignal.timeout(300000)});
  const d=await r.json().catch(()=>({}));if(r.ok&&!d.idle)pause=d.error?30000:d.busy?2000:250;
  const note=d.error||'';if(note!==lastReader){lastReader=note;log(note?`telegram: ${note}`:'telegram: back to normal');}}
 catch{/* runtime still starting, or a long answer */}
 reader=setTimeout(readTelegram,pause);};
if(E.TELEGRAM_BOT_TOKEN)reader=setTimeout(readTelegram,20000);

// 7. daily database backup: a consistent copy (SQLite VACUUM INTO) under DATA/backups, the last HARVEX_BACKUP_DAYS kept
const keep=/^\d{1,3}$/.test(E.HARVEX_BACKUP_DAYS||'')?Number(E.HARVEX_BACKUP_DAYS):7;
function backup(){
 try{
  const dir=path.join(DATA,'v3','d1');const files=[];
  const walk=d=>{for(const f of readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else if(f.name.endsWith('.sqlite')&&f.name!=='metadata.sqlite')files.push(p);}};
  walk(dir);if(!files.length)return;
  const db=files.sort((a,b)=>statSync(b).size-statSync(a).size)[0];
  const out=path.join(DATA,'backups');mkdirSync(out,{recursive:true});
  const target=path.join(out,`harvex-${new Date().toISOString().slice(0,10)}.sqlite`);rmSync(target,{force:true});
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');const con=new DatabaseSync(db);
  try{con.exec(`VACUUM INTO '${target.replace(/'/g,"''")}'`);}finally{con.close();}
  const old=readdirSync(out).filter(f=>/^harvex-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort().reverse().slice(keep);
  for(const f of old)rmSync(path.join(out,f),{force:true});
  log(`backup written: ${target}`);
 }catch(e){log(`backup skipped: ${e.message}`);}
}
const backups=keep>0?[setTimeout(backup,5*60e3),setInterval(backup,24*3600e3)]:[];

for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{if(ticker)clearInterval(ticker);if(reader)clearTimeout(reader);backups.forEach(t=>clearTimeout(t));front.close();child.kill(sig);});
child.on('exit',code=>process.exit(code??0));
