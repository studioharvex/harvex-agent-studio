/* Route marker for the public holder tiers page (/tiers): the app shell in app/layout.tsx renders the screen from the
   pathname (lib/routes.ts, components/harvex/tiers-page.tsx). The page has its own link preview (lib/page-cards.ts). */
import {pageMetadata} from '@/lib/page-cards';
export const metadata=pageMetadata('tiers');
export default function Page(){return null;}
