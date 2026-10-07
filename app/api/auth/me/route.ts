import {currentUser} from '@/lib/auth';
import {failure} from '@/lib/server';
export async function GET(request:Request){try{const u=await currentUser(request);return Response.json(u?{signedIn:true,email:u.email,label:u.label,wallet:u.wallet||null}:{signedIn:false},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e)}}
