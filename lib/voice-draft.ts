/* Creator voice, the part without server imports (lib/voice.ts has the settings; the test imports this file):
   the limits, the neutral writer that drafts the instructions, and how the draft is read from the model's answer. */
import type {Agent} from './agents';

/** What a voice draft is filed under in runs.skill. Not one of the agent skills (lib/agents.ts skillIds). */
export const VOICE_SKILL='voice';
/** Characters of pasted posts: enough to hear a voice, and no more than a run takes. */
export const VOICE_MIN=300,VOICE_MAX=12000;

/** Who writes the draft: not the creator's agent (its instructions are what is being written). */
export const VOICE_WRITER={name:'Voice Writer',skin:'atlas',tone:'Professional',language:'English',skills:['write'],
 personality:'You turn a person’s own posts into clear character instructions for an AI agent. You are exact and plain, and you describe the style you actually see in the posts, not a generic one.'} as Agent;

/** The draft as the page needs it. The model is asked for "TAGLINE: ..." and then "PERSONA:" with the instructions;
    an answer without those marks is taken whole as the instructions. Both are cut to what an agent may carry. */
export function parseVoice(output:string):{tagline:string;persona:string}{
 const text=String(output||'').split('\r').join('').trim();
 const lines=text.split('\n');
 const tagAt=lines.findIndex(l=>l.trim().toUpperCase().startsWith('TAGLINE:'));
 const perAt=lines.findIndex(l=>l.trim().toUpperCase().startsWith('PERSONA:'));
 const strip=(s:string)=>s.trim().replace(/^["“*_\s]+|["”*_\s]+$/g,'');
 const tagline=tagAt>=0?strip(lines[tagAt].trim().slice('TAGLINE:'.length)).slice(0,140):'';
 const body=perAt>=0?[lines[perAt].trim().slice('PERSONA:'.length),...lines.slice(perAt+1)].join('\n'):lines.filter((_,i)=>i!==tagAt).join('\n');
 return {tagline,persona:body.trim().slice(0,2000)};
}
