'use client';
/* The HARVEX token as the server knows it (HARVEX_TOKEN_ADDRESS on BNB Smart Chain mainnet), handed down from the root
   layout so the address is already in the first HTML. Every place that talks about the token reads this instead of a
   hard-coded address or a hard-coded "not live", so adding the token is a server setting and nothing else.
   A testnet build never shows a contract address and never says whether the real token exists: it cannot know. */
import {createContext,useContext,type ReactNode} from 'react';

export type HarvexToken={address:string;explorer:string;rewardsLive:boolean};
/** 'test': testnet build. 'none': mainnet, no contract yet. 'token': the token, rewards off. 'rewards': both. */
export type TokenStage='test'|'none'|'token'|'rewards';
type TokenInfo={token:HarvexToken|null;test:boolean};
const TokenContext=createContext<TokenInfo>({token:null,test:false});
export function TokenProvider({token,test,children}:TokenInfo&{children:ReactNode}){return <TokenContext.Provider value={{token,test}}>{children}</TokenContext.Provider>;}
/** The live HARVEX token, or null while there is none (always null on a testnet build). */
export const useHarvexToken=()=>useContext(TokenContext).token;
export function useTokenStage():TokenStage{const {token,test}=useContext(TokenContext);return test?'test':!token?'none':token.rewardsLive?'rewards':'token';}
/** One sentence on the token and holder rewards that is true for the state the server reports. */
export const TOKEN_LINE:Record<TokenStage,string>={
 test:'You are on a testnet build. No real HARVEX token and no real reward exists here.',
 none:'There is no HARVEX token yet, and no holder reward is running.',
 token:'HARVEX exists as a token. The holder reward has not been turned on.',
 rewards:'HARVEX exists and the holder reward is running. The Rewards page lists what has been paid.',
};
