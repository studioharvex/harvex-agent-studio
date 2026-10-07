import {HARVEX_DATA} from './harvex3d/data';
import type {Look,Preset} from './harvex3d/engine';
export type {Look};

/* 25 original characters. The first 12 ids are unchanged so older saved agents still open. */
export const skinIds=['atlas','nova','orbit','kira','dash','byte','echo','terra','volt','vesper','rook','mira','juno','cole','lumi','otto','wren','zara','felix','ines','taro','noor','scout','maker','guardian'] as const;
export type CharacterId=typeof skinIds[number];
export const motionNames=['Idle','Wave','Nod','Shrug','Think','Point','Clap','Cheer','Laugh','Bow','Salute','Stretch','Typing','Walk','Run','Jump','Spin','Dance','Disco','Victory','Flex','Heart','Dab','Facepalm','Kick','Backflip','Chat','Sit','Crouch','Pickup','Use','Tinker','Cast'] as const;
export type Motion=typeof motionNames[number];
/** Looping motions become the agent's default stance; the others play once. */
export const loopMotions:readonly Motion[]=['Idle','Think','Typing','Walk','Run','Dance','Disco','Chat','Sit','Crouch'];
/** Motions from the first studio that were renamed. */
export const legacyMotions:Record<string,Motion>={Pray:'Bow'};
export const accessories=['None','Visor','Headphones','Halo'] as const;
/** Legacy colour-only appearance from the first studio. Still read and written for compatibility. */
export type Appearance={outfit:string;accent:string;skinTone:string;hair:string;accessory:typeof accessories[number];finish:'Matte'|'Gloss'};
export const defaultAppearance:Appearance={outfit:'#252b31',accent:'#ffe600',skinTone:'#bd855d',hair:'#261e1c',accessory:'None',finish:'Matte'};

function clone<T>(v:T):T{return JSON.parse(JSON.stringify(v));}
const DEFAULT_LOOK:Look={kind:'human',model:null,body:'masculine',build:'regular',headStyle:'human',skin:'#c98e66',eyes:'#4a3526',facial:'none',hair:{style:'short',color:'#2b201c'},top:{type:'tee',color:'#2b3a33',accent:'#ffe600'},bottom:{type:'pants',color:'#1f2528'},legwear:'bare',shoes:{type:'sneaker',color:'#e9ece4'},head:'none',face:'none',back:'none',accColor:'#20262a',glow:'#ffe600',finish:'matte'};
function merge(base:Look,over?:Partial<Look>|null):Look{
 const out=clone(base) as unknown as Record<string,unknown>;if(!over)return out as unknown as Look;
 for(const [k,v] of Object.entries(over)){if(v&&typeof v==='object'&&!Array.isArray(v))out[k]={...((out[k] as object)||{}),...v};else if(v!==undefined)out[k]=v;}
 return out as unknown as Look;
}
function legacyFromLook(l:Look):Appearance{return {outfit:l.top.color,accent:l.top.accent,skinTone:l.skin,hair:l.hair.color,accessory:l.face==='visor'?'Visor':l.head==='headphones'?'Headphones':l.head==='halo'?'Halo':'None',finish:l.finish==='gloss'?'Gloss':'Matte'};}

export const characters:Array<{id:CharacterId;name:string;desc:string;role:string;category:'Humanoid'|'Companion';color:string;sig:string;preset:Look;look:Appearance;motions:readonly Motion[]}>=HARVEX_DATA.PRESETS.map((p:Preset)=>{
 const preset=merge(DEFAULT_LOOK,p.look as Partial<Look>);
 return {id:p.id as CharacterId,name:p.name,desc:p.desc,role:p.role,category:p.cat,color:preset.top.color,sig:p.sig,preset,look:legacyFromLook(preset),motions:motionNames};
});
export function getCharacter(id:string){return characters.find(c=>c.id===id)||characters[0];}
export function getAppearance(id:string,look?:Partial<Appearance>):Appearance{return {...getCharacter(id).look,...look};}
/** Full 3D look for an agent: saved look first, else the legacy appearance mapped onto the preset, else the preset. */
export function lookFor(id:string,look?:Partial<Look>|null,appearance?:Partial<Appearance>|null):Look{
 const c=getCharacter(id);
 if(look)return merge(c.preset,look);
 const l=clone(c.preset);
 if(appearance){
  if(appearance.outfit)l.top.color=appearance.outfit;
  if(appearance.accent){l.top.accent=appearance.accent;l.glow=appearance.accent;}
  if(c.category==='Humanoid'){if(appearance.skinTone)l.skin=appearance.skinTone;if(appearance.hair)l.hair.color=appearance.hair;if(appearance.accessory==='Visor')l.face='visor';if(appearance.accessory==='Headphones')l.head='headphones';if(appearance.accessory==='Halo')l.head='halo';}
  if(appearance.finish)l.finish=appearance.finish==='Gloss'?'gloss':'matte';
 }
 return l;
}
export {legacyFromLook};
export const wardrobe=HARVEX_DATA.WARDROBE;
export const motionGroups=HARVEX_DATA.MOTION_GROUPS;
export const powers=HARVEX_DATA.POWERS;
