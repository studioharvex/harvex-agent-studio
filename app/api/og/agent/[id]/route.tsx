/* The card of one published agent (1200x630 PNG): the picture a link to the agent shows on X (og:image /
   twitter:image of app/a/[id]/page.tsx), and the picture its page offers to download and post. It is drawn as a card
   to show off, in the website's style: the agent on a card of the hero deck (a colour of its own, a serial number, its
   creator's verified handle or the character's role, the character, its name) next to its name, its line and three
   numbers (runs, the price of a chat message, the price of a task).
   Public data only (lib/market.ts): an agent that is not published gets the site's general picture instead, so a
   private agent cannot be probed through this route. The character is the default picture of its character
   (public/characters/deck/<id>.png): an outfit made in the Studio is not drawn here. */
import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {appOrigin} from '@/lib/server';
import {publishedAgent} from '@/lib/market';
import {getCharacter} from '@/lib/characters';

const W=1200,H=630;
const clip=(s:string,n:number)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s;
/** The colours of the hero deck; an agent keeps the same one (picked from its id). */
const DECK:[string,string][]=[['#ffe600','#0a0a0a'],['#2440ff','#ffffff'],['#ff5a1f','#0a0a0a'],['#38bdff','#0a0a0a'],['#ffab1a','#0a0a0a'],['#12c96a','#0a0a0a'],['#fafafa','#0a0a0a']];
const pick=(id:string)=>{let h=0;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0;return h;};

/** A static file of this site as a data URI (satori cannot read the asset binding). Empty when it cannot be read; the
    card is then drawn without it and is not kept. */
let missing=0;
async function asset(url:string,type:string){
 try{
  const r=await fetch(url);if(!r.ok){missing++;return '';}
  const b=new Uint8Array(await r.arrayBuffer());let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));
  return `data:${type};base64,${btoa(s)}`;
 }catch{missing++;return '';}
}

async function render(request:Request){
 const origin=appOrigin(request);
 const id=new URL(request.url).pathname.split('/').filter(Boolean).pop()||'';
 const db=(env as unknown as {DB?:D1Database}).DB;
 const a=db?await publishedAgent(db,id).catch(()=>null):null;
 if(!a)return Response.redirect(`${origin}/og.png`,302);
 const ch=getCharacter(a.skin);
 const [who,logo]=await Promise.all([asset(`${origin}/characters/deck/${ch.id}.png`,'image/png'),asset(`${origin}/brands/harvex-logo-lime.png`,'image/png')]);
 const INK='#0a0a0a',BG='#0a0a0a',TEXT='#fafafa',MUTED='#a3a3a3',LINE='rgba(255,255,255,0.14)';
 const h=pick(a.id);const [bg,fg]=DECK[h%DECK.length];const [bg2]=DECK[(h+3)%DECK.length];
 const name=String(a.name||'Agent'),tagline=String(a.tagline||'');
 const serial=a.id.replace(/-/g,'').slice(0,4).toUpperCase();
 const tag=a.verified?a.creator.toUpperCase():ch.role;
 const cr=(n:number)=>n===0?'FREE':`${n} CR`;
 const stats:[string,string][]=[['RUNS',Number(a.uses||0)>0?Number(a.uses).toLocaleString('en-US'):'NEW'],['CHAT',cr(a.talkPrice)],['TASK',cr(a.price)]];
 return new ImageResponse(
  <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:BG,color:TEXT,fontFamily:'sans-serif'}}>
   <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:700,height:H,padding:'54px 0 52px 64px'}}>
    <div style={{display:'flex',alignItems:'center',gap:18}}>
     {logo?<img src={logo} width={146} height={44}/>:<div style={{display:'flex',fontSize:24,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
     <div style={{display:'flex',alignItems:'center',gap:10,fontSize:16,letterSpacing:3.5,color:MUTED}}><div style={{display:'flex',width:9,height:9,borderRadius:9,backgroundColor:'#ffe600'}}/>AGENT CARD</div>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:16,width:600}}>
     <div style={{display:'flex',fontSize:name.length>20?58:name.length>12?72:88,lineHeight:1.02,letterSpacing:-3}}>{clip(name,40)}</div>
     {tagline?<div style={{display:'flex',fontSize:27,lineHeight:1.3,color:MUTED}}>{clip(tagline,92)}</div>:null}
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
     <div style={{display:'flex',gap:12}}>
      {stats.map(([l,v])=><div key={l} style={{display:'flex',flexDirection:'column',gap:4,width:150,padding:'12px 16px',borderRadius:14,border:`1px solid ${LINE}`}}>
       <div style={{display:'flex',fontSize:13,letterSpacing:2.4,color:MUTED}}>{l}</div><div style={{display:'flex',fontSize:28,letterSpacing:-0.5}}>{v}</div></div>)}
     </div>
     <div style={{display:'flex',fontSize:15,letterSpacing:2.6,color:MUTED}}>CHAT WITH IT ON HARVEX.STUDIO</div>
    </div>
   </div>
   {/* a second card behind it, so the card reads as one of a deck */}
   <div style={{display:'flex',position:'absolute',left:812,top:110,width:312,height:428,borderRadius:26,backgroundColor:bg2,opacity:0.5,transform:'rotate(-7deg)'}}/>
   <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',position:'absolute',left:808,top:90,width:320,height:440,padding:24,borderRadius:26,backgroundColor:bg,color:fg,transform:'rotate(4deg)',boxShadow:'0 30px 70px rgba(0,0,0,0.5)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:15,letterSpacing:2.4}}>
     <div style={{display:'flex'}}>#{serial}</div>
     <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 11px',borderRadius:10,...(a.verified?{backgroundColor:INK,color:'#ffe600'}:{border:`1px solid ${fg==='#ffffff'?'rgba(255,255,255,0.35)':'rgba(31,32,30,0.3)'}`})}}>
      {a.verified?<svg width="15" height="15" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#ffe600" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>:null}{clip(tag,16)}</div>
    </div>
    {who?<img src={who} width={234} height={312} style={{position:'absolute',left:43,top:52}}/>:null}
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
     <div style={{display:'flex',fontSize:name.length>18?24:30,lineHeight:1.08,letterSpacing:-1}}>{clip(name,30)}</div>
     <div style={{display:'flex',fontSize:12,letterSpacing:2.4,opacity:0.7}}>AI AGENT · HARVEX</div>
    </div>
   </div>
  </div>,
  {width:W,height:H,headers:{'Cache-Control':'public, max-age=600'}},
 );
}

/* A card takes a few seconds to draw and a link crawler may not wait, so each one is kept in memory for ten minutes
   under its address (agent id and ?v=). A card drawn while a picture failed to load is served but not kept. */
const KEPT=new Map<string,{until:number;body:ArrayBuffer}>();
const png=(body:ArrayBuffer)=>new Response(body,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=600'}});
export async function GET(request:Request){
 const u=new URL(request.url);const key=`${u.pathname}?${(u.searchParams.get('v')||'').slice(0,60)}`;
 const hit=KEPT.get(key);if(hit&&hit.until>Date.now())return png(hit.body.slice(0));
 const before=missing;const r=await render(request);
 if(r.status!==200||!(r.headers.get('content-type')||'').startsWith('image/png'))return r;
 const body=await r.arrayBuffer();
 if(missing===before){if(KEPT.size>=64)KEPT.clear();KEPT.set(key,{until:Date.now()+600_000,body:body.slice(0)});}
 return png(body);
}
