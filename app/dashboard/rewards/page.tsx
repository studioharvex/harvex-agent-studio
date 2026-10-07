/* Route marker: the app shell in app/layout.tsx renders this screen from the pathname (lib/routes.ts).
   The page has its own link preview (lib/page-cards.ts). */
import type {Metadata} from 'next';
import {pageMetadata} from '@/lib/page-cards';
export function generateMetadata():Metadata{return pageMetadata('rewards',String(Math.floor(Date.now()/3600e3)));}
export default function Page(){return null;}
