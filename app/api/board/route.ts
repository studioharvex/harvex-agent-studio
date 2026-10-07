/* The weekly board (lib/board.ts). GET is public: the published agents used most in the last seven days by accounts
   other than their creators, with the totals of that week. Nothing here depends on who asks. */
import {env} from 'cloudflare:workers';
import {failure,HttpError} from '@/lib/server';
import {board} from '@/lib/board';

export async function GET(){try{
 const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw new HttpError(503,'Storage is unavailable.');
 return Response.json({board:await board(db)},{headers:{'Cache-Control':'public, max-age=120'}});
}catch(e){return failure(e)}}
