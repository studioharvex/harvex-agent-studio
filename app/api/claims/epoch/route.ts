/* Operator endpoint for claim epochs (Authorization: Bearer CLAIMS_ADMIN_TOKEN).
   build   : every claim ever queued, summed per wallet (cumulative), becomes a new merkle root. With CLAIMS_CONTRACT set
             the build is refused while the contract's token balance cannot pay every cumulative − claimed in full
             (full-or-wait: queued claims stay queued until the contract is topped up).
   publish : after the multisig calls setMerkleRoot(root) on HarvexClaims, mark the epoch live so
             creators see their proofs. When CLAIMS_CONTRACT is set the root is checked on-chain first.
   The endpoint never signs or sends a transaction. */
import {formatUnits,type Address,type Hex} from 'viem';
import {failure,body,HttpError} from '@/lib/server';
import {env} from 'cloudflare:workers';
import {adminAllowed,chainClient,chainConfig,claimsAbi,erc20Abi,readMany} from '@/lib/chain';
import {buildTree} from '@/lib/merkle';

const db=()=>{const d=(env as unknown as {DB?:D1Database}).DB;if(!d)throw new HttpError(503,'Storage is unavailable.');return d;};

export async function GET(request:Request){try{
 if(!adminAllowed(request))throw new HttpError(401,'Admin token required.');
 const r=await db().prepare('SELECT id,root,total,status,tx_hash,created FROM claim_epochs ORDER BY id DESC LIMIT 20').all();
 return Response.json({epochs:r.results});
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 if(!adminAllowed(request))throw new HttpError(401,'Admin token required.');
 const b=await body(request) as {action?:string;epoch?:number;txHash?:string};const d=db();
 if(b.action==='build'){
  const fresh=await d.prepare("SELECT COUNT(*) AS n FROM claims WHERE status='queued'").first<{n:number}>();
  if(!fresh?.n)throw new HttpError(409,'No new claims since the last epoch.');
  const c=chainConfig();
  // one contract only: `claimed()` starts at zero on another contract, so a tree built on these claims would pay
  // everything that was already paid a second time (a redeploy, or a database that ran on testnet before)
  const bound=await d.prepare('SELECT contract,chain_id FROM claim_epochs ORDER BY id DESC LIMIT 1').first<{contract:string|null;chain_id:number|null}>();
  if(bound&&c.claimsContract&&(bound.contract!==c.claimsContract||bound.chain_id!==c.id))
   throw new HttpError(409,`This database already holds claim epochs built for another contract (${bound.contract||'unknown'}, chain ${bound.chain_id??'unknown'}). CLAIMS_CONTRACT is now ${c.claimsContract}: its claimed() amounts start at zero, so continuing would pay every earlier claim a second time. Do not top it up; the cumulative amounts must be migrated first.`);
  // the claims this epoch covers are fixed here (rowid grows with every new claim): one queued while the chain is being
  // read below stays queued for the next epoch instead of being marked as included without being in the tree
  const rows=await d.prepare('SELECT rowid AS n,address,amount,credits FROM claims ORDER BY rowid').all<{n:number;address:string;amount:string;credits:number}>();
  const upTo=rows.results.length?rows.results[rows.results.length-1].n:0;
  const leaves:Record<string,bigint>={};for(const r of rows.results)leaves[r.address]=(leaves[r.address]??0n)+BigInt(r.amount);
  // money in bounds money out: every claimable credit was bought with a top-up on THIS chain. More claimed than bought
  // means credits from somewhere else (another network's database, a counting error) are about to be paid in real tokens.
  const bought=(await d.prepare('SELECT COALESCE(SUM(credits),0) AS n FROM topups WHERE chain_id=?').bind(c.id).first<{n:number}>())?.n??0;
  const asked=rows.results.reduce((a,r)=>a+Number(r.credits||0),0);
  if(asked>bought)throw new HttpError(409,`Claims add up to ${asked} credits but only ${bought} credits were ever bought on this chain (${c.name}). Nothing is built until that is explained: no claim can be worth more than what was paid in.`);
  if(c.claimsContract&&c.token){
   // full-or-wait: never publish a root the contract cannot pay in full
   const contract=c.claimsContract;const addrs=Object.keys(leaves).filter(a=>leaves[a]>0n);
   let balance:bigint,claimed:bigint[];
   // one block for every read, and Multicall3 where the chain has it (lib/chain.ts readMany)
   try{const blockNumber=await chainClient(c).getBlockNumber();
    [balance,...claimed]=await readMany(c,[{address:c.token.address,abi:erc20Abi,functionName:'balanceOf',args:[contract]},
     ...addrs.map(a=>({address:contract,abi:claimsAbi,functionName:'claimed',args:[a as Address]}))],blockNumber) as bigint[];}
   catch{throw new HttpError(503,'Could not read the claims contract on BNB Smart Chain. Try again in a minute.');}
   let owed=0n;addrs.forEach((a,i)=>{const d=leaves[a]-claimed[i];if(d>0n)owed+=d;});
   if(owed>balance){const f=(v:bigint)=>formatUnits(v,c.token!.decimals);throw new HttpError(409,`The claims contract holds ${f(balance)} ${c.token.symbol} but ${f(owed)} would be owed. Send at least ${f(owed-balance)} ${c.token.symbol} to it, then build again. Queued claims stay queued.`);}
  }
  const tree=buildTree(leaves);const total=Object.values(leaves).reduce((a,v)=>a+v,0n);
  const created=new Date().toISOString();
  // the epoch and the marking of its claims land together
  const [ins]=await d.batch([
   d.prepare('INSERT INTO claim_epochs (root,total,leaves,status,created,contract,chain_id) VALUES (?,?,?,?,?,?,?) RETURNING id').bind(tree.root,total.toString(),JSON.stringify(Object.fromEntries(Object.entries(leaves).map(([a,v])=>[a,v.toString()]))),'built',created,c.claimsContract,c.id),
   d.prepare("UPDATE claims SET status='in_root',epoch=(SELECT MAX(id) FROM claim_epochs) WHERE status='queued' AND rowid<=?").bind(upTo),
  ]);
  const epoch=(ins.results as {id:number}[])[0].id;
  return Response.json({epoch,root:tree.root,total:total.toString(),wallets:tree.leaves.length});
 }
 if(b.action==='publish'){
  const ep=await d.prepare('SELECT id,root,status FROM claim_epochs WHERE id=?').bind(Number(b.epoch)).first<{id:number;root:Hex;status:string}>();
  if(!ep)throw new HttpError(404,'Unknown epoch.');if(ep.status!=='built')throw new HttpError(409,`Epoch ${ep.id} is ${ep.status}.`);
  const newer=await d.prepare("SELECT 1 FROM claim_epochs WHERE id>? AND status='published'").bind(ep.id).first();if(newer)throw new HttpError(409,'A newer epoch is already published.');
  const c=chainConfig();
  if(c.claimsContract){
   let onchain:Hex;try{onchain=await chainClient(c).readContract({address:c.claimsContract,abi:claimsAbi,functionName:'merkleRoot'});}catch{throw new HttpError(503,'Could not read the claims contract.');}
   if(onchain.toLowerCase()!==ep.root.toLowerCase())throw new HttpError(409,'The contract root does not match this epoch yet. Post the root on-chain first.');
  }
  await d.batch([
   d.prepare("UPDATE claim_epochs SET status='published',tx_hash=? WHERE id=?").bind(typeof b.txHash==='string'?b.txHash.slice(0,80):null,ep.id),
   d.prepare("UPDATE claim_epochs SET status='superseded' WHERE id<? AND status<>'superseded'").bind(ep.id),
   d.prepare("UPDATE claims SET status='published' WHERE status='in_root' AND epoch<=?").bind(ep.id),
  ]);
  return Response.json({epoch:ep.id,status:'published'});
 }
 throw new HttpError(400,'Use action "build" or "publish".');
}catch(e){return failure(e)}}
