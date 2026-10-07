'use client';
/* App header and mobile navigation.
   Desktop (≥1024): a floating, centered bar (logo · mega-menu triggers · actions). Each trigger opens
   a full-width mega panel under the bar: grouped links with tinted icons plus a featured card.
   Tablet (821–1023): same bar, groups move into a right-side Sheet with accordions.
   Mobile (≤820): compact top bar + a bottom dock in the other theme with the Studio button beside it + "More" drawer. */
import {lazy,Suspense,useEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {NavigationMenu,NavigationMenuContent,NavigationMenuItem,NavigationMenuLink,NavigationMenuList,NavigationMenuTrigger} from '@/components/ui/navigation-menu';
import {Button} from '@/components/ui/button';
import {Kbd} from '@/components/ui/kbd';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger} from '@/components/ui/accordion';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {cn} from '@/lib/utils';
import {FaXTwitter} from 'react-icons/fa6';
import {SOCIAL} from '@/lib/site';
import {I} from '@/app/ui';
import {useTheme} from '@/app/theme';
import {CutButton,Folder,TINT_BG,type Tone} from './motion';
import {TOKEN_LINE,useTokenStage} from './token-context';
import {Face} from '@/components/landing/mocks';
import {Soon,useGate} from './gate';

/* The mobile "More" drawer (vaul) loads the first time it opens. */
const MoreDrawer=lazy(()=>import('./more-drawer').then(m=>({default:m.MoreDrawer})));
import type {View} from '@/lib/routes';
export type {View};
export type NavLink={id:View;title:string;icon:string;desc:string;tone:Tone;doc?:string};
export const PRODUCT:NavLink[]=[
 {id:'studio',title:'Studio',icon:'cube',desc:'Shape a character and give it work',tone:'lime'},
 {id:'skills',title:'Skills',icon:'layers',desc:'The ten skills and the six powers',tone:'iris'},
 {id:'discover',title:'Discover',icon:'store',desc:'Agents that creators have listed',tone:'coral'},
 {id:'plaza',title:'Plaza',icon:'users',desc:'Every listed agent on one floor: pick one, start a chat',tone:'lime'},
 {id:'top',title:'This week',icon:'hype',desc:'Seven days of use: who leads and who climbed',tone:'coral'},
 {id:'arena',title:'Arena',icon:'target',desc:'Put one question to two agents and let readers choose',tone:'iris'},
 {id:'discover',title:'Templates',icon:'list',desc:'Begin with a brief that is already written',tone:'amber',doc:'templates'},
];
export const WORKSPACE:NavLink[]=[
 {id:'agents',title:'My agents',icon:'users',desc:'What you saved, what it costs, what is listed',tone:'sky'},
 {id:'creators',title:'Creator agents',icon:'pen',desc:'Your posts become its voice, and each message pays you',tone:'lime'},
 {id:'teams',title:'Teams',icon:'link',desc:'A relay of two or three agents, answer by answer',tone:'iris'},
 {id:'schedules',title:'Schedules',icon:'cal',desc:'Put a skill on a timer, several runs a day',tone:'iris'},
 {id:'recipes',title:'Recipes',icon:'play',desc:'Automations set up for you in a single click',tone:'coral'},
 {id:'referral',title:'Invite friends',icon:'users',desc:'Credits for you both, and a boost to your holder reward',tone:'lime'},
 {id:'quests',title:'Quests',icon:'target',desc:'Small things to try, each worth free credits',tone:'lime'},
 {id:'activity',title:'History',icon:'clock',desc:'All your runs, with output and cost',tone:'mint'},
 {id:'credits',title:'Credits',icon:'coins',desc:'Your balance, what you earned, the ledger',tone:'amber'},
 {id:'wallet',title:'Wallet & chain',icon:'wallet',desc:'BNB Smart Chain: top-ups, claims, holder tiers',tone:'sky'},
 {id:'rewards',title:'Holder rewards',icon:'hype',desc:'A reward per period for holding HARVEX (planned)',tone:'lime'},
];
export const RESOURCES:NavLink[]=[
 {id:'docs',title:'Getting started',icon:'book',desc:'Your first agent, step by step',tone:'lime',doc:'start'},
 {id:'docs',title:'Agent skills',icon:'layers',desc:'Each skill and what it returns',tone:'iris',doc:'skills'},
 {id:'docs',title:'Credits & prices',icon:'coins',desc:'Paying per run, explained',tone:'amber',doc:'credits'},
 {id:'docs',title:'FAQ',icon:'bulb',desc:'Common questions, briefly answered',tone:'sky',doc:'faq'},
 {id:'paper',title:'Whitepaper',icon:'doc',desc:'Token, holder rewards and the economics behind them',tone:'coral'},
 {id:'tiers',title:'Holder tiers',icon:'layers',desc:'What a HARVEX balance adds: schedules, runs, channels',tone:'amber'},
 {id:'whales',title:'Whale watch',icon:'scan',desc:'The largest HARVEX holders and transfers, read from the chain',tone:'lime'},
 {id:'roadmap',title:'Roadmap',icon:'map',desc:'Done, under way, planned',tone:'mint'},
];
const TONE_TEXT:Record<Tone,string>={lime:'text-tx-lime',iris:'text-tx-iris',coral:'text-tx-coral',sky:'text-tx-sky',amber:'text-tx-amber',mint:'text-tx-mint',pink:'text-tx-pink',ink:'text-foreground'};
export function ToneIcon({icon,tone,className}:{icon:string;tone:Tone;className?:string}){
 return <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-[18px]',TINT_BG[tone],TONE_TEXT[tone],className)}><I id={icon}/></span>;
}

/** The logo stands bare on the page (no chip, no border, no shadow) and is yellow. This looks at what lies under it
    and answers true when that is itself yellow (the hero's stage, a yellow frame): there the logo turns black.
    false = anything else, null = not looked yet or a phone (the top bar is solid there). `dep` = look again when
    it changes. */
function useYellowUnder(ref:RefObject<HTMLElement|null>,dep:unknown){
 const [light,setLight]=useState<boolean|null>(null);
 useEffect(()=>{
  const read=()=>{
   const el=ref.current;if(!el||innerWidth<=820){setLight(null);return;}
   const r=el.getBoundingClientRect();
   const hit=document.elementsFromPoint(r.left+r.width/2,r.top+r.height/2).find(n=>!n.closest('header'));
   for(let n:Element|null=hit||document.body;n;n=n.parentElement){
    const c=getComputedStyle(n).backgroundColor,m=(c.match(/[\d.]+/g)||[]).map(Number);
    if(m.length<3||(m.length>3&&m[3]<.5))continue;
    // rgb(): 0..255; color(srgb ...): 0..1; oklch(): lightness, chroma, hue. Yellow = much red and green, little blue.
    const k=c.startsWith('rgb')?255:1;
    // (the pale yellow of the cards on the stage counts too: blue clearly under red and green)
    setLight(c.startsWith('oklch')?m[0]>.8&&m[1]>.06&&m[2]>85&&m[2]<115:!c.startsWith('okl')&&m[0]/k>.6&&m[1]/k>.6&&Math.min(m[0],m[1])/k-m[2]/k>.08);return;
   }
   setLight(null);
  };
  read();const later=setTimeout(read,450);
  addEventListener('scroll',read,{passive:true});addEventListener('resize',read);
  // the theme changes in one step (app/theme.ts); look at once and once more when the fade is over
  const mo=new MutationObserver(()=>{read();setTimeout(read,300);});mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  return()=>{clearTimeout(later);removeEventListener('scroll',read);removeEventListener('resize',read);mo.disconnect();};
 },[ref,dep]);
 return light;
}

/** The sun / moon button. It reads the theme itself, so pressing it renders this button and not the page. */
export function ThemeButton({className}:{className?:string}){
 const [theme,setTheme]=useTheme();
 return <Button variant="ghost" size="icon" className={className} onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label={theme==='dark'?'Switch to light theme':'Switch to dark theme'}><I id={theme==='dark'?'sun':'moon'}/></Button>;
}

/* The Harvex lockup: the split H mark and the lowercase wordmark (Outfit Bold drawn as outlines, so no font loads).
   One colour: the brand yellow, everywhere (user, 7 Oct 2026: "make the logo yellow, in the navbar and everywhere");
   only on a yellow surface it turns black, because yellow on yellow is no logo. The mark alone is public/harvex-icon.svg; the pictures that
   carry the logo are drawn by scripts/build-brand-images.mjs, which has its own copy of the mark. */
export const LOGO_MARK='M17 20L45 20L41.18 38L62.18 38L49.08 62L36.08 62L28 100L0 100ZM81.26 0L109.26 0L92.25 80L64.25 80L68.08 62L55.08 62L68.18 38L73.18 38Z';
const LOGO_WORD='M72.7 100L51.7 100L51.7 61.8Q51.7 56.6 48.4 53.4Q45.2 50.1 40.2 50.1L40.2 50.1Q36.8 50.1 34.2 51.6Q31.5 53.0 30.0 55.7Q28.5 58.4 28.5 61.8L28.5 61.8L28.5 100L7.4 100L7.4 0L28.5 0L28.5 38.0Q30.4 36.2 32.9 34.8L32.9 34.8Q38.8 31.7 46.6 31.7L46.6 31.7Q54.4 31.7 60.3 34.9Q66.3 38.2 69.5 43.9Q72.7 49.6 72.7 57.2L72.7 57.2L72.7 100ZM112.1 101.4L112.1 101.4Q102.9 101.4 95.7 96.8Q88.4 92.3 84.2 84.4Q80.0 76.6 80.0 66.5Q80.0 56.5 84.2 48.6Q88.4 40.8 95.7 36.2Q102.9 31.7 112.1 31.7L112.1 31.7Q118.9 31.7 124.4 34.3L124.4 34.3Q127.8 36.0 130.6 38.6L130.6 38.6L130.6 33.1L151.2 33.1L151.2 100L130.6 100L130.6 94.6Q128.0 97.1 124.4 98.8L124.4 98.8Q118.9 101.4 112.1 101.4ZM116.4 82.4L116.4 82.4Q123.1 82.4 127.3 77.9Q131.4 73.4 131.4 66.5L131.4 66.5Q131.4 61.8 129.5 58.3Q127.7 54.7 124.3 52.7Q120.9 50.7 116.5 50.7Q112.1 50.7 108.7 52.7Q105.4 54.7 103.4 58.3Q101.4 61.8 101.4 66.5L101.4 66.5Q101.4 71.1 103.3 74.7Q105.2 78.2 108.7 80.3Q112.1 82.4 116.4 82.4ZM185.1 100L164.0 100L164.0 33.1L185.1 33.1L185.1 38.2Q191.3 31.7 202.3 31.7L202.3 31.7Q207.2 31.7 210.8 33.1Q214.5 34.6 217.2 37.6L217.2 37.6L204.7 53.4Q203.3 51.9 201.2 51.1Q199.2 50.3 196.6 50.3L196.6 50.3Q191.3 50.3 188.2 53.5Q185.1 56.7 185.1 63.2L185.1 63.2L185.1 100ZM258.3 100L241.3 100L212.9 33.1L235.7 33.1L250.0 74.5L264.3 33.1L286.6 33.1L258.3 100ZM323.4 101.5L323.4 101.5Q312.5 101.5 304.1 97.0Q295.6 92.6 290.8 84.6Q286.0 76.6 286.0 66.5Q286.0 56.5 290.7 48.6Q295.5 40.6 303.6 36.1Q311.7 31.5 321.9 31.5L321.9 31.5Q331.8 31.5 339.4 35.8Q347.0 40.1 351.3 47.7Q355.6 55.2 355.6 65.0L355.6 65.0Q355.6 66.8 355.4 68.8Q355.2 70.8 354.7 73.4L354.7 73.4L306.7 73.6Q307.2 75.1 308.0 76.4L308.0 76.4Q310.1 80.7 314.0 83.0Q317.9 85.3 323.3 85.3L323.3 85.3Q328.2 85.3 332.2 83.5Q336.2 81.8 339.3 78.4L339.3 78.4L350.8 89.9Q345.9 95.7 338.8 98.6Q331.8 101.5 323.4 101.5ZM306.7 59.1L306.7 59.1L336.0 59.0Q335.5 57.0 334.8 55.4L334.8 55.4Q333.2 51.7 330.0 49.7Q326.7 47.7 322.0 47.7L322.0 47.7Q317.1 47.7 313.4 49.9Q309.8 52.2 307.9 56.3L307.9 56.3Q307.2 57.6 306.7 59.1ZM427.8 100L403.4 100L391.0 80.0L378.2 100L355.2 100L379.2 65.8L356.5 33.1L381.1 33.1L392.3 51.2L403.6 33.1L426.4 33.1L404.1 65.4L427.8 100Z';
export function Logo({onClick,className}:{onClick?:()=>void;className?:string}){
 return <button onClick={onClick} aria-label="Harvex home" className={cn('flex items-center text-lime',className)}>
  <svg viewBox="0 -1 560 103" className="h-6 w-auto max-[820px]:h-[22px]" fill="currentColor" aria-hidden="true"><path d={LOGO_MARK}/><path d={LOGO_WORD} transform="translate(131.8 0)"/></svg>
 </button>;
}

type Props={appMode?:boolean;view:View;navigate:(v:View,doc?:string)=>void;onSearch:()=>void;auth:boolean;balance:number|null;email:string;onAccount:()=>void;onSignIn:()=>void};

function MegaLink({l,onGo,active}:{l:NavLink;onGo:()=>void;active:boolean}){
 const shut=useGate().view(l.id);
 return <NavigationMenuLink asChild data-active={active}>
  <button onClick={onGo} className="group/ml flex w-full flex-row items-start gap-3 rounded-xl p-2.5 text-left transition-colors duration-300 hover:bg-secondary data-[active=true]:bg-secondary">
   <ToneIcon icon={l.icon} tone={l.tone} className="transition-transform duration-300 group-hover/ml:-translate-y-0.5"/>
   <span className="grid min-w-0 gap-0.5"><span className="flex items-center gap-2 text-[14px] font-semibold text-foreground">{l.title}{shut&&<Soon/>}</span><span className="line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">{l.desc}</span></span>
  </button>
 </NavigationMenuLink>;
}
function Featured({tone,kicker,title,text,cta,onClick,children}:{tone:Tone;kicker:string;title:string;text:string;cta:string;onClick:()=>void;children?:ReactNode}){
 // the featured card of a panel is a folder: the kicker on its tab, pictures on its back, the text in its pocket
 return <NavigationMenuLink asChild>
  <button onClick={onClick} className="group/folder group/ft flex h-full animate-[pop-in_.5s_var(--ease-smooth)_.15s_both] text-left">
   <Folder tab={kicker} tone={tone} back={children} className="h-full w-full" pocket="justify-between gap-3">
    <span className="grid gap-1.5"><span className="font-display text-[17px] leading-tight font-medium tracking-[-.02em] text-foreground">{title}</span><span className="line-clamp-3 text-[12.5px] leading-snug text-muted-foreground">{text}</span></span>
    <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold tracking-[.1em] text-foreground uppercase [&_svg]:size-3.5 [&_svg]:transition-transform group-hover/ft:[&_svg]:translate-x-1">{cta}<I id="arrow"/></span>
   </Folder>
  </button>
 </NavigationMenuLink>;
}
// a panel is wide and short (user, 6 Oct 2026: "let it widen to the left, not run so far down"): it hangs from the
// right end of the bar and reaches left, the links stand in three columns and the folder closes the row
const panel='tone-page absolute right-0 left-auto top-full mt-3 w-[min(1120px,calc(100vw-24px))] rounded-3xl border bg-popover p-3 shadow-[0_30px_60px_-30px_rgb(0_0_0/.35)] md:w-[min(1120px,calc(100vw-24px))]';
const cols='grid grid-cols-[minmax(0,1fr)_256px] gap-3',links='stagger grid grid-cols-3 gap-x-1 gap-y-0.5 max-[1180px]:grid-cols-2';

export function Navbar(p:Props){
 const [sheet,setSheet]=useState(false);const stage=useTokenStage();const gate=useGate();
 const logoRef=useRef<HTMLDivElement>(null);const under=useYellowUnder(logoRef,p.view);
 // a closed trigger is quiet text on the pill; the open one is a yellow pill, so the bar itself shows which panel is open
 const trig='h-10 rounded-full bg-transparent px-3.5 text-[14px] font-medium text-foreground/75 transition-colors duration-300 hover:bg-secondary hover:text-foreground focus:bg-transparent focus:text-foreground data-[state=open]:bg-lime data-[state=open]:text-ink data-[state=open]:hover:bg-lime data-[state=open]:focus:bg-lime';
 const go=(l:NavLink)=>p.navigate(l.id,l.doc);
 // the buttons at the end of the bar, drawn twice: in the menu pill (desktop) and bare on the phone's top bar
 const tools=<div className="flex items-center gap-1">
     <Button variant="ghost" onClick={p.onSearch} className="h-10 gap-2 rounded-full px-3 text-muted-foreground max-[1180px]:w-10 max-[1180px]:px-0" aria-label="Search (Ctrl K)"><I id="search"/><span className="text-[13px] max-[1180px]:hidden">Search</span><Kbd className="max-[1180px]:hidden">Ctrl K</Kbd></Button>
     <ThemeButton className="size-10"/>
     {SOCIAL.x&&<a href={SOCIAL.x} target="_blank" rel="noreferrer noopener" aria-label="Harvex on X" title="Harvex on X" className="grid size-10 place-items-center rounded-full text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground [&_svg]:size-[15px]"><FaXTwitter/></a>}
     {p.auth?<Button variant="ghost" onClick={p.onAccount} className="h-10 gap-2 rounded-full px-3.5 font-mono text-[12px]" title={p.email||'Account'}><span className="size-2 rounded-lg bg-lime"/>{p.balance??'—'} CR</Button>
      :gate.has('signin')?null:<Button variant="ghost" onClick={p.onSignIn} className="h-10 gap-2 rounded-full px-3.5 text-[14px] max-[820px]:hidden"><I id="wallet"/>Connect</Button>}
     {p.view!=='studio'&&<CutButton variant="lime" onClick={()=>p.navigate('studio')} className="magnetic h-10 px-5 text-[11px] max-[820px]:hidden">{gate.view('studio')?'Studio · soon':'Open studio'}</CutButton>}
     {!p.auth&&!gate.has('signin')&&<Button size="sm" shape="pill" onClick={p.onSignIn} className="min-[821px]:hidden">Connect</Button>}
     <Button variant="outline" size="icon" className="size-10 rounded-full min-[1024px]:hidden max-[820px]:hidden" onClick={()=>setSheet(true)} aria-label="Open menu"><I id="grid"/></Button>
    </div>;
 return <>
  {/* desktop: no band across the page. The logo stands bare (user, 6 Oct 2026: no border, no shadow) and is
      yellow, black only over a yellow surface; the menu is a round pill in the OTHER theme (black on the white
      page, white on the dark one: the page's contrast element), and the gap between the two lets clicks
      through to the page. Phones keep a solid top bar with the tools bare on it. */}
  <header className={cn('pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3 py-3 max-[820px]:pointer-events-auto max-[820px]:bg-background max-[820px]:px-0 max-[820px]:py-0',p.appMode&&'min-[821px]:hidden')}>
   <div className="flex w-[calc(100%*6/7)] items-center justify-between gap-x-3 max-[1100px]:w-full max-[820px]:flex max-[820px]:h-[var(--top)] max-[820px]:items-center max-[820px]:justify-between max-[820px]:border-b max-[820px]:px-4">
    <div ref={logoRef} style={under?{color:'#0a0a0a'}:undefined} className="pointer-events-auto flex h-14 w-fit shrink-0 items-center text-lime transition-colors duration-300 max-[820px]:h-auto"><Logo className="text-inherit" onClick={()=>p.navigate('home')}/></div>
    <div className="tone-flip pointer-events-auto relative flex h-14 w-fit min-w-0 items-center gap-1 rounded-full py-2 pr-2 pl-2.5 ring-1 ring-border shadow-[0_18px_40px_-20px_rgb(0_0_0/.55)] max-[820px]:hidden">
    <NavigationMenu viewport={false} className="static max-w-none flex-none max-[1023px]:hidden [&>div]:!static">
     <NavigationMenuList className="gap-0.5">
      <NavigationMenuItem className="static"><NavigationMenuTrigger className={trig}>Product</NavigationMenuTrigger>
       <NavigationMenuContent className={panel}><div className={cols}>
        <div className="grid content-start gap-1"><span className="px-3 pt-2 pb-1 font-mono text-[10px] font-semibold tracking-[.1em] text-muted-foreground uppercase">Build</span><div className={links}>{PRODUCT.map(l=><MegaLink key={l.title} l={l} active={p.view===l.id&&!l.doc} onGo={()=>go(l)}/>)}</div></div>
        <Featured tone="lime" kicker="The cast" title="Twenty-five people, none of them fixed" text="Choose one, change the face and the clothes, then write its brief." cta="Enter the studio" onClick={()=>p.navigate('studio')}>
         <span className="flex -space-x-2.5">{(['atlas','lumi','scout','kira','felix'] as const).map(id=><Face key={id} id={id} className="size-11 border-2 border-[var(--t-lime)] bg-background"/>)}</span>
        </Featured>
       </div></NavigationMenuContent></NavigationMenuItem>
      <NavigationMenuItem className="static"><NavigationMenuTrigger className={trig}>Workspace</NavigationMenuTrigger>
       <NavigationMenuContent className={panel}><div className={cols}>
        <div className="grid content-start gap-1"><span className="px-3 pt-2 pb-1 font-mono text-[10px] font-semibold tracking-[.1em] text-muted-foreground uppercase">Your workspace</span><div className={links}>{WORKSPACE.map(l=><MegaLink key={l.title} l={l} active={p.view===l.id} onGo={()=>go(l)}/>)}</div></div>
        {p.auth?<Featured tone="amber" kicker="Balance" title={`${p.balance??'—'} preview credits`} text="Runs are paid with credits. Credits are not money." cta="Open credits" onClick={()=>p.navigate('credits')}/>
         :gate.has('signin')?<Featured tone="iris" kicker="Account" title="Accounts open with the studio" text="Sign-in is closed for now. Nobody is asked to connect a wallet yet." cta="See the roadmap" onClick={()=>p.navigate('roadmap')}/>
         :<Featured tone="iris" kicker="Account" title="Sign in with a wallet" text="Any EVM wallet works, MetaMask and Trust Wallet included. Signed in, you can save, list and run agents." cta="Connect wallet" onClick={p.onSignIn}/>}
       </div></NavigationMenuContent></NavigationMenuItem>
      <NavigationMenuItem className="static"><NavigationMenuTrigger className={trig}>Resources</NavigationMenuTrigger>
       <NavigationMenuContent className={panel}><div className={cols}>
        <div className="grid content-start gap-1"><span className="px-3 pt-2 pb-1 font-mono text-[10px] font-semibold tracking-[.1em] text-muted-foreground uppercase">Learn</span><div className={links}>{RESOURCES.map(l=><MegaLink key={l.title} l={l} active={p.view===l.id&&!l.doc} onGo={()=>go(l)}/>)}</div></div>
        <Featured tone="sky" kicker="No guessing" title="Running now, or still a plan" text={`Skills, credits and listings work today. Top-ups and claims on the chain exist only on servers where the operator turned them on. ${TOKEN_LINE[stage]}`} cta="Start with the overview" onClick={()=>p.navigate('docs','overview')}/>
       </div></NavigationMenuContent></NavigationMenuItem>
      {/* the classes go on the link, not on the button: there they are merged with the link's own (a column with its
          text at the top, small corners), so "Discover" stands on the same line and in the same shape as the triggers */}
      <NavigationMenuItem><NavigationMenuLink asChild data-active={p.view==='discover'} className={cn(trig,'inline-flex flex-row items-center justify-center gap-0 py-0 data-[active=true]:bg-secondary data-[active=true]:text-foreground data-[active=true]:hover:bg-secondary data-[active=true]:focus:bg-secondary')}><button onClick={()=>p.navigate('discover')}>Discover</button></NavigationMenuLink></NavigationMenuItem>
     </NavigationMenuList>
    </NavigationMenu>
    {tools}
    </div>
    <div className="min-[821px]:hidden">{tools}</div>
   </div>
  </header>
  <div aria-hidden="true" className={cn('h-[var(--top)]',p.appMode&&'min-[821px]:hidden')}/>
  <Sheet open={sheet} onOpenChange={setSheet}>
   <SheetContent side="right" className="w-[340px] gap-0 p-0">
    <SheetHeader className="border-b"><SheetTitle>Menu</SheetTitle><SheetDescription>Everything in Harvex.</SheetDescription></SheetHeader>
    <Accordion type="multiple" defaultValue={['Product']} className="px-4">
     {([['Product',PRODUCT],['Workspace',WORKSPACE],['Resources',RESOURCES]] as const).map(([g,items])=><AccordionItem key={g} value={g}>
      <AccordionTrigger className="text-[15px]">{g}</AccordionTrigger>
      <AccordionContent className="stagger grid gap-1">{items.map(l=><button key={l.title} onClick={()=>{setSheet(false);go(l);}} className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary"><ToneIcon icon={l.icon} tone={l.tone} className="size-8"/><span className="grid"><b className="flex items-center gap-2 text-sm font-semibold">{l.title}{gate.view(l.id)&&<Soon/>}</b><span className="text-xs text-muted-foreground">{l.desc}</span></span></button>)}</AccordionContent>
     </AccordionItem>)}
    </Accordion>
   </SheetContent>
  </Sheet>
 </>;
}

/* Phones: the bottom bar is two pieces (user, 6 Oct 2026: "the bottom navbar on mobile is still too much the same").
   A dock in the OTHER theme (like the site's menu pill and the dashboard's dock) holds the places as icons; the one
   you are in opens into a yellow lozenge with its name, so yellow always means "you are here". The Studio stands
   apart on the right as its own button. Not five equal tabs with a label under each icon. */
const TABS:{id:View;title:string;icon:string}[]=[{id:'home',title:'Home',icon:'home'},{id:'discover',title:'Discover',icon:'store'},{id:'agents',title:'Agents',icon:'users'}];
export function BottomNav(p:Props){
 const [more,setMore]=useState(false);const [moreOpened,setMoreOpened]=useState(false);
 useEffect(()=>{if(more)setMoreOpened(true);},[more]);
 const moreItems:NavLink[]=[PRODUCT[1],WORKSPACE[1],WORKSPACE[2],{id:'docs',title:'Docs',icon:'book',desc:'',tone:'lime'},RESOURCES[4],RESOURCES[5]];
 const moreActive=moreItems.some(l=>l.id===p.view);
 const go=(v:View,doc?:string)=>{setMore(false);p.navigate(v,doc);};
 const inStudio=p.view==='studio'&&!more;
 return <>
  <nav aria-label="Sections" className="pointer-events-none fixed inset-x-3 bottom-[calc(10px+env(safe-area-inset-bottom))] z-40 hidden items-center gap-2 max-[820px]:flex">
   <div className="tone-flip pointer-events-auto flex h-14 min-w-0 flex-1 items-center gap-1 rounded-full p-1.5 ring-1 ring-border shadow-[0_18px_40px_-18px_rgb(0_0_0/.55)]">
    {TABS.map(t=><DockTab key={t.id} active={!more&&p.view===t.id} icon={t.icon} label={t.title} onClick={()=>go(t.id)}/>)}
    <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border"/>
    <DockTab active={more||moreActive} menu icon="grid" label="More" onClick={()=>setMore(true)}/>
   </div>
   <button onClick={()=>go('studio')} aria-label="Studio" aria-current={inStudio?'page':undefined} className={cn('pointer-events-auto grid size-14 shrink-0 place-items-center rounded-full shadow-[0_18px_40px_-18px_rgb(0_0_0/.55)] ring-1 ring-border transition-[background-color,color,transform] duration-300 active:scale-95 [&_svg]:size-6',inStudio?'bg-lime text-ink ring-transparent':'tone-flip [&_svg]:text-brand')}><I id="cube"/></button>
  </nav>
  {moreOpened&&<Suspense fallback={null}><MoreDrawer open={more} onOpenChange={setMore} items={moreItems} view={p.view} onSearch={p.onSearch} go={go}/></Suspense>}
 </>;
}
function DockTab({active,icon,label,onClick,menu}:{active:boolean;icon:string;label:string;onClick:()=>void;menu?:boolean}){
 return <button onClick={onClick} aria-label={label} aria-current={active&&!menu?'page':undefined} aria-haspopup={menu?'dialog':undefined} className={cn('flex h-11 min-w-0 items-center justify-center gap-2 rounded-full text-[13px] font-semibold text-muted-foreground transition-colors duration-300 active:bg-secondary [&_svg]:size-5 [&_svg]:shrink-0',active?'shrink-0 bg-lime px-4 text-ink active:bg-lime max-[349px]:px-3':'flex-1')}>
  <I id={icon}/>{active&&<span className="animate-[pop-in_.3s_var(--ease-smooth)_both] whitespace-nowrap max-[349px]:hidden">{label}</span>}
 </button>;
}
