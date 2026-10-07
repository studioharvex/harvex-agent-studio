/* Link-preview picture of the Whale watch page (1200x630 PNG), used as og:image / twitter:image by app/whales/page.tsx.
   Numbers come from lib/whales.ts (the server's record of the HARVEX token); a server without that record answers with
   the site's general picture. */
import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {appOrigin} from '@/lib/server';
import {whales} from '@/lib/whales';

const W=1200,H=630;
async function asset(url:string,type:string){
 try{
  const r=await fetch(url);if(!r.ok)return '';
  const b=new Uint8Array(await r.arrayBuffer());let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));
  return `data:${type};base64,${btoa(s)}`;
 }catch{return '';}
}
const short=(a:string)=>`${a.slice(0,6)}…${a.slice(-4)}`;

export async function GET(request:Request){
 const origin=appOrigin(request);
 const db=(env as unknown as {DB?:D1Database}).DB;
 const w=db?await whales(db).catch(()=>null):null;
 if(!w)return Response.redirect(`${origin}/og.png`,302);
 const logo=await asset(`${origin}/brands/harvex-logo-lime.png`,'image/png');
 const big=w.moves.find(m=>m.kind==='transfer')||w.moves[0];
 const stats:[string,string][]=[['Holders',w.holders.toLocaleString('en-US')],['New in 24 h',w.newHolders.toLocaleString('en-US')],['Transactions, 24 h',w.day.txs.toLocaleString('en-US')],['Moved in 24 h',`${w.day.volumeShort} HARVEX`]];
 return new ImageResponse(
  <div style={{width:W,height:H,display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'56px 64px',backgroundColor:'#0a0a0a',color:'#f4f4f2',fontFamily:'sans-serif'}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
    <div style={{display:'flex',alignItems:'center',gap:14}}>
     {logo?<img src={logo} width={172} height={52}/>:<div style={{display:'flex',fontSize:26,letterSpacing:6,color:'#ffe600'}}>Harvex</div>}
     <div style={{display:'flex',fontSize:18,letterSpacing:4,color:'#8c8c8c',marginLeft:4}}>WHALE WATCH</div>
    </div>
    <div style={{display:'flex',fontSize:20,color:'#8c8c8c'}}>{new Date(w.asOf.ts*1000).toISOString().slice(0,16).replace('T',' ')} UTC</div>
   </div>
   <div style={{display:'flex',flexDirection:'column',gap:12}}>
    <div style={{display:'flex',fontSize:22,letterSpacing:3,color:'#8c8c8c'}}>{big?'BIGGEST TRANSFER, LAST 24 HOURS':'LAST 24 HOURS'}</div>
    <div style={{display:'flex',fontSize:big&&big.amount.length>14?84:104,lineHeight:1,letterSpacing:-3,color:'#ffe600'}}>{big?`${big.amount.split('.')[0]} HARVEX`:'No transfers'}</div>
    {big?<div style={{display:'flex',fontSize:26,color:'#bdbdbd'}}>{big.kind==='mint'?`minted to ${short(big.to)}`:big.kind==='burn'?`burned by ${short(big.from)}`:`${short(big.from)} → ${short(big.to)}`}</div>:null}
   </div>
   <div style={{display:'flex',gap:14}}>
    {stats.map(([l,v])=><div key={l} style={{display:'flex',flexDirection:'column',gap:6,flex:1,padding:'18px 20px',borderRadius:16,border:'1px solid #333333'}}>
     <div style={{display:'flex',fontSize:18,letterSpacing:2,color:'#8c8c8c'}}>{l.toUpperCase()}</div>
     <div style={{display:'flex',fontSize:38,letterSpacing:-1}}>{v}</div>
    </div>)}
   </div>
  </div>,
  {width:W,height:H,headers:{'Cache-Control':'public, max-age=600'}},
 );
}
