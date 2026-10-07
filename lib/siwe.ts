/* Strict Sign-In with Ethereum (EIP-4361) check, shared by wallet sign-in (lib/auth.ts) and wallet linking
   (lib/wallets.ts). A signature only counts when the signed text is a well-formed EIP-4361 message for THIS site:
   - domain = this host, URI on this origin, version 1, an allowed chain id, a nonce;
   - issued within the last 20 minutes (not in the future), not expired, not before its start;
   - canonical: exactly what a standard EIP-4361 library writes for those fields, nothing added, moved or left out.
   Why the last point matters: wallets warn when a site asks for a sign-in message that names another domain, but only
   when they recognise the text as EIP-4361. A look-alike site relaying one of our nonces would otherwise ask its visitor
   to sign a slightly malformed text that names this site, get no warning, and receive a session for that account. */
import {createSiweMessage,parseSiweMessage} from 'viem/siwe';
import type {Address} from 'viem';

export function strictSiwe(message:unknown,want:{host:string;origin:string;chains:number[]}):{address:Address;nonce:string;chainId:number}|null{
 if(typeof message!=='string'||message.length<50||message.length>2000)return null;
 let m:ReturnType<typeof parseSiweMessage>;try{m=parseSiweMessage(message);}catch{return null;}
 if(!m.address||!m.nonce||!m.domain||!m.uri||m.version!=='1'||typeof m.chainId!=='number')return null;
 if(m.domain!==want.host||!want.chains.includes(m.chainId))return null;
 try{if(new URL(m.uri).origin!==want.origin)return null;}catch{return null;}
 const now=Date.now();const time=(d?:Date)=>d instanceof Date&&!Number.isNaN(d.getTime())?d.getTime():null;
 const issued=time(m.issuedAt);if(issued===null||issued>now+5*60e3||now-issued>20*60e3)return null;
 if(m.expirationTime!==undefined){const t=time(m.expirationTime);if(t===null||t<now)return null;}
 if(m.notBefore!==undefined){const t=time(m.notBefore);if(t===null||t>now)return null;}
 let canonical:string;
 try{canonical=createSiweMessage({address:m.address,chainId:m.chainId,domain:m.domain,nonce:m.nonce,uri:m.uri,version:'1',statement:m.statement,issuedAt:m.issuedAt,
  expirationTime:m.expirationTime,notBefore:m.notBefore,requestId:m.requestId,resources:m.resources,scheme:m.scheme});}catch{return null;}
 if(canonical!==message)return null;
 return {address:m.address,nonce:m.nonce,chainId:m.chainId};
}
