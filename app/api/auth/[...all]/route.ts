/* Better Auth endpoints (wallet only): SIWE nonce/verify, get-session, sign-out. */
import {createAuth,AuthError} from '@/lib/auth';
import {appOrigin} from '@/lib/server';
async function handle(request:Request){
 // Better Auth checks the Origin only on requests that carry a cookie, so the first sign-in (no cookie yet) was not
 // covered. A browser on another site always sends its own Origin on a POST: refuse it here for every auth write.
 if(request.method!=='GET'){const o=request.headers.get('origin');if(o&&o!==appOrigin(request))return Response.json({error:'Invalid request.'},{status:403});}
 try{return await createAuth(request).handler(request);}
 catch(e){if(e instanceof AuthError)return Response.json({error:e.message},{status:e.status});console.error('auth handler failed',e);return Response.json({error:'Sign-in failed. Try again.'},{status:500});}
}
export const GET=handle;export const POST=handle;
