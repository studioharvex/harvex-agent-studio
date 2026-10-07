/* Route marker: the app shell in app/layout.tsx renders this screen from the pathname (lib/routes.ts).
   The page has its own link preview (lib/page-cards.ts). */
import {pageMetadata} from '@/lib/page-cards';
// the number is the picture's design: raise it when the card changes, so a posted link shows the new picture
export const metadata=pageMetadata('discover','2');
export default function Page(){return null;}
