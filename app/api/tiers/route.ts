/* Holder tiers, public: what each tier needs and what it gives on this server (monthly credits, limits). Used by the
   public page /tiers; its link preview reads the same rows (lib/schedules.ts tierRows). A server without the HARVEX
   token answers {live:false}. */
import {failure} from '@/lib/server';
import {tierRows} from '@/lib/schedules';

export async function GET(){try{
 const tiers=tierRows();
 return Response.json(tiers?{live:true,tiers}:{live:false,tiers:[]},{headers:{'Cache-Control':'public, max-age=300'}});
}catch(e){return failure(e)}}
