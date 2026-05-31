// Asset pipeline: raw CraftPix frames (assets/) -> optimized sprite sheets + backgrounds (public/)
// Runnable locally (RAW defaults to ../assets) or in Docker (set RAW_ASSETS_DIR=/raw-assets).
// Output is platform-independent WebP + a JSON manifest imported by the app.
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

const RAW = process.env.RAW_ASSETS_DIR || path.resolve(process.cwd(), "..", "assets");
const OUT_PUBLIC = path.resolve(process.cwd(), "public");
const OUT_MANIFEST = path.resolve(process.cwd(), "lib", "asset-manifest.json");

const FRAME_H = 256; // uniform target frame height (keeps registration; no per-frame trim)
const MAX_FRAMES = 14; // cap frames per animation to keep sheets light
const FPS = 14;

// negotiation state -> candidate source animation folders (penguin uses "Confused" vs others "Stuned")
const STATE_ANIM = {
  idle: ["Idle"],
  counter: ["Walk"],
  aggressive: ["Throwing"],
  escalate: ["Stuned", "Confused"],
  deal: ["Jump"],
  walkaway: ["Dead"],
};

// curated subset for the first build: one character per animal, paired with a default biome
const CHARACTERS = [
  { key: "penguin", label: "Pinguin", biome: "snowy" },
  { key: "capybara", label: "Kapibara", biome: "nature" },
  { key: "panda", label: "Panda", biome: "mountain" },
  { key: "racoon", label: "Rakun", biome: "nature" },
  { key: "bunny", label: "Kelinci", biome: "mountain" },
  { key: "chicken", label: "Ayam", biome: "nature" },
];
const CHAR_NO = "Character01";

const BACKGROUNDS = [
  { key: "snowy", label: "Bersalju", file: "background/snowy/_PNG/01/snowy01_preview-01.png" },
  { key: "nature", label: "Hutan", file: "background/nature/PNG/game_background_1/game_background_1.png" },
  { key: "mountain", label: "Gunung", file: "background/mountain/_PNG/01/preview.png" },
];
const BG_WIDTH = 1600;

const naturalSort = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

async function dirExists(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function listFrames(dir) {
  const files = (await fs.readdir(dir)).filter((f) => /\.png$/i.test(f));
  files.sort(naturalSort);
  return files.map((f) => path.join(dir, f));
}

function subsample(arr, max) {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
}

async function buildSheet(frameFiles, outPath) {
  const meta = await sharp(frameFiles[0]).metadata();
  const frameW = Math.round((meta.width * FRAME_H) / meta.height);
  const buffers = await Promise.all(
    frameFiles.map((f) => sharp(f).resize(frameW, FRAME_H, { fit: "fill" }).png().toBuffer())
  );
  const composites = buffers.map((input, i) => ({ input, left: i * frameW, top: 0 }));
  await sharp({
    create: {
      width: frameW * buffers.length,
      height: FRAME_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 88, alphaQuality: 90, effort: 4 })
    .toFile(outPath);
  return { frameW, frames: buffers.length };
}

async function main() {
  console.log("[assets] RAW dir:", RAW);
  const characters = [];
  for (const ch of CHARACTERS) {
    const baseDir = path.join(RAW, "character", ch.key, "Png", CHAR_NO);
    if (!(await dirExists(baseDir))) {
      console.warn("[assets] SKIP (missing):", baseDir);
      continue;
    }
    const outDir = path.join(OUT_PUBLIC, "characters", ch.key);
    await fs.mkdir(outDir, { recursive: true });
    const states = {};
    for (const [state, candidates] of Object.entries(STATE_ANIM)) {
      let animDir = null;
      for (const c of candidates) {
        const d = path.join(baseDir, c);
        if (await dirExists(d)) {
          animDir = d;
          break;
        }
      }
      if (!animDir) {
        console.warn(`[assets]   ${ch.key}: no source for "${state}"`);
        continue;
      }
      const frames = subsample(await listFrames(animDir), MAX_FRAMES);
      const outPath = path.join(outDir, `${state}.webp`);
      const { frameW, frames: n } = await buildSheet(frames, outPath);
      states[state] = { src: `/characters/${ch.key}/${state}.webp`, frameW, frames: n };
      console.log(`[assets]   ${ch.key}/${state}: ${n}f @ ${frameW}x${FRAME_H}`);
    }
    characters.push({ key: ch.key, label: ch.label, biome: ch.biome, states });
  }

  const backgrounds = [];
  await fs.mkdir(path.join(OUT_PUBLIC, "backgrounds"), { recursive: true });
  for (const bg of BACKGROUNDS) {
    const src = path.join(RAW, bg.file);
    try {
      const outPath = path.join(OUT_PUBLIC, "backgrounds", `${bg.key}.webp`);
      await sharp(src).resize(BG_WIDTH).webp({ quality: 82, effort: 4 }).toFile(outPath);
      backgrounds.push({ key: bg.key, label: bg.label, src: `/backgrounds/${bg.key}.webp` });
      console.log(`[assets]   bg ${bg.key}`);
    } catch (e) {
      console.warn("[assets] SKIP bg:", src, e.message);
    }
  }

  const manifest = { frameH: FRAME_H, fps: FPS, characters, backgrounds };
  await fs.mkdir(path.dirname(OUT_MANIFEST), { recursive: true });
  await fs.writeFile(OUT_MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`[assets] manifest -> ${OUT_MANIFEST}`);
  console.log(`[assets] done: ${characters.length} characters, ${backgrounds.length} backgrounds`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
