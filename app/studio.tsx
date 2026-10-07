'use client';
/* App shell and every view. UI is shadcn/ui (components/ui) + Tailwind; data logic unchanged. */
import {lazy,Suspense,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Chain} from '@/components/harvex/web3';
import {usePathname,useRouter} from 'next/navigation';
import {parsePath,pathFor,agentPath,LEGACY_HASH,type Area} from '@/lib/routes';
import {Toaster,toast} from 'sonner';
import {starter,skillCatalog,isOpenSkill,triesLeft,MAX_SKILLS,type Trials,type Agent,type Run,type MarketAgent,type LedgerEntry,GREETING_MAX,STARTERS_MAX,STARTER_MAX,KNOWLEDGE_MAX} from '@/lib/agents';
import {characters,getCharacter,loopMotions,powers,type CharacterId,type Motion} from '@/lib/characters';
import {CONTENT} from '@/lib/harvex3d/content';
import {filterItems,type SearchMode} from '@/lib/search';
import {SIGNIN_EVENT,requireAuth,setAuthenticated} from '@/lib/auth-gate';
import Avatar,{playMotion,castPower} from './avatar';
/** How the character works while a task runs: research scans first, writing-type skills type, the rest think. */
const WORK_MOTION:Record<string,string>={research:'Think',brainstorm:'Think',planner:'Think'};
function startWork(skill:string){if(skill==='research'||skill==='monitor'||skill==='whales')castPower('scan');playMotion(WORK_MOTION[skill]||'Typing',true);}
import {Roster,OutfitEditor,Powers,MotionDeck,StageControls} from './character-controls';
import {useTheme} from './theme';
import type {DocKind} from './content-pages';
import Home from './home';
import {api,download,copyText,Modal,Options,Empty,PageHead,TextOut,outputText,FieldLabel,SKILL_ICON,I,IconDefs} from './ui';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Badge} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {Switch} from '@/components/ui/switch';
import {Progress} from '@/components/ui/progress';
import {Alert,AlertDescription} from '@/components/ui/alert';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger} from '@/components/ui/accordion';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {gateOf,type Section} from '@/lib/gate';
import {GateProvider} from '@/components/harvex/gate';
import {ClosedPage} from '@/components/harvex/closed-page';
import {Navbar,BottomNav,PRODUCT,WORKSPACE,RESOURCES,ToneIcon,type View} from '@/components/harvex/navbar';
import {Folder,type Tone} from '@/components/harvex/motion';
import {SearchBox,type PaletteItem} from '@/components/harvex/search';
import {cn} from '@/lib/utils';
import {AppShell,APP_VIEWS} from '@/components/app/shell';
/* Views that are not needed on first paint load on demand (code-split): docs/whitepaper/roadmap, wallet
   (viem), rewards, account, wallet sign-in (viem) and the command palette (cmdk). */
const DocsShell=lazy(()=>import('./content-pages').then(m=>({default:m.DocsShell})));
const RoadmapPage=lazy(()=>import('./content-pages').then(m=>({default:m.RoadmapPage})));
const WalletPage=lazy(()=>import('@/components/app/wallet').then(m=>({default:m.WalletPage})));
const SchedulesPage=lazy(()=>import('@/components/app/schedules').then(m=>({default:m.SchedulesPage})));
const AgentSchedules=lazy(()=>import('@/components/app/schedules').then(m=>({default:m.AgentSchedules})));
const RewardsPage=lazy(()=>import('@/components/app/rewards').then(m=>({default:m.RewardsPage})));
const AgentCheck=lazy(()=>import('@/components/app/agent-check').then(m=>({default:m.AgentCheck})));
const VoiceBox=lazy(()=>import('@/components/app/voice').then(m=>({default:m.VoiceBox})));
const KnowledgeBox=lazy(()=>import('@/components/app/knowledge').then(m=>({default:m.KnowledgeBox})));
const VerifiedPage=lazy(()=>import('@/components/harvex/verified-page').then(m=>({default:m.VerifiedPage})));
const PlazaPage=lazy(()=>import('@/components/harvex/plaza-page').then(m=>({default:m.PlazaPage})));
const BoardPage=lazy(()=>import('@/components/harvex/board-page').then(m=>({default:m.BoardPage})));
const ArenaPage=lazy(()=>import('@/components/harvex/arena-page').then(m=>({default:m.ArenaPage})));
const DuelPage=lazy(()=>import('@/components/harvex/arena-page').then(m=>({default:m.DuelPage})));
const CreatorsPage=lazy(()=>import('@/components/harvex/creators-page').then(m=>({default:m.CreatorsPage})));
const TeamsPage=lazy(()=>import('@/components/app/teams').then(m=>({default:m.TeamsPage})));
const TeamsInfoPage=lazy(()=>import('@/components/harvex/teams-page').then(m=>({default:m.TeamsInfoPage})));
const QuestsPage=lazy(()=>import('@/components/app/quests').then(m=>({default:m.QuestsPage})));
const AccountPanel=lazy(()=>import('@/components/app/account').then(m=>({default:m.AccountPanel})));
const SignIn=lazy(()=>import('@/components/harvex/sign-in').then(m=>({default:m.SignIn})));
const Overview=lazy(()=>import('@/components/app/overview').then(m=>({default:m.Overview})));
const ProfilePage=lazy(()=>import('@/components/app/profile').then(m=>({default:m.ProfilePage})));
const PublicDocs=lazy(()=>import('./public-docs').then(m=>({default:m.PublicDocs})));
const PublicRoadmap=lazy(()=>import('./public-docs').then(m=>({default:m.PublicRoadmap})));
const AgentPage=lazy(()=>import('@/components/harvex/agent-page').then(m=>({default:m.AgentPage})));
const WhalesPage=lazy(()=>import('@/components/harvex/whales-page').then(m=>({default:m.WhalesPage})));
const ReferralPage=lazy(()=>import('@/components/harvex/referral-page').then(m=>({default:m.ReferralPage})));
const InvitePage=lazy(()=>import('@/components/harvex/invite-page').then(m=>({default:m.InvitePage})));
const RecipesPage=lazy(()=>import('@/components/harvex/recipes-page').then(m=>({default:m.RecipesPage})));
const TiersPage=lazy(()=>import('@/components/harvex/tiers-page').then(m=>({default:m.TiersPage})));
const SharePage=lazy(()=>import('@/components/harvex/share-page').then(m=>({default:m.SharePage})));
const ShareAnswer=lazy(()=>import('@/components/app/share-answer').then(m=>({default:m.ShareAnswer})));
const LoginPage=lazy(()=>import('@/components/harvex/login-page').then(m=>({default:m.LoginPage})));
const NotFoundPage=lazy(()=>import('@/components/harvex/login-page').then(m=>({default:m.NotFoundPage})));
const SearchPalette=lazy(()=>import('@/components/harvex/search-palette').then(m=>({default:m.SearchPalette})));
/** Agent validation (zod) loads only when saving, importing or sharing. */
const agentSchema=()=>import('@/lib/agent-schema').then(m=>m.agentSchema);
const agentIssue=(e:import('zod').ZodError)=>import('@/lib/agent-schema').then(m=>m.agentIssue(e));
/** Fields the server stores; Run and Automate save first when any of them differs from the saved copy. */
const SAVED_KEYS=['name','tagline','skin','appearance','look','motion','personality','greeting','starters','knowledge','tone','language','skills'] as const;
const sameConfig=(a:Agent,b:Agent)=>SAVED_KEYS.every(k=>JSON.stringify(a[k]??null)===JSON.stringify(b[k]??null));
const Loading=()=><div className="grid min-h-40 place-items-center text-sm text-muted-foreground">Loading…</div>;
import {DashPage,PageHeader,Kpi,KpiRow,Segmented,StatusBadge,EmptyState} from '@/components/app/parts';
import {Thumb} from '@/components/landing/mocks';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Skeleton} from '@/components/ui/skeleton';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@/components/ui/tooltip';
import {MotionRuntime} from '@/components/harvex/gsap-motion';

const TEMPLATES=[
 {name:'Source checker',skin:'scout',skills:['research','document','summarize'],text:'Sets sources side by side, marks what is fact and what is opinion, and closes with a list of things to check.',personality:'Check claims against each other before you answer. Say which parts are fact and which are opinion, and how sure you are. Finish with what still needs checking.'},
 {name:'Draft partner',skin:'nova',skills:['write','brainstorm','translate'],text:'Shapes loose notes into a clean draft of your own, asks who will read it, and leaves the publishing to you.',personality:'Turn loose notes into a clear draft in the voice of the writer. If the reader is not obvious, ask who it is for. Nothing goes out without a yes from the writer.'},
 {name:'Document desk',skin:'guardian',skills:['document','summarize','planner'],text:'Works from the text you hand it and nothing else: the main points, the passages behind them, and what to do next.',personality:'Work only from the text you are given. Pull out the main points, quote the passages that back them, and list what to do next.'},
 {name:'Build planner',skin:'rook',skills:['code','planner','research'],text:'Plain answers for people who build. Cuts the work into small steps you can test and names the risks at the start.',personality:'Keep it practical and plain. Break the work into small steps that can be tested, and flag the risks before anything else.'},
] as const;
const TONES=['Friendly','Professional','Concise'] as const;
const SKILL_CATS=['All','Research','Creative','Knowledge','Language','Builder','Productivity','Automation'];
function encoded(a:Agent){const {id,updated,archived,published,price,uses,...config}=a as any;return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(config))));}
const C_DOCS=CONTENT.docs;const C_PAPER=CONTENT.paper.sections;
const CAT_TONE:Record<string,Tone>={Research:'sky',Creative:'pink',Knowledge:'amber',Language:'iris',Builder:'coral',Productivity:'mint',Automation:'lime'};
const POWER_TONE:Record<string,Tone>={orb:'iris',shield:'sky',blink:'amber',levitate:'mint',scan:'lime',hype:'pink'};
const toneFor=(key:string)=>CAT_TONE[key]||POWER_TONE[key]||'lime';
const skillName=(id:string)=>skillCatalog.find(s=>s.id===id)?.name||id;
const Mono=({children,className}:{children:ReactNode;className?:string})=><span className={cn('font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase',className)}>{children}</span>;

/** The toaster reads the theme itself (app/theme.ts): a theme change does not render the app. */
function ThemedToaster(){const [theme]=useTheme();return <Toaster theme={theme} position="bottom-center" richColors mobileOffset={{bottom:96}}/>;}

const OPEN:readonly Section[]=[];
export default function Studio({closed=OPEN}:{closed?:readonly Section[]}){
 // the screen comes from the URL (lib/routes.ts); this component stays mounted across routes (app/layout.tsx)
 const pathname=usePathname()||'/';const router=useRouter();const route=useMemo(()=>parsePath(pathname),[pathname]);
 // a part that is not open yet has no screen: no view matches, so nothing of it loads or draws (lib/gate.ts)
 const gate=gateOf(pathname,closed);
 const view:View=gate?'closed':route.view;const area:Area=gate?'site':route.area;
 const docPage=route.doc||(view==='paper'?C_PAPER[0].id:'overview');
 const [draft,setDraft]=useState<Agent>({...starter,skills:[...starter.skills]});const restored=useRef(false);
 // a link from the creators page opens the Persona tab with the voice box open: /dashboard/studio?voice=1
 const [voiceOpen,setVoiceOpen]=useState(false);const [tab,setTab]=useState('look');
 useEffect(()=>{try{if(new URLSearchParams(location.search).has('voice')){setVoiceOpen(true);setTab('persona');}}catch{/* no link, nothing to open */}},[]);
 const [paused,setPaused]=useState(false);const [speed,setSpeed]=useState(1);
 const [agents,setAgents]=useState<Agent[]>([]);const [runs,setRuns]=useState<Run[]>([]);const [balance,setBalance]=useState<number|null>(null);const [email,setEmail]=useState('');const [wallet,setWallet]=useState('');const [earned,setEarned]=useState(0);const [ledger,setLedger]=useState<LedgerEntry[]>([]);const [feeBps,setFeeBps]=useState(0);const [liveCost,setLiveCost]=useState(5);const [skillCosts,setSkillCosts]=useState<Record<string,number>>({});const [startCredits,setStartCredits]=useState(25);const [refill,setRefill]=useState<FreeRefill|null>(null);const [liveToday,setLiveToday]=useState<LiveToday|null>(null);const [trials,setTrials]=useState<Trials|null>(null);const [ready,setReady]=useState(false);const [auth,setAuth]=useState(true);const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState('');const [busy,setBusy]=useState(false);
 const [market,setMarket]=useState<MarketAgent[]|null>(null);const [marketAgent,setMarketAgent]=useState<MarketAgent|null>(null);const [priceDraft,setPriceDraft]=useState<Record<string,string>>({});const [talkDraft,setTalkDraft]=useState<Record<string,string>>({});
 const [query,setQuery]=useState('');const [mode,setMode]=useState<SearchMode>('title');const [filter,setFilter]=useState('All');const [agentFilter,setAgentFilter]=useState<'all'|'published'|'private'|'archived'>('all');const [publishFor,setPublishFor]=useState<Agent|null>(null);const [importOpen,setImportOpen]=useState(false);const [sort,setSort]=useState<'popular'|'cheap'|'new'>('popular');const [runFilter,setRunFilter]=useState<'all'|'complete'|'failed'>('all');
 const [share,setShare]=useState(false);const [settings,setSettings]=useState(false);const [signin,setSignin]=useState(false);const [runDetail,setRunDetail]=useState<Run|null>(null);const [shares,setShares]=useState<Record<string,{id:string;task:boolean}>>({});const [embed,setEmbed]=useState(false);const [scan,setScan]=useState(false);const [palette,setPalette]=useState(false);
 async function refresh(){setLoading(true);setLoadError('');try{
  // ask who is signed in first so signed-out visitors do not trigger a 401 on every page
  const me=await api('/api/auth/me').catch(()=>({signedIn:true}));if(!me.signedIn){setAuth(false);setBalance(null);setAgents([]);setRuns([]);setWallet('');setEmail('');return;}
  const d=await api('/api/workspace');setAgents(d.agents);
  // first load only: a returning creator lands on the agent edited last instead of a blank copy (Run would save the
  // blank one as a duplicate). An edited draft, a shared #agent= link or "New" is never replaced.
  if(!restored.current){restored.current=true;const last=(d.agents as Agent[]).filter(a=>!a.archived).sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||'')))[0];
   if(last)setDraft(cur=>!cur.id&&sameConfig(cur,starter)?{...last}:cur);}setRuns(d.runs);setShares(d.shares||{});setBalance(d.balance);setEarned(d.earned||0);setEmail(d.email||'');setWallet(d.wallet||'');setLedger(d.ledger||[]);setFeeBps(d.feeBps||0);setLiveCost(typeof d.liveCost==='number'?d.liveCost:5);setSkillCosts(d.skillCosts||{});if(typeof d.startingCredits==='number')setStartCredits(d.startingCredits);setRefill(d.freeRefill||null);setLiveToday(d.liveToday||null);setSpent(d.spent||0);setTrials(d.trials||null);setReady(d.aiReady);setAuth(true);}catch(e:any){setAuth(e.status!==401);if(e.status!==401)setLoadError(e.message);}finally{setLoading(false)}}
 useEffect(()=>{refresh();
  try{/* a fixed message: the text of a URL parameter is never shown as if the site had written it */if(new URLSearchParams(location.search).has('auth_error')){toast.error('The sign-in was not finished. Please start it again.');history.replaceState(null,'',location.pathname+location.hash);}}catch{}
  try{const hash=location.hash;if(hash.startsWith('#agent=')){if(hash.length>12000)throw new Error();const raw=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(hash.slice(7)),c=>c.charCodeAt(0))));const isEmbed=new URLSearchParams(location.search).get('view')==='embed';setEmbed(isEmbed);if(!isEmbed&&parsePath(location.pathname).view!=='studio')router.replace('/dashboard/studio');agentSchema().then(sc=>{const data=sc.parse(raw);delete data.id;setDraft(data);toast.success('The agent from the link is open');}).catch(()=>toast.error('That link does not hold a valid agent.'));}
   else if(LEGACY_HASH[hash.slice(1)])router.replace(pathFor(LEGACY_HASH[hash.slice(1)]));}catch{toast.error('That link does not hold a valid agent.');}
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)setPaused(true);
  const onStage=(e:Event)=>{const ev=(e as CustomEvent).detail;if(ev==='scan-start')setScan(true);if(ev==='scan-end')setTimeout(()=>setScan(false),2600);};
  const onKey=(e:KeyboardEvent)=>{if((e.key==='k'||e.key==='K')&&(e.metaKey||e.ctrlKey)){e.preventDefault();setPalette(p=>!p);}else if(e.key==='/'&&!(e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')){e.preventDefault();setPalette(true);}};
  window.addEventListener('harvex:stage',onStage);window.addEventListener('keydown',onKey);return()=>{window.removeEventListener('harvex:stage',onStage);window.removeEventListener('keydown',onKey);};},[]);
 /** Go to a screen. Docs, whitepaper and roadmap stay in the current area (public site or dashboard) unless `to` says otherwise. */
 // with sign-in closed there is no dialog to open: the login page says so
 function askSignIn(){if(closed.includes('signin'))router.push('/login');else setSignin(true);}
 function navigate(v:string,doc?:string,to?:Area){const next=v as View;const a:Area=to||(next==='docs'||next==='paper'||next==='roadmap'?area:'dash');router.push(pathFor(next,doc,a));setQuery('');setFilter('All');}
 useEffect(()=>{window.scrollTo(0,0);if(view==='discover'&&!market)loadMarket();},[pathname]); // eslint-disable-line react-hooks/exhaustive-deps
 // Discover loads the top 60; a search also asks the server so agents beyond those can be found
 useEffect(()=>{const q=query.trim();if(view!=='discover'||q.length<2)return;const t=setTimeout(async()=>{try{const d=await api('/api/market?q='+encodeURIComponent(q));setMarket(m=>{const seen=new Set((m||[]).map(a=>a.id));return [...(m||[]),...(d.agents as MarketAgent[]).filter(a=>!seen.has(a.id))];});}catch{}},300);return()=>clearTimeout(t);},[query,view]);
 function change<K extends keyof Agent>(key:K,value:Agent[K]){setDraft(d=>({...d,[key]:value}));}
 function chooseCharacter(id:CharacterId){const c=getCharacter(id);setDraft(d=>{const renamed=!d.name.trim()||d.name==='My '+getCharacter(d.skin).name;return {...d,skin:id,appearance:{...c.look},look:undefined,...(renamed?{name:'My '+c.name}:{})};});playMotion('Wave');}
 // Account gate (lib/auth-gate.ts): this component owns the session state and the sign-in panel. Every action that
 // saves, runs, publishes, shares or imports starts with requireAuth(); api() applies the same gate to every write.
 useEffect(()=>{setAuthenticated(auth);},[auth]);
 // an invite link opened before sign-in (components/harvex/invite-page.tsx keeps its code): hand it to the server once
 // the visitor is signed in. The code is dropped when it was accepted or can never be (4xx), kept on a network error.
 useEffect(()=>{if(!auth)return;let code='';try{code=localStorage.getItem('harvex-ref')||'';}catch{return;}if(!code)return;
  api('/api/referrals',{method:'POST',body:JSON.stringify({code})}).then(d=>{try{localStorage.removeItem('harvex-ref');}catch{/* nothing to drop */}if(d.credits>0)toast.success('Invite accepted',{description:`Once your first run is done, ${d.credits} free credits go to you and ${d.credits} to the friend who invited you.`});})
   .catch((e:any)=>{if(e?.status>=400&&e?.status<500){try{localStorage.removeItem('harvex-ref');}catch{/* nothing to drop */}}});},[auth]);
 useEffect(()=>{const open=(e:Event)=>{if((e as CustomEvent<{expired?:boolean}>).detail?.expired)setAuth(false);askSignIn();};
  window.addEventListener(SIGNIN_EVENT,open);return()=>window.removeEventListener(SIGNIN_EVENT,open);},[]);
 async function save(){if(!requireAuth())return null;const parsed=(await agentSchema()).safeParse(draft);if(!parsed.success){toast.error(await agentIssue(parsed.error));return null;}setBusy(true);const wasArchived=!!agents.find(a=>a.id===draft.id)?.archived;try{const saved=await api('/api/agents',{method:'POST',body:JSON.stringify(parsed.data)});setDraft(saved);await refresh();toast.success(wasArchived?`Saved and restored “${saved.name}”`:`Saved “${saved.name}”`);playMotion('Salute');return saved as Agent;}catch(e:any){toast.error(e.message);if(e.status===401){setAuth(false);askSignIn();}return null;}finally{setBusy(false)}}
 /** Saves first when the agent is new, archived, or changed since the last save, so runs use what is on screen. */
 async function ensureCurrent(){const prev=draft.id?agents.find(a=>a.id===draft.id):undefined;const s=prev&&!prev.archived&&sameConfig(prev,draft)?draft:await save();return s?.id||null;}
 function fresh(skin:Agent['skin']='atlas'){const c=getCharacter(skin);setDraft({...starter,name:'My '+c.name,skin,skills:[...starter.skills]});setTab('look');navigate('studio');}
 function edit(a:Agent){setDraft({...a});setTab('look');navigate('studio');}
 function applyTemplate(t:typeof TEMPLATES[number]){setDraft({...starter,name:t.name,skin:t.skin as Agent['skin'],skills:(t.skills.filter(isOpenSkill).length?t.skills.filter(isOpenSkill):['summarize']) as Agent['skills'],personality:t.personality});setTab('persona');navigate('studio');toast.success(`${t.name} is set as your starting point`);}
 async function archive(a:Agent){if(!requireAuth())return;try{await api('/api/agents',{method:'PATCH',body:JSON.stringify({id:a.id,archived:!a.archived})});await refresh();toast.success(a.archived?'Agent restored':'Moved to Archived. You can bring it back from there.');}catch(e:any){toast.error(e.message)}}
 async function loadMarket(){try{const d=await api('/api/market?q=');setMarket(d.agents);}catch(e:any){toast.error(e.message);}}
 async function publish(a:Agent,published:boolean){if(!requireAuth())return;const raw=priceDraft[a.id!]??String(a.price??0);const price=Number(raw);const talkPrice=Number(talkDraft[a.id!]??String(chatPriceOf(a)));if(published&&[price,talkPrice].some(v=>!Number.isInteger(v)||v<0||v>500)){toast.error('Both prices take whole credits between 0 and 500.');return;}setBusy(true);try{await api('/api/agents',{method:'PATCH',body:JSON.stringify({id:a.id,published,price,...(published?{talkPrice}:{})})});await refresh();if(market)loadMarket();toast.success(published?`${a.name} now shows in Discover at ${price} credits a task and ${talkPrice} a chat message`:`${a.name} no longer shows in Discover`);}catch(e:any){toast.error(e.message);}finally{setBusy(false);}}
 async function exportAgent(a:Agent=draft){if(!requireAuth())return;const checked=(await agentSchema()).safeParse(a);if(!checked.success){toast.error('An export needs a name, instructions and skills. Fill those in first.');return;}const file=`harvex-${(a.name||'agent').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'agent'}.json`;const {id:_id,...config}=checked.data;download(file,JSON.stringify(config,null,2));toast.success(`Exported ${file}`,{description:'Any Harvex account can load this file under My agents → Import.'});}
 async function importText(txt:string){if(!requireAuth())return;
  let list:unknown[];try{const o=JSON.parse(txt);list=Array.isArray(o)?o:[o];}catch{toast.error('This text could not be read as agent JSON.');return;}
  const sc=await agentSchema();let n=0,bad=0;
  for(const x of list){const p=sc.safeParse(x&&typeof x==='object'?{...x,id:undefined}:x);if(!p.success){bad++;continue;}
   try{await api('/api/agents',{method:'POST',body:JSON.stringify(p.data)});n++;}
   catch(e:any){await refresh();toast.error(`${n?`Stopped after ${n} imported. `:''}${e.message}`);if(e.status===401){setAuth(false);askSignIn();}return;}}
  await refresh();
  if(n)toast.success(`${n} agent${n>1?'s':''} imported${bad?` · ${bad} left out (failed the checks)`:''}`);else toast.error(bad?`Nothing was imported: ${bad} entr${bad>1?'ies':'y'} in that file failed the checks.`:'That file holds no agent.');}
 async function signOut(){try{await api('/api/auth/logout',{method:'POST'});}catch{}location.href='/';}
 const character=getCharacter(draft.skin);const sig=powers.find(p=>p.id===character.sig);
 const shareURL=typeof location!=='undefined'?`${location.origin}/dashboard/studio#agent=${encoded(draft)}`:'';
 const agentDoc=(a:{name:string;tagline?:string;personality?:string;skills:readonly string[];tone?:string;language?:string;skin:string})=>({title:a.name,body:[a.tagline,a.personality,a.skills.map(skillName).join(', '),getCharacter(a.skin).name,a.tone,a.language].filter(Boolean).join('. ')});
 const activeAgents=agents.filter(a=>!a.archived);const archivedCount=agents.length-activeAgents.length;const publishedCount=activeAgents.filter(a=>a.published).length;const usesTotal=activeAgents.reduce((n,a)=>n+(a.uses||0),0);
 const [spent,setSpent]=useState(0);
 const visibleAgents=filterItems(agents.filter(a=>agentFilter==='archived'?a.archived:!a.archived&&(agentFilter==='all'||(agentFilter==='published'?a.published:!a.published))),query,mode,agentDoc);
 const shownRuns=runs.filter(r=>runFilter==='all'||r.status===runFilter);
 const runCount=runs.reduce<Record<string,number>>((m,r)=>{m[r.agent_id]=(m[r.agent_id]||0)+1;return m;},{});
 const visibleMarket=market?filterItems(market,query,mode,a=>{const d=agentDoc(a);return {title:d.title,body:d.body+'. '+(a.creator||'')};}).sort((x,y)=>sort==='cheap'?x.price-y.price:sort==='new'?String(y.publishedAt||'').localeCompare(String(x.publishedAt||'')):y.uses-x.uses):null;
 const visibleSkills=filterItems(skillCatalog.filter(s=>filter==='All'||s.category===filter),query,mode,s=>({title:s.name,body:s.description+'. '+s.category}));

 /* ---------- global search index ---------- */
 const paletteItems=useMemo<PaletteItem[]>(()=>{
  const C=CONTENT;const jump=(v:View,anchor?:string)=>()=>{navigate(v);if(anchor)setTimeout(()=>document.getElementById(anchor)?.scrollIntoView({behavior:'smooth',block:'start'}),120);};
  const pages:PaletteItem[]=[{id:'p-home',kind:'Page',title:'Home',body:'Where the Harvex site begins.',icon:'home',run:jump('home')},...[...PRODUCT,...WORKSPACE,...RESOURCES].filter(l=>!l.doc).map(l=>({id:'p-'+l.id+l.title,kind:'Page',title:l.title,body:l.desc,icon:l.icon,run:jump(l.id)})),{id:'p-docs',kind:'Page',title:'Docs',body:'A guide to the studio: what runs today and what is still planned.',icon:'book',run:jump('docs')}];
  return [...pages,
   ...characters.map(c=>({id:'c-'+c.id,kind:'Character',title:c.name,body:`${c.role}. ${c.desc}. Signature power: ${powers.find(p=>p.id===c.sig)?.name}. ${c.category==='Humanoid'?'Human':'Bot'}.`,icon:'user',run:()=>{chooseCharacter(c.id);navigate('studio');}})),
   ...skillCatalog.map(s=>({id:'s-'+s.id,kind:s.planned?'Skill · planned':s.locked?'Skill · locked':'Skill',title:s.name,body:`${s.description} Category: ${s.category}.`,icon:SKILL_ICON[s.icon]||'globe',run:()=>{navigate('skills');setQuery(s.name);}})),
   ...powers.map(p=>({id:'w-'+p.id,kind:'Power',title:p.name,body:`${p.desc} Key ${p.key}. ${p.cd}s cooldown.`,icon:p.id,run:jump('studio')})),
   ...TEMPLATES.map(t=>({id:'t-'+t.name,kind:'Template',title:t.name,body:t.text+' Skills: '+t.skills.map(skillName).join(', '),icon:'list',run:()=>applyTemplate(t)})),
   ...C.docs.map(s=>({id:'d-'+s.id,kind:'Docs',title:s.title,body:s.body,icon:'book',run:()=>navigate('docs',s.id)})),
   ...C.paper.sections.map(s=>({id:'wp-'+s.id,kind:'Whitepaper',title:s.title,body:s.body,icon:'doc',run:()=>navigate('paper',s.id)})),
   ...C.roadmap.map(p=>({id:'r-'+p.phase,kind:'Roadmap',title:`${p.phase}: ${p.title}`,body:`${p.when}. `+p.items.map(x=>x[1]).join('. '),icon:'map',run:jump('roadmap')})),
   ...agents.filter(a=>!a.archived).map(a=>({id:'a-'+a.id,kind:'My agent',...agentDoc(a),icon:'users',run:()=>edit(a)})),
   ...(market||[]).filter(a=>!a.mine).map(a=>({id:'m-'+a.id,kind:'Discover',...agentDoc(a),icon:'store',run:()=>{navigate('discover');setQuery(a.name);}})),
  ];
 },[agents,market]); // eslint-disable-line react-hooks/exhaustive-deps
 const suggestions=paletteItems.filter(i=>['p-studioStudio','p-discoverDiscover','p-agentsMy agents','p-skillsSkills','p-docs','p-roadmapRoadmap','c-atlas','c-scout'].includes(i.id));

 if(embed)return <div className="grid min-h-svh grid-rows-[1fr_auto] bg-background"><IconDefs/><div className="relative min-h-[420px] bg-stage"><Avatar skin={draft.skin} appearance={draft.appearance} look={draft.look} animation={draft.motion||'Idle'} paused={paused}/></div><div className="grid gap-2 p-4"><Badge className="justify-self-start font-mono text-[10px] uppercase">Harvex agent preview</Badge><h2 className="font-display text-2xl font-medium">{draft.name}</h2><p className="text-sm text-muted-foreground">{draft.personality}</p><Button asChild className="justify-self-start"><a href={`/dashboard/studio#agent=${encoded(draft)}`} target="_blank" rel="noreferrer">Open in Harvex</a></Button></div></div>;

 const navProps={view,navigate:(v:View,doc?:string)=>navigate(v,doc,'site'),onSearch:()=>setPalette(true),auth,balance,email,onAccount:()=>setSettings(true),onSignIn:()=>askSignIn()};
 const isApp=area==='dash';
 const needsAuth=!auth&&['studio','agents','discover','activity','credits'].includes(view);
 return <GateProvider closed={closed}>
  <IconDefs/>
  <MotionRuntime viewKey={pathname}/>
  {isApp?<>
   <Navbar {...navProps} appMode/>
   <AppShell view={view} navigate={(v,doc)=>navigate(v,doc)} onSearch={()=>setPalette(true)} auth={auth} label={email} balance={balance} counts={{agents:activeAgents.length,published:publishedCount,runs:runs.length}} onAccount={()=>setSettings(true)} onSignIn={()=>askSignIn()} onNew={()=>fresh()} agent={{name:draft.name,skin:draft.skin,appearance:draft.appearance,look:draft.look,skills:draft.skills,sub:`${character.name} · ${character.role}`,saved:!!draft.id&&agents.some(a=>a.id===draft.id)}}>
   <Suspense fallback={<Loading/>}>
   <div key={view} className={cn('max-[820px]:pb-[calc(92px+env(safe-area-inset-bottom))]',view==='studio'&&'min-[821px]:flex min-[821px]:h-[calc(100svh-var(--dash-chrome,74px))] min-[821px]:flex-col')}>
   {/* signed out: on desktop the top bar carries the hint and the Connect button (components/app/shell.tsx) and the
       Studio shows a small chip under the agent name, so no row is taken from the page. Phones keep one slim line
       on the list pages; the Studio stage is too short there for a banner. */}
   {((needsAuth&&view!=='studio')||loadError)&&<div className={cn('mx-auto grid max-w-[1240px] gap-2 px-[clamp(16px,2.4vw,32px)] pt-4',view==='studio'&&'max-w-none shrink-0 px-2 pt-2 pb-2',!loadError&&'min-[821px]:hidden')}>
    {needsAuth&&view!=='studio'&&<Alert className="flex items-center gap-3 rounded-xl py-2.5 min-[821px]:hidden"><I id="user"/><AlertDescription className="flex-1 text-[13px]"><span>Saving, publishing and running agents need <b className="text-foreground">a connected wallet</b>.</span></AlertDescription><Button size="sm" onClick={()=>askSignIn()}>Connect</Button></Alert>}
    {loadError&&<Alert variant="destructive" className="flex items-center gap-3 rounded-xl"><AlertDescription className="flex-1">{loadError}</AlertDescription><Button size="sm" variant="outline" onClick={refresh}>Retry</Button></Alert>}
   </div>}

   {view==='studio'&&<section className="grid min-h-[560px] flex-1 grid-cols-[minmax(0,1fr)_400px] grid-rows-[minmax(0,1fr)] overflow-hidden max-[1100px]:grid-cols-[minmax(0,1fr)_360px] max-[820px]:flex max-[820px]:h-auto max-[820px]:flex-col">
    <div className="relative min-h-0 overflow-hidden bg-stage max-[820px]:order-1 max-[820px]:h-[min(74svh,640px)] max-[820px]:min-h-[480px]">
     <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{backgroundImage:'radial-gradient(var(--grid-dot) 1px,transparent 1.2px)',backgroundSize:'22px 22px'}}/>
     <Avatar skin={draft.skin} appearance={draft.appearance} look={draft.look} animation={draft.motion||'Idle'} paused={paused} speed={speed}/>
     <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3 [&>*]:pointer-events-auto">
      <div className="grid gap-1.5"><h1 className="font-display text-[clamp(22px,2.4vw,30px)] leading-none font-medium tracking-[-.03em]">{draft.name||'Untitled agent'}</h1>
       <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><span className="size-2 rounded-sm bg-lime"/><span>{character.name} · {character.role} · {sig?.name}</span>
        <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><button className="grid size-5 place-items-center rounded-sm text-muted-foreground hover:text-foreground" aria-label="Stage tips"><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg></button></TooltipTrigger><TooltipContent side="bottom">Turn it by dragging · zoom with the wheel · powers sit on keys 1–6</TooltipContent></Tooltip></TooltipProvider></div>
       {!auth&&!loading&&<button onClick={()=>askSignIn()} className="flex w-fit items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1 text-[12px] whitespace-nowrap max-[820px]:hidden text-muted-foreground backdrop-blur-sm transition-colors hover:border-foreground/30 hover:text-foreground [&_svg]:size-3.5"><I id="wallet"/><span>Not saved · <b className="font-medium text-foreground">connect wallet</b></span></button>}</div>
      <StageControls paused={paused} onPause={()=>setPaused(v=>!v)} speed={speed} onSpeed={setSpeed}/>
     </div>
     {scan&&<Card className="absolute top-24 right-4 w-60 gap-2 border-lime/50 bg-background/90 p-3.5 text-[13px] backdrop-blur-md max-[820px]:top-auto max-[820px]:bottom-44">
      <Mono className="text-brand">Scan · {character.name}</Mono>
      {[['Agent',draft.name],['Class',character.role],['Tone',draft.tone],['Skills',draft.skills.map(skillName).join(', ')],['Signature',sig?.name]].map(([k,v])=><div key={k} className="flex justify-between gap-3"><Mono className="pt-0.5 text-[10px]">{k}</Mono><b className="text-right font-semibold">{v}</b></div>)}
      <Progress value={40+draft.skills.length*15} className="h-1 bg-secondary [&>div]:bg-lime"/>
     </Card>}
     <div className="absolute top-1/2 left-4 -translate-y-1/2 max-[820px]:top-auto max-[820px]:bottom-[68px] max-[820px]:left-1/2 max-[820px]:-translate-x-1/2 max-[820px]:translate-y-0"><Powers skin={draft.skin}/></div>
     <div className="absolute inset-x-4 bottom-4 flex justify-center max-[820px]:inset-x-3 max-[820px]:bottom-3"><div className="w-full max-w-[640px]"><MotionDeck stance={draft.motion||'Idle'} onStance={m=>{change('motion',m);playMotion(m);}}/></div></div>
    </div>
    <aside aria-label="Agent editor" className="flex min-h-0 flex-col border-l bg-surface max-[820px]:order-3 max-[820px]:border-t max-[820px]:border-l-0">
     <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
      <TabsList variant="line" className="h-12 w-full justify-start gap-0 overflow-x-auto rounded-none border-b px-2">
       {[['character','Avatar'],['look','Outfit'],['persona','Persona'],['skills','Skills'],['run','Run'],['automate','Automate']].map(([id,l])=><TabsTrigger key={id} value={id} className="h-full flex-none px-1.5 text-[13px] after:bg-lime">{l}{id==='skills'&&<span className="rounded-sm bg-secondary px-1.5 font-mono text-[10px] text-brand">{draft.skills.length}</span>}</TabsTrigger>)}
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-width:thin] max-[820px]:overflow-visible">
       <TabsContent value="character"><Roster skin={draft.skin} onSelect={chooseCharacter}/></TabsContent>
       <TabsContent value="look" className="grid gap-5"><OutfitEditor skin={draft.skin} look={draft.look} appearance={draft.appearance} onLook={v=>change('look',v)} onChange={v=>change('appearance',v)}/></TabsContent>
       <TabsContent value="persona" className="stagger grid gap-5">
        <div className="grid gap-2"><FieldLabel htmlFor="fName">Agent name</FieldLabel><Input id="fName" maxLength={40} value={draft.name} onChange={e=>change('name',e.target.value)}/></div>
        <div className="grid gap-2"><FieldLabel htmlFor="fTag">Tagline <span className="font-normal">(appears in Discover once the agent is published)</span></FieldLabel><Input id="fTag" maxLength={140} value={draft.tagline||''} onChange={e=>change('tagline',e.target.value)} placeholder="What this agent does best, in a single line"/></div>
        <div className="grid gap-2"><FieldLabel htmlFor="fPersona">Personality &amp; instructions</FieldLabel><Textarea id="fPersona" maxLength={2000} value={draft.personality} onChange={e=>change('personality',e.target.value)} className="min-h-28"/><span className="text-xs text-muted-foreground">The AI receives this text each time the agent takes a task.</span></div>
        <Suspense fallback={null}><VoiceBox auth={auth} balance={balance} open={voiceOpen} onSignIn={()=>askSignIn()} ensureSaved={ensureCurrent} onSpent={refresh} onUse={(persona,tagline)=>setDraft(d=>({...d,personality:persona,tagline:d.tagline||tagline||undefined}))}/></Suspense>
        <div className="grid gap-2"><FieldLabel htmlFor="fKnow">Always-on notes <span className="font-normal">(optional; short facts that go along with each answer)</span></FieldLabel><Textarea id="fKnow" maxLength={KNOWLEDGE_MAX} value={draft.knowledge||''} onChange={e=>change('knowledge',e.target.value)} className="min-h-24 text-[13px]" placeholder="Short facts that belong in any answer: your name, your project, the link people should get. Put longer material in Sources below."/><span className="text-xs text-muted-foreground tabular-nums">{(draft.knowledge||'').length.toLocaleString('en-US')} / {KNOWLEDGE_MAX.toLocaleString('en-US')} characters. They go out with each run, as the instructions do; the agent works from them and never prints them whole.</span></div>
        <Suspense fallback={null}><KnowledgeBox auth={auth} agentId={draft.id&&agents.some(a=>a.id===draft.id)?draft.id:undefined} onSignIn={()=>askSignIn()} ensureSaved={ensureCurrent} onChanged={refresh}/></Suspense>
        <div className="grid gap-2"><FieldLabel htmlFor="fGreet">Greeting <span className="font-normal">(its opening line in a chat)</span></FieldLabel><Input id="fGreet" maxLength={GREETING_MAX} value={draft.greeting||''} onChange={e=>change('greeting',e.target.value)} placeholder="e.g. Hi there. Ask me where I would start."/></div>
        <div className="grid gap-2"><FieldLabel>Questions to start from <span className="font-normal">(a chat offers them as buttons)</span></FieldLabel>{Array.from({length:STARTERS_MAX},(_,i)=><Input key={i} maxLength={STARTER_MAX} aria-label={`Question ${i+1}`} value={draft.starters?.[i]||''} onChange={e=>{const next=Array.from({length:STARTERS_MAX},(_,j)=>j===i?e.target.value:draft.starters?.[j]||'');change('starters',next);}} placeholder={['e.g. Where would you start?','e.g. Pick my plan apart','e.g. Walk me through it from zero'][i]}/>)}</div>
        <Options label="Tone" value={draft.tone} options={TONES.map(t=>[t,t])} onChange={v=>change('tone',v as Agent['tone'])}/>
        <div className="grid gap-1.5"><Options label="Default stance" value={draft.motion||'Idle'} options={loopMotions.map(m=>[m,m])} onChange={v=>{change('motion',v as Motion);playMotion(v);}}/><span className="text-xs text-muted-foreground">On the stage the agent falls back to this motion and repeats it.</span></div>
        <div className="grid gap-2.5 border-t pt-5"><Mono>Start from a template</Mono><div className="flex flex-wrap gap-1.5">{TEMPLATES.map(t=><Button key={t.name} variant="outline" size="sm" shape="pill" onClick={()=>applyTemplate(t)}>{t.name}</Button>)}</div><span className="text-xs text-muted-foreground">A template brings its own character, skills and instructions, and it replaces any outfit changes you made.</span></div>
       </TabsContent>
       <TabsContent value="skills" className="stagger grid gap-3">
        <p className="text-sm text-muted-foreground">An agent carries at most <b className="text-foreground">{MAX_SKILLS}</b> agent skills. You use them from the <b className="text-foreground">Run</b> tab.</p>
        {trials?.limit?<p className="text-[12.5px] text-muted-foreground">All skills are open. In the preview each of them can be tried <b className="text-foreground">{trials.limit}×</b>.</p>:null}
        {skillCatalog.filter(s=>!s.planned&&!s.locked).map(s=>{const on=draft.skills.includes(s.id as Agent['skills'][number]);return <SkillRow key={s.id} tone={toneFor(s.category)} icon={SKILL_ICON[s.icon]||'globe'} name={s.name} tag={s.category} extra={<TriesBadge left={triesLeft(trials,s.id)}/>} desc={s.description} on={on} action={<Switch checked={on} aria-label={`Equip ${s.name}`} onCheckedChange={()=>{if(on){if(draft.skills.length===1){toast.error('An agent needs one skill at least');return;}change('skills',draft.skills.filter(x=>x!==s.id) as Agent['skills']);}else{if(draft.skills.length>=MAX_SKILLS){toast.error(`The limit is ${MAX_SKILLS} skills. Switch one off to add another.`);return;}change('skills',[...draft.skills,s.id] as Agent['skills']);}}}/>}/>;})}
        <Mono className="mt-3">Powers · stage</Mono>
        {powers.map(p=><SkillRow key={p.id} tone={toneFor(p.id)} icon={p.id} name={p.name} tag={p.id===character.sig?'signature · faster cooldown':undefined} desc={p.desc} action={<Badge variant="outline" className="font-mono text-[10px]">key {p.key}</Badge>}/>)}
        {skillCatalog.some(s=>s.locked)&&<Mono className="mt-3">Locked · unlocking soon</Mono>}
        {skillCatalog.filter(s=>s.locked).map(s=>{const on=draft.skills.includes(s.id as Agent['skills'][number]);return <SkillRow key={s.id} muted icon={SKILL_ICON[s.icon]||'globe'} name={s.name} tag="locked" desc={s.description} action={on?<Button size="sm" variant="outline" onClick={()=>{if(draft.skills.length===1){toast.error('Add an open skill before you remove this one');return;}change('skills',draft.skills.filter(x=>x!==s.id) as Agent['skills']);}}>Remove</Button>:<Badge variant="outline" className="font-mono text-[10px]">locked</Badge>}/>;})}
        <Mono className="mt-3">Planned</Mono>
        {skillCatalog.filter(s=>s.planned).map(s=><SkillRow key={s.id} muted icon={SKILL_ICON[s.icon]||'globe'} name={s.name} tag="planned" desc={s.description}/>)}
       </TabsContent>
       <TabsContent value="run" className="grid gap-4"><RunPanel target={{id:draft.id,name:draft.name,skills:draft.skills,price:0,mine:true}} ready={ready} liveCost={liveCost} skillCosts={skillCosts} liveToday={liveToday} balance={balance} trials={trials} auth={auth} ensureSaved={ensureCurrent} onDone={refresh} onSignIn={()=>askSignIn()} onShare={setRunDetail}/></TabsContent>
       <TabsContent value="automate" className="grid gap-4"><Suspense fallback={<Loading/>}><AgentSchedules auth={auth} agent={draft} agents={agents} balance={balance} onSignIn={()=>askSignIn()} ensureSaved={ensureCurrent}/></Suspense></TabsContent>
      </div>
     </Tabs>
     <div className="flex items-center gap-2 border-t bg-surface p-3">
      <Button className="h-10 flex-1 shadow-[inset_0_-3px_0_rgb(0_0_0/.12)]" disabled={busy} onClick={save}><I id="save"/>{busy?'Saving…':'Save agent'}</Button>
      <Button variant="outline" size="icon" className="size-10" onClick={async()=>{if(!requireAuth())return;const p=(await agentSchema()).safeParse(draft);if(!p.success){toast.error('Sharing needs a complete agent. Fill in what is missing.');return;}setShare(true);}} aria-label="Share or export"><I id="share"/></Button>
      <Button variant="outline" className="h-10" onClick={()=>fresh(draft.skin)}>New</Button>
     </div>
    </aside>
   </section>}

   {(view==='docs'||view==='paper')&&<DocsShell kind={view as DocKind} page={docPage} onPage={(k,id)=>navigate(k,id,'dash')} onSearch={()=>setPalette(true)} onRoadmap={()=>navigate('roadmap',undefined,'dash')}/>}
   {view==='roadmap'&&<DashPage><PageHeader icon="map" tone="mint" title="Roadmap" text="This page lists what is done, what is in the works and what is still a plan. Each date is a target and not a promise, and the token phase waits until the launch principles in the whitepaper are met."/><RoadmapPage/></DashPage>}

   {view==='overview'&&<Overview auth={auth} balance={balance} earned={earned} agents={activeAgents.length} published={publishedCount} runs={runs} wallet={wallet} navigate={(v:View)=>navigate(v)} onSignIn={()=>askSignIn()} onNew={()=>fresh()}/>}
   {view==='profile'&&<ProfilePage auth={auth} label={email} wallet={wallet} balance={balance} earned={earned} feeBps={feeBps} navigate={(v:View)=>navigate(v)} onSignIn={()=>askSignIn()} onSignOut={signOut}/>}
   {view==='wallet'&&<WalletPage auth={auth} onSignIn={()=>askSignIn()} onChanged={refresh}/>}
   {view==='schedules'&&<SchedulesPage auth={auth} agents={agents} balance={balance} onSignIn={()=>askSignIn()} onOpenHistory={()=>navigate('activity')} onAgents={refresh}/>}
   {view==='teams'&&<TeamsPage auth={auth} agents={agents} balance={balance} onSignIn={()=>askSignIn()} onOpenHistory={()=>navigate('activity')} onChanged={refresh}/>}
   {view==='quests'&&<QuestsPage auth={auth} onSignIn={()=>askSignIn()} onGo={v=>navigate(v)} onClaimed={refresh}/>}
   {view==='rewards'&&<RewardsPage wallet={wallet||undefined} auth={auth} onSignIn={()=>askSignIn()} onPaper={()=>navigate('paper','token')}/>}

   {view==='agents'&&<DashPage>
    <PageHeader icon="users" tone="sky" title="My agents" text="Every agent you saved is kept here. Set a price to list one in Discover, or export its config and carry it somewhere else." actions={<><Button variant="outline" onClick={()=>requireAuth()&&setImportOpen(true)}><I id="download"/>Import</Button><Button onClick={()=>fresh()}><I id="plus"/>New agent</Button></>}/>
    <KpiRow>
     <Kpi label="Agents" value={activeAgents.length} hint={`${archivedCount} archived`} tone="sky" icon="users"/>
     <Kpi label="Live in Discover" value={publishedCount} hint="Listed there with a price" tone="mint" icon="store"/>
     <Kpi label="Runs by others" value={usesTotal} hint="On all your published agents" tone="iris" icon="play"/>
     <Kpi label="Earned" value={`${earned} CR`} hint={`Platform fee ${feeBps/100}%`} tone="amber" icon="coins"/>
    </KpiRow>
    <div className="flex flex-wrap items-start justify-between gap-3">
     <Segmented value={agentFilter} onChange={setAgentFilter} items={[['all','All',activeAgents.length],['published','Published',publishedCount],['private','Private',activeAgents.length-publishedCount],['archived','Archived',archivedCount]]}/>
     <SearchBox value={query} onChange={setQuery} mode={mode} onMode={setMode} count={visibleAgents.length} placeholder="Search your agents" label="Search agents" className="w-full max-w-md"/>
    </div>
    {loading?<TileSkeletons/>:visibleAgents.length===0?<EmptyState title={query?'Nothing found':agentFilter==='archived'?'The archive is empty':'You have no agents yet'} text={query?(mode==='title'?'No agent has that in its name. Switch to Search everything.':'Your search found nothing.'):'Make one in the Studio and press Save agent. It is then listed on this page.'} action={!query&&agentFilter!=='archived'?<Button onClick={()=>fresh()}><I id="plus"/>Create an agent</Button>:undefined}/>:
    <Grid>{visibleAgents.map((a,k)=><AgentTile key={a.id} a={a} idx={k} actions={a.archived?[['Restore',()=>archive(a)],['Export JSON',()=>exportAgent(a)]]:[[a.published?'Price & publishing':'Publish to Discover',()=>setPublishFor(a)],['Duplicate',()=>{edit({...a,id:undefined,name:(a.name+' copy').slice(0,40)});toast.success('A copy is open in the Studio. Save it to keep it.');}],['Export JSON',()=>exportAgent(a)],['Archive',()=>archive(a)]]}
     footer={<><span className="text-xs text-muted-foreground">{runCount[a.id!]||0} run{runCount[a.id!]===1?'':'s'}{a.published?` · ${a.uses||0} by others`:''} · {a.tone}</span>{a.archived?<Button size="sm" variant="outline" className="ml-auto" onClick={()=>archive(a)}>Restore</Button>:<Button size="sm" className="ml-auto" onClick={()=>edit(a)}>Open<I id="arrow"/></Button>}</>}/>)}</Grid>}
   </DashPage>}

   {view==='discover'&&<DashPage>
    <PageHeader icon="store" tone="coral" title="Discover" text="Other creators put these agents here. Chat with one or hand it a task for credits; its creator gets the price less the platform fee."/>
    <div className="flex flex-wrap items-start justify-between gap-3">
     <SearchBox value={query} onChange={setQuery} mode={mode} onMode={setMode} count={visibleMarket?.length} placeholder="Search published agents" label="Search published agents" className="w-full max-w-md"/>
     <Select value={sort} onValueChange={v=>setSort(v as typeof sort)}><SelectTrigger className="w-[190px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="popular">Most used</SelectItem><SelectItem value="cheap">Lowest price</SelectItem><SelectItem value="new">Newest</SelectItem></SelectContent></Select>
    </div>
    {visibleMarket===null?<TileSkeletons/>:visibleMarket.length===0?<EmptyState title={query?'Nothing found':'Nobody has published an agent yet'} text={query?(mode==='title'?'No agent has that in its name. Switch to Search everything.':'Your search found nothing.'):'Publish an agent of yours from My agents and everyone will find it here.'} chars={['cole','nova','rook']} action={!query?<Button variant="outline" onClick={()=>navigate('agents')}>Go to My agents</Button>:undefined}/>:
    <Grid>{visibleMarket.map((a,k)=><AgentTile key={a.id} a={a} idx={k+2} creator={a.mine?'Your agent':a.verified?`${a.creator} · verified`:a.creator} price={a.price} status={a.mine?'mine':'live'}
     actions={[['Open its page',()=>router.push(agentPath(a.id))],['Copy link',()=>copyText(location.origin+agentPath(a.id),toast.success,toast.error)]]}
     footer={<><span className="text-xs text-muted-foreground">{a.uses} run{a.uses===1?'':'s'} · {a.tone}</span><Button size="sm" variant="outline" className="ml-auto" onClick={()=>router.push(agentPath(a.id))}>Chat</Button><Button size="sm" onClick={()=>{if(!requireAuth())return;setMarketAgent(a);}}>Run a task<I id="arrow"/></Button></>}/>)}</Grid>}
    <div className="mt-2 flex items-end justify-between gap-3"><div className="grid gap-1"><h2 className="font-display text-xl font-medium tracking-[-.02em]">Starter templates</h2><p className="text-sm text-muted-foreground">Templates are yours to change. A published agent runs as its creator saved it, and its instructions are never shown.</p></div></div>
    <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{TEMPLATES.map((t,k)=><button key={t.name} onClick={()=>applyTemplate(t)} className={cn('lift group grid gap-3 rounded-xl border p-4 text-left',['bg-t-iris','bg-t-mint','bg-t-amber','bg-t-coral'][k%4])}>
     <div className="flex items-center gap-3"><Thumb id={t.skin as CharacterId} className="size-11 rounded-lg bg-background object-[50%_18%]"/><div className="grid"><b className="text-[15px] font-semibold">{t.name}</b><span className="font-mono text-[10px] tracking-[.06em] text-muted-foreground uppercase">{getCharacter(t.skin).name} · {t.skills.length} skills</span></div></div>
     <p className="line-clamp-3 text-[13px] text-muted-foreground">{t.text}</p>
     <span className="nudge flex items-center gap-1.5 font-mono text-[10.5px] font-semibold tracking-[.08em] uppercase">Customize<I id="arrow" className="i size-3.5"/></span>
    </button>)}</div>
   </DashPage>}

   {view==='skills'&&<DashPage>
    <PageHeader icon="layers" tone="iris" title="Skill library" text={`Work is done by agent skills, while powers only play on the stage. In the Studio each agent takes up to ${MAX_SKILLS} agent skills.`}/>
    <KpiRow>
     <Kpi label="Open skills" value={skillCatalog.filter(s=>!s.planned&&!s.locked).length} hint="Ready to use in the Studio" tone="iris" icon="layers"/>
     <Kpi label="Tries per skill" value={!trials?'—':trials.limit?`${trials.limit}×`:'∞'} hint={!trials?'Shown once a wallet is connected':trials.limit?'For each skill, on each account':'This server sets no limit'} tone="amber" icon="clock"/>
     <Kpi label="Stage powers" value={powers.length} hint="Keys 1 to 6" tone="sky" icon="hype"/>
     <Kpi label={`Equipped on ${draft.name||'draft'}`} value={`${draft.skills.length}/${MAX_SKILLS}`} hint="Edit them in the Studio" tone="lime" icon="check"/>
    </KpiRow>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
     <SearchBox value={query} onChange={setQuery} mode={mode} onMode={setMode} count={visibleSkills.length} placeholder="Search skills" label="Search skills"/>
     <Segmented value={filter} onChange={setFilter} items={SKILL_CATS.map(c=>[c,c] as [string,string])} className="lg:justify-self-end"/>
    </div>
    <div className="stagger grid gap-3 md:grid-cols-2">{visibleSkills.map(s=>{const on=draft.skills.includes(s.id as Agent['skills'][number]);return <SkillRow key={s.id} card tone={toneFor(s.category)} muted={s.planned||s.locked} icon={SKILL_ICON[s.icon]||'globe'} name={s.name} tag={s.planned?'planned':s.locked?'locked':s.category} extra={<>{on&&<StatusBadge kind="live">equipped</StatusBadge>}{!s.planned&&!s.locked&&<TriesBadge left={triesLeft(trials,s.id)}/>}</>} desc={s.description}
     action={s.locked?<Button size="sm" variant="outline" disabled>Locked</Button>:!s.planned?<Button size="sm" variant={on?'secondary':'outline'} disabled={on} onClick={()=>{if(draft.skills.length>=MAX_SKILLS){toast.error(`The limit is ${MAX_SKILLS} skills. Take one off in the Studio first.`);return;}change('skills',[...draft.skills,s.id] as Agent['skills']);toast.success(`${draft.name} now carries ${s.name}`);}}>{on?'Equipped':'Equip'}</Button>:undefined}/>;})}</div>
    {visibleSkills.length===0&&<EmptyState title="No skill found" text={mode==='title'?'No skill has that in its name. Switch to Search everything.':'Your search found nothing.'}/>}
    <h2 className="mt-2 font-display text-xl font-medium tracking-[-.02em]">Stage powers</h2>
    <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">{powers.map(p=><SkillRow key={p.id} card tone={toneFor(p.id)} icon={p.id} name={p.name} tag={`key ${p.key} · ${p.cd}s`} desc={`${p.desc} Signature: ${characters.filter(x=>x.sig===p.id).map(x=>x.name).join(', ')}.`}/>)}</div>
   </DashPage>}

   {view==='activity'&&<DashPage>
    <PageHeader icon="clock" tone="mint" title="Task history" text="The 100 most recent runs, each with its output and its cost in credits." actions={<Button variant="outline" onClick={refresh}><I id="reset"/>Refresh</Button>}/>
    <KpiRow>
     <Kpi label="Runs" value={runs.length} hint="The newest 100" tone="mint" icon="play"/>
     <Kpi label="Completed" value={runs.filter(r=>r.status==='complete').length} hint="Came back with an output" tone="sky" icon="check"/>
     <Kpi label="Failed" value={runs.filter(r=>r.status==='failed').length} hint="Their credits went back to you" tone="coral" icon="reset"/>
     <Kpi label="Credits used" value={`${runs.reduce((n,r)=>n+(r.status==='failed'?0:r.cost),0)} CR`} hint="Paid runs and samples together" tone="amber" icon="coins"/>
    </KpiRow>
    <Segmented value={runFilter} onChange={setRunFilter} items={[['all','All',runs.length],['complete','Complete',runs.filter(r=>r.status==='complete').length],['failed','Failed',runs.filter(r=>r.status==='failed').length]]}/>
    {loading?<TileSkeletons rows/>:shownRuns.length===0?<EmptyState title="Nothing has run yet" text="Give an agent a task in the Studio. Its output and cost are then listed here." chars={['scout','maker','guardian']} action={<Button onClick={()=>{navigate('studio');setTab('run');}}>Try your agent</Button>}/>:<>
     <div className="overflow-hidden rounded-xl border max-md:hidden"><Table>
      <TableHeader className="bg-secondary/60"><TableRow className="hover:bg-transparent">{['Agent','Task','Mode','Status','Cost','When'].map(h=><TableHead key={h} className="h-10 font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase">{h}</TableHead>)}</TableRow></TableHeader>
      <TableBody className="stagger">{shownRuns.map(r=><TableRow key={r.id} onClick={()=>setRunDetail(r)} className="cursor-pointer">
       <TableCell className="font-medium">{r.agent_name}{!!r.step&&<span className="ml-1.5 inline-flex items-center gap-1 rounded-sm bg-t-iris px-1.5 py-px align-middle font-mono text-[9.5px] font-semibold text-tx-iris uppercase"><I id="link" className="i size-2.5"/>Team · {r.step}</span>}{!!r.talk&&<span className="ml-1.5 inline-flex items-center gap-1 rounded-sm bg-t-sky px-1.5 py-px align-middle font-mono text-[9.5px] font-semibold text-tx-sky uppercase"><I id="users" className="i size-2.5"/>Chat</span>}{r.skill==='voice'&&<span className="ml-1.5 inline-flex items-center gap-1 rounded-sm bg-t-amber px-1.5 py-px align-middle font-mono text-[9.5px] font-semibold text-tx-amber uppercase"><I id="pen" className="i size-2.5"/>Voice</span>}{r.skill==='check'&&<span className="ml-1.5 inline-flex items-center gap-1 rounded-sm bg-t-lime px-1.5 py-px align-middle font-mono text-[9.5px] font-semibold text-tx-lime uppercase"><I id="scan" className="i size-2.5"/>Check</span>}{r.schedule_id&&<span className="ml-1.5 inline-flex items-center gap-1 rounded-sm bg-t-mint px-1.5 py-px align-middle font-mono text-[9.5px] font-semibold text-tx-mint uppercase"><I id="clock" className="i size-2.5"/>Scheduled</span>}</TableCell>
       <TableCell className="max-w-[360px] truncate text-muted-foreground">{r.prompt}</TableCell>
       <TableCell><StatusBadge kind={r.mode==='sample'?'sample':'live_ai'}>{r.mode==='sample'?'Sample':'AI'}</StatusBadge></TableCell>
       <TableCell><StatusBadge kind={r.status}/></TableCell>
       <TableCell className="font-mono tabular-nums">{r.status==='failed'?0:r.cost} CR</TableCell>
       <TableCell className="text-muted-foreground">{new Date(r.created).toLocaleDateString()} {new Date(r.created).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</TableCell>
      </TableRow>)}</TableBody>
     </Table></div>
     <div className="stagger grid gap-2 md:hidden">{shownRuns.map(r=><button key={r.id} onClick={()=>setRunDetail(r)} className="grid gap-2 rounded-xl border bg-card p-3 text-left">
      <div className="flex items-center justify-between gap-2"><b className="truncate text-sm">{r.agent_name}</b><StatusBadge kind={r.status}/></div>
      <p className="line-clamp-2 text-[13px] text-muted-foreground">{r.prompt}</p>
      <div className="flex justify-between font-mono text-[10.5px] text-muted-foreground"><span>{r.mode==='sample'?'Sample':'AI'} · {r.status==='failed'?0:r.cost} CR</span><span>{new Date(r.created).toLocaleDateString()}</span></div>
     </button>)}</div>
    </>}
   </DashPage>}

   {view==='credits'&&<DashPage>
    <PageHeader icon="coins" tone="amber" title="Credits & earnings" text="Runs are paid in credits. Each time another person runs an agent you published, its price is added to your balance."/>
    <KpiRow>
     <Kpi label="Balance" value={`${balance??'—'} CR`} hint={`A new account starts with ${startCredits} free`} tone="lime" icon="wallet"><Progress value={Math.min(100,(balance??0)/100*100)} className="h-1.5 bg-background [&>div]:bg-foreground"/></Kpi>
     <Kpi label="Earned" value={`${earned} CR`} hint={`${publishedCount} agent${publishedCount===1?'':'s'} live`} tone="iris" icon="store"/>
     <Kpi label="Spent" value={`${spent} CR`} hint="What runs and creators cost you, less refunds" tone="coral" icon="play"/>
     <Kpi label="Platform fee" value={`${feeBps/100}%`} hint={feeBps===0?'During the beta creators keep 100%':'Taken from every creator price'} tone="amber" icon="coins"/>
    </KpiRow>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
     <div className="grid gap-3">
      <div className="flex items-center justify-between"><h2 className="font-display text-xl font-medium tracking-[-.02em]">Ledger</h2><span className="font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase">{ledger.length} entries</span></div>
      {ledger.length===0?<EmptyState title="The ledger is empty" text="Every run, earning and refund gets a line here." chars={['cole','juno','otto']}/>:
      <div className="overflow-hidden rounded-xl border"><Table>
       <TableHeader className="bg-secondary/60"><TableRow className="hover:bg-transparent">{['Entry','Type','Date','Amount'].map(h=><TableHead key={h} className={cn('h-10 font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase',h==='Amount'&&'text-right')}>{h}</TableHead>)}</TableRow></TableHeader>
       <TableBody className="stagger">{ledger.map(l=><TableRow key={l.id}>
        <TableCell className="max-w-[340px] truncate font-medium">{l.note}</TableCell>
        <TableCell><StatusBadge kind={l.kind}/></TableCell>
        <TableCell className="text-muted-foreground max-sm:hidden">{new Date(l.created).toLocaleString()}</TableCell>
        <TableCell className={cn('text-right font-mono tabular-nums',l.delta>0?'text-tx-mint':'text-foreground')}>{l.delta>0?'+':'−'}{Math.abs(l.delta)} CR</TableCell>
       </TableRow>)}</TableBody>
      </Table></div>}
     </div>
     <div className="stagger grid gap-3">
      <div className="grid gap-3 rounded-xl border bg-card p-4"><b className="text-sm font-semibold">How credits work</b>{[['wallet',`Signing in gives you ${startCredits} free credits${refill?.credits?`; every ${refill.hours} hours the free part is filled back to ${refill.credits}${refill.next?` (next at ${clock(refill.next)})`:''}`:''}`],['layers',liveToday?.heavy?`In any ${liveToday.heavy.hours} hours a heavy skill runs ${liveToday.heavy.freeLimit} times on free credits, or ${liveToday.heavy.paidLimit} times while you hold bought credits`:'Heavy skills are counted in 5-hour windows'],['play',`A workflow sample costs 5 CR${ready?`; a live AI run costs ${liveRange(skillCosts,liveCost)} CR, set by the skill`:''}`],['store','Another creator’s agent adds the price they set to the run'],['reset','A run that fails gives its credits back by itself']].map(([ic,t])=><div key={t} className="flex items-start gap-2.5 text-[13px] text-muted-foreground"><ToneIcon icon={ic} tone={toneFor(ic==='wallet'?'scan':ic==='play'?'orb':ic==='store'?'hype':'shield')} className="size-7 rounded-md [&_svg]:size-3.5"/>{t}</div>)}<Button variant="outline" onClick={()=>navigate('agents')}>Set prices</Button></div>
      <div className="grid gap-2 rounded-xl border bg-t-sky p-4 text-[13px]"><b className="font-semibold">On <Chain/></b><span className="text-muted-foreground">The Wallet page holds USDT top-ups, claims of what you earned and your holder tier. None of them works unless the operator has switched it on. No credit can be withdrawn, and a claim covers earned credits only.</span><Button variant="outline" onClick={()=>navigate('wallet')}><I id="wallet"/>Wallet & chain</Button></div>
     </div>
    </div>
   </DashPage>}
   </div>
   </Suspense>
   </AppShell>
  </>:<>
  {/* the library (docs, whitepaper, roadmap) has its own top bar from 821px: app/public-docs.tsx */}
  <Navbar {...navProps} appMode={view==='docs'||view==='paper'||view==='roadmap'}/>
  <main key={gate?pathname:view} data-view="" className="max-[820px]:pb-[calc(92px+env(safe-area-inset-bottom))]">
   {gate&&<ClosedPage section={gate} closed={closed} path={pathname} onNavigate={(v,doc)=>navigate(v,doc,'site')}/>}
   {view==='home'&&<Home onNavigate={(v,doc)=>navigate(v,doc,'site')} onPick={id=>{chooseCharacter(id);navigate('studio');}} templates={TEMPLATES} onTemplate={name=>{const t=TEMPLATES.find(x=>x.name===name);if(t)applyTemplate(t);}}/>}
   <Suspense fallback={<Loading/>}>
    {(view==='docs'||view==='paper')&&<PublicDocs kind={view as DocKind} page={docPage} onPage={(k,id)=>navigate(k,id,'site')} onNavigate={(v,doc)=>navigate(v,doc,'site')} onSearch={()=>setPalette(true)}/>}
    {view==='roadmap'&&<PublicRoadmap onNavigate={(v,doc)=>navigate(v,doc,'site')} onSearch={()=>setPalette(true)}/>}
    {view==='login'&&<LoginPage auth={auth} onDone={()=>{refresh();const n=new URLSearchParams(location.search).get('next');router.replace(n&&n.startsWith('/dashboard')?n:'/dashboard');}} onNavigate={(v,doc)=>navigate(v,doc,'site')}/>}
    {view==='agent'&&route.doc&&<AgentPage id={route.doc} auth={auth} onSignIn={()=>askSignIn()} onSpent={refresh} onRun={a=>{if(!requireAuth())return;setMarketAgent(a);}} onNavigate={(v,doc)=>navigate(v,doc,'site')}/>}
    {view==='whales'&&<WhalesPage onNavigate={(v,doc)=>navigate(v,doc,'site')}/>}
    {view==='invite'&&route.doc&&<InvitePage key={route.doc} code={route.doc} auth={auth} onNavigate={(v,doc)=>navigate(v,doc)} onSignIn={()=>askSignIn()}/>}
    {view==='referral'&&<ReferralPage onNavigate={(v,doc)=>navigate(v,doc)}/>}
    {view==='verified'&&<VerifiedPage onNavigate={(v,doc)=>navigate(v,doc)}/>}
    {view==='plaza'&&<PlazaPage auth={auth} onSignIn={()=>askSignIn()} onSpent={refresh} onNavigate={(v,doc)=>navigate(v,doc)}/>}
    {view==='top'&&<BoardPage onNavigate={(v,doc)=>navigate(v,doc)}/>}
    {view==='arena'&&<ArenaPage auth={auth} onSignIn={()=>askSignIn()} onSpent={refresh} onNavigate={(v,doc)=>navigate(v,doc)}/>}
    {view==='duel'&&route.doc&&<DuelPage key={route.doc} id={route.doc} auth={auth} onSignIn={()=>askSignIn()} onNavigate={(v,doc)=>navigate(v,doc)}/>}
    {view==='creators'&&<CreatorsPage onNavigate={(v,doc)=>navigate(v,doc)}/>}
    {view==='teamup'&&<TeamsInfoPage onNavigate={(v,doc)=>navigate(v,doc)}/>}
    {view==='recipes'&&<RecipesPage onNavigate={(v,doc)=>navigate(v,doc)}/>}
    {view==='tiers'&&<TiersPage onNavigate={(v,doc)=>navigate(v,doc,v==='paper'?'site':undefined)}/>}
    {view==='shared'&&route.doc&&<SharePage key={route.doc} id={route.doc} onNavigate={(v,doc)=>navigate(v,doc,'site')}/>}
    {view==='notfound'&&<NotFoundPage onNavigate={(v,doc)=>navigate(v,doc,'site')}/>}
   </Suspense>

  </main>
  </>}
  {palette&&<Suspense fallback={null}><SearchPalette open={palette} onOpenChange={setPalette} items={paletteItems} suggestions={suggestions}/></Suspense>}
  <Modal open={!!marketAgent} onClose={()=>setMarketAgent(null)} title={marketAgent?`Give ${marketAgent.name} a task`:''} description={marketAgent?`${marketAgent.mine?'It is your own agent, so no creator price':marketAgent.price===0?'No creator price':`Each run pays its creator ${marketAgent.price} credits`} · ${marketAgent.skills.map(skillName).join(', ')}`:''}>
   {marketAgent&&<div className="grid gap-4"><RunPanel target={{id:marketAgent.id,name:marketAgent.name,skills:marketAgent.skills,price:marketAgent.price,mine:!!marketAgent.mine}} ready={ready} liveCost={liveCost} skillCosts={skillCosts} liveToday={liveToday} balance={balance} trials={trials} auth={auth} ensureSaved={async()=>marketAgent.id} onDone={()=>{refresh();loadMarket();}} onSignIn={()=>askSignIn()} onShare={setRunDetail}/></div>}
  </Modal>
  <Modal open={share} onClose={()=>setShare(false)} title="Share or move this agent" description="Send its configuration as a link, or embed a preview of the character. Name, instructions and skills are all inside the link.">
   <div className="grid gap-2"><FieldLabel>Configuration link</FieldLabel><Textarea readOnly value={shareURL} rows={3} className="min-h-[70px] font-mono text-xs"/></div>
   <div className="flex flex-wrap gap-2"><Button onClick={()=>copyText(shareURL,toast.success,toast.error)}><I id="copy"/>Copy link</Button><Button variant="outline" onClick={()=>copyText(`<iframe src="${shareURL.replace('#agent=','?view=embed#agent=')}" title="Harvex agent preview" width="400" height="600" style="border:0;border-radius:16px" loading="lazy"></iframe>`,toast.success,toast.error)}><I id="copy"/>Copy embed code</Button><Button variant="outline" onClick={()=>exportAgent()}><I id="download"/>Export JSON</Button></div>
   <p className="text-sm text-muted-foreground">Whoever opens the link gets a copy in the studio, instructions included. Give it only to people who may read them.</p>
  </Modal>
  <Modal open={signin} onClose={()=>setSignin(false)} title="Connect wallet" description="Your wallet is your sign-in: MetaMask, Trust Wallet or another EVM wallet on BNB Smart Chain. There is no email and no password." narrow><Suspense fallback={<Loading/>}><SignIn onWalletDone={()=>{setSignin(false);refresh();toast.success('Your wallet is signed in');}}/></Suspense></Modal>
  <Modal open={settings} onClose={()=>setSettings(false)} title="Account & workspace" narrow><Suspense fallback={<Loading/>}><AccountPanel auth={auth} email={email} wallet={wallet} balance={balance} earned={earned} ready={ready} feeBps={feeBps} loadError={loadError} onSignOut={signOut} onSignIn={()=>{setSettings(false);askSignIn();}} onGo={v=>{setSettings(false);navigate(v);}}/></Suspense></Modal>
  <Sheet open={!!runDetail} onOpenChange={o=>{if(!o)setRunDetail(null);}}>
   <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">{runDetail&&<>
    <SheetHeader className="border-b"><SheetTitle>{runDetail.agent_name}</SheetTitle><SheetDescription>{new Date(runDetail.created).toLocaleString()}</SheetDescription>
     <div className="flex flex-wrap gap-1.5 pt-1"><StatusBadge kind={runDetail.status}/><StatusBadge kind={runDetail.mode==='sample'?'sample':'live_ai'}>{runDetail.mode==='sample'?'Workflow sample':'AI output'}</StatusBadge><StatusBadge kind="pending">{runDetail.status==='failed'?0:runDetail.cost} CR</StatusBadge></div></SheetHeader>
    <div className="stagger grid gap-5 p-4">
     <div className="grid gap-1.5"><span className="font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase">Task</span><p className="rounded-lg border bg-secondary/50 p-3 text-sm">{runDetail.prompt}</p></div>
     <div className="grid gap-1.5"><span className="font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase">Output</span><div className="rounded-lg border p-3"><TextOut text={runDetail.output||'No output has come back for this task yet.'}/></div></div>
     <div className="flex gap-2"><Button variant="outline" onClick={()=>copyText(outputText(runDetail.output),toast.success,toast.error)}><I id="copy"/>Copy</Button><Button variant="outline" onClick={()=>download('harvex-result.txt',outputText(runDetail.output),'text/plain')}><I id="download"/>Download</Button></div>
     <Suspense fallback={null}><ShareAnswer key={runDetail.id} run={runDetail} share={shares[runDetail.id]||null} onChange={s=>setShares(cur=>{const next={...cur};if(s)next[runDetail.id]=s;else delete next[runDetail.id];return next;})}/></Suspense>
    </div>
   </>}</SheetContent>
  </Sheet>
  <Modal open={!!publishFor} onClose={()=>setPublishFor(null)} title={publishFor?(publishFor.published?'Price & publishing':`Publish ${publishFor.name}`):''} description="In Discover a published agent runs exactly as you saved it. Its instructions are never shown, and the agent is told not to repeat them. Leave passwords and keys out of them all the same." narrow>
   {publishFor&&(()=>{const a=agents.find(x=>x.id===publishFor.id)||publishFor;const raw=priceDraft[a.id!]??String(a.price??0);const n=Math.max(0,Math.floor(Number(raw)||0));const fee=Math.floor(n*feeBps/10000);const rawTalk=talkDraft[a.id!]??String(chatPriceOf(a));
    return <div className="grid gap-4">
     <div className="grid gap-2"><FieldLabel htmlFor="pub-price">Price per run</FieldLabel><div className="flex items-center gap-2"><Input id="pub-price" type="number" min={0} max={500} value={raw} onChange={e=>setPriceDraft(d=>({...d,[a.id!]:e.target.value}))} className="h-11 tabular-nums"/><span className="font-mono text-sm text-muted-foreground">CR</span></div><span className="text-xs text-muted-foreground">Any whole number of credits, 0 to 500. On top of it the runner pays for the run: a workflow sample is 5 CR{ready?`, live AI is ${liveRange(skillCosts,liveCost)} CR by skill`:''}.</span></div>
     <div className="grid gap-2"><FieldLabel htmlFor="pub-talk">Price per chat message</FieldLabel><div className="flex items-center gap-2"><Input id="pub-talk" type="number" min={0} max={500} value={rawTalk} onChange={e=>setTalkDraft(d=>({...d,[a.id!]:e.target.value}))} className="h-11 tabular-nums"/><span className="font-mono text-sm text-muted-foreground">CR</span></div><span className="text-xs text-muted-foreground">You earn this for every message sent on the agent&apos;s page. A low price lets people try it, since the message itself costs them too.</span></div>
     <div className="grid grid-cols-2 gap-2"><div className="rounded-lg border bg-t-mint p-3"><span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">You keep per task</span><b className="block font-display text-2xl font-medium">{n-fee} CR</b></div><div className="rounded-lg border bg-secondary p-3"><span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">Platform fee</span><b className="block font-display text-2xl font-medium">{fee} CR</b></div></div>
     <Suspense fallback={null}><AgentCheck agent={a} balance={balance} onDone={refresh}/></Suspense>
     <div className="flex flex-wrap gap-2">{a.published
      ?<><Button disabled={busy} onClick={async()=>{await publish(a,true);setPublishFor(null);}}>Update prices</Button><Button variant="outline" disabled={busy} onClick={async()=>{await publish(a,false);setPublishFor(null);}}>Unpublish</Button></>
      :<Button disabled={busy} onClick={async()=>{await publish(a,true);setPublishFor(null);}}><I id="store"/>Publish to Discover</Button>}</div>
    </div>;})()}
  </Modal>
  <Modal open={importOpen} onClose={()=>setImportOpen(false)} title="Import a config" description="Drop in the agent JSON that Harvex exported, or pick a .json file." narrow><ImportBox onImport={t=>{setImportOpen(false);importText(t);}}/></Modal>
  <BottomNav {...navProps}/>
  <ThemedToaster/>
 </GateProvider>;
}

/* ---------- pieces ---------- */
function Page({children}:{children:ReactNode}){return <div className="stagger mx-auto grid max-w-[1180px] gap-6 px-4 pt-10 pb-16">{children}</div>;}
function Grid({children}:{children:ReactNode}){return <div className="stagger grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">{children}</div>;}
const TILE_TONES:Tone[]=['lime','iris','coral','sky','amber','mint','pink'];
type TileAgent={name:string;skin:Agent['skin'];look?:Agent['look'];appearance?:Agent['appearance'];tagline?:string;skills:readonly string[];published?:number;archived?:number;price?:number;tone?:string};
/** The chat price shown in the publish dialog: the one the creator set, else a small one (never the task price by default). */
const chatPriceOf=(a:Agent)=>a.talkPrice??Math.min(a.price??0,2);
function AgentTile({a,idx,actions,footer,creator,price,status}:{a:TileAgent;idx:number;actions?:[string,()=>void][];footer:ReactNode;creator?:string;price?:number;status?:string}){
 const c=getCharacter(a.skin);const st=status||(a.archived?'archived':a.published?'live':'private');const p=price??(a.published?a.price:undefined);
 // an agent is a folder: who it is on the tab, its picture on the back, what it does in the pocket
 return <Folder tab={<>{c.name} · {c.role}</>} tone={TILE_TONES[idx%TILE_TONES.length]} backClass="p-0" pocket="p-0" back={<div className="relative aspect-[16/10] [&_.avatar-thumb]:object-[50%_10%]">
   <Avatar skin={a.skin} appearance={a.appearance} look={a.look} small/>
   <div className="absolute top-2 left-2 flex gap-1.5"><StatusBadge kind={st==='mine'?'sample':st}>{st==='live'?'Live':st==='private'?'Private':st==='archived'?'Archived':st==='mine'?'Yours':st}</StatusBadge></div>
   {p!==undefined&&<span className="absolute right-2 bottom-2 rounded-full bg-background px-2.5 py-1 font-mono text-[11px] font-semibold">{p===0?'Free':`${p} CR/run`}</span>}
   {actions&&<DropdownMenu><DropdownMenuTrigger asChild><Button variant="secondary" size="icon-sm" className="absolute top-2 right-2 bg-background/90" aria-label={`Actions for ${a.name}`}><I id="more"/></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52">{actions.map(([l,fn])=><DropdownMenuItem key={l} onSelect={fn} className={cn(l==='Archive'&&'text-destructive focus:text-destructive')}>{l}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
  </div>}>
  <div className="grid gap-2.5 p-4">
   <div className="grid min-w-0 gap-0.5">{creator&&<span className="font-mono text-[10px] tracking-[.06em] text-muted-foreground uppercase">{creator}</span>}<h3 className="truncate font-display text-[17px] font-medium tracking-[-.02em]">{a.name}</h3></div>
   {a.tagline&&<p className="line-clamp-2 text-[13px] text-muted-foreground">{a.tagline}</p>}
   <div className="flex flex-wrap gap-1">{a.skills.slice(0,3).map(s=><span key={s} className="rounded-md border bg-secondary/60 px-2 py-0.5 text-[11.5px]">{skillName(s)}</span>)}{a.skills.length>3&&<span className="rounded-md border px-2 py-0.5 text-[11.5px] text-muted-foreground">+{a.skills.length-3}</span>}</div>
  </div>
  <div className="mt-auto flex items-center gap-2 border-t px-4 py-3">{footer}</div>
 </Folder>;
}
function TileSkeletons({rows}:{rows?:boolean}){
 return rows?<div className="grid gap-2">{[0,1,2,3].map(k=><Skeleton key={k} className="h-12 rounded-lg"/>)}</div>
  :<div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">{[0,1,2].map(k=><Skeleton key={k} className="h-[330px] rounded-2xl"/>)}</div>;
}
function SkillRow({icon,name,tag,desc,action,extra,on,muted,card,tone}:{icon:string;name:string;tag?:string;desc:string;action?:ReactNode;extra?:ReactNode;on?:boolean;muted?:boolean;card?:boolean;tone?:Tone}){
 return <div className={cn('grid grid-cols-[36px_1fr_auto] items-start gap-3 rounded-xl border bg-card p-4 transition-[border-color,background-color] duration-300 hover:border-foreground/25',on&&'border-lime/60',card&&'p-4')}>
  {muted?<span className="grid size-9 place-items-center rounded-md bg-secondary text-muted-foreground"><I id={icon}/></span>:<ToneIcon icon={icon} tone={tone||'lime'}/>}
  <div className="grid gap-1"><b className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">{name}{tag&&<Badge variant="outline" className="font-mono text-[9.5px] font-medium uppercase">{tag}</Badge>}{extra}</b><p className="text-[12.5px] leading-relaxed text-muted-foreground">{desc}</p></div>
  {action&&<div className="pt-0.5">{action}</div>}
 </div>;
}
function ImportBox({onImport}:{onImport:(t:string)=>void}){
 const [txt,setTxt]=useState('');
 return <div className="grid gap-3"><Textarea aria-label="Agent JSON" value={txt} onChange={e=>setTxt(e.target.value)} placeholder='{"name":"My Dorian","skin":"atlas", ...}' className="min-h-40 font-mono text-xs"/><div className="flex flex-wrap gap-2"><Button onClick={()=>{onImport(txt);setTxt('');}} disabled={!txt.trim()}>Import</Button><Button variant="outline" asChild><label className="cursor-pointer">Choose .json file<input type="file" accept=".json,application/json" className="sr-only" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>onImport(String(r.result));r.readAsText(f);e.target.value='';}}/></label></Button></div><p className="text-xs text-muted-foreground">A config from the first studio is brought up to date when it is imported.</p></div>;
}
type RunTarget={id?:string;name:string;skills:readonly string[];price:number;mine:boolean};
/** "2 tries left" chip; hidden when the server has no limit. */
function TriesBadge({left}:{left:number|null}){
 if(left===null)return null;
 return <span className={cn('rounded-full px-1.5 py-px font-mono text-[9.5px] font-semibold tracking-[.04em] uppercase',left>0?'bg-lime/15 text-foreground':'bg-destructive/10 text-destructive')}>{left>0?`${left} ${left===1?'try':'tries'} left`:'no tries left'}</span>;
}
type LiveToday={used:number;limit:number;studioFull:boolean;freeFull?:boolean;heavy?:{skills:string[];hours:number;tier:'free'|'paid';used:number;limit:number;resets:string;freeLimit:number;paidLimit:number};search?:{on:boolean;left:number;freeCredits:boolean}};
/** Why Web research will answer without browsing on this run, or '' when nothing stands in the way of a web search. */
function noSearchNote(t:LiveToday|null){const s=t?.search;if(!s)return '';
 if(!s.on)return 'This server has no web search connected. Web research answers from the model’s own knowledge and tells you it did not browse.';
 if(s.left===0)return 'The studio has spent today’s web searches. Until they return after 00:00 UTC, Web research goes on answering without browsing and tells you so.';
 if(!s.freeCredits&&t?.heavy?.tier==='free')return 'Only bought credits pay for a web search. A run on free credits gets a Web research answer without browsing, and it tells you so.';
 return '';}
type FreeRefill={credits:number;hours:number;next:string|null};
const clock=(iso:string)=>new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
/** Live AI price range across skills, e.g. "4–12" (a single number when every skill costs the same). */
function liveRange(costs:Record<string,number>,fallback:number){const v=Object.values(costs);if(!v.length)return String(fallback);const lo=Math.min(...v),hi=Math.max(...v);return lo===hi?String(lo):`${lo}–${hi}`;}
function RunPanel({target,ready,liveCost,skillCosts,liveToday,balance,trials,auth,ensureSaved,onDone,onSignIn,onShare}:{onShare?:(r:Run)=>void;target:RunTarget;ready:boolean;liveCost:number;skillCosts:Record<string,number>;liveToday:LiveToday|null;balance:number|null;trials:Trials|null;auth:boolean;ensureSaved:()=>Promise<string|null>;onDone:()=>void;onSignIn:()=>void}){
 const runnable=target.skills.filter(isOpenSkill) as typeof target.skills;const [skillPick,setSkill]=useState(runnable[0]);const skill=runnable.includes(skillPick)?skillPick:runnable[0];const [mode,setMode]=useState<'sample'|'live'>('sample');const [task,setTask]=useState('');const [running,setRunning]=useState(false);const [result,setResult]=useState<Run|null>(null);
 const cost=(mode==='sample'?5:skillCosts[skill]??liveCost)+(target.mine?0:target.price);const short=balance!==null&&cost>balance;const left=skill?triesLeft(trials,skill):null;const out=auth&&left===0;
 const timer=useRef(0);
 async function run(){if(running)return;if(!requireAuth())return;if(task.trim().length<3){toast.error('A task needs 3 characters or more.');return;}setRunning(true);setResult(null);startWork(skill);
  try{const id=await ensureSaved();if(!id){setRunning(false);return;}const data=await api('/api/runs',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),agentId:id,prompt:task,skill,mode,...(target.mine?{}:{expectedPrice:target.price})})});setResult(data);playMotion(Math.random()<0.5?'Cheer':'Victory');onDone();}
  catch(e:any){toast.error(e.message);playMotion('Shrug');onDone();}finally{setRunning(false);clearTimeout(timer.current);}}
 return <>
  {runnable.length?<Options label="Skill" value={skill} options={runnable.map(s=>[s,skillName(s)])} onChange={setSkill}/>:<p className="rounded-lg border border-dashed p-3 text-[13px] text-muted-foreground">Every skill on this agent is locked. Add an open one in the Skills tab and it can take a task.</p>}
  <Options label="Run mode" value={mode} options={ready?[['sample','Workflow sample'],['live','Live AI']]:[['sample','Workflow sample']]} onChange={v=>setMode(v as 'sample'|'live')}/>
  {ready&&mode==='live'&&liveToday&&<p className={cn('-mt-2 text-xs',liveToday.used>=liveToday.limit||liveToday.studioFull||liveToday.freeFull?'text-destructive':'text-muted-foreground')}>{liveToday.studioFull?'The studio has reached today’s live AI limit. Workflow samples keep working, and live AI returns after 00:00 UTC.':liveToday.freeFull?'Today’s free live AI runs are gone for the whole studio. Bought credits still run live AI; free live runs return after 00:00 UTC.':`You have used ${liveToday.used} of ${liveToday.limit} live AI runs today (the count resets at 00:00 UTC).`}</p>}
  {ready&&mode==='live'&&liveToday?.heavy&&liveToday.heavy.skills.includes(skill)&&(()=>{const h=liveToday.heavy!;const left=Math.max(0,h.limit-h.used);return <p className={cn('-mt-2 text-xs',left===0?'text-destructive':'text-muted-foreground')}>{`This is a heavy skill: ${left} of ${h.limit} runs remain in the current ${h.hours}-hour window (${h.tier==='paid'?'paid':'free'} tier), which resets at ${clock(h.resets)}.`}{h.tier==='free'?` With bought credits a window holds ${h.paidLimit}.`:''}</p>;})()}
  {ready&&mode==='live'&&skill==='research'&&noSearchNote(liveToday)&&<p className="-mt-2 text-xs text-muted-foreground">{noSearchNote(liveToday)}</p>}
  <div className="grid gap-2"><FieldLabel htmlFor="rf-task">What would you like to work on?</FieldLabel><Textarea id="rf-task" value={task} onChange={e=>setTask(e.target.value)} placeholder={skill==='monitor'?'Give a wallet address (0x…) and what to look for. If you leave the address out, the agent reads the wallet you linked.':skill==='whales'?'Ask your question about the HARVEX token today. The token reading is handed to the agent along with the task.':'Write the task here, or paste the document it should work on…'} maxLength={12000} className="min-h-28"/>
   {!task&&<div className="flex flex-wrap gap-1.5">{(skill==='monitor'?['Read my wallet and tell me what is different','What is in this wallet, and has HARVEX moved in the past day? 0x…']:skill==='whales'?['Which HARVEX transfers happened in the past 24 hours?','Turn today’s numbers into a short update for holders']:['Use official sources to compare three projects','Write a launch post from my idea','Give me the summary of this document and the next steps']).map(p=><Button key={p} size="sm" variant="outline" shape="pill" className="h-auto py-1.5 text-left whitespace-normal" onClick={()=>setTask(p)}>{p}</Button>)}</div>}</div>
  {auth&&!ready&&<Alert className="rounded-xl"><AlertDescription><span>This server has no live AI connected yet. A run gives you a <b className="text-foreground">labelled workflow sample</b>, not an AI answer.</span></AlertDescription></Alert>}
  <div className="flex flex-wrap items-center gap-3"><Button className="h-10 flex-1" disabled={running||!skill||task.trim().length<3||short||out} onClick={run}>{running?'Working…':out?`No tries left for ${skillName(skill)}`:`Run ${skillName(skill)}`}</Button><span className="text-xs text-muted-foreground">{cost} credits{target.mine?'':` · ${target.price} to the creator`}{short?' · not enough credits':''}{auth&&left!==null&&trials?` · ${left} of ${trials.limit} tries left`:''}</span></div>
  {out&&<p className="text-[12.5px] text-muted-foreground">The preview gave you a set number of tries for {skillName(skill)}, and none is left. Choose a different skill above or add one in the Skills tab.</p>}
  <Card className="gap-0 p-0 shadow-none">
   <div className="flex items-center justify-between gap-2 border-b px-3 py-2"><Mono className="text-[10px]">{running?'Working':result?(result.mode==='sample'?'Workflow sample':'AI output'):'Output'}</Mono>{result&&<div className="flex gap-1"><Button size="sm" variant="ghost" onClick={()=>copyText(outputText(result.output),toast.success,toast.error)}><I id="copy"/>Copy</Button><Button size="icon-sm" variant="ghost" aria-label="Download" onClick={()=>download('harvex-task.txt',outputText(result.output),'text/plain')}><I id="download"/></Button>{onShare&&result.status==='complete'&&<Button size="sm" variant="ghost" onClick={()=>onShare(result)}><I id="share"/>Share</Button>}</div>}</div>
   <div className="min-h-24 p-4">{running?<div className="flex items-center gap-2 text-sm text-muted-foreground">{[0,1,2].map(k=><i key={k} className="size-2 animate-pulse rounded-lg bg-lime" style={{animationDelay:`${k*.15}s`}}/>)} {target.name} is working…</div>:result?<TextOut text={result.output}/>:<p className="text-sm text-muted-foreground">The answer will show in this box. While the task runs, the character is at work on the stage.</p>}</div>
  </Card>
 </>;
}
