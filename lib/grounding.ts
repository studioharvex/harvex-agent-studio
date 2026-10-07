/* Grounding with Google Search (Gemini) keeps its "Search Suggestions" widget next to the answer: Google's terms say a
   grounded result is only shown together with its Search Suggestion(s), unmodified, to the user who asked. The run output
   is one text column, so lib/provider.ts appends the widget HTML at the end of the output inside a marker; the UI strips
   it here and renders it (app/ui.tsx SearchSuggestions, a sandboxed iframe). Copy and download use the text only.
   The marker format must match lib/provider.ts (scripts/verify-ai-compat.mjs checks the round trip). */
const MARK='<!--harvex-search-suggestions:';

const fromB64=(s:string)=>{const bin=atob(s);return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)));};

/** Puts a note of the studio under the answer. The widget marker is only read at the very end of the output, so the
    note goes in front of it. */
export function withNote(output:string,note:string){
 const at=output.lastIndexOf(MARK);
 return at<0||!output.endsWith('-->')?`${output}\n\n${note}`:`${output.slice(0,at).trimEnd()}\n\n${note}\n\n${output.slice(at)}`;
}

/** Split a run output into the readable text and the widget HTML (empty when there is none or the marker is broken). */
export function splitSearchWidget(output:string):{text:string;widget:string}{
 const at=output.lastIndexOf(MARK);
 if(at<0||!output.endsWith('-->'))return {text:output,widget:''};
 try{return {text:output.slice(0,at).trimEnd(),widget:fromB64(output.slice(at+MARK.length,-3))};}
 catch{return {text:output.slice(0,at).trimEnd(),widget:''};}
}
