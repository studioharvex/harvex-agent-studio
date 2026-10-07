/* Next.js 16 proxy (formerly middleware). Runs before every page and API route:
   1. Signed-in-only dashboard pages (lib/routes.ts PROTECTED_PATHS) redirect to /login?next=... when there is
      no session cookie. This is an optimistic gate for pages; every API still verifies the session itself.
   1b. Parts that are not open yet (CLOSED_SECTIONS, lib/gate.ts): their API routes answer 403 here, and their pages
      go through without the sign-in redirect so that the app shell can draw its "not open yet" page.
   2. Request bodies are always drained (see proxy()) so an unread body can never stall later requests.
   3. Security headers on every response: HSTS (https only), CSP (production), frame blocking (except the
      agent embed view), nosniff, strict referrer, locked-down permissions, COOP. */
import {NextResponse,type NextRequest} from 'next/server';
import {isProtectedPath} from './lib/routes';
import {CLOSED_ERROR,gateOf,gateOfApi} from './lib/gate';
import {closedNow} from './lib/gate-server';

const SESSION_COOKIES=['__Secure-harvex.session_token','harvex.session_token'];
const PROD=process.env.NODE_ENV==='production';

function csp(embed:boolean,https:boolean){
 return ["default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'","base-uri 'self'","form-action 'self'",
  `frame-ancestors ${embed?'*':"'none'"}`,
  ...(https?['upgrade-insecure-requests']:[])].join('; ');
}

// The only page other sites may frame: the Studio's character preview (the share dialog's embed code). Every other
// page, with or without ?view=embed, refuses framing.
const EMBED_PATH='/dashboard/studio';
function secure(res:NextResponse,req:NextRequest){
 const embed=req.nextUrl.searchParams.get('view')==='embed'&&(req.nextUrl.pathname.replace(/\/+$/,'')||'/')===EMBED_PATH;
 const h=res.headers;
 h.set('X-Content-Type-Options','nosniff');
 h.set('Referrer-Policy','strict-origin-when-cross-origin');
 h.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
 h.set('Cross-Origin-Opener-Policy','same-origin-allow-popups');
 if(!embed)h.set('X-Frame-Options','DENY');
 const https=req.nextUrl.protocol==='https:'||req.headers.get('x-forwarded-proto')==='https';
 if(https)h.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');
 if(PROD)h.set('Content-Security-Policy',csp(embed,https));
 return res;
}

const STATIC_FILE=/\.(?:webp|png|jpe?g|svg|ico|woff2?|txt|js|css|map|glb)$/i;
const MAX_BODY=1_000_000;

export async function proxy(req:NextRequest){
 const {pathname,search}=req.nextUrl;
 // The local runtime stalls the next request when a handler answers without reading the request body (404s,
 // early 401/403s). Reading a clone drains the connection while the handler keeps its own buffered copy.
 if(req.method!=='GET'&&req.method!=='HEAD'&&req.body){
  if(Number(req.headers.get('content-length')||0)>MAX_BODY)return secure(NextResponse.json({error:'Request too large.'},{status:413}),req);
  // a body without a Content-Length (chunked) is counted while it is drained, and refused once it passes the limit
  try{const reader=req.clone().body?.getReader();let size=0;
   while(reader){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>MAX_BODY){await reader.cancel().catch(()=>null);return secure(NextResponse.json({error:'Request too large.'},{status:413}),req);}}
  }catch{/* body already read */}
 }
 // a path that merely looks like a file (/docs/x.css is a page, not an asset) still gets every security header
 if(STATIC_FILE.test(pathname))return secure(NextResponse.next(),req);
 // parts that are not open yet: refuse their API routes; let their pages through for the "not open yet" page
 const closed=closedNow();
 if(closed.length){
  const none={'Cache-Control':'no-store'};
  if(pathname.startsWith('/api/')){
   // with sign-in closed nobody is signed in here, whatever cookie an earlier visit left behind
   if(closed.includes('signin')&&pathname.replace(/\/+$/,'')==='/api/auth/me')return secure(NextResponse.json({signedIn:false},{headers:none}),req);
   const part=gateOfApi(pathname,closed);
   if(part)return secure(NextResponse.json({error:CLOSED_ERROR,closed:part},{status:403,headers:none}),req);
  }else if(gateOf(pathname,closed)){
   const res=NextResponse.next();res.headers.set('X-Robots-Tag','noindex');res.headers.set('Cache-Control','no-store');
   return secure(res,req);
  }
 }
 if(isProtectedPath(pathname)&&!SESSION_COOKIES.some(n=>(req.cookies.get(n)?.value||'').length>=20)){
  const url=req.nextUrl.clone();url.pathname='/login';url.search=`?next=${encodeURIComponent(pathname+search)}`;
  return secure(NextResponse.redirect(url),req);
 }
 return secure(NextResponse.next(),req);
}

export const config={
 // everything except build assets and character images; other static files are skipped inside proxy()
 matcher:['/((?!_next/static|_next/image|characters/|favicon).*)'],
};
