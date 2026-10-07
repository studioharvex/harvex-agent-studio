/* Types for the generated data module (data.js): presets, wardrobe, motion groups, powers. No three.js. */
import type {Preset,Power,Wardrobe} from './engine';
export function installData(G: {HARVEX: Record<string, unknown>}): void;
export const HARVEX_DATA: {
  PRESETS: Preset[]; WARDROBE: Wardrobe; MOTION_GROUPS: [string, string[]][]; POWERS: Power[];
  getPreset(id: string): Preset;
};
