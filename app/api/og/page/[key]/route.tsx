/* Link-preview picture of one page (1200x630 PNG), used by pageMetadata() (lib/page-cards.ts): the page's own headline
   and three points next to a character, a different one per page. The rewards card shows the live vault numbers
   instead (lib/rewards.ts rewardsOverview: public data only). The tiers card has its own layout: the character on the
   left, and one tile per tier with what it needs and gives here. The invite card shows two characters and what an
   invitation gives on this server right now (lib/referrals.ts). The agent teams card and the Discover card are drawn like the
   website: cards of the hero deck on the page background (Discover: one card and a short conversation). An unknown key gets the site's general picture. */
import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {formatUnits} from 'viem';
import {appOrigin} from '@/lib/server';
import {PAGE_CARDS,isPageCard,type PageCard} from '@/lib/page-cards';
import {rewardsOverview} from '@/lib/rewards';
import {tierRows} from '@/lib/schedules';
import {referralConfig,referralProgram} from '@/lib/referrals';
import {getCharacter} from '@/lib/characters';
import {duelCard} from '@/lib/og-duel';
import {board} from '@/lib/board';

const W=1200,H=630;
/* The line at the foot of a card: the site's address and the page. 'HARVEX.EXAMPLE' is the placeholder that
   scripts/rename-brand.mjs replaces once there is a domain; until then a card names the studio, not a made-up address. */
const SITE='HARVEX.EXAMPLE';
const foot=(page:string)=>SITE.endsWith('.EXAMPLE')?`HARVEX AGENT STUDIO · /${page}`:`${SITE}/${page}`;

/** Pictures that could not be loaded since the server started: a card rendered without one of them is not kept. */
let missing=0;
async function asset(url:string,type:string){
 try{
  const r=await fetch(url);if(!r.ok){missing++;return '';}
  const b=new Uint8Array(await r.arrayBuffer());let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));
  return `data:${type};base64,${btoa(s)}`;
 }catch{missing++;return '';}
}
const fixed=(raw:string,dec:number,digits:number)=>Number(formatUnits(BigInt(raw),dec)).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});

/** Live numbers for the rewards card; null when the program is not running here (the card then shows its plain text). */
async function rewardNumbers(){
 const db=(env as unknown as {DB?:D1Database}).DB;if(!db)return null;
 const o=await rewardsOverview(db,null).catch(()=>null);
 if(!o||!o.live||!o.token||!o.vault)return null;
 const dec=o.token.decimals,sym=o.token.symbol,refills=o.fundings.length;
 return {headline:`${fixed(o.vault.balance,dec,4)} ${sym} in the reward vault`,
  stats:[['Refills',refills?`${refills}, read from the chain`:'none yet'],['Rate',`$${o.usdPerUnitHour}/h per ${Number(o.harvexPerUnit).toLocaleString('en-US')} HARVEX`],
   [`${sym} price`,o.price?`$${Number(o.price.usd).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`:'waiting'],['Earning now',`${o.recorder?.earners??0} holders`]] as [string,string][]};
}

async function render(request:Request){
 const origin=appOrigin(request);
 const key=new URL(request.url).pathname.split('/').filter(Boolean).pop()||'';
 if(!isPageCard(key))return Response.redirect(`${origin}/og.png`,302);
 const c:PageCard=PAGE_CARDS[key];
 // ?still=1: the card as a file needs it (scripts/render-page-cards.mjs): no live numbers, nothing read from the database
 const still=new URL(request.url).searchParams.get('still')==='1';
 const live=key==='rewards'&&!still?await rewardNumbers():null;
 const [img,logo]=await Promise.all([asset(`${origin}/characters/card/${getCharacter(c.character).id}.jpg`,'image/jpeg'),asset(`${origin}/brands/harvex-logo-lime.png`,'image/png')]);
 const headline=live?.headline||c.headline;
 const tiers=key==='tiers'?tierRows():null;
 if(key==='invite'||key==='referral'){
  // the same picture for every invite link: it says what an invitation gives, never who sent it
  const ref=referralConfig();const credits=ref.enabled?ref.credits:0;
  const pair=await asset(`${origin}/characters/card/pair-invite.jpg`,'image/jpeg');
  // the program page says what the inviter gets (the holder reward boost, where it runs); an invite link says what the
  // invited person gets
  const prog=key==='referral'?referralProgram():null;const b=prog?.boost||null;
  const head=key==='referral'?(b?['Bring friends.',`Up to ${(1+b.percent*b.maxFriends/100).toFixed(1)}x on your`,`${b.token} holder reward.`]:credits>0?['Bring friends.','Each of you gets',`${credits} free credits.`]:['Bring friends','to shape a character','and hand it work.'])
   :credits>0?['A place is saved.','Each of you gets',`${credits} free credits.`]:['A place is saved.','Shape a character','and hand it work.'];
  const points=key==='referral'?(b?[`+${b.percent}% per friend who holds ${Number(b.unit)>=1e6?`${Number(b.unit)/1e6}M`:Number(b.unit).toLocaleString('en-US')} HARVEX`,`Up to ${b.maxFriends} friends`,...(credits>0?[`${credits} free credits each, too`]:[])]:c.lines)
   :credits>0?['Sign in with a new account','Run your first task',`${credits} free credits for you and your friend`]:c.lines;
  return new ImageResponse(
   <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:'#0a0a0a',color:'#f4f4f2',fontFamily:'sans-serif'}}>
    {pair?<img src={pair} width={640} height={H} style={{position:'absolute',right:-30,top:0}}/>:null}
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:640,height:H,padding:'52px 0 48px 60px'}}>
     <div style={{display:'flex',alignItems:'center',gap:14}}>
      {logo?<img src={logo} width={160} height={48}/>:<div style={{display:'flex',fontSize:26,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
      <div style={{display:'flex',fontSize:17,letterSpacing:4,color:'#8c8c8c',marginLeft:4}}>{c.kicker}</div>
     </div>
     <div style={{display:'flex',flexDirection:'column'}}>
      {head.map((l,i)=><div key={l} style={{display:'flex',fontSize:68,lineHeight:1.1,letterSpacing:-2.5,color:i===2?'#ffe600':'#f4f4f2'}}>{l}</div>)}
     </div>
     <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {points.map(l=><div key={l} style={{display:'flex',alignItems:'center',gap:14,fontSize:25,color:'#e5e5e5'}}><div style={{display:'flex',width:10,height:10,borderRadius:10,backgroundColor:'#ffe600'}}/>{l}</div>)}
     </div>
    </div>
   </div>,
   {width:W,height:H,headers:{'Cache-Control':'public, max-age=600'}},
  );
 }
 if(key==='top'){
  // In the website's style: the first three of the week on cards of the deck, with their place and how many people
  // used them. A week without any use shows three open places instead of invented names.
  const db=(env as unknown as {DB?:D1Database}).DB;const b=db&&!still?await board(db).catch(()=>null):null;
  const INK='#0a0a0a',BG='#0a0a0a',TEXT='#fafafa',MUTED='#a3a3a3',LINE='rgba(255,255,255,0.14)';
  const firsts=(b?.entries||[]).slice(0,3);
  const pics=await Promise.all(firsts.map(e=>asset(`${origin}/characters/deck/${getCharacter(e.agent.skin).id}.png`,'image/png')));
  const spots=[{bg:'#ffe600',fg:INK,left:590,top:74,turn:-4},{bg:'#2440ff',fg:'#ffffff',left:790,top:118,turn:2},{bg:'#ff5a1f',fg:INK,left:984,top:86,turn:5}];
  const cut=(s:string,n:number)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s;
  const deck=spots.map((p,i)=>{const e=firsts[i];return {...p,n:`#0${i+1}`,tag:e?`${e.people} ${e.people===1?'PERSON':'PEOPLE'}`:'OPEN',title:e?cut(e.agent.name,20):'Open place',img:e?pics[i]:''};});
  const chips=b&&b.totals.runs>0?[`${b.totals.runs.toLocaleString('en-US')} ${b.totals.runs===1?'RUN':'RUNS'}`,`${b.totals.people.toLocaleString('en-US')} ${b.totals.people===1?'PERSON':'PEOPLE'}`,`${b.totals.agents} ${b.totals.agents===1?'AGENT':'AGENTS'}`]:['SEVEN DAYS','PEOPLE COUNT FIRST'];
  return new ImageResponse(
   <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:BG,color:TEXT,fontFamily:'sans-serif'}}>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:560,height:H,padding:'54px 0 52px 64px'}}>
     <div style={{display:'flex',alignItems:'center',gap:18}}>
      {logo?<img src={logo} width={146} height={44}/>:<div style={{display:'flex',fontSize:24,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
      <div style={{display:'flex',alignItems:'center',gap:10,fontSize:16,letterSpacing:3.5,color:MUTED}}><div style={{display:'flex',width:9,height:9,borderRadius:9,backgroundColor:'#ffe600'}}/>{c.kicker}</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',fontSize:70,lineHeight:1.04,letterSpacing:-3}}>
      <div style={{display:'flex',color:MUTED}}>A week of use.</div>
      <div style={{display:'flex',color:TEXT}}>Who drew</div>
      <div style={{display:'flex',color:TEXT}}>the crowd.</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:10}}>
       {chips.map(l=><div key={l} style={{display:'flex',alignItems:'center',flexShrink:0,height:40,padding:'0 16px',borderRadius:999,border:`1px solid ${LINE}`,fontSize:14,letterSpacing:2,whiteSpace:'nowrap',color:TEXT}}>{l}</div>)}
      </div>
      <div style={{display:'flex',fontSize:15,letterSpacing:2.6,color:MUTED}}>{foot('TOP')}</div>
     </div>
    </div>
    {deck.map(d=><div key={d.n} style={{display:'flex',flexDirection:'column',justifyContent:'space-between',position:'absolute',left:d.left,top:d.top,width:196,height:300,padding:16,borderRadius:20,backgroundColor:d.bg,color:d.fg,transform:`rotate(${d.turn}deg)`,boxShadow:'0 24px 60px rgba(0,0,0,0.45)'}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12,letterSpacing:1.8}}>
      <div style={{display:'flex',fontSize:15}}>{d.n}</div>
      <div style={{display:'flex',padding:'3px 8px',borderRadius:8,border:`1px solid ${d.fg==='#ffffff'?'rgba(255,255,255,0.35)':'rgba(31,32,30,0.3)'}`}}>{d.tag}</div>
     </div>
     {d.img?<img src={d.img} width={150} height={200} style={{position:'absolute',left:23,top:44}}/>:<div style={{display:'flex',position:'absolute',left:58,top:96,width:80,height:80,borderRadius:80,border:`2px dashed ${d.fg==='#ffffff'?'rgba(255,255,255,0.5)':'rgba(31,32,30,0.4)'}`}}/>}
     <div style={{display:'flex',fontSize:21,lineHeight:1.1,letterSpacing:-0.6}}>{d.title}</div>
    </div>)}
   </div>,
   {width:W,height:H,headers:{'Cache-Control':'public, max-age=900'}},
  );
 }
 if(key==='arena'){
  // In the website's style: the lime corner and the iris corner of the hero deck, one question between them.
  const [ia,ib]=await Promise.all([asset(`${origin}/characters/deck/juno.png`,'image/png'),asset(`${origin}/characters/deck/rook.png`,'image/png')]);
  return new ImageResponse(duelCard({logo,kicker:c.kicker,muted:'Same question.',bright:'Two answers.',chips:['TWO AGENTS','ASKED ONCE','READERS CHOOSE'],foot:foot('ARENA'),
   a:{tag:getCharacter('juno').role,name:'Skipper Marlow',img:ia},b:{tag:getCharacter('rook').role,name:'Tobin, No Sugar',img:ib}}),{width:W,height:H,headers:{'Cache-Control':'public, max-age=3600'}});
 }
 if(key==='teams'){
  // In the website's own style: the page background, a two-tone headline, mono labels, and two
  // cards of the hero deck (a lime one and an iris one), the first agent handing over to the second.
  const [one,two]=await Promise.all([asset(`${origin}/characters/card/team-atlas.png`,'image/png'),asset(`${origin}/characters/card/team-nova.png`,'image/png')]);
  const INK='#0a0a0a',BG='#0a0a0a',TEXT='#fafafa',MUTED='#a3a3a3',LINE='rgba(255,255,255,0.14)';
  const deck=[{n:'#01',tag:'FIRST',title:'Does the first part',bg:'#ffe600',fg:INK,img:one,left:628,top:112,turn:-4},
   {n:'#02',tag:'SECOND',title:'Builds on that answer',bg:'#2440ff',fg:'#ffffff',img:two,left:886,top:150,turn:4}];
  return new ImageResponse(
   <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:BG,color:TEXT,fontFamily:'sans-serif'}}>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:600,height:H,padding:'54px 0 52px 64px'}}>
     <div style={{display:'flex',alignItems:'center',gap:18}}>
      {logo?<img src={logo} width={146} height={44}/>:<div style={{display:'flex',fontSize:24,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
      <div style={{display:'flex',alignItems:'center',gap:10,fontSize:16,letterSpacing:3.5,color:MUTED}}><div style={{display:'flex',width:9,height:9,borderRadius:9,backgroundColor:'#ffe600'}}/>{c.kicker}</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',fontSize:72,lineHeight:1.04,letterSpacing:-3}}>
      <div style={{display:'flex',color:MUTED}}>First one works.</div>
      <div style={{display:'flex',color:MUTED}}>Then the next</div>
      <div style={{display:'flex',color:TEXT}}>builds on it.</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:10}}>
       {['OWN OR LISTED','2 OR 3 STEPS','RUN BY RUN'].map(l=><div key={l} style={{display:'flex',alignItems:'center',flexShrink:0,height:40,padding:'0 16px',borderRadius:999,border:`1px solid ${LINE}`,fontSize:14,letterSpacing:2,whiteSpace:'nowrap',color:TEXT}}>{l}</div>)}
      </div>
      <div style={{display:'flex',fontSize:15,letterSpacing:2.6,color:MUTED}}>{foot('TEAMS')}</div>
     </div>
    </div>
    {deck.map(d=><div key={d.n} style={{display:'flex',flexDirection:'column',justifyContent:'space-between',position:'absolute',left:d.left,top:d.top,width:268,height:366,padding:20,borderRadius:22,backgroundColor:d.bg,color:d.fg,transform:`rotate(${d.turn}deg)`,boxShadow:'0 24px 60px rgba(0,0,0,0.45)'}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:14,letterSpacing:2.2}}>
      <div style={{display:'flex'}}>{d.n}</div>
      <div style={{display:'flex',padding:'4px 10px',borderRadius:9,border:`1px solid ${d.fg==='#ffffff'?'rgba(255,255,255,0.35)':'rgba(31,32,30,0.3)'}`}}>{d.tag}</div>
     </div>
     {d.img?<img src={d.img} width={195} height={260} style={{position:'absolute',left:36,top:44}}/>:null}
     <div style={{display:'flex',fontSize:25,lineHeight:1.1,letterSpacing:-0.8}}>{d.title}</div>
    </div>)}
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',position:'absolute',left:858,top:286,width:76,height:76,borderRadius:76,backgroundColor:INK,border:`5px solid ${BG}`}}>
     <svg width="36" height="36" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" stroke="#ffe600" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
   </div>,
   {width:W,height:H,headers:{'Cache-Control':'public, max-age=3600'}},
  );
 }
 if(key==='verified'){
  // In the website's style: the post that carries the code, and the deck card it leads to, with the handle on it.
  const who=await asset(`${origin}/characters/card/deck-juno.png`,'image/png');
  const INK='#0a0a0a',BG='#0a0a0a',TEXT='#fafafa',MUTED='#a3a3a3',LINE='rgba(255,255,255,0.14)';
  return new ImageResponse(
   <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:BG,color:TEXT,fontFamily:'sans-serif'}}>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:600,height:H,padding:'54px 0 52px 64px'}}>
     <div style={{display:'flex',alignItems:'center',gap:18}}>
      {logo?<img src={logo} width={146} height={44}/>:<div style={{display:'flex',fontSize:24,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
      <div style={{display:'flex',alignItems:'center',gap:10,fontSize:16,letterSpacing:3.5,color:MUTED}}><div style={{display:'flex',width:9,height:9,borderRadius:9,backgroundColor:'#ffe600'}}/>{c.kicker}</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',fontSize:66,lineHeight:1.05,letterSpacing:-2.8}}>
      <div style={{display:'flex',color:MUTED}}>The handle</div>
      <div style={{display:'flex',color:MUTED}}>on the agent</div>
      <div style={{display:'flex',color:TEXT}}>is checked.</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:10}}>
       {['POSTED ON X','A PERSON CONFIRMS','ONE HANDLE'].map(l=><div key={l} style={{display:'flex',alignItems:'center',flexShrink:0,height:40,padding:'0 16px',borderRadius:999,border:`1px solid ${LINE}`,fontSize:14,letterSpacing:2,whiteSpace:'nowrap',color:TEXT}}>{l}</div>)}
      </div>
      <div style={{display:'flex',fontSize:15,letterSpacing:2.6,color:MUTED}}>{foot('VERIFIED')}</div>
     </div>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:8,position:'absolute',left:604,top:214,width:258,padding:'16px 18px',borderRadius:18,backgroundColor:TEXT,color:INK,transform:'rotate(-3deg)',boxShadow:'0 18px 40px rgba(0,0,0,0.4)'}}>
     <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,letterSpacing:1.6,color:'#595959'}}><div style={{display:'flex',width:16,height:16,borderRadius:16,backgroundColor:INK}}/>@YOU ON X</div>
     <div style={{display:'flex',fontSize:19,lineHeight:1.28}}>Verifying my creator agent on Harvex:</div>
     <div style={{display:'flex',alignSelf:'flex-start',padding:'5px 10px',borderRadius:8,backgroundColor:INK,color:'#ffe600',fontSize:17,letterSpacing:1.5}}>harvex-7KQ2M9XA</div>
    </div>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',position:'absolute',left:892,top:128,width:268,height:366,padding:20,borderRadius:22,backgroundColor:'#ffe600',color:INK,transform:'rotate(4deg)',boxShadow:'0 24px 60px rgba(0,0,0,0.45)'}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:14,letterSpacing:2.2}}>
      <div style={{display:'flex'}}>#01</div>
      <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:9,backgroundColor:INK,color:'#ffe600'}}>
       <svg width="15" height="15" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#ffe600" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>@YOU</div>
     </div>
     {who?<img src={who} width={195} height={260} style={{position:'absolute',left:36,top:44}}/>:null}
     <div style={{display:'flex',fontSize:25,lineHeight:1.1,letterSpacing:-0.8}}>Verified creator</div>
    </div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',position:'absolute',left:836,top:286,width:76,height:76,borderRadius:76,backgroundColor:INK,border:`5px solid ${BG}`}}>
     <svg width="36" height="36" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" stroke="#ffe600" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
   </div>,
   {width:W,height:H,headers:{'Cache-Control':'public, max-age=3600'}},
  );
 }
 if(key==='plaza'){
  // In the website's style, like the page: agents on cards of the deck, one of them picked.
  const [a1,a2,a3,a4,a5]=await Promise.all(['team-atlas','team-nova','deck-juno','deck-echo','deck-lumi'].map(n=>asset(`${origin}/characters/card/${n}.png`,'image/png')));
  const INK='#0a0a0a',BG='#0a0a0a',TEXT='#fafafa',MUTED='#a3a3a3',LINE='rgba(255,255,255,0.14)';
  const deck=[{n:'#01',tag:'PRESENTER',title:'Skipper Marlow',bg:'#ffe600',fg:INK,img:a3,left:606,top:60,turn:-3,picked:false},{n:'#02',tag:'ORGANIZER',title:'Fact Finder',bg:'#2440ff',fg:'#ffffff',img:a1,left:800,top:92,turn:2,picked:true},{n:'#03',tag:'SKETCHER',title:'Draft Desk',bg:'#ff5a1f',fg:INK,img:a2,left:992,top:60,turn:-2,picked:false},
   {n:'#04',tag:'YOURS',title:'Your agent',bg:'#38bdff',fg:INK,img:a4,left:702,top:338,turn:3,picked:false},{n:'#05',tag:'THINKER',title:'Unsure Seer',bg:'#ffab1a',fg:INK,img:a5,left:898,top:350,turn:-3,picked:false}];
  return new ImageResponse(
   <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:BG,color:TEXT,fontFamily:'sans-serif'}}>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:600,height:H,padding:'54px 0 52px 64px'}}>
     <div style={{display:'flex',alignItems:'center',gap:18}}>
      {logo?<img src={logo} width={146} height={44}/>:<div style={{display:'flex',fontSize:24,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
      <div style={{display:'flex',alignItems:'center',gap:10,fontSize:16,letterSpacing:3.5,color:MUTED}}><div style={{display:'flex',width:9,height:9,borderRadius:9,backgroundColor:'#ffe600'}}/>{c.kicker}</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',fontSize:72,lineHeight:1.04,letterSpacing:-3}}>
      <div style={{display:'flex',color:MUTED}}>One floor.</div>
      <div style={{display:'flex',color:TEXT}}>Every listed</div>
      <div style={{display:'flex',color:TEXT}}>agent on it.</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:10}}>
       {['ALL LISTED','TAP TO CHAT','OWN VOICE'].map(l=><div key={l} style={{display:'flex',alignItems:'center',flexShrink:0,height:40,padding:'0 16px',borderRadius:999,border:`1px solid ${LINE}`,fontSize:14,letterSpacing:2,whiteSpace:'nowrap',color:TEXT}}>{l}</div>)}
      </div>
      <div style={{display:'flex',fontSize:15,letterSpacing:2.6,color:MUTED}}>{foot('PLAZA')}</div>
     </div>
    </div>
    {deck.map(d=><div key={d.n} style={{display:'flex',flexDirection:'column',justifyContent:'space-between',position:'absolute',left:d.left,top:d.top,width:184,height:250,padding:14,borderRadius:18,backgroundColor:d.bg,color:d.fg,transform:`rotate(${d.turn}deg)`,boxShadow:d.picked?`0 0 0 4px ${BG}, 0 0 0 7px ${TEXT}, 0 24px 60px rgba(0,0,0,0.45)`:'0 24px 60px rgba(0,0,0,0.45)'}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11,letterSpacing:1.8}}>
      <div style={{display:'flex'}}>{d.n}</div>
      <div style={{display:'flex',padding:'3px 8px',borderRadius:7,border:`1px solid ${d.fg==='#ffffff'?'rgba(255,255,255,0.35)':'rgba(31,32,30,0.3)'}`}}>{d.tag}</div>
     </div>
     {d.img?<img src={d.img} width={132} height={176} style={{position:'absolute',left:26,top:32}}/>:null}
     <div style={{display:'flex',fontSize:19,lineHeight:1.1,letterSpacing:-0.6}}>{d.title}</div>
    </div>)}
   </div>,
   {width:W,height:H,headers:{'Cache-Control':'public, max-age=3600'}},
  );
 }
 if(key==='creators'){
  // In the website's style: three pasted posts turn into one card of the hero deck, the creator's agent.
  const who=await asset(`${origin}/characters/card/deck-echo.png`,'image/png');
  const INK='#0a0a0a',BG='#0a0a0a',TEXT='#fafafa',MUTED='#a3a3a3',LINE='rgba(255,255,255,0.14)';
  const posts=[{t:'small releases, every day.',left:612,top:128,turn:-3},{t:'plans are cheap. show me what shipped.',left:596,top:226,turn:2},{t:'morning, makers',left:624,top:372,turn:-2}];
  return new ImageResponse(
   <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:BG,color:TEXT,fontFamily:'sans-serif'}}>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:560,height:H,padding:'54px 0 52px 64px'}}>
     <div style={{display:'flex',alignItems:'center',gap:18}}>
      {logo?<img src={logo} width={146} height={44}/>:<div style={{display:'flex',fontSize:24,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
      <div style={{display:'flex',alignItems:'center',gap:10,fontSize:16,letterSpacing:3.5,color:MUTED}}><div style={{display:'flex',width:9,height:9,borderRadius:9,backgroundColor:'#ffe600'}}/>{c.kicker}</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',fontSize:72,lineHeight:1.04,letterSpacing:-3}}>
      <div style={{display:'flex',color:MUTED}}>It writes</div>
      <div style={{display:'flex',color:TEXT}}>the way you do.</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:10}}>
       {['YOU PASTE IT','YOUR STYLE','PAID PER MESSAGE'].map(l=><div key={l} style={{display:'flex',alignItems:'center',flexShrink:0,height:40,padding:'0 16px',borderRadius:999,border:`1px solid ${LINE}`,fontSize:14,letterSpacing:2,whiteSpace:'nowrap',color:TEXT}}>{l}</div>)}
      </div>
      <div style={{display:'flex',fontSize:15,letterSpacing:2.6,color:MUTED}}>{foot('CREATORS')}</div>
     </div>
    </div>
    {posts.map(p=><div key={p.t} style={{display:'flex',flexDirection:'column',gap:8,position:'absolute',left:p.left,top:p.top,width:232,padding:'14px 16px',borderRadius:18,backgroundColor:TEXT,color:INK,transform:`rotate(${p.turn}deg)`,boxShadow:'0 18px 40px rgba(0,0,0,0.4)'}}>
     <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,letterSpacing:1.6,color:'#595959'}}><div style={{display:'flex',width:16,height:16,borderRadius:16,backgroundColor:INK}}/>YOU</div>
     <div style={{display:'flex',fontSize:20,lineHeight:1.25}}>{p.t}</div>
    </div>)}
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',position:'absolute',left:892,top:128,width:268,height:366,padding:20,borderRadius:22,backgroundColor:'#2440ff',color:'#ffffff',transform:'rotate(4deg)',boxShadow:'0 24px 60px rgba(0,0,0,0.45)'}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:14,letterSpacing:2.2}}>
      <div style={{display:'flex'}}>#01</div>
      <div style={{display:'flex',padding:'4px 10px',borderRadius:9,border:'1px solid rgba(255,255,255,0.35)'}}>YOUR STYLE</div>
     </div>
     {who?<img src={who} width={195} height={260} style={{position:'absolute',left:36,top:44}}/>:null}
     <div style={{display:'flex',fontSize:25,lineHeight:1.1,letterSpacing:-0.8}}>Writes like you</div>
    </div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',position:'absolute',left:826,top:274,width:76,height:76,borderRadius:76,backgroundColor:INK,border:`5px solid ${BG}`}}>
     <svg width="36" height="36" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" stroke="#ffe600" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
   </div>,
   {width:W,height:H,headers:{'Cache-Control':'public, max-age=3600'}},
  );
 }
 if(key==='discover'){
  // In the website's style, like the agent teams card: one card of the hero deck and a short conversation next to it.
  const who=await asset(`${origin}/characters/card/deck-juno.png`,'image/png');
  const INK='#0a0a0a',BG='#0a0a0a',TEXT='#fafafa',MUTED='#a3a3a3',LINE='rgba(255,255,255,0.14)';
  return new ImageResponse(
   <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:BG,color:TEXT,fontFamily:'sans-serif'}}>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:600,height:H,padding:'54px 0 52px 64px'}}>
     <div style={{display:'flex',alignItems:'center',gap:18}}>
      {logo?<img src={logo} width={146} height={44}/>:<div style={{display:'flex',fontSize:24,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
      <div style={{display:'flex',alignItems:'center',gap:10,fontSize:16,letterSpacing:3.5,color:MUTED}}><div style={{display:'flex',width:9,height:9,borderRadius:9,backgroundColor:'#ffe600'}}/>CHAT WITH AN AGENT</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',fontSize:72,lineHeight:1.04,letterSpacing:-3}}>
      <div style={{display:'flex',color:MUTED}}>Agents for hire.</div>
      <div style={{display:'flex',color:TEXT}}>Chat or task.</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:10}}>
       {['OWN VOICE','PER MESSAGE OR TASK','CREATORS COLLECT'].map(l=><div key={l} style={{display:'flex',alignItems:'center',flexShrink:0,height:40,padding:'0 16px',borderRadius:999,border:`1px solid ${LINE}`,fontSize:14,letterSpacing:2,whiteSpace:'nowrap',color:TEXT}}>{l}</div>)}
      </div>
      <div style={{display:'flex',fontSize:15,letterSpacing:2.6,color:MUTED}}>{foot('DASHBOARD/DISCOVER')}</div>
     </div>
    </div>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',position:'absolute',left:624,top:120,width:268,height:366,padding:20,borderRadius:22,backgroundColor:'#ffe600',color:INK,transform:'rotate(-4deg)',boxShadow:'0 24px 60px rgba(0,0,0,0.45)'}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:14,letterSpacing:2.2}}>
      <div style={{display:'flex'}}>#01</div>
      <div style={{display:'flex',padding:'4px 10px',borderRadius:9,border:'1px solid rgba(31,32,30,0.3)'}}>LISTED AGENT</div>
     </div>
     {who?<img src={who} width={195} height={260} style={{position:'absolute',left:36,top:44}}/>:null}
     <div style={{display:'flex',fontSize:25,lineHeight:1.1,letterSpacing:-0.8}}>Answers as itself</div>
    </div>
    <div style={{display:'flex',position:'absolute',left:900,top:150,width:250,padding:'14px 18px',borderRadius:22,borderBottomRightRadius:6,backgroundColor:TEXT,color:INK,fontSize:21,lineHeight:1.3,boxShadow:'0 18px 40px rgba(0,0,0,0.4)'}}>Morning. What are agents good for?</div>
    <div style={{display:'flex',position:'absolute',left:846,top:268,width:300,padding:'16px 20px',borderRadius:22,borderBottomLeftRadius:6,backgroundColor:'#1a1a1a',border:`1px solid ${LINE}`,color:TEXT,fontSize:21,lineHeight:1.3,boxShadow:'0 18px 40px rgba(0,0,0,0.4)'}}>Each does one job well. Put two in a row and the work gets done.</div>
    <div style={{display:'flex',alignItems:'center',gap:8,position:'absolute',left:920,top:402,height:44,padding:'0 18px',borderRadius:22,borderBottomLeftRadius:6,backgroundColor:'#1a1a1a',border:`1px solid ${LINE}`}}>
     {[0,1,2].map(i=><div key={i} style={{display:'flex',width:9,height:9,borderRadius:9,backgroundColor:i===0?'#ffe600':MUTED}}/>)}
    </div>
   </div>,
   {width:W,height:H,headers:{'Cache-Control':'public, max-age=3600'}},
  );
 }
 if(c.layout==='left')return new ImageResponse(
  <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:'#0a0a0a',color:'#f4f4f2',fontFamily:'sans-serif'}}>
   {img?<img src={img} width={480} height={H} style={{position:'absolute',left:-40,top:0}}/>:null}
   <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',position:'absolute',left:420,top:0,width:780,height:H,padding:'52px 60px 52px 0'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
     <div style={{display:'flex',fontSize:18,letterSpacing:4,color:'#8c8c8c'}}>{c.kicker}</div>
     {logo?<img src={logo} width={146} height={44}/>:<div style={{display:'flex',fontSize:24,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
    </div>
    <div style={{display:'flex',fontSize:70,lineHeight:1.02,letterSpacing:-2.5}}>{c.headline}</div>
    {tiers?<div style={{display:'flex',flexWrap:'wrap',gap:12}}>
      {tiers.map(t=><div key={t.id} style={{display:'flex',flexDirection:'column',gap:6,width:354,padding:'14px 18px',borderRadius:16,border:t.id==='studio'?'1px solid #ffe600':'1px solid #333333',backgroundColor:t.id==='studio'?'#141f0c':'#0f1711'}}>
       <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between'}}><div style={{display:'flex',fontSize:27,color:t.id==='studio'?'#ffe600':'#f4f4f2'}}>{t.name}</div>
        <div style={{display:'flex',fontSize:16,color:'#8c8c8c'}}>{t.min==='0'?'no HARVEX needed':`${Number(t.min).toLocaleString('en-US')}+ HARVEX`}</div></div>
       <div style={{display:'flex',flexDirection:'column',fontSize:18,lineHeight:1.35,color:'#bdbdbd'}}><div style={{display:'flex'}}>{`${t.schedules} schedules · ${t.channels} channels`}</div><div style={{display:'flex'}}>{`${t.dailyRuns} scheduled runs a day`}</div></div>
      </div>)}
     </div>
     :<div style={{display:'flex',flexDirection:'column',gap:12}}>
      {c.lines.map(l=><div key={l} style={{display:'flex',alignItems:'center',gap:14,fontSize:28,color:'#e5e5e5'}}><div style={{display:'flex',width:10,height:10,borderRadius:10,backgroundColor:'#ffe600'}}/>{l}</div>)}
     </div>}
   </div>
  </div>,
  {width:W,height:H,headers:{'Cache-Control':'public, max-age=3600'}},
 );
 return new ImageResponse(
  <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:'#0a0a0a',color:'#f4f4f2',fontFamily:'sans-serif'}}>
   <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:720,height:H,padding:'56px 0 56px 64px'}}>
    <div style={{display:'flex',alignItems:'center',gap:14}}>
     {logo?<img src={logo} width={172} height={52}/>:<div style={{display:'flex',fontSize:26,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
     <div style={{display:'flex',fontSize:18,letterSpacing:4,color:'#8c8c8c',marginLeft:4}}>{c.kicker}</div>
    </div>
    <div style={{display:'flex',fontSize:headline.length>34?56:68,lineHeight:1.06,letterSpacing:-2,color:live?'#ffe600':'#f4f4f2'}}>{headline}</div>
    {live?<div style={{display:'flex',flexWrap:'wrap',gap:12,width:640}}>
      {live.stats.map(([l,v])=><div key={l} style={{display:'flex',flexDirection:'column',gap:4,width:314,padding:'14px 18px',borderRadius:14,border:'1px solid #333333'}}>
       <div style={{display:'flex',fontSize:15,letterSpacing:2,color:'#8c8c8c'}}>{l.toUpperCase()}</div><div style={{display:'flex',fontSize:23}}>{v}</div></div>)}
     </div>
     :<div style={{display:'flex',flexDirection:'column',gap:12}}>
      {c.lines.map(l=><div key={l} style={{display:'flex',alignItems:'center',gap:14,fontSize:28,color:'#e5e5e5'}}><div style={{display:'flex',width:10,height:10,borderRadius:10,backgroundColor:'#ffe600'}}/>{l}</div>)}
     </div>}
   </div>
   {img?<img src={img} width={480} height={H} style={{position:'absolute',right:0,top:0}}/>:null}
  </div>,
  {width:W,height:H,headers:{'Cache-Control':`public, max-age=${live?600:86400}`}},
 );
}

/* A card takes a few seconds to draw, and a link crawler (X, Telegram) may not wait that long. So each card is drawn
   once and kept in memory for as long as its own Cache-Control says (at most an hour; the cards with live numbers
   say ten minutes): the picture's address (page and ?v=) is the key. A card drawn while one of its pictures failed
   to load is served but not kept, so a broken card never sticks. */
const KEPT=new Map<string,{until:number;body:ArrayBuffer;cache:string}>();
const png=(body:ArrayBuffer,cache:string,gaps=false)=>new Response(body,{headers:{'Content-Type':'image/png','Cache-Control':cache,...(gaps?{'X-Card-Gaps':'1'}:{})}});
export async function GET(request:Request){
 const u=new URL(request.url);const id=`${u.pathname}?${u.searchParams.get('still')==='1'?'still:':''}${(u.searchParams.get('v')||'').slice(0,40)}`;
 const hit=KEPT.get(id);if(hit&&hit.until>Date.now())return png(hit.body.slice(0),hit.cache);
 const before=missing;const r=await render(request);
 if(r.status!==200||!(r.headers.get('content-type')||'').startsWith('image/png'))return r;
 const body=await r.arrayBuffer();const cache=r.headers.get('cache-control')||'public, max-age=600';
 const seconds=Math.min(Number(/max-age=(\d+)/.exec(cache)?.[1]||600),3600);
 if(missing===before){if(KEPT.size>=32)KEPT.clear();KEPT.set(id,{until:Date.now()+seconds*1000,body:body.slice(0),cache});}
 return png(body,cache,missing!==before);
}
