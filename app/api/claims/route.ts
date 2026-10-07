/* Earnings claims. Creators move EARNED credits (never starting grants or top-ups) into a claim for
   one of their linked wallets. Only earnings paid for with BOUGHT credits count (earned_paid, drizzle/0014): what
   was earned from free credits stays spendable in the studio but never becomes USDT. Claims are grouped into
   merkle epochs by the operator
   (/api/claims/epoch); once the multisig posts an epoch root to the HarvexClaims contract, the creator
   claims on-chain with the proof below and pays their own gas. The server never holds a payout key. */
import {getAddress,type Address,type Hex} from 'viem';
import {context,failure,body,HttpError} from '@/lib/server';
import {chainClient,chainConfig,claimsAbi,rawFor} from '@/lib/chain';
import {buildTree} from '@/lib/merkle';
import {ensureWallet} from '@/lib/economy';
import {userWallets} from '@/lib/wallets';

async function claimable(db:D1Database,owner:string){
 const w=await db.prepare('SELECT balance,earned,paid,earned_paid FROM preview_wallets WHERE owner=?').bind(owner).first<{balance:number;earned:number;paid:number;earned_paid:number}>();
 const q=await db.prepare('SELECT COALESCE(SUM(credits),0) AS c FROM claims WHERE owner=?').bind(owner).first<{c:number}>();
 const open=Math.max((w?.earned_paid??0)-(q?.c??0),0);
 return {balance:w?.balance??0,earned:w?.earned??0,earnedFree:Math.max((w?.earned??0)-(w?.earned_paid??0),0),claimed:q?.c??0,claimable:Math.max(0,Math.min(open,w?.paid??0,w?.balance??0))};
}

export async function GET(request:Request){try{
 const {db,owner}=await context(request);const c=chainConfig();await ensureWallet(db,owner);
 const [sums,wallets,reqs,epoch]=await Promise.all([claimable(db,owner),userWallets(db,owner),
  db.prepare('SELECT id,address,credits,amount,status,epoch,created FROM claims WHERE owner=? ORDER BY created DESC LIMIT 50').bind(owner).all(),
  db.prepare("SELECT id,root,leaves,tx_hash FROM claim_epochs WHERE status='published' ORDER BY id DESC LIMIT 1").first<{id:number;root:Hex;leaves:string;tx_hash:string|null}>()]);
 let proofs:{address:Address;cumulative:string;proof:Hex[];claimedOnchain:string|null}[]=[];
 if(epoch){
  const leaves=Object.fromEntries(Object.entries(JSON.parse(epoch.leaves) as Record<string,string>).map(([a,v])=>[a,BigInt(v)]));const tree=buildTree(leaves);
  const client=c.claimsContract?chainClient(c):null;
  proofs=await Promise.all(wallets.filter(a=>leaves[a]!==undefined).map(async a=>{
   let claimedOnchain:string|null=null;
   if(client&&c.claimsContract)try{claimedOnchain=(await client.readContract({address:c.claimsContract,abi:claimsAbi,functionName:'claimed',args:[a]})).toString();}catch{claimedOnchain=null;}
   return {address:a,cumulative:leaves[a].toString(),proof:tree.proof(a)!,claimedOnchain};
  }));
 }
 return Response.json({enabled:c.claimsEnabled,contract:c.claimsContract,token:c.token,creditsPerToken:c.creditsPerToken,min:c.claimMin,...sums,wallets,
  requests:reqs.results,epoch:epoch?{id:epoch.id,root:epoch.root,txHash:epoch.tx_hash}:null,proofs},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const c=chainConfig();
 if(!c.claimsEnabled||!c.token)throw new HttpError(503,'Earnings claims are not switched on yet.');
 const b=await body(request) as {credits?:number;address?:string};
 const credits=Number(b.credits);if(!Number.isInteger(credits)||credits<c.claimMin)throw new HttpError(400,`Claim at least ${c.claimMin} earned credits.`);
 if(typeof b.address!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(b.address))throw new HttpError(400,'Choose the wallet to be paid.');
 const address=getAddress(b.address);
 if(!(await userWallets(db,owner)).includes(address))throw new HttpError(403,'Claims can only be paid to a wallet linked to your account.');
 const sums=await claimable(db,owner);if(credits>sums.claimable)throw new HttpError(402,`You can claim up to ${sums.claimable} earned credits right now.`);
 const amount=rawFor(credits,c);if(amount<=0n)throw new HttpError(400,'That claim is too small.');
 const id=crypto.randomUUID(),created=new Date().toISOString();
 try{await db.batch([
  // every check is repeated inside the transaction so parallel claims or runs cannot overdraw: claimable earnings,
  // bought (paid) credits and the balance itself
  db.prepare('INSERT INTO claims (id,owner,address,credits,amount,status,created) SELECT ?,?,?,?,?,?,? WHERE (SELECT earned_paid FROM preview_wallets WHERE owner=?)-(SELECT COALESCE(SUM(credits),0) FROM claims WHERE owner=?)>=? AND (SELECT MIN(paid,balance) FROM preview_wallets WHERE owner=?)>=?').bind(id,owner,address,credits,amount.toString(),'queued',created,owner,owner,credits,owner,credits),
  db.prepare('UPDATE preview_wallets SET balance=balance-?,paid=paid-? WHERE owner=? AND EXISTS (SELECT 1 FROM claims WHERE id=?)').bind(credits,credits,owner,id),
  db.prepare('INSERT INTO credit_ledger (id,owner,delta,kind,ref,note,created) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM claims WHERE id=?)').bind(crypto.randomUUID(),owner,-credits,'claim',id,`Claim queued → ${address.slice(0,6)}…${address.slice(-4)}`,created,id),
 ]);}catch{throw new HttpError(409,'Your balance changed. Refresh and try again.');}
 if(!(await db.prepare('SELECT 1 FROM claims WHERE id=?').bind(id).first()))throw new HttpError(409,'Your earned credits changed. Refresh and try again.');
 return Response.json({id,credits,amount:amount.toString(),status:'queued',...await claimable(db,owner)});
}catch(e){return failure(e)}}
