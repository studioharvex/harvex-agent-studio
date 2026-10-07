/* Route marker for the public Whale watch page (/whales). The app shell in app/layout.tsx renders the screen from the
   pathname (lib/routes.ts, components/harvex/whales-page.tsx); this file gives the link its own title, description and
   preview picture with the current numbers (lib/whales.ts). The picture's address changes every hour of the record,
   so a preview that was cached shows the numbers of the hour it was posted in. */
import type {Metadata} from 'next';
import {env} from 'cloudflare:workers';
import {whales} from '@/lib/whales';

export async function generateMetadata():Promise<Metadata>{
 const db=(env as unknown as {DB?:D1Database}).DB;
 const w=db?await whales(db).catch(()=>null):null;
 const title='Harvex whale watch';
 const description=w?`${w.holders.toLocaleString('en-US')} addresses hold HARVEX. Last 24 hours: ${w.day.txs.toLocaleString('en-US')} transactions moved ${w.day.volumeShort} HARVEX, ${w.newHolders.toLocaleString('en-US')} new holders. Biggest transfers and holders, from the chain.`
  :'The biggest HARVEX transfers and holders on BNB Smart Chain, from the chain.';
 const image=w?`/api/og/whales?v=${Math.floor(w.asOf.ts/3600)}`:'/og.png';
 return {
  title:{absolute:title},description,alternates:{canonical:'/whales'},
  openGraph:{type:'website',siteName:'Harvex Agent Studio',title,description,url:'/whales',images:[{url:image,width:1200,height:630,alt:'Harvex whale watch: biggest transfer and holder numbers'}]},
  twitter:{card:'summary_large_image',title,description,images:[image]},
 };
}
export default function Page(){return null;}
