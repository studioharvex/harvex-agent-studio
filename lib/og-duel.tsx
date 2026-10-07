/* The arena's link-preview picture, in the website's style (page background, mono kicker with a lime dot, two cards
   of the hero deck: the lime corner and the iris corner, "VS" between them). Used for the page /arena
   (app/api/og/page/[key]/route.tsx) and for one duel (app/api/og/arena/[id]/route.tsx). Pictures arrive as data URIs:
   the routes load them. */
import type {ReactElement} from 'react';

export const DUEL_W=1200,DUEL_H=630;
export type DuelCorner={tag:string;name:string;img:string};
const INK='#0a0a0a',BG='#0a0a0a',TEXT='#fafafa',MUTED='#a3a3a3',LINE='rgba(255,255,255,0.14)';
const cut=(s:string,n:number)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s;

export function duelCard({logo,kicker,muted,bright,chips,foot,a,b}:{logo:string;kicker:string;/** headline: a muted first part (may be empty) and a bright part */muted:string;bright:string;chips:string[];foot:string;a:DuelCorner;b:DuelCorner}):ReactElement{
 const n=(muted+bright).length;const size=n>110?38:n>80?44:n>50?54:n>30?64:72;
 const deck=[{n:'A',c:a,bg:'#ffe600',fg:INK,left:628,top:112,turn:-4},{n:'B',c:b,bg:'#2440ff',fg:'#ffffff',left:886,top:150,turn:4}];
 return <div style={{width:DUEL_W,height:DUEL_H,display:'flex',position:'relative',backgroundColor:BG,color:TEXT,fontFamily:'sans-serif'}}>
  <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:600,height:DUEL_H,padding:'54px 0 52px 64px'}}>
   <div style={{display:'flex',alignItems:'center',gap:18}}>
    {logo?<img src={logo} width={146} height={44}/>:<div style={{display:'flex',fontSize:24,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
    <div style={{display:'flex',alignItems:'center',gap:10,fontSize:16,letterSpacing:3.5,color:MUTED}}><div style={{display:'flex',width:9,height:9,borderRadius:9,backgroundColor:'#ffe600'}}/>{kicker}</div>
   </div>
   <div style={{display:'flex',flexDirection:'column',width:520,fontSize:size,lineHeight:1.06,letterSpacing:size>50?-2.6:-1.4}}>
    {muted?<div style={{display:'flex',color:MUTED}}>{muted}</div>:null}
    <div style={{display:'flex',color:TEXT}}>{bright}</div>
   </div>
   <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',gap:10}}>
     {chips.map(l=><div key={l} style={{display:'flex',alignItems:'center',flexShrink:0,height:40,padding:'0 16px',borderRadius:999,border:`1px solid ${LINE}`,fontSize:14,letterSpacing:2,whiteSpace:'nowrap',color:TEXT}}>{l}</div>)}
    </div>
    <div style={{display:'flex',fontSize:15,letterSpacing:2.6,color:MUTED}}>{foot}</div>
   </div>
  </div>
  {deck.map(d=><div key={d.n} style={{display:'flex',flexDirection:'column',justifyContent:'space-between',position:'absolute',left:d.left,top:d.top,width:268,height:366,padding:20,borderRadius:22,backgroundColor:d.bg,color:d.fg,transform:`rotate(${d.turn}deg)`,boxShadow:'0 24px 60px rgba(0,0,0,0.45)'}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:14,letterSpacing:2.2}}>
    <div style={{display:'flex'}}>CORNER {d.n}</div>
    <div style={{display:'flex',padding:'4px 10px',borderRadius:9,border:`1px solid ${d.fg==='#ffffff'?'rgba(255,255,255,0.35)':'rgba(31,32,30,0.3)'}`}}>{cut(d.c.tag.toUpperCase(),12)}</div>
   </div>
   {d.c.img?<img src={d.c.img} width={195} height={260} style={{position:'absolute',left:36,top:44}}/>:null}
   <div style={{display:'flex',fontSize:25,lineHeight:1.1,letterSpacing:-0.8}}>{cut(d.c.name,22)}</div>
  </div>)}
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',position:'absolute',left:858,top:286,width:76,height:76,borderRadius:76,backgroundColor:INK,border:`5px solid ${BG}`,color:'#ffe600',fontSize:24,letterSpacing:1}}>VS</div>
 </div>;
}
