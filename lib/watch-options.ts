/* Report only on change: the part without server imports (lib/watch.ts does the looking; the page and the recipes read
   this file). */
/** Skills a schedule can watch with: the two that read something to compare. */
export const WATCH_SKILLS=['monitor','whales'] as const;
/** Whale watch: the smallest transfer that counts as a change, in whole HARVEX: the default and the choices offered. */
export const WATCH_MIN_DEFAULT=1_000_000;
export const WATCH_MIN_OPTIONS=[100_000,250_000,1_000_000,5_000_000,10_000_000] as const;
export const canWatch=(skill:string)=>(WATCH_SKILLS as readonly string[]).includes(skill);
export const watchMin=(v:number|null|undefined)=>(WATCH_MIN_OPTIONS as readonly number[]).includes(Number(v))?Number(v):WATCH_MIN_DEFAULT;
/** 1000000 → "1M", 250000 → "250K". */
export const watchLabel=(n:number)=>n>=1e6?`${n/1e6}M`:`${n/1e3}K`;
/** What a watching schedule waits for, in one line. */
export const watchText=(skill:string,min?:number|null)=>skill==='whales'?`a transfer of ${watchLabel(watchMin(min))} HARVEX or more, or a new address among the ten biggest holders`:'a balance that changed, or a transaction the wallet sent';
