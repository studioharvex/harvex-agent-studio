/* Route marker for the weekly board (/top): the app shell in app/layout.tsx renders the screen from the pathname
   (lib/routes.ts, components/harvex/board-page.tsx). The page has its own link preview (lib/page-cards.ts); its picture
   shows the first three of the week, so its address changes with the day. */
import type {Metadata} from 'next';
import {pageMetadata} from '@/lib/page-cards';
export function generateMetadata():Metadata{return pageMetadata('top',`b1-${new Date().toISOString().slice(0,10)}`);}
export default function Page(){return null;}
