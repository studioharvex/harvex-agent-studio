'use client';
/* Shared UI helpers for the Harvex studio: API client, icons, and thin wrappers over shadcn/ui
   (Dialog, ToggleGroup, Empty) so every view uses the same components. */
import type {ReactNode} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {Empty as EmptyRoot,EmptyContent,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Label} from '@/components/ui/label';
import {cn} from '@/lib/utils';
import {splitSearchWidget} from '@/lib/grounding';
import {openSignIn,requireAuth} from '@/lib/auth-gate';

/** API client. Every write (anything but GET) goes through the account gate (lib/auth-gate.ts): signed out, the
    request is not sent and the sign-in panel opens; a 401 on a write (expired session) opens it too. Reads are never
    blocked here: signed-out pages load public data, and a 401 on the first workspace read is the normal answer. */
export async function api(path:string,options:RequestInit={}):Promise<any>{
 const write=(options.method||'GET').toUpperCase()!=='GET'&&!path.startsWith('/api/auth/');
 if(write&&!requireAuth())throw Object.assign(new Error('Connect a wallet to continue.'),{status:401,signIn:true});
 const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});const data=await response.json().catch(()=>({})) as any;
 if(!response.ok){if(write&&response.status===401)openSignIn(true);throw Object.assign(new Error(data.error||'Something went wrong.'),{status:response.status});}
 return data;}
/** Saves text as a file. The link is attached while it is clicked and the blob kept for a minute: Safari and older
    Firefox ignore detached links or lose a blob that is revoked too early. */
export function download(name:string,text:string,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function copyText(text:string,ok:(m:string)=>void,fail:(m:string)=>void){try{await navigator.clipboard.writeText(text);ok('Copied to clipboard');}catch{fail('Clipboard unavailable. Select the text and copy it.');}}

export function Modal({open,onClose,title,description,narrow,children}:{open:boolean;onClose:()=>void;title:string;description?:ReactNode;narrow?:boolean;children:ReactNode}){
 return <Dialog open={open} onOpenChange={o=>{if(!o)onClose();}}>
  <DialogContent className={cn('max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto p-6',narrow?'sm:max-w-md':'sm:max-w-2xl')}>
   <DialogHeader className="text-left"><DialogTitle className="font-display text-xl font-medium tracking-[-.02em]">{title}</DialogTitle>{description?<DialogDescription>{description}</DialogDescription>:<DialogDescription className="sr-only">{title}</DialogDescription>}</DialogHeader>
   {children}
  </DialogContent>
 </Dialog>;
}
export function FieldLabel({children,htmlFor}:{children:ReactNode;htmlFor?:string}){return <Label htmlFor={htmlFor} className="text-[13px] font-medium text-muted-foreground">{children}</Label>;}
export function Options({label,value,options,onChange}:{label?:string;value:string;options:readonly (readonly [string,string])[];onChange:(v:string)=>void}){
 return <div className="grid gap-2">{label&&<FieldLabel>{label}</FieldLabel>}
  <ToggleGroup type="single" spacing={1.5} value={value} onValueChange={v=>{if(v)onChange(v);}} className="flex w-full flex-wrap justify-start" aria-label={label}>
   {options.map(([v,l])=><ToggleGroupItem key={v} value={v} className="h-8 flex-none border bg-card px-3 text-[13px] font-medium data-[state=on]:border-lime data-[state=on]:bg-lime data-[state=on]:text-ink">{l}</ToggleGroupItem>)}
  </ToggleGroup></div>;
}
/* The selected swatch is marked INSIDE its own box (a dark line, then a gap in the page colour): a ring drawn outside
   the box was cut off by the collapsible panel around it, and so was the hover zoom. */
export function Swatches({label,value,colors,onChange}:{label:string;value:string;colors:readonly string[];onChange:(v:string)=>void}){
 const v=(value||'').toLowerCase();
 return <div className="grid gap-2"><FieldLabel>{label}</FieldLabel><div className="flex flex-wrap items-center gap-1.5">
  {colors.map(c=><button type="button" key={c} style={{background:c}} aria-label={c} aria-pressed={c.toLowerCase()===v} onClick={()=>onChange(c)} className="size-7 rounded-lg border border-foreground/15 transition-[box-shadow,border-color] hover:border-foreground/50 aria-pressed:border-transparent aria-pressed:shadow-[inset_0_0_0_2px_var(--text),inset_0_0_0_4px_var(--bg)]"/>)}
  <label title="Custom color" className="relative grid size-7 cursor-pointer place-items-center overflow-hidden rounded-md border border-dashed text-sm text-muted-foreground">+<input type="color" value={/^#[0-9a-f]{6}$/i.test(value)?value:'#ffe600'} onChange={e=>onChange(e.target.value)} aria-label="Custom color" className="absolute inset-0 cursor-pointer opacity-0"/></label>
 </div></div>;
}
export function Empty({title,text,action}:{title:string;text:string;action?:ReactNode}){
 return <EmptyRoot className="rounded-2xl border border-dashed py-12"><EmptyHeader><EmptyTitle className="font-display text-lg font-medium">{title}</EmptyTitle><EmptyDescription>{text}</EmptyDescription></EmptyHeader>{action&&<EmptyContent>{action}</EmptyContent>}</EmptyRoot>;
}
export function PageHead({title,text,action,eyebrow}:{title:string;text?:string;action?:ReactNode;eyebrow?:string}){
 return <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
  <div className="grid gap-2">{eyebrow&&<span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.1em] uppercase before:h-2 before:w-3 before:rounded-[2px] before:bg-iris">{eyebrow}</span>}<h1 className="font-display text-[clamp(30px,3.8vw,46px)] leading-[1.02] font-light tracking-[-.035em]">{title}</h1>{text&&<p className="max-w-[62ch] text-[15px] text-muted-foreground">{text}</p>}</div>{action}
 </div>;
}
/* Run output. AI answers are Markdown, so a small subset is rendered as React elements (never as HTML):
   headings, lists, tables, code blocks, quotes, rules, **bold**, *italic*, `code`, [links](https://…) and bare URLs.
   Only http(s) links become anchors. Styles: `.md` in globals.css. */
const LINK_CLASS='break-all text-brand underline-offset-4 hover:underline';
function mdInline(s:string,key=0):ReactNode[]{
 const out:ReactNode[]=[];const re=/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s\]<>)]+)/g;let last=0,m:RegExpExecArray|null,k=key;
 while((m=re.exec(s))){if(m.index>last)out.push(s.slice(last,m.index));const t=m[0];
  if(t.startsWith('`'))out.push(<code key={k++}>{t.slice(1,-1)}</code>);
  else if(t.startsWith('**'))out.push(<strong key={k++}>{mdInline(t.slice(2,-2),k*100)}</strong>);
  else if(t.startsWith('*'))out.push(<em key={k++}>{t.slice(1,-1)}</em>);
  else if(t.startsWith('[')){const mm=t.match(/^\[([^\]]+)\]\((.+)\)$/)!;out.push(<a key={k++} href={mm[2]} target="_blank" rel="noreferrer noopener" className={LINK_CLASS}>{mm[1]}</a>);}
  else out.push(<a key={k++} href={t} target="_blank" rel="noreferrer noopener" className={LINK_CLASS}>{t}</a>);
  last=m.index+t.length;}
 if(last<s.length)out.push(s.slice(last));return out;
}
const mdCells=(r:string)=>r.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
/** Google's Search Suggestions widget for a Gemini answer grounded with Google Search (lib/grounding.ts). Google's
    HTML is shown unmodified in a sandboxed iframe: no scripts, no access to this page, links open in a new tab. */
function SearchSuggestions({html}:{html:string}){
 const doc=`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;background:transparent}</style></head><body>${html}</body></html>`;
 return <iframe title="Google Search Suggestions" srcDoc={doc} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" className="mt-3 block h-[72px] w-full rounded-md border-0 bg-transparent"/>;
}
/** A run output as text for copy and download (without the Search Suggestions widget marker). */
export const outputText=(output:string)=>splitSearchWidget(String(output||'')).text;
export function TextOut({text:raw}:{text:string}){
 const {text,widget}=splitSearchWidget(String(raw||''));
 const lines=text.replace(/\r/g,'').split('\n');const nodes:ReactNode[]=[];let k=0;
 let para:string[]=[],list:{ol:boolean;items:string[]}|null=null,code:string[]|null=null,table:string[]|null=null;
 const flush=()=>{
  if(para.length){nodes.push(<p key={k++}>{para.map((l,i)=><span key={i}>{i>0&&<br/>}{mdInline(l)}</span>)}</p>);para=[];}
  if(list){const items=list.items.map((t,i)=><li key={i}>{mdInline(t)}</li>);nodes.push(list.ol?<ol key={k++}>{items}</ol>:<ul key={k++}>{items}</ul>);list=null;}
  if(table){const rows=table.filter(r=>!/^\|?\s*:?-{3,}/.test(r.trim())).map(mdCells);const [h,...rest]=rows;
   // a "table" that is only separator rows (|---|) has no header: show the lines as text instead of failing to render
   if(h)nodes.push(<table key={k++}><thead><tr>{h.map((c,i)=><th key={i}>{mdInline(c)}</th>)}</tr></thead><tbody>{rest.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{mdInline(c)}</td>)}</tr>)}</tbody></table>);
   else nodes.push(<p key={k++}>{table.join(' ')}</p>);
   table=null;}
 };
 for(const ln of lines){
  if(code){if(/^\s*```/.test(ln)){nodes.push(<pre key={k++}><code>{code.join('\n')}</code></pre>);code=null;}else code.push(ln);continue;}
  if(/^\s*```/.test(ln)){flush();code=[];continue;}
  if(/^\s*\|.*\|\s*$/.test(ln)){if(!table){flush();table=[];}table.push(ln);continue;}else if(table)flush();
  let m:RegExpMatchArray|null;
  if((m=ln.match(/^\s{0,3}(#{1,6})\s+(.*)/))){flush();const H=(m[1].length<=2?'h3':'h4') as 'h3'|'h4';nodes.push(<H key={k++}>{mdInline(m[2].replace(/\s#+\s*$/,''))}</H>);continue;}
  if(/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(ln)){flush();nodes.push(<hr key={k++} className="my-3 border-border"/>);continue;}
  if((m=ln.match(/^\s*[-*•]\s+(.*)/))){if(para.length||(list&&list.ol))flush();(list||(list={ol:false,items:[]})).items.push(m[1]);continue;}
  if((m=ln.match(/^\s*\d+[.)]\s+(.*)/))){if(para.length||(list&&!list.ol))flush();(list||(list={ol:true,items:[]})).items.push(m[1]);continue;}
  if((m=ln.match(/^\s*>\s?(.*)/))){flush();nodes.push(<blockquote key={k++}>{mdInline(m[1])}</blockquote>);continue;}
  if(!ln.trim()){flush();continue;}
  if(list)flush();para.push(ln);
 }
 if(code)nodes.push(<pre key={k++}><code>{(code as string[]).join('\n')}</code></pre>);
 flush();
 return <div className="md text-sm leading-relaxed break-words">{nodes}{widget&&<SearchSuggestions html={widget}/>}</div>;
}
export const SKILL_ICON:Record<string,string>={Globe:'globe',PenLine:'pen',FileText:'doc',AlignLeft:'sum',Languages:'lang',Lightbulb:'bulb',Code2:'code',ListChecks:'list',Activity:'wallet',Radar:'scan',Clock3:'cal'};
export function I({id,className='i'}:{id:string;className?:string}){return <svg className={className}><use href={`#i-${id}`}/></svg>;}
export function IconDefs(){return <svg width="0" height="0" style={{position:'absolute'}} aria-hidden="true">
  <symbol id="i-more" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></symbol>
  <symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
  <symbol id="i-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></symbol>
  <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
  <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></symbol>
  <symbol id="i-cube" viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="m3 11 9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></symbol>
  <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-1.5-5-4-5.6"/></symbol>
  <symbol id="i-store" viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v9h14v-9M10 21v-6h4v6"/></symbol>
  <symbol id="i-layers" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
  <symbol id="i-coins" viewBox="0 0 24 24"><circle cx="9" cy="9" r="6"/><path d="M14.5 6.5A6 6 0 1 1 6.5 14.5"/></symbol>
  <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/></symbol>
  <symbol id="i-map" viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></symbol>
  <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></symbol>
  <symbol id="i-save" viewBox="0 0 24 24"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7M8 21v-7h8v7"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
  <symbol id="i-dice" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/></symbol>
  <symbol id="i-reset" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></symbol>
  <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></symbol>
  <symbol id="i-share" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></symbol>
  <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12M6 10l6 6 6-6M4 21h16"/></symbol>
  <symbol id="i-archive" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/></symbol>
  <symbol id="i-orb" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M12 3a9 9 0 0 1 9 9M3 12a9 9 0 0 1 4-7.5M12 21a9 9 0 0 1-8.5-6M20 16a9 9 0 0 1-4 4.2"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></symbol>
  <symbol id="i-blink" viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></symbol>
  <symbol id="i-levitate" viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5"/><ellipse cx="12" cy="19" rx="8" ry="2.5"/></symbol>
  <symbol id="i-scan" viewBox="0 0 24 24"><path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3"/><path d="M3 12h18"/></symbol>
  <symbol id="i-hype" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/></symbol>
  <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></symbol>
  <symbol id="i-sum" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6"/></symbol>
  <symbol id="i-doc" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h5"/></symbol>
  <symbol id="i-pen" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/></symbol>
  <symbol id="i-lang" viewBox="0 0 24 24"><path d="M3 5h10M8 3v2M5 5c1 4 4 7 7 8M11 5c-1 4-4 7-7 8"/><path d="m13 21 4-10 4 10M14.5 17.5h5"/></symbol>
  <symbol id="i-bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></symbol>
  <symbol id="i-code" viewBox="0 0 24 24"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></symbol>
  <symbol id="i-list" viewBox="0 0 24 24"><path d="m4 6 1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"/></symbol>
  <symbol id="i-wallet" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/></symbol>
  <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/></symbol>
  <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></symbol>
</svg>;}
