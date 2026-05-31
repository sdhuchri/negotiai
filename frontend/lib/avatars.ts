// Avatar portraits (public/avatars/...). Each character has 4 color variants.
// File naming is inconsistent across packs, so the dir+prefix is mapped explicitly.

const AVATAR_DIR: Record<string, { dir: string; prefix: string }> = {
  penguin: { dir: "penguin-avatar", prefix: "penguin" },
  capybara: { dir: "capybara-avatar", prefix: "capybara" },
  panda: { dir: "panda-avatar", prefix: "panda" },
  racoon: { dir: "racoon-avatar", prefix: "raccoon" }, // key "racoon", files "raccoon_*"
  bunny: { dir: "bunny-avatar", prefix: "avatar" }, // files "avatar_*"
  chicken: { dir: "chicken-avatar", prefix: "chicken" },
};

export const AVATAR_COLORS = ["cream", "indigo", "mint", "white"] as const;

/** All color-variant image paths for a character (empty if none). */
export function avatarVariants(key: string): string[] {
  const f = AVATAR_DIR[key];
  if (!f) return [];
  return AVATAR_COLORS.map((c) => `/avatars/${f.dir}/${f.prefix}_${c}.png`);
}

/** A stable default portrait (first color) for unselected tiles. */
export function defaultAvatar(key: string): string | undefined {
  return avatarVariants(key)[0];
}

/** A random color variant — used each time a character is picked. */
export function randomAvatar(key: string): string | undefined {
  const v = avatarVariants(key);
  if (!v.length) return undefined;
  return v[Math.floor(Math.random() * v.length)];
}
