/* Route marker for one duel (/arena/<id>). The app shell in app/layout.tsx renders the screen from the pathname
   (lib/routes.ts, components/harvex/arena-page.tsx); this file gives the link its own title, description and preview
   picture. The page is what a user chose to publish, so search engines are asked not to index it. An id that is not
   up (anymore) answers 404. */
import type {Metadata} from 'next';
import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import {duelOf} from '@/lib/arena';
import {excerpt} from '@/lib/share';

type P={params:Promise<{id:string}>|{id:string}};
async function load({params}:P){
 const {id}=await params;
 const db=(env as unknown as {DB?:D1Database}).DB;
 return db?duelOf(db,String(id||'')).catch(()=>null):null;
}

export async function generateMetadata(p:P):Promise<Metadata>{
 const d=await load(p);
 if(!d)return {title:'Duel not available',robots:{index:false,follow:false}};
 const title=`${d.a.name} vs ${d.b.name} · Harvex Arena`,description=`“${excerpt(d.question,120)}” The same question went to two agents. Which one answered it better?`,url=`/arena/${d.id}`;
 const image=`/api/og/arena/${d.id}`;
 return {
  title:{absolute:title},description,alternates:{canonical:url},robots:{index:false,follow:false},
  openGraph:{type:'article',siteName:'Harvex Agent Studio',title,description,url,images:[{url:image,width:1200,height:630,alt:`${d.a.name} and ${d.b.name}, two AI agents on Harvex, answer the same question`}]},
  twitter:{card:'summary_large_image',title,description,images:[image]},
 };
}
export default async function Page(p:P){if(!await load(p))notFound();return null;}
