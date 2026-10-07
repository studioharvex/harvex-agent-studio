/* Agent teams (lib/teams.ts). GET: the limits, what a step costs here and whether the HARVEX token is set; with a session also the account's saved
   teams. POST {name, steps, id?} saves a team (with `id`: changes it). DELETE {id} removes one. Running a team is not
   done here: the page runs the steps one after another through POST /api/runs with `relay`. */
import {context,failure,body,HttpError} from '@/lib/server';
import {deleteTeam,listTeams,saveTeam,teamCosts,teamLimits} from '@/lib/teams';
import {chainConfig} from '@/lib/chain';

// `token`: the HARVEX token is set here, so the kits that read it are offered
const base=()=>({limits:teamLimits(),costs:teamCosts(),token:!!chainConfig().harvex});
const noStore={headers:{'Cache-Control':'no-store'}};

export async function GET(request:Request){try{
 let db:D1Database|undefined,owner:string|undefined;
 try{const ctx=await context(request);db=ctx.db;owner=ctx.owner;}catch(e){if(!(e instanceof HttpError)||e.status!==401)throw e;}
 return Response.json({signedIn:!!owner,...base(),teams:db&&owner?await listTeams(db,owner):[]},noStore);
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);
 const id=await saveTeam(db,owner,await body(request) as {id?:unknown;name?:unknown;steps?:unknown});
 return Response.json({id,signedIn:true,...base(),teams:await listTeams(db,owner)},noStore);
}catch(e){return failure(e)}}

export async function DELETE(request:Request){try{
 const {db,owner}=await context(request,true);const {id}=await body(request) as {id?:unknown};
 await deleteTeam(db,owner,id);
 return Response.json({signedIn:true,...base(),teams:await listTeams(db,owner)},noStore);
}catch(e){return failure(e)}}
