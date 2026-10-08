/* Public links shown in the navbar and footer. Empty = the link is not shown: Harvex has no
   accounts yet, so nothing here may point at somebody else's profile. */
export const SOCIAL:{x:string;github:string}={
 x:'',
 github:'',
};

/* What the holder reward is planned to be paid in (user, 7 Oct 2026: "the NVDA reward"). A NAME only: no token
   address is set anywhere, so the pages use it while the server names no reward token (REWARD_TOKEN_SYMBOL wins
   once there is one). NVDA is a tokenized share from a third-party issuer: the plan names NVDAon by Ondo Global Markets (token / issuer below). */
export const REWARD_PLAN:{symbol:string;what:string;token:string;issuer:string}={
 symbol:'NVDA',
 what:'a tokenized Nvidia share on BNB Smart Chain',
 // which one (user, 7 Oct 2026: "the NVDA with the largest market cap"): of the two tokenized NVDA on BNB Smart Chain,
 // NVDAon had the larger supply there that day. A plan and a name: its address goes into the server's settings.
 token:'NVDAon',
 issuer:'Ondo Global Markets',
};
