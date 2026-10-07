/* Verified creators (lib/creators.ts). GET: whether verification is open here; with a session, the account's own
   claim, and for a reviewer the claims that wait. POST {action}:
   - start {handle}, proof {url}, withdraw: the creator's own claim;
   - approve / reject {owner, note?}: a reviewer's decision (accounts whose sign-in wallet is in CREATOR_ADMINS). */
import {context,failure,body,HttpError} from '@/lib/server';
import {creatorOf,creatorsEnabled,decide,isCreatorAdmin,reviewList,startClaim,submitProof,withdraw} from '@/lib/creators';

const noStore={headers:{'Cache-Control':'no-store'}};
async function state(db:D1Database,owner:string,wallet?:string|null){
 const admin=isCreatorAdmin(wallet);
 return {signedIn:true,enabled:creatorsEnabled(),admin,mine:await creatorOf(db,owner),review:admin?await reviewList(db):[]};
}

export async function GET(request:Request){try{
 try{const {db,owner,wallet}=await context(request);return Response.json(await state(db,owner,wallet),noStore);}
 catch(e){if(!(e instanceof HttpError)||e.status!==401)throw e;return Response.json({signedIn:false,enabled:creatorsEnabled(),admin:false,mine:{status:'none'},review:[]},noStore);}
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner,wallet}=await context(request,true);const data=await body(request) as {action?:string;handle?:unknown;url?:unknown;owner?:unknown;note?:unknown};
 if(data.action==='start')await startClaim(db,owner,data.handle);
 else if(data.action==='proof')await submitProof(db,owner,data.url);
 else if(data.action==='withdraw')await withdraw(db,owner);
 else if(data.action==='approve'||data.action==='reject'){
  if(!isCreatorAdmin(wallet))throw new HttpError(403,'Only a reviewer can decide on a creator request.');
  await decide(db,data.owner,data.action==='approve',data.note);
 }else throw new HttpError(400,'Unknown action.');
 return Response.json(await state(db,owner,wallet),noStore);
}catch(e){return failure(e)}}
