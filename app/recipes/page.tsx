/* Route marker for the public recipes page (/recipes): the app shell in app/layout.tsx renders the screen from the
   pathname (lib/routes.ts, components/harvex/recipes-page.tsx). The page has its own link preview (lib/page-cards.ts). */
import {pageMetadata} from '@/lib/page-cards';
export const metadata=pageMetadata('recipes');
export default function Page(){return null;}
