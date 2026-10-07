/* Route marker for an invite link (/r/<code>): the app shell in app/layout.tsx renders the screen from the pathname
   (lib/routes.ts, components/harvex/invite-page.tsx). Every invite link shares one link preview (lib/page-cards.ts,
   /api/og/page/invite): it says what an invitation gives and nothing about the account behind the code. The picture's
   address carries the credits and a design number, so a change of either gives a new address and a link posted
   afterwards shows the new picture at once. Search engines are asked not to index invite links. */
import type {Metadata} from 'next';
import {pageMetadata} from '@/lib/page-cards';
import {referralConfig} from '@/lib/referrals';
const DESIGN=2;
export function generateMetadata():Metadata{
 const r=referralConfig();const credits=r.enabled?r.credits:0;
 const m=pageMetadata('invite',`${DESIGN}-${credits}`);
 const description=credits>0?`A friend saved you a place in Harvex Agent Studio. Sign in with a new account and finish one task: you and your friend then receive ${credits} free credits each.`:'A friend saved you a place in Harvex Agent Studio: shape a character into an AI agent, give it skills and send it off on tasks.';
 return {...m,description,openGraph:{...m.openGraph,description},twitter:{...m.twitter,description},robots:{index:false,follow:false}};
}
export default function Page(){return null;}
