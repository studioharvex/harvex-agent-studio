import {context,failure,body,HttpError} from '@/lib/server';
import {chainConfig} from '@/lib/chain';
import {linkWallet,newNonce,unlinkWallet,userWallets} from '@/lib/wallets';
/* GET: linked wallets. POST {action:'nonce'}: one-time nonce. POST {message,signature}: link a wallet.
   DELETE {address}: unlink. Linking only needs a signature: it is free and sends no transaction. */
export async function GET(request:Request){try{const {db,owner}=await context(request);return Response.json({wallets:await userWallets(db,owner)},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const b=await body(request) as {action?:string;message?:string;signature?:string};
 if(b.action==='nonce')return Response.json({nonce:await newNonce(db,owner),chainId:chainConfig().id});
 if(typeof b.message!=='string'||typeof b.signature!=='string'||b.message.length>2000||!/^0x[0-9a-fA-F]+$/.test(b.signature))throw new HttpError(400,'Sign the link message with your wallet first.');
 const address=await linkWallet(request,db,owner,chainConfig().id,b.message,b.signature);
 return Response.json({linked:address,wallets:await userWallets(db,owner)});
}catch(e){return failure(e)}}
export async function DELETE(request:Request){try{
 const {db,owner}=await context(request,true);const b=await body(request) as {address?:string};
 if(typeof b.address!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(b.address))throw new HttpError(400,'Choose a wallet to unlink.');
 await unlinkWallet(db,owner,b.address);return Response.json({wallets:await userWallets(db,owner)});
}catch(e){return failure(e)}}
