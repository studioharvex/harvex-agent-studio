/* Merkle tree for cumulative claims, compatible with OpenZeppelin MerkleProof.verify (sorted pairs)
   and contracts/HarvexClaims.sol:
     leaf = keccak256(bytes.concat(keccak256(abi.encode(account, cumulativeAmount))))
   Double hashing stops a 64-byte leaf from being passed off as an inner node. */
import {encodeAbiParameters,getAddress,keccak256,concat,type Address,type Hex} from 'viem';

export function leafHash(account:Address,cumulative:bigint):Hex{
 return keccak256(keccak256(encodeAbiParameters([{type:'address'},{type:'uint256'}],[getAddress(account),cumulative])));
}
const pair=(a:Hex,b:Hex):Hex=>BigInt(a)<BigInt(b)?keccak256(concat([a,b])):keccak256(concat([b,a]));

/** Builds the tree for `{address: cumulativeAmount}`. Leaves are sorted so the root is deterministic. */
export function buildTree(entries:Record<string,bigint>){
 const leaves=Object.entries(entries).filter(([,v])=>v>0n).map(([a,v])=>({account:getAddress(a),amount:v,hash:leafHash(a as Address,v)}))
  .sort((x,y)=>BigInt(x.hash)<BigInt(y.hash)?-1:1);
 const levels:Hex[][]=[leaves.map(l=>l.hash)];
 while(levels[levels.length-1].length>1){const cur=levels[levels.length-1];const next:Hex[]=[];for(let i=0;i<cur.length;i+=2)next.push(i+1<cur.length?pair(cur[i],cur[i+1]):cur[i]);levels.push(next);}
 const root:Hex=levels[levels.length-1][0]??('0x'+'0'.repeat(64) as Hex);
 const proof=(account:string):Hex[]|null=>{
  let idx=leaves.findIndex(l=>l.account===getAddress(account));if(idx<0)return null;const out:Hex[]=[];
  for(let d=0;d<levels.length-1;d++){const sib=idx^1;if(sib<levels[d].length)out.push(levels[d][sib]);idx>>=1;}
  return out;
 };
 return {root,leaves,proof};
}

export function verifyProof(root:Hex,account:Address,cumulative:bigint,proof:Hex[]){
 let h=leafHash(account,cumulative);for(const p of proof)h=pair(h,p);return h===root;
}
