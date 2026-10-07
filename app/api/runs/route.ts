import {z} from 'zod';
import {context,failure,body,HttpError} from '@/lib/server';
import {skillIds} from '@/lib/agents';
import {performRun} from '@/lib/runs';
import {countTeamRun} from '@/lib/teams';
import {TEAM_STEPS_MAX} from '@/lib/team-kits';
// expectedPrice: the creator price the buyer saw in Discover (lib/runs.ts refuses the run when it changed meanwhile)
const schema=z.object({id:z.string().uuid(),agentId:z.string().uuid(),prompt:z.string().trim().min(3).max(12000),skill:z.enum(skillIds),mode:z.enum(['sample','live']),expectedPrice:z.number().int().min(0).max(500).optional(),
 // a step of a team run (lib/teams.ts): the id of the team run, the step's place and the run of the step before it;
 // `team` names the saved team so its run count goes up with the first step
 relay:z.object({id:z.string().uuid(),step:z.number().int().min(1).max(TEAM_STEPS_MAX),after:z.string().uuid().optional()}).optional(),team:z.string().uuid().optional()});
export async function POST(request:Request){try{
 const {db,owner}=await context(request,true);const parsed=schema.safeParse(await body(request));if(!parsed.success)throw new HttpError(400,'Choose an agent and enter a task between 3 and 12,000 characters.');
 const {team,...data}=parsed.data;const run=await performRun(db,owner,data);
 if(team&&data.relay?.step===1)await countTeamRun(db,owner,team).catch(()=>null);
 return Response.json(run);
}catch(e){return failure(e)}}
