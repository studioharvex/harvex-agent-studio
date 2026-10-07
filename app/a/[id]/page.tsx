/* Route marker for the public page of one published agent (/a/<id>). The app shell in app/layout.tsx renders the
   screen from the pathname (lib/routes.ts, components/harvex/agent-page.tsx); this file gives the link its own title,
   description and preview picture, so a post on X or Telegram shows this agent and not the general site card.
   Only public fields are read (lib/market.ts); an agent that is not published gets the site's defaults. */
import type {Metadata} from 'next';
import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import {publishedAgent,agentSummary,previewVersion} from '@/lib/market';

type P={params:Promise<{id:string}>|{id:string}};
async function load({params}:P){
 const {id}=await params;
 const db=(env as unknown as {DB?:D1Database}).DB;
 return db?publishedAgent(db,String(id||'')).catch(()=>null):null;
}

export async function generateMetadata(p:P):Promise<Metadata>{
 const a=await load(p);
 if(!a)return {title:'Agent not available',robots:{index:false,follow:false}};
 const title=`${a.name} · Harvex agent`,description=agentSummary(a),url=`/a/${a.id}`;
 const image=`/api/og/agent/${a.id}?v=${previewVersion(a)}`;
 return {
  title:{absolute:title},description,alternates:{canonical:url},
  openGraph:{type:'website',siteName:'Harvex Agent Studio',title,description,url,images:[{url:image,width:1200,height:630,alt:`${a.name}, an AI agent on Harvex`}]},
  twitter:{card:'summary_large_image',title,description,images:[image]},
 };
}
/** A link to an agent that is not published (or never existed) answers 404; the shell shows "not available". */
export default async function Page(p:P){if(!await load(p))notFound();return null;}
