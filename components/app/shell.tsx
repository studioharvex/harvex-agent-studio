'use client';
/* Dashboard shell for the app views. There is no sidebar:
   - a top bar shaped like a folder turned upside down (user, 6 Oct 2026: "the navbar like a folder too, but
     inverted"): the bar hangs from the top of the window in the page colour (logo, the search / command field,
     credits, account), and a tab hangs from its left end and says where you are (the breadcrumb). It stays in
     place while the page scrolls, so the breadcrumb is always in sight;
   - the page on a round sheet under it. No outline: bar and sheet are the page colour on the grey surface. Next
     to the sheet the agent panel, which reaches down to the foot of the window from 1300px (the dock is in the
     middle and does not come that far; below 1300px the panel stops above the dock): the agent on the Studio's stage (picture, name, skills),
     the credit balance and a few shortcuts. The Studio and the reading views (docs, whitepaper, roadmap) take the
     full width instead;
   - a dock floating at the bottom with every section (the active one opens its label; the rest name themselves on
     hover) and a "More" menu.
   Contrast (user, 6 Oct 2026: "light mode should have dark elements too, and the other way round, the theme still
   dominant"): three things are drawn in the OTHER theme with `.tone-flip`: the dock, the credits folder and each
   page's header band (PageHeader in parts.tsx); the agent's folder is solid brand yellow in both themes.
   Phones (≤820px) show none of this: the compact top bar and the bottom tab bar of components/harvex/navbar.tsx take over. */
import type {ComponentProps,ReactNode} from 'react';
import Avatar from '@/app/avatar';
import {Button} from '@/components/ui/button';
import {Kbd} from '@/components/ui/kbd';
import {Progress} from '@/components/ui/progress';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@/components/ui/tooltip';
import {I} from '@/app/ui';
import {cn} from '@/lib/utils';
import {Folder} from '@/components/harvex/motion';
import {skillCatalog} from '@/lib/agents';
import {Logo,ThemeButton,type View} from '@/components/harvex/navbar';

export const APP_VIEWS:View[]=['overview','profile','studio','agents','teams','discover','skills','schedules','quests','activity','credits','wallet','rewards','docs','paper','roadmap'];
type Item={id:View;title:string;icon:string;badge?:number|string};
const TITLES:Record<string,[string,string]>={overview:['Dashboard','Overview'],profile:['Account','Profile'],studio:['Build','Studio'],agents:['Build','My agents'],teams:['Build','Teams'],skills:['Build','Skills'],schedules:['Build','Schedules'],quests:['Dashboard','Quests'],discover:['Marketplace','Discover'],activity:['Account','History'],credits:['Account','Credits'],wallet:['Account','Wallet & chain'],rewards:['Account','Holder rewards'],docs:['Learn','Docs'],paper:['Learn','Whitepaper'],roadmap:['Learn','Roadmap']};
/** Views that use the whole width: the Studio has its own stage and side panel, the reading views their own index. */
const WIDE:View[]=['studio','docs','paper','roadmap'];
const MORE:Item[]=[{id:'profile',title:'Profile',icon:'user'},{id:'quests',title:'Quests',icon:'target'},{id:'docs',title:'Docs',icon:'book'},{id:'paper',title:'Whitepaper',icon:'doc'},{id:'roadmap',title:'Roadmap',icon:'map'}];

/** The agent the panel shows: what is on the Studio's stage right now (saved or not). */
export type PanelAgent=Pick<ComponentProps<typeof Avatar>,'skin'|'appearance'|'look'>&{name:string;sub:string;skills:readonly string[];saved:boolean};

function DockButton({it,active,onClick}:{it:Item;active:boolean;onClick:()=>void}){
 return <Tooltip><TooltipTrigger asChild>
  <button onClick={onClick} aria-label={it.title} aria-current={active?'page':undefined}
   className={cn('relative flex h-11 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-[background-color,color,padding] duration-300 ease-smooth hover:bg-secondary hover:text-foreground [&_svg]:size-[18px]',active&&'bg-lime px-4 text-ink hover:bg-lime hover:text-ink')}>
   <I id={it.icon}/>{active&&<span className="whitespace-nowrap">{it.title}</span>}
   {it.badge!==undefined&&!active&&<span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 font-mono text-[9px] leading-none text-background">{it.badge}</span>}
  </button>
 </TooltipTrigger>{!active&&<TooltipContent side="top" sideOffset={10}>{it.title}</TooltipContent>}</Tooltip>;
}

export function AppShell({view,navigate,onSearch,auth,label,balance,counts,agent,onAccount,onSignIn,onNew,children}:{
 view:View;navigate:(v:View,doc?:string)=>void;onSearch:()=>void;
 auth:boolean;label:string;balance:number|null;counts:{agents:number;published:number;runs:number;schedules?:number};agent?:PanelAgent;
 onAccount:()=>void;onSignIn:()=>void;onNew:()=>void;/** kept for callers of the former sidebar shell; the dock has nothing to collapse */collapsed?:boolean;children:ReactNode}){
 const build:Item[]=[{id:'overview',title:'Overview',icon:'grid'},{id:'studio',title:'Studio',icon:'cube'},{id:'agents',title:'My agents',icon:'users',badge:counts.agents||undefined},{id:'teams',title:'Teams',icon:'link'},{id:'skills',title:'Skills',icon:'layers'},{id:'schedules',title:'Schedules',icon:'cal',badge:counts.schedules||undefined},{id:'discover',title:'Discover',icon:'store'}];
 const account:Item[]=[{id:'activity',title:'History',icon:'clock'},{id:'credits',title:'Credits',icon:'coins'},{id:'wallet',title:'Wallet & chain',icon:'wallet'},{id:'rewards',title:'Holder rewards',icon:'hype'}];
 const [crumb,title]=TITLES[view]||['',''];
 const wide=WIDE.includes(view);const moreActive=MORE.some(m=>m.id===view);
 const skillName=(id:string)=>skillCatalog.find(s=>s.id===id)?.name||id;
 return <TooltipProvider delayDuration={120}>
  <div className="min-h-svh bg-surface max-[820px]:bg-background [--dash-chrome:164px] min-[821px]:[--dash-chrome:204px]">
   {/* top bar: a folder upside down. The bar is the folder's body, the breadcrumb hangs from it as the tab (the
       Folder's tab and inner curve, mirrored). The soft shadow follows the whole outline (a drop-shadow, since
       bar, tab and curve are three boxes). */}
   <header className="sticky top-0 z-30 px-5 drop-shadow-[0_10px_18px_rgb(0_0_0/.1)] max-[820px]:hidden">
   <div className="relative flex h-[68px] items-center gap-4 rounded-b-3xl rounded-bl-none bg-background px-5">
    <nav aria-label="Breadcrumb" className="absolute top-full left-0 -mt-px flex h-[29px] max-w-[60%] items-center gap-1.5 rounded-b-lg bg-background px-5 text-[13px] whitespace-nowrap after:absolute after:top-px after:left-full after:size-3 after:bg-[radial-gradient(circle_at_100%_100%,transparent_11.5px,var(--bg)_12px)]"><span className="text-muted-foreground">{crumb}</span><span className="text-muted-foreground/50">/</span><b className="truncate font-medium">{title}</b></nav>
    <Logo onClick={()=>navigate('home')}/>
    <button onClick={onSearch} className="mx-auto flex h-11 w-[min(480px,38vw)] items-center gap-2.5 rounded-full border border-transparent bg-surface px-4 text-sm text-muted-foreground transition-colors duration-300 hover:border-foreground/20 hover:text-foreground [&_svg]:size-4">
     <I id="search"/><span className="flex-1 truncate text-left">Find a page, an agent or a skill and go there…</span><Kbd>Ctrl K</Kbd>
    </button>
    <div className="flex items-center gap-1.5">
     <ThemeButton/>
     <Button variant="ghost" size="icon" className="rounded-full" onClick={()=>navigate('home')} aria-label="Back to the site"><I id="home"/></Button>
     {auth
      ?<><button onClick={()=>navigate('credits')} className="flex h-10 items-center gap-2 rounded-full border border-transparent bg-surface px-3.5 font-mono text-[12px] transition-colors hover:border-foreground/20" title="Preview credits"><span className="size-2 rounded-full bg-lime"/>{balance??'—'} CR</button>
        <button onClick={onAccount} title={label||'Account'} aria-label="Account" className="grid size-10 place-items-center rounded-full bg-foreground font-mono text-[11px] font-bold text-background transition-transform duration-300 hover:scale-105">{(label||'?').replace(/^0x/,'').slice(0,2).toUpperCase()}</button></>
      :<><span className="text-[12.5px] text-muted-foreground max-[1240px]:hidden">No account connected yet</span>
        <Button onClick={onSignIn} className="gap-1.5 rounded-full"><I id="wallet"/>Connect wallet</Button></>}
    </div>
   </div>
   </header>

   <div className={cn('flex items-start gap-4 px-5 min-[821px]:pt-3 max-[820px]:block max-[820px]:px-0',wide?'min-[821px]:pb-[96px]':'min-[821px]:pb-[112px]')}>
    {/* the page: a round sheet; it starts under the tab that hangs from the top bar */}
    <div className="relative min-w-0 flex-1 min-[821px]:pt-7">
     <main className="overflow-hidden rounded-3xl bg-background min-[821px]:[--top:100px] max-[820px]:rounded-none" data-view="">{children}</main>
    </div>

    {/* the agent panel */}
    {!wide&&<aside aria-label="Your agent" className="sticky top-[80px] flex h-[calc(100svh-80px-112px)] w-[296px] shrink-0 flex-col gap-3 overflow-y-auto max-[1180px]:hidden min-[1300px]:h-[calc(100svh-80px-20px)]">
     {/* the agent on stage is a folder: its picture on the back, its name and skills in the pocket */}
     {agent&&<Folder tab="On your stage" fold="var(--lime)" className="min-h-[340px] flex-1 [&>span]:text-ink" backClass="flex min-h-[140px] flex-1 p-0" pocket="flex-none gap-3"
      aside={<span className="rounded-full bg-[var(--fold)] px-2 py-1 font-mono text-[9.5px] leading-none tracking-[.06em] uppercase">{agent.saved?'Saved':'Draft'}</span>}
      back={<button onClick={()=>navigate('studio')} aria-label="Open the Studio" className="group/stage relative min-h-[140px] flex-1 [&_.avatar-thumb]:!object-contain [&_.avatar-thumb]:transition-transform [&_.avatar-thumb]:duration-700 [&_.avatar-thumb]:ease-smooth hover:[&_.avatar-thumb]:scale-[1.04]"><Avatar small skin={agent.skin} appearance={agent.appearance} look={agent.look}/></button>}>
       <div className="grid gap-0.5"><b className="truncate font-display text-[19px] leading-tight font-medium tracking-[-.02em]">{agent.name||'Untitled agent'}</b><span className="truncate text-[12.5px] text-muted-foreground">{agent.sub}</span></div>
       {agent.skills.length>0&&<div className="flex flex-wrap gap-1">{agent.skills.slice(0,4).map(s=><span key={s} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">{skillName(s)}</span>)}</div>}
       <div className="grid grid-cols-[1fr_auto] gap-2"><Button onClick={()=>navigate('studio')} className="gap-1.5 rounded-full"><I id="cube"/>Open studio</Button><Button variant="outline" size="icon" className="rounded-full" onClick={onNew} aria-label="New agent"><I id="plus"/></Button></div>
     </Folder>}
     <Folder tab="Preview credits" tone="ink" className="tone-flip shrink-0 !bg-transparent" pocket="gap-2.5" aside={<span className="grid size-6 place-items-center rounded-full bg-[var(--fold)] [&_svg]:size-3.5"><I id="coins"/></span>}>
      <b className="font-display text-[30px] leading-none font-medium tracking-[-.03em] tabular-nums">{balance??'—'}<span className="ml-1 text-xs font-normal tracking-normal text-muted-foreground">CR</span></b>
      <Progress value={Math.min(100,(balance??0)/100*100)} className="h-1.5 bg-secondary [&>div]:bg-lime"/>
      <span className="text-[11px] leading-snug text-muted-foreground">Credits are not cash. Top-ups and claims sit on the Wallet page.</span>
     </Folder>
     <div className="grid rounded-2xl bg-background p-2">
      {([['quests','Quests','target','+CR'],['activity','History','clock',counts.runs||''],['profile','Profile','user','']] as const).map(([id,t,ic,b])=><button key={id} onClick={()=>navigate(id)} className={cn('flex h-10 items-center gap-2.5 rounded-xl px-3 text-left text-[13px] font-medium transition-colors duration-300 hover:bg-secondary [&_svg]:size-4',view===id&&'bg-secondary')}><I id={ic}/><span className="flex-1">{t}</span>{b!==''&&<span className="font-mono text-[10px] text-muted-foreground">{b}</span>}</button>)}
     </div>
    </aside>}
   </div>

   {/* the dock */}
   <nav aria-label="Sections" className="tone-flip fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full p-1.5 ring-1 ring-border shadow-[0_22px_50px_-22px_rgb(0_0_0/.55)] max-[820px]:hidden">
    {build.map(it=><DockButton key={it.id} it={it} active={view===it.id} onClick={()=>navigate(it.id)}/>)}
    <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border"/>
    {account.map(it=><DockButton key={it.id} it={it} active={view===it.id} onClick={()=>navigate(it.id)}/>)}
    <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border"/>
    <DropdownMenu>
     <DropdownMenuTrigger asChild><button aria-label="More" className={cn('flex h-11 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary hover:text-foreground [&_svg]:size-[18px]',moreActive&&'bg-lime px-4 text-ink hover:bg-lime hover:text-ink')}><I id="list"/>{moreActive&&<span className="whitespace-nowrap">{title}</span>}</button></DropdownMenuTrigger>
     <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-52 p-1.5">
      <DropdownMenuLabel className="font-mono text-[10px] tracking-[.1em] text-muted-foreground uppercase">More</DropdownMenuLabel>
      {MORE.map(m=><DropdownMenuItem key={m.id} onSelect={()=>navigate(m.id)} className={cn('gap-2.5',view===m.id&&'bg-secondary')}><I id={m.icon}/>{m.title}</DropdownMenuItem>)}
      <DropdownMenuSeparator/>
      <DropdownMenuItem onSelect={onNew} className="gap-2.5"><I id="plus"/>New agent</DropdownMenuItem>
     </DropdownMenuContent>
    </DropdownMenu>
   </nav>
  </div>
 </TooltipProvider>;
}
