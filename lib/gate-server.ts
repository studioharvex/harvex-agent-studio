/* The closed parts as the server is set right now (CLOSED_SECTIONS, see lib/gate.ts). Server only. */
import {env} from 'cloudflare:workers';
import {parseClosed,type Section} from './gate';

export function closedNow():Section[]{
 return parseClosed((env as unknown as Record<string,string|undefined>).CLOSED_SECTIONS);
}
