/* Route marker: the app shell in app/layout.tsx renders this screen from the pathname (lib/routes.ts).
   The page has its own link preview (lib/page-cards.ts). */
import {pageMetadata} from '@/lib/page-cards';
export const metadata=pageMetadata('studio');
export default function Page(){return null;}
