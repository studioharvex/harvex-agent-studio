/* Networks and tokens are shown with their mark, not as bare words (user, 6 Oct 2026: "whatever is still text
   only, like BNB Smart Chain: find web3 icons for it, and the same for the others").
   - The marks are the owners' own shapes, taken from Simple Icons (the data ships inside react-icons, already a
     dependency; only these few paths are copied here, so the big icon module is never loaded). Sources and the
     trademark note: public/licenses/web3-icons.txt.
   - ONE colour, the text colour of where the mark stands, like our own logo. That is on purpose: Binance gold stays
     out of the palette (the site must not look like an official BNB product), and a mark in the text colour names
     the network without dressing the page in its brand.
   - A mark never stands alone: the name stays next to it (Named / Chain / Token), so nothing depends on knowing a
     logo. The independence note in the FAQ and whitepaper still applies. */
import type {ReactNode} from 'react';
import {cn} from '@/lib/utils';
import {LOGO_MARK} from './navbar';

const MARKS={
 /** BNB Chain: the network and its coin share this mark */
 bnb:{box:'0 0 24 24',d:'M5.631 3.676 12.001 0l6.367 3.676-2.34 1.358L12 2.716 7.972 5.034l-2.34-1.358Zm12.737 4.636-2.34-1.358L12 9.272 7.972 6.954l-2.34 1.358v2.716l4.026 2.318v4.636L12 19.341l2.341-1.359v-4.636l4.027-2.318V8.312Zm0 7.352v-2.716l-2.34 1.358v2.716l2.34-1.358Zm1.663.96-4.027 2.318v2.717l6.368-3.677V10.63l-2.34 1.358v4.636Zm-2.34-10.63 2.34 1.358v2.716l2.341-1.358V5.994l-2.34-1.358-2.342 1.358ZM9.657 19.926v2.716L12 24l2.341-1.358v-2.716l-2.34 1.358-2.343-1.358Zm-4.027-4.262 2.341 1.358v-2.716l-2.34-1.358v2.716Zm4.027-9.67L12 7.352l2.341-1.358-2.34-1.358-2.343 1.358Zm-5.69 1.358L6.31 5.994 3.968 4.636l-2.34 1.358V8.71l2.34 1.358V7.352Zm0 4.636-2.34-1.358v7.352l6.368 3.677v-2.717l-4.028-2.318v-4.636Z'},
 usdt:{box:'0 0 24 24',d:'M18.7538 10.5176c0 .6251-2.2379 1.1483-5.2381 1.2812l.0028.0007c-.0848.0064-.5233.0325-1.5012.0325-.7778 0-1.33-.0233-1.5237-.0325-3.0059-.1322-5.2495-.6555-5.2495-1.2819s2.2436-1.149 5.2495-1.2834v2.0442c.1965.0142.7594.0474 1.5372.0474.9334 0 1.4008-.0389 1.4849-.0466V9.2356c2.9994.1337 5.2381.657 5.2381 1.282zm5.19.5466L12.1248 22.389a.1803.1803 0 0 1-.2496 0L.0562 11.0635a.1781.1781 0 0 1-.0382-.2079l4.3762-9.1921a.1767.1767 0 0 1 .1626-.1026h14.8878a.1768.1768 0 0 1 .1612.1032l4.3762 9.1922a.1782.1782 0 0 1-.0382.2079zm-4.478-.4038c0-.8068-2.5515-1.4799-5.9473-1.6369V7.195h4.186V4.4055H6.3076V7.195h4.1852v1.8286c-3.4018.1562-5.9601.83-5.9601 1.6376 0 .8075 2.5583 1.4806 5.9601 1.6376v5.8618h3.025v-5.8639c3.394-.1563 5.948-.8295 5.948-1.6363z'},
 chainlink:{box:'0 0 24 24',d:'M12 0L9.798 1.266l-6 3.468L1.596 6v12l2.202 1.266 6.055 3.468L12.055 24l2.202-1.266 5.945-3.468L22.404 18V6l-2.202-1.266-6-3.468zM6 15.468V8.532l6-3.468 6 3.468v6.936l-6 3.468z'},
 walletconnect:{box:'0 0 24 24',d:'M4.913 7.519c3.915-3.831 10.26-3.831 14.174 0l.471.461a.483.483 0 0 1 0 .694l-1.611 1.577a.252.252 0 0 1-.354 0l-.649-.634c-2.73-2.673-7.157-2.673-9.887 0l-.694.68a.255.255 0 0 1-.355 0L4.397 8.719a.482.482 0 0 1 0-.693l.516-.507Zm17.506 3.263 1.434 1.404a.483.483 0 0 1 0 .694l-6.466 6.331a.508.508 0 0 1-.709 0l-4.588-4.493a.126.126 0 0 0-.178 0l-4.589 4.493a.508.508 0 0 1-.709 0L.147 12.88a.483.483 0 0 1 0-.694l1.434-1.404a.508.508 0 0 1 .709 0l4.589 4.493c.05.048.129.048.178 0l4.589-4.493a.508.508 0 0 1 .709 0l4.589 4.493c.05.048.128.048.178 0l4.589-4.493a.507.507 0 0 1 .708 0Z'},
 /** our own token: the logo's mark */
 harvex:{box:'0 0 109.26 100',d:LOGO_MARK},
} as const;
export type Web3Mark=keyof typeof MARKS;

/** The mark alone, sized by the text around it. Decorative unless `title` is given. */
export function Web3Icon({mark,title,className}:{mark:Web3Mark;title?:string;className?:string}){
 const m=MARKS[mark];
 return <svg viewBox={m.box} fill="currentColor" role={title?'img':undefined} aria-label={title} aria-hidden={title?undefined:true} className={cn('inline-block size-[1.1em] shrink-0',className)}><path d={m.d}/></svg>;
}
/** A name with its mark in front; the two never break apart. */
export function Named({mark,children,className}:{mark:Web3Mark;children:ReactNode;className?:string}){
 return <span className={cn('inline-flex items-center gap-[.38em] align-bottom whitespace-nowrap',className)}><Web3Icon mark={mark}/>{children}</span>;
}

/** Which mark a token symbol has, if any (test tokens carry a "t" in front: tUSDT, tHARVEX). */
export function tokenMark(symbol?:string|null):Web3Mark|null{
 const s=(symbol||'').toUpperCase().replace(/^T(?=USDT|HARVEX|BNB)/,'');
 return s==='USDT'?'usdt':s==='BNB'||s==='WBNB'?'bnb':s==='HARVEX'?'harvex':s==='LINK'?'chainlink':null;
}
/** The network's name with its mark. Any name that is not a BNB chain is shown as it is. */
export function Chain({name='BNB Smart Chain',className}:{name?:string;className?:string}){
 return /bnb|bsc|binance/i.test(name)?<Named mark="bnb" className={className}>{name}</Named>:<span className={className}>{name}</span>;
}
/** A token symbol with its mark (a symbol without a mark is shown as it is). */
export function Token({symbol,className}:{symbol:string;className?:string}){
 const mark=tokenMark(symbol);
 return mark?<Named mark={mark} className={className}>{symbol}</Named>:<span className={className}>{symbol}</span>;
}
