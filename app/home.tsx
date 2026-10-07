'use client';
/* Landing page, composed from components/landing. References (DESIGN.md): ZATS structure for the
   hero, feature rows, flow and statement; Twenty typography, buttons, folder cards, slider and FAQ.
   Harvex brand, solid multi-color palette, no scenery or gradients. */
import type {CharacterId} from '@/lib/characters';
import {Hero} from '@/components/landing/hero';
import {FeatureRows,FolderCards,TheIdea} from '@/components/landing/features';
import {Crew,Flow,Statement,Templates} from '@/components/landing/story';
import {Closing,Faq,TokenBand} from '@/components/landing/outro';

type T={name:string;skin:string;skills:readonly string[];personality:string};
export default function Home({onNavigate,onPick,templates,onTemplate}:{onNavigate:(view:string,doc?:string)=>void;onPick:(id:CharacterId)=>void;templates:readonly T[];onTemplate:(name:string)=>void}){
 return <div id="v-home" className="overflow-x-clip">
  <Hero onNavigate={onNavigate} onPick={onPick}/>
  <TheIdea onNavigate={onNavigate}/>
  <FeatureRows onNavigate={onNavigate} onPick={onPick}/>
  <FolderCards onNavigate={onNavigate}/>
  <Flow onNavigate={onNavigate}/>
  <Statement/>
  <Templates templates={templates} onUse={onTemplate}/>
  <Crew onPick={onPick}/>
  <TokenBand onNavigate={onNavigate}/>
  <Faq onNavigate={onNavigate}/>
  <Closing onNavigate={onNavigate}/>
 </div>;
}
