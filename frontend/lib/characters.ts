// Character/background registry — a thin typed layer over the generated asset manifest.
// The manifest is produced by scripts/build-assets.mjs from the raw CraftPix packs.
// Avatars are DATA, not hardcoded: swapping/adding packs only changes the manifest.
import manifestRaw from "./asset-manifest.json";

export type NegotiationState =
  | "idle"
  | "counter"
  | "aggressive"
  | "escalate"
  | "deal"
  | "walkaway";

export interface SpriteMeta {
  src: string;
  frameW: number;
  frames: number;
}

export interface CharacterDef {
  key: string;
  label: string;
  biome: string; // default background pairing
  states: Partial<Record<NegotiationState, SpriteMeta>>;
}

export interface BackgroundDef {
  key: string;
  label: string;
  src: string;
}

export interface AssetManifest {
  frameH: number;
  fps: number;
  characters: CharacterDef[];
  backgrounds: BackgroundDef[];
}

export const manifest = manifestRaw as AssetManifest;
export const CHARACTERS = manifest.characters;
export const BACKGROUNDS = manifest.backgrounds;
export const FRAME_H = manifest.frameH;
export const FPS = manifest.fps;

export const STATE_ORDER: NegotiationState[] = [
  "idle",
  "counter",
  "aggressive",
  "escalate",
  "deal",
  "walkaway",
];

// negotiation state -> human label (the animation->state map made visible)
export const STATE_LABELS: Record<NegotiationState, string> = {
  idle: "Diam (menunggu)",
  counter: "Counter-offer",
  aggressive: "Agresif (lowball)",
  escalate: "Eskalasi",
  deal: "Deal! 🎉",
  walkaway: "Walk away",
};

export const getCharacter = (key: string): CharacterDef | undefined =>
  CHARACTERS.find((c) => c.key === key);

export const getBackground = (key: string): BackgroundDef | undefined =>
  BACKGROUNDS.find((b) => b.key === key);

// Pick the sprite for a state, falling back to idle if a state is missing.
export const spriteFor = (
  char: CharacterDef | undefined,
  state: NegotiationState
): SpriteMeta | undefined => char?.states[state] ?? char?.states.idle;
