/* Route marker: the app shell in app/layout.tsx renders this screen from the pathname (lib/routes.ts).
   A visitor without a session who opens a page behind sign-in lands here with ?next=<that page>. The link preview
   then is the one of the page the link was for (lib/page-cards.ts), not a general one. */
import type {Metadata} from 'next';
import {cardForPath,pageMetadata} from '@/lib/page-cards';
type P={searchParams?:Promise<{next?:string|string[]}>|{next?:string|string[]}};
export async function generateMetadata({searchParams}:P):Promise<Metadata>{
 const sp=await searchParams;const next=Array.isArray(sp?.next)?sp?.next[0]:sp?.next;
 const key=cardForPath(String(next||''));
 return key?{...pageMetadata(key),title:'Connect wallet'}:{title:'Connect wallet'};
}
export default function Page(){return null;}
