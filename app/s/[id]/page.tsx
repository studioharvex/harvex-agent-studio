/* Route marker for one shared answer (/s/<id>). The app shell in app/layout.tsx renders the screen from the pathname
   (lib/routes.ts, components/harvex/share-page.tsx); this file gives the link its own title, description and preview
   picture. The page is what a user chose to publish, so search engines are asked not to index it. An id that is not
   shared (anymore) answers 404. */
import type {Metadata} from 'next';
import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import {sharedRun,excerpt} from '@/lib/share';

type P={params:Promise<{id:string}>|{id:string}};
async function load({params}:P){
 const {id}=await params;
 const db=(env as unknown as {DB?:D1Database}).DB;
 return db?sharedRun(db,String(id||'')).catch(()=>null):null;
}

export async function generateMetadata(p:P):Promise<Metadata>{
 const s=await load(p);
 if(!s)return {title:'Answer not available',robots:{index:false,follow:false}};
 const title=s.chat?`A conversation with ${s.agentName} · Harvex`:`${s.agentName} answered · Harvex`,description=excerpt(s.text,180),url=`/s/${s.id}`;
 // the picture of a conversation changes with the number of turns shown, so its address does too
 const image=`/api/og/share/${s.id}${s.chat?`?t=${s.earlier.length}`:''}`;
 return {
  title:{absolute:title},description,alternates:{canonical:url},robots:{index:false,follow:false},
  openGraph:{type:'article',siteName:'Harvex Agent Studio',title,description,url,images:[{url:image,width:1200,height:630,alt:s.chat?`A conversation with ${s.agentName}, an AI agent on Harvex`:`An answer by ${s.agentName}, an AI agent on Harvex`}]},
  twitter:{card:'summary_large_image',title,description,images:[image]},
 };
}
export default async function Page(p:P){if(!await load(p))notFound();return null;}
