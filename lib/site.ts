/* Public links shown in the navbar and footer. Empty = the link is not shown: Harvex has no
   accounts yet, so nothing here may point at somebody else's profile. */
export const SOCIAL:{x:string;github:string}={
 x:'',
 github:'',
};

/* What the holder reward is planned to be paid in (user, 7 Oct 2026: "the NVDA reward"). A NAME only: no token
   address is set anywhere, so the pages use it while the server names no reward token (REWARD_TOKEN_SYMBOL wins
   once there is one). NVDA is a tokenized share from a third-party issuer; which issuer's token is not fixed. */
export const REWARD_PLAN:{symbol:string;what:string}={
 symbol:'NVDA',
 what:'a tokenized Nvidia share on BNB Smart Chain',
};
