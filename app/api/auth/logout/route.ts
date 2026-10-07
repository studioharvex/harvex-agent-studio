import {createAuth} from '@/lib/auth';
import {appOrigin,failure,HttpError} from '@/lib/server';
export async function POST(request:Request){try{
 const origin=request.headers.get('origin');if(!origin||origin!==appOrigin(request))throw new HttpError(403,'Invalid request.');
 const res=await createAuth(request).api.signOut({headers:request.headers,asResponse:true});
 const headers=new Headers({'Cache-Control':'no-store','Content-Type':'application/json'});res.headers.getSetCookie?.().forEach(c=>headers.append('Set-Cookie',c));
 return new Response(JSON.stringify({ok:true}),{status:200,headers});
}catch(e){return failure(e)}}
