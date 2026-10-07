import {publicChainConfig} from '@/lib/chain';
/** Public BNB Smart Chain settings: network, public RPC, token and treasury addresses, rates, tiers. */
export function GET(){return Response.json(publicChainConfig(),{headers:{'Cache-Control':'no-store'}});}
