/* Wallets linked to an account. Better Auth's SIWE plugin creates the first wallet when someone signs
   in with a wallet; /api/wallet lets a signed-in user (email or wallet) link more by signing a
   Sign-In with Ethereum message for BNB Smart Chain. Linked wallets are what top-ups must come from,
   where claims are paid to and whose HARVEX balance sets the holder tier. */
import {getAddress,verifyMessage,type Address} from 'viem';
import {appOrigin,HttpError} from './server';
import {WALLET_EMAIL_DOMAIN} from './auth';
import {strictSiwe} from './siwe';

/** Wallets per account. Every linked wallet costs a chain read on each tier or reward check. */
export const MAX_WALLETS=10;

export async function userWallets(db:D1Database,owner:string):Promise<Address[]>{
 const r=await db.prepare('SELECT address FROM ba_wallet_address WHERE user_id=? ORDER BY is_primary DESC,created_at ASC').bind(owner).all<{address:string}>();
 return [...new Set(r.results.map(x=>getAddress(x.address)))];
}

export async function newNonce(db:D1Database,owner:string){
 const nonce=[...crypto.getRandomValues(new Uint8Array(12))].map(b=>b.toString(36).padStart(2,'0')).join('').slice(0,20);
 await db.prepare('DELETE FROM chain_nonces WHERE expires<?').bind(Date.now()).run();
 await db.prepare('INSERT INTO chain_nonces (nonce,owner,expires,used) VALUES (?,?,?,0)').bind(nonce,owner,Date.now()+10*60e3).run();
 return nonce;
}

function appHost(req:Request){return new URL(appOrigin(req)).host;}

/** Verifies a SIWE message signed for this site, this user's nonce and the configured chain, then links it. */
export async function linkWallet(req:Request,db:D1Database,owner:string,chainId:number,message:string,signature:string){
 // a well-formed, fresh EIP-4361 message for this site and the configured chain (lib/siwe.ts explains why it is strict)
 const m=strictSiwe(message,{host:appHost(req),origin:appOrigin(req),chains:[chainId]});
 if(!m)throw new HttpError(401,`That link message is not valid for this site. Sign the message Harvex shows, on BNB Smart Chain (chain ${chainId}), and try again.`);
 const used=await db.prepare('UPDATE chain_nonces SET used=1 WHERE nonce=? AND owner=? AND used=0 AND expires>?').bind(m.nonce,owner,Date.now()).run();
 if(!used.meta.changes)throw new HttpError(401,'This link request expired or was already used. Try again.');
 const address=getAddress(m.address);
 let ok=false;try{ok=await verifyMessage({address,message,signature:signature as `0x${string}`});}catch{ok=false;}
 if(!ok)throw new HttpError(401,'The signature does not match that wallet.');
 const other=await db.prepare('SELECT user_id FROM ba_wallet_address WHERE lower(address)=lower(?) AND user_id<>? LIMIT 1').bind(address,owner).first();
 if(other)throw new HttpError(409,'This wallet is already linked to another Harvex account.');
 const mine=await db.prepare('SELECT id FROM ba_wallet_address WHERE lower(address)=lower(?) AND user_id=? LIMIT 1').bind(address,owner).first();
 if(!mine){
  const now=Date.now();const id=crypto.randomUUID();
  // ONE statement decides: the wallet is inserted only while no account has it and this account is under the limit, so
  // two requests at the same moment can never both link it (the table has no UNIQUE index on the address)
  const [ins]=await db.batch([
   db.prepare(`INSERT INTO ba_wallet_address (id,user_id,address,chain_id,is_primary,created_at) SELECT ?,?,?,?,CASE WHEN EXISTS (SELECT 1 FROM ba_wallet_address WHERE user_id=?) THEN 0 ELSE 1 END,?
    WHERE NOT EXISTS (SELECT 1 FROM ba_wallet_address WHERE lower(address)=lower(?)) AND (SELECT COUNT(*) FROM ba_wallet_address WHERE user_id=?)<?`).bind(id,owner,address,chainId,owner,now,address,owner,MAX_WALLETS),
   db.prepare('INSERT INTO ba_account (id,account_id,provider_id,user_id,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM ba_wallet_address WHERE id=?)').bind(crypto.randomUUID(),`${address}:${chainId}`,'siwe',owner,now,now,id),
  ]);
  if(!ins.meta.changes){
   const count=(await db.prepare('SELECT COUNT(*) AS n FROM ba_wallet_address WHERE user_id=?').bind(owner).first<{n:number}>())?.n??0;
   throw new HttpError(409,count>=MAX_WALLETS?`An account can link up to ${MAX_WALLETS} wallets. Unlink one first.`:'This wallet is already linked to another Harvex account.');
  }
 }
 return address;
}

/** Unlinks a wallet. The wallet a wallet-only account signs in with cannot be removed. */
export async function unlinkWallet(db:D1Database,owner:string,address:string){
 const a=getAddress(address);
 const u=await db.prepare('SELECT email FROM ba_user WHERE id=?').bind(owner).first<{email:string}>();
 if(u?.email.toLowerCase()===`${a}@${WALLET_EMAIL_DOMAIN}`.toLowerCase())throw new HttpError(409,'This is the wallet you sign in with, so it stays linked.');
 const r=await db.prepare('DELETE FROM ba_wallet_address WHERE user_id=? AND lower(address)=lower(?)').bind(owner,a).run();
 if(!r.meta.changes)throw new HttpError(404,'That wallet is not linked to your account.');
 await db.batch([
  db.prepare("DELETE FROM ba_account WHERE user_id=? AND provider_id='siwe' AND lower(account_id) LIKE lower(?)").bind(owner,a+':%'),
  // the holder tier was read with this wallet's balance: it is read again instead of being kept for a day (the same
  // HARVEX moved to the next account must not give both the fee discount)
  db.prepare('DELETE FROM tier_cache WHERE owner=?').bind(owner),
 ]);
}
