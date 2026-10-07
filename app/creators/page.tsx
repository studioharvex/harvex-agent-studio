/* Route marker for the public creator agents page (/creators): the app shell in app/layout.tsx renders the screen
   from the pathname (lib/routes.ts, components/harvex/creators-page.tsx). The page has its own link preview
   (lib/page-cards.ts). */
import {pageMetadata} from '@/lib/page-cards';
// the number is the picture's design: raise it when the card changes, so a posted link shows the new picture
export const metadata=pageMetadata('creators','1');
export default function Page(){return null;}
