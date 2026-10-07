/* Referral boost of the holder reward (client, 4 Oct 2026). An account that invited friends earns more on its OWN
   holder reward: +`percent`% (default 10) for every invited friend who held at least one complete reward unit for the
   WHOLE period, up to `maxFriends` friends (default 5, so at most 1.5x).
   The rule, exactly:
   - a "friend" is an account whose invitation was completed (lib/referrals.ts: it signed in through the invite link
     and completed a run). Each account can be the friend of one inviter only;
   - a friend counts in a period when the reward units of its linked wallets, summed over the period, are at least
     one unit for every second of it. Holding for part of the period, or moving the tokens in at its end, does not count;
     the same tokens cannot make two friends count at once, because a token sits in one wallet at a time;
   - the boost multiplies the USD the inviter's own wallets accrued in that period, rounded down. A wallet that accrued
     nothing gets nothing: a multiple of zero is zero. The friend's own reward is not changed.
   What it does not prevent, on purpose and within the cap: one person splitting tokens over several accounts to count
   as their own friends. That costs the vault at most `percent` x `maxFriends` more for that holder.
   This file is pure (no database, no server imports) so the rule can be tested on its own (scripts/verify-boost.mjs). */

export type BoostRow={address:string;unitSeconds:bigint;usdE8:bigint};
export type BoostData={/** linked wallets of the accounts involved */wallets:{owner:string;address:string}[];
 /** completed invitations */pairs:{referee:string;referrer:string}[];percent:number;maxFriends:number};

/** How many friends count for each inviter in a period of `seconds` seconds, from that period's accrual rows. */
export function friendsCounting(rows:BoostRow[],seconds:number,d:BoostData){
 const ownerOf=new Map(d.wallets.map(w=>[w.address.toLowerCase(),w.owner]));
 const held=new Map<string,bigint>();
 for(const r of rows){const o=ownerOf.get(r.address.toLowerCase());if(o)held.set(o,(held.get(o)||0n)+r.unitSeconds);}
 const need=BigInt(Math.max(0,Math.floor(seconds)));const count=new Map<string,number>();
 if(need>0n)for(const p of d.pairs)if(p.referee!==p.referrer&&(held.get(p.referee)||0n)>=need)count.set(p.referrer,(count.get(p.referrer)||0)+1);
 return {ownerOf,count};
}

/** The rows with the inviters' USD raised. `boost` is the percentage paid: 100 = no boost, 120 = 1.2x. */
export function applyBoost<T extends BoostRow>(rows:T[],seconds:number,d:BoostData|null):(T&{boost:number})[]{
 if(!d||d.percent<=0||d.maxFriends<=0||!d.pairs.length)return rows.map(r=>({...r,boost:100}));
 const {ownerOf,count}=friendsCounting(rows,seconds,d);
 return rows.map(r=>{
  const owner=ownerOf.get(r.address.toLowerCase());const n=owner?Math.min(count.get(owner)||0,d.maxFriends):0;
  const boost=100+d.percent*n;
  return {...r,usdE8:n?r.usdE8*BigInt(boost)/100n:r.usdE8,boost};
 });
}
