"use client";

import { useState } from "react";
import SpriteAnimator from "./SpriteAnimator";
import { CHARACTERS, spriteFor } from "@/lib/characters";
import { defaultAvatar, randomAvatar } from "@/lib/avatars";

interface Props {
  value: string;
  onChange: (key: string) => void;
  tone?: "amber" | "sky";
  flip?: boolean;
}

export default function CharacterPicker({ value, onChange, tone = "sky", flip = false }: Props) {
  // remember the random color chosen for the currently-picked character
  const [pick, setPick] = useState<{ key: string; src: string } | null>(null);

  const ring =
    tone === "amber"
      ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300/40"
      : "border-sky-400 bg-sky-50 ring-2 ring-sky-300/40";

  function handlePick(key: string) {
    onChange(key);
    const src = randomAvatar(key); // fresh random color each time it's picked
    setPick(src ? { key, src } : null);
  }

  function portrait(key: string): string | undefined {
    if (pick && pick.key === key) return pick.src; // selected -> random color
    return defaultAvatar(key); // others -> stable default color
  }

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      {CHARACTERS.map((c) => {
        const selected = value === c.key;
        const src = portrait(c.key);
        const sprite = spriteFor(c, "idle");
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => handlePick(c.key)}
            aria-pressed={selected}
            className={`flex flex-col items-center rounded-2xl border p-2 transition ${
              selected ? ring : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40"
            }`}
          >
            <div className="flex h-20 w-full items-center justify-center overflow-hidden">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={c.label}
                  draggable={false}
                  className="h-20 w-full object-contain transition-transform"
                  style={{
                    transform:
                      `${flip ? "scaleX(-1)" : ""} ${selected ? "scale(1.05)" : ""}`.trim() ||
                      undefined,
                  }}
                />
              ) : (
                sprite && (
                  <SpriteAnimator
                    src={sprite.src}
                    frameW={sprite.frameW}
                    frames={sprite.frames}
                    scale={0.34}
                    flip={flip}
                    playing={selected}
                  />
                )
              )}
            </div>
            <span
              className={`mt-1 text-xs font-medium ${selected ? "text-slate-900" : "text-slate-500"}`}
            >
              {c.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
