/* Public reading of the HARVEX token for the Whale watch page (lib/whales.ts): holders, new holders, the last 24 hours
   of transfers, the biggest transfers and the biggest holders. Everything in it is public chain data from the
   server's own record; a server without the token or the recorder answers {off:true}. */
import {env} from 'cloudflare:workers';
import {failure} from '@/lib/server';
import {whales} from '@/lib/whales';

export async function GET(){try{
 const db=(env as unknown as {DB?:D1Database}).DB;
 const w=db?await whales(db):null;
 return Response.json(w?{whales:w}:{off:true},{headers:{'Cache-Control':'public, max-age=60'}});
}catch(e){return failure(e)}}
