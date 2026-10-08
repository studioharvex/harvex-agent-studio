/* Public links shown in the navbar and footer. Empty = the link is not shown: Harvex has no
   accounts yet, so nothing here may point at somebody else's profile. */
export const SOCIAL:{x:string;github:string}={
 x:'',
 github:'',
};

/* What the holder reward is planned to be paid in (user, 7 Oct 2026: "the NVDA reward"). A NAME only: no token
   address is set anywhere, so the pages use it while the server names no reward token (REWARD_TOKEN_SYMBOL wins
   once there is one). NVDA is a tokenized share from a third-party issuer: the plan names NVDAB, one of Binance's bStocks (token / issuer / family below). */
export const REWARD_PLAN:{symbol:string;what:string;token:string;issuer:string;family:string;apart:string}={
 symbol:'NVDA',
 what:'a tokenized Nvidia share on BNB Smart Chain',
 // which one (user, 8 Oct 2026: "NVDAB, the one backed by Binance"; the day before the plan named Ondo's NVDAon, until
 // NVDAB turned out to have the larger supply on BNB Smart Chain). A plan and a name: its address goes into the
 // server's settings. `apart` = who the pages say Harvex has nothing to do with.
 token:'NVDAB',
 issuer:'BTECH Holdings Ltd',
 family:'Binance bStocks',
 apart:'Nvidia, Binance or BTECH Holdings Ltd',
};
