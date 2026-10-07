/* One gate for every action that needs an account (browser only).
   - isAuthenticated(): what the app currently knows about the session.
   - requireAuth(): use at the top of an action. Signed in → true. Signed out → opens the sign-in panel, returns false.
   - guard(fn): the same, as a wrapper for an event handler.
   app/studio.tsx owns the session state: it calls setAuthenticated() whenever it changes and opens the sign-in panel
   on SIGNIN_EVENT. app/ui.tsx api() uses the gate for every write, so an action that forgets to ask is still stopped
   before the request leaves the browser; a 401 from the server (expired session) opens the panel too.
   The server never relies on this: every API verifies the session itself. */
export const SIGNIN_EVENT='harvex:signin';
let signedIn=true; // optimistic until the first workspace load answers; the server decides in the meantime

export function setAuthenticated(value:boolean){signedIn=value;}
export function isAuthenticated(){return signedIn;}
/** Opens the sign-in panel. `expired` tells the app that a session it believed in was refused by the server. */
export function openSignIn(expired=false){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(SIGNIN_EVENT,{detail:{expired}}));}
export function requireAuth(){if(signedIn)return true;openSignIn();return false;}
export function guard<A extends unknown[],R>(fn:(...args:A)=>R){return (...args:A):R|undefined=>requireAuth()?fn(...args):undefined;}
