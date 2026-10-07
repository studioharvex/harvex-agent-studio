/* Creator voice (POST /api/voice; the "Write it from my posts" box in the Studio's Persona tab, components/app/voice.tsx).
   A creator pastes posts they wrote themselves and gets a draft of the agent's instructions in their own style, plus
   a tagline. Nothing is saved to the agent: the Studio shows the draft and the creator decides to use it.
   Opt-in by design: the request must state that the posts are the creator's own (or used with the author's leave),
   the page says so next to the box, and the instructions the model writes never let the agent pass as the person: it
   is an AI character in their style. There is no way here to fetch anyone's posts: only pasted text is read.
   The draft is a normal paid run of the creator's own saved agent (lib/runs.ts performRun with `voice`): it costs
   VOICE_COST credits (default 8), counts toward the live AI limits, is refunded when it fails and appears in History.
   The model does not see the agent's current instructions for it; it works as the neutral writer in lib/voice-draft.ts (the part without server imports). */
import {aiReady,runtime} from './server';
import {VOICE_MAX,VOICE_MIN} from './voice-draft';
export {parseVoice,VOICE_MAX,VOICE_MIN,VOICE_SKILL,VOICE_WRITER} from './voice-draft';

/** Credits for one draft (VOICE_COST, default 8, at least 1). */
export function voiceCost(){const raw=(runtime() as {VOICE_COST?:string}).VOICE_COST;const v=Number(raw);return typeof raw==='string'&&raw.trim()!==''&&Number.isFinite(v)?Math.min(Math.max(Math.round(v),1),500):8;}
export const voiceInfo=()=>({live:aiReady(),cost:voiceCost(),min:VOICE_MIN,max:VOICE_MAX});
