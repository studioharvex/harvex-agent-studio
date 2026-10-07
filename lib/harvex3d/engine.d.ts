/* Types for the generated Harvex modules. engine.js = 3D engine (lazy); data.js = presets etc.; content.js = docs text. */
export type Look = {
  kind: 'human' | 'companion'; model?: 'scout' | 'maker' | 'guardian' | null; body?: string; build: string; headStyle?: 'human' | 'screen';
  skin: string; eyes: string; facial: string;
  hair: { style: string; color: string };
  top: { type: string; color: string; accent: string };
  bottom: { type: string; color: string }; legwear: string;
  shoes: { type: string; color: string };
  head: string; face: string; back: string; accColor: string; glow: string; finish: 'matte' | 'gloss';
  /** Parametric human (lib/harvex3d/src/e2c-sim.js): shape numbers 0..1, detail sliders -1..1 by id, and picked pieces. */
  sim?: SimLook;
};
export type SimLook = { age?: number; muscle?: number; weight?: number; height?: number; cup?: number; sliders?: Record<string, number>; hair?: string; outfit?: string; shoes?: string; brows?: string; lashes?: string;
  /** The light pack (public/sim/lite, the home page's stage): `baked` names the finished shape, a cast member's id. Not for saved looks. */
  lite?: boolean; baked?: string };
export type Preset = { id: string; name: string; role: string; desc: string; sig: string; cat: 'Humanoid' | 'Companion'; look: Partial<Look> & { kind: Look['kind'] } };
export type Power = { id: string; name: string; key: string; cd: number; desc: string };
export type Wardrobe = Record<'body' | 'build' | 'hair' | 'facial' | 'top' | 'bottom' | 'legwear' | 'shoes' | 'head' | 'face' | 'back' | 'finish', [string, string][]> & { swatches: string[]; skin: string[]; hairColors: string[]; eyes: string[]; glow: string[] };
export type DocSection = { id: string; title: string; body: string };
export type RoadmapPhase = { phase: string; title: string; when: string; status: 'done' | 'now' | 'planned' | 'idea'; items: [string, string][] };
export type Content = { version: string; docs: DocSection[]; paper: { title: string; subtitle: string; status: string; sections: DocSection[] }; roadmap: RoadmapPhase[] };
export type Stage = {
  /** Resolves once the look is on stage (a modelled human may have files to load first). */
  setLook(look: Partial<Look>): Promise<void>; start(): void; stop(): void; dispose(): void; cast(id: string): number;
  anim: { play(name: string, o?: { temp?: boolean; dur?: number; blend?: number }): void; stance: string; cur: string; paused: boolean; speed: number;
    /** Which stance the motion `Portrait` takes (see poseOf). */
    portrait?: number };
  yaw: number; yawVel: number; zoom: number;
};
export type Engine = {
  Stage: new (canvas: HTMLCanvasElement, o?: { onEvent?: (e: string) => void; bare?: boolean; fidget?: boolean }) => Stage;
  renderThumb(look: Partial<Look>, w?: number, h?: number, pose?: number): string;
  /** The same picture, after the character's model files are loaded. */
  renderThumbAsync(look: Partial<Look>, w?: number, h?: number, pose?: number): Promise<string>;
  normalizeLook(look?: Partial<Look>): Look;
  /** The stance a look's picture is taken in (the motion `Portrait`): the same number for the same look. */
  poseOf(look: Look): number;
  /** The parametric humans' loader: `ensure` fetches what a look needs, `ready` says whether it is all there. */
  sim?: { enabled: boolean; ensure(look: Look): Promise<unknown>; ready(look: Look): boolean };
};
export function createEngine(THREE: unknown, extras?: { GLTFLoader?: unknown }): Engine;
