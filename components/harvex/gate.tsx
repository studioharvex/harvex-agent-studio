'use client';
/* Which parts are closed, for the components that link to them (lib/gate.ts). The app shell provides the list the
   server rendered with, so the first paint and the browser agree. */
import {createContext,useContext,useMemo,type ReactNode} from 'react';
import {gateOf,type Section} from '@/lib/gate';
import {pathFor,type View} from '@/lib/routes';

type Gate={closed:readonly Section[];has:(s:Section)=>boolean;view:(v:View)=>boolean};
const OPEN:Gate={closed:[],has:()=>false,view:()=>false};
const Ctx=createContext<Gate>(OPEN);

export function GateProvider({closed,children}:{closed:readonly Section[];children:ReactNode}){
 const value=useMemo<Gate>(()=>closed.length?{closed,has:s=>closed.includes(s),view:v=>!!gateOf(pathFor(v,undefined,'site'),closed)}:OPEN,[closed]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useGate=()=>useContext(Ctx);

/** The small mark beside a link whose page is not open yet. */
export function Soon({className=''}:{className?:string}){
 return <span className={'shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[9px] leading-none font-semibold tracking-[.08em] text-muted-foreground uppercase '+className}>Soon</span>;
}
