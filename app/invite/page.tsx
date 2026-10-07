/* Route marker for the public invitation program page (/invite): the app shell in app/layout.tsx renders the screen
   from the pathname (lib/routes.ts, components/harvex/referral-page.tsx). Its link preview shows what an invitation
   gives right now (/api/og/page/referral); the picture's address carries those numbers and a design number, so a
   link posted after a change shows the new picture at once. */
import type {Metadata} from 'next';
import {pageMetadata} from '@/lib/page-cards';
import {referralProgram} from '@/lib/referrals';
const DESIGN=1;
export function generateMetadata():Metadata{
 const p=referralProgram();const b=p.boost;
 const m=pageMetadata('referral',`${DESIGN}-${p.credits}-${b?b.percent:0}-${b?b.maxFriends:0}`);
 const description=b?`Invite a friend to Harvex: ${p.credits} free credits for both of you after their first run, and +${b.percent}% on your own ${b.token} holder reward for every friend who holds ${Number(b.unit).toLocaleString('en-US')} HARVEX, up to ${(1+b.percent*b.maxFriends/100).toFixed(1)}x.`:m.description as string;
 return {...m,description,openGraph:{...m.openGraph,description},twitter:{...m.twitter,description}};
}
export default function Page(){return null;}
