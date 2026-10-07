/* Link-preview picture of one duel (1200x630 PNG), used as og:image / twitter:image by app/arena/[id]/page.tsx.
   Only what the public page shows (lib/arena.ts): the question and the two agents' names and characters; never the
   picks (they change) and never who asked. An id that is not up (anymore) gets the site's general picture.
   Kept in memory for ten minutes per duel: a render takes a few seconds and a link crawler may not wait. */
import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {appOrigin} from '@/lib/server';
import {duelOf} from '@/lib/arena';
import {excerpt} from '@/lib/share';
import {getCharacter} from '@/lib/characters';
import {duelCard,DUEL_W,DUEL_H} from '@/lib/og-duel';

async function asset(url:string,type:string){
 try{
  const r=await fetch(url);if(!r.ok)return '';
  const b=new Uint8Array(await r.arrayBuffer());let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));
  return `data:${type};base64,${btoa(s)}`;
 }catch{return '';}
}
const KEPT=new Map<string,{until:number;body:ArrayBuffer}>();
const png=(body:ArrayBuffer)=>new Response(body,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=600'}});

export async function GET(request:Request){
 const origin=appOrigin(request);
 const id=new URL(request.url).pathname.split('/').filter(Boolean).pop()||'';
 const db=(env as unknown as {DB?:D1Database}).DB;
 const d=db?await duelOf(db,id).catch(()=>null):null;
 if(!d)return Response.redirect(`${origin}/og.png`,302);
 const hit=KEPT.get(id);if(hit&&hit.until>Date.now())return png(hit.body.slice(0));
 const ca=getCharacter(d.a.skin),cb=getCharacter(d.b.skin);
 const [logo,ia,ib]=await Promise.all([asset(`${origin}/brands/harvex-logo-lime.png`,'image/png'),asset(`${origin}/characters/deck/${ca.id}.png`,'image/png'),asset(`${origin}/characters/deck/${cb.id}.png`,'image/png')]);
 const image=new ImageResponse(duelCard({logo,kicker:'ARENA',muted:'',bright:excerpt(d.question,130),chips:['ONE QUESTION','TWO AGENTS'],foot:'HARVEX.EXAMPLE/ARENA · WHICH ANSWER IS BETTER?',
  a:{tag:ca.role,name:d.a.name,img:ia},b:{tag:cb.role,name:d.b.name,img:ib}}),{width:DUEL_W,height:DUEL_H});
 const body=await image.arrayBuffer();
 if(logo&&ia&&ib){if(KEPT.size>=64)KEPT.clear();KEPT.set(id,{until:Date.now()+600_000,body:body.slice(0)});}
 return png(body);
}
