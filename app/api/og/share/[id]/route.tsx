/* Link-preview picture of one shared answer (1200x630 PNG), used as og:image / twitter:image by app/s/[id]/page.tsx.
   Only what the public page shows (lib/share.ts): the agent's name and character, the skill and the start of the
   answer. An id that is not shared (anymore) gets the site's general picture. */
import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {appOrigin} from '@/lib/server';
import {sharedRun,excerpt} from '@/lib/share';
import {getCharacter} from '@/lib/characters';

const W=1200,H=630;
async function asset(url:string,type:string){
 try{
  const r=await fetch(url);if(!r.ok)return '';
  const b=new Uint8Array(await r.arrayBuffer());let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));
  return `data:${type};base64,${btoa(s)}`;
 }catch{return '';}
}

export async function GET(request:Request){
 const origin=appOrigin(request);
 const id=new URL(request.url).pathname.split('/').filter(Boolean).pop()||'';
 const db=(env as unknown as {DB?:D1Database}).DB;
 const s=db?await sharedRun(db,id).catch(()=>null):null;
 if(!s)return Response.redirect(`${origin}/og.png`,302);
 if(s.chat){
  // A shared conversation, in the website's style: what was asked and the start of the answer as two bubbles, next
  // to the agent on a card of the hero deck.
  const ch=getCharacter(s.skin);
  const [who,mark]=await Promise.all([asset(`${origin}/characters/deck/${ch.id}.png`,'image/png'),asset(`${origin}/brands/harvex-logo-lime.png`,'image/png')]);
  const INK='#0a0a0a',BG='#0a0a0a',TEXT='#fafafa',MUTED='#a3a3a3',LINE='rgba(255,255,255,0.14)';
  const asked=s.task?excerpt(s.task,90):'';const said=excerpt(s.text,asked?170:240);const name=s.agentName.length>22?s.agentName.slice(0,21)+'…':s.agentName;
  return new ImageResponse(
   <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:BG,color:TEXT,fontFamily:'sans-serif'}}>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:800,height:H,padding:'54px 0 52px 64px'}}>
     <div style={{display:'flex',alignItems:'center',gap:18}}>
      {mark?<img src={mark} width={146} height={44}/>:<div style={{display:'flex',fontSize:24,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
      <div style={{display:'flex',alignItems:'center',gap:10,fontSize:16,letterSpacing:3.5,color:MUTED}}><div style={{display:'flex',width:9,height:9,borderRadius:9,backgroundColor:'#ffe600'}}/>A CONVERSATION</div>
     </div>
     <div style={{display:'flex',flexDirection:'column',gap:16,width:720}}>
      {asked?<div style={{display:'flex',alignSelf:'flex-end',maxWidth:600,padding:'14px 20px',borderRadius:24,borderBottomRightRadius:6,backgroundColor:TEXT,color:INK,fontSize:26,lineHeight:1.28}}>{asked}</div>:null}
      <div style={{display:'flex',alignSelf:'flex-start',maxWidth:680,padding:'18px 22px',borderRadius:24,borderBottomLeftRadius:6,backgroundColor:'#1a1a1a',border:`1px solid ${LINE}`,color:TEXT,fontSize:said.length>120?27:32,lineHeight:1.3}}>{said}</div>
     </div>
     <div style={{display:'flex',fontSize:15,letterSpacing:2.6,color:MUTED}}>HARVEX.STUDIO · CHAT WITH IT YOURSELF</div>
    </div>
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',position:'absolute',left:884,top:132,width:268,height:366,padding:20,borderRadius:22,backgroundColor:'#ffe600',color:INK,transform:'rotate(4deg)',boxShadow:'0 24px 60px rgba(0,0,0,0.45)'}}>
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:14,letterSpacing:2.2}}>
      <div style={{display:'flex'}}>#01</div>
      <div style={{display:'flex',padding:'4px 10px',borderRadius:9,border:'1px solid rgba(31,32,30,0.3)'}}>{ch.role}</div>
     </div>
     {who?<img src={who} width={195} height={260} style={{position:'absolute',left:36,top:44}}/>:null}
     <div style={{display:'flex',fontSize:25,lineHeight:1.1,letterSpacing:-0.8}}>{name}</div>
    </div>
   </div>,
   {width:W,height:H,headers:{'Cache-Control':'public, max-age=600'}},
  );
 }
 const [img,logo]=await Promise.all([asset(`${origin}/characters/card/${getCharacter(s.skin).id}.jpg`,'image/jpeg'),asset(`${origin}/brands/harvex-logo-lime.png`,'image/png')]);
 const quote=excerpt(s.text,230);
 return new ImageResponse(
  <div style={{width:W,height:H,display:'flex',position:'relative',backgroundColor:'#0a0a0a',color:'#f4f4f2',fontFamily:'sans-serif'}}>
   <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:720,height:H,padding:'56px 0 56px 64px'}}>
    <div style={{display:'flex',alignItems:'center',gap:14}}>
     {logo?<img src={logo} width={172} height={52}/>:<div style={{display:'flex',fontSize:26,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
     <div style={{display:'flex',fontSize:18,letterSpacing:4,color:'#8c8c8c',marginLeft:4}}>{s.sample?'WORKFLOW SAMPLE':'ANSWER'}</div>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
     <div style={{display:'flex',fontSize:quote.length>150?34:quote.length>80?42:54,lineHeight:1.22,letterSpacing:-1}}>{quote}</div>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:14}}>
     <div style={{display:'flex',padding:'10px 20px',borderRadius:12,backgroundColor:'#ffe600',color:'#0a0a0a',fontSize:26}}>{s.agentName.length>26?s.agentName.slice(0,25)+'…':s.agentName}</div>
     {s.skillName?<div style={{display:'flex',padding:'9px 16px',borderRadius:999,border:'1px solid #333333',color:'#e5e5e5',fontSize:22}}>{s.skillName}</div>:null}
    </div>
   </div>
   {img?<img src={img} width={480} height={H} style={{position:'absolute',right:0,top:0}}/>:null}
  </div>,
  {width:W,height:H,headers:{'Cache-Control':'public, max-age=600'}},
 );
}
