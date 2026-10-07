/* Verified creators (drizzle/0027; GET/POST /api/creator; components/app/creator-verify.tsx on the Profile page).
   A creator shows that an X handle is theirs, and a person on the team confirms it. Then every agent that account
   published says "@handle, verified creator" instead of an anonymous creator id. This is what makes "an agent in your
   own voice" checkable: a handle is only ever shown after this.
   How:
   1. the creator names the handle and gets a code (start);
   2. the creator posts the code from that handle and sends the link to the post (proof). The link must be a post of
      that same handle on x.com: nothing else is accepted;
   3. a reviewer opens the link, sees the code in a post by that handle, and approves or rejects (decide).
   The server never fetches X (its pages are behind bot checks, which are not to be worked around): step 3 is done
   by a person. Reviewers are the accounts whose sign-in wallet is listed in CREATOR_ADMINS (comma-separated
   addresses); with no address there, verification is closed on this server and the page says so.
   A handle is verified for one account only. A verified creator who withdraws loses the mark at once. */
import {env} from 'cloudflare:workers';
import {HttpError} from './server';

type Env={CREATOR_ADMINS?:string};
const HANDLE=/^[A-Za-z0-9_]{1,15}$/;
const POST=/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})(?:[/?#].*)?$/i;
const CODE_CHARS='ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Wallet addresses (lower case) of the accounts that may confirm creators. */
export function creatorAdmins(){return String((env as unknown as Env).CREATOR_ADMINS||'').split(',').map(s=>s.trim().toLowerCase()).filter(s=>/^0x[0-9a-f]{40}$/.test(s));}
export const isCreatorAdmin=(wallet?:string|null)=>!!wallet&&creatorAdmins().includes(wallet.toLowerCase());
/** Verification is open here only when someone can confirm it. */
export const creatorsEnabled=()=>creatorAdmins().length>0;

type Row={owner:string;handle:string;code:string;proof:string|null;status:string;note:string|null;updated:string;verified_at:string|null};
export type CreatorView={status:'none'|'pending'|'review'|'verified'|'rejected';handle?:string;code?:string;proof?:string|null;note?:string|null;/** what the creator posts from the handle */post?:string};
const postText=(code:string)=>`Verifying my creator agent on Harvex: ${code}`;
const view=(r:Row|null):CreatorView=>!r?{status:'none'}:{status:r.status as CreatorView['status'],handle:r.handle,code:r.code,proof:r.proof,note:r.note,post:postText(r.code)};
const rowOf=(db:D1Database,owner:string)=>db.prepare('SELECT owner,handle,code,proof,status,note,updated,verified_at FROM creators WHERE owner=?').bind(owner).first<Row>();

export const creatorOf=async(db:D1Database,owner:string)=>view(await rowOf(db,owner));
/** The verified handle of an account, or null. */
export const verifiedHandle=async(db:D1Database,owner:string)=>(await db.prepare("SELECT handle FROM creators WHERE owner=? AND status='verified'").bind(owner).first<{handle:string}>())?.handle??null;

function newCode(){const b=crypto.getRandomValues(new Uint8Array(8));return 'harvex-'+[...b].map(x=>CODE_CHARS[x%CODE_CHARS.length]).join('');}

/** Step 1: the creator names the handle. A new code each time; a verified creator withdraws first to change it. */
export async function startClaim(db:D1Database,owner:string,raw:unknown){
 if(!creatorsEnabled())throw new HttpError(503,'Creator verification is not open on this server yet.');
 const handle=String(raw??'').trim().replace(/^@/,'');
 if(!HANDLE.test(handle))throw new HttpError(400,'Enter your X handle: letters, numbers and underscores, up to 15 characters.');
 const h=handle.toLowerCase();
 const cur=await rowOf(db,owner);if(cur?.status==='verified')throw new HttpError(409,`You are verified as @${cur.handle}. Remove that first to verify another handle.`);
 if(await db.prepare("SELECT 1 AS x FROM creators WHERE handle=? AND status='verified' AND owner!=?").bind(h,owner).first())throw new HttpError(409,`@${h} is already verified for another account.`);
 const now=new Date().toISOString();
 await db.prepare("INSERT INTO creators (owner,handle,code,proof,status,note,created,updated) VALUES (?,?,?,NULL,'pending',NULL,?,?) ON CONFLICT(owner) DO UPDATE SET handle=excluded.handle,code=excluded.code,proof=NULL,status='pending',note=NULL,updated=excluded.updated WHERE creators.status!='verified'").bind(owner,h,newCode(),now,now).run();
 return creatorOf(db,owner);
}

/** Step 2: the link to the post that carries the code. Only a post of the claimed handle on x.com is taken. */
export async function submitProof(db:D1Database,owner:string,raw:unknown){
 const cur=await rowOf(db,owner);if(!cur||cur.status==='verified')throw new HttpError(400,'Start with your X handle to get a code.');
 const m=POST.exec(String(raw??'').trim());
 if(!m||m[1].toLowerCase()!==cur.handle)throw new HttpError(400,`Paste the link to your post from @${cur.handle}: https://x.com/${cur.handle}/status/…`);
 const proof=`https://x.com/${cur.handle}/status/${m[2]}`;
 await db.prepare("UPDATE creators SET proof=?,status='review',note=NULL,updated=? WHERE owner=? AND status!='verified'").bind(proof,new Date().toISOString(),owner).run();
 return creatorOf(db,owner);
}

/** The creator takes the claim back, verified or not: the row and the mark are gone. */
export async function withdraw(db:D1Database,owner:string){await db.prepare('DELETE FROM creators WHERE owner=?').bind(owner).run();return creatorOf(db,owner);}

export type ReviewItem={owner:string;handle:string;code:string;post:string;proof:string;updated:string};
/** What waits for a reviewer, oldest first. */
export async function reviewList(db:D1Database):Promise<ReviewItem[]>{
 const rows=await db.prepare("SELECT owner,handle,code,proof,updated FROM creators WHERE status='review' ORDER BY updated ASC LIMIT 50").all<{owner:string;handle:string;code:string;proof:string;updated:string}>();
 return rows.results.map(r=>({...r,post:postText(r.code)}));
}
/** Step 3: a reviewer's decision on a claim that waits for review. */
export async function decide(db:D1Database,owner:unknown,approve:boolean,note?:unknown){
 if(typeof owner!=='string'||!owner)throw new HttpError(400,'Choose a request.');
 const now=new Date().toISOString();const text=String(note??'').trim().slice(0,200)||null;
 try{
  const r=approve
   ?await db.prepare("UPDATE creators SET status='verified',note=NULL,verified_at=?,updated=? WHERE owner=? AND status='review'").bind(now,now,owner).run()
   :await db.prepare("UPDATE creators SET status='rejected',note=?,updated=? WHERE owner=? AND status='review'").bind(text,now,owner).run();
  if(!r.meta.changes)throw new HttpError(404,'This request is no longer waiting for review.');
 }catch(e){if(e instanceof HttpError)throw e;throw new HttpError(409,'This handle is already verified for another account.');}
}
