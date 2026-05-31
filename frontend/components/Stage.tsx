"use client";

import SpriteAnimator from "./SpriteAnimator";
import {
  getBackground,
  getCharacter,
  spriteFor,
  type NegotiationState,
} from "@/lib/characters";

export interface StageActor {
  charKey: string;
  state: NegotiationState;
  name: string;
}

interface Props {
  backgroundKey?: string;
  vendor: StageActor;
  user: StageActor;
}

function NamePlate({
  name,
  role,
  tone,
}: {
  name: string;
  role: string;
  tone: "amber" | "sky";
}) {
  const ring = tone === "amber" ? "border-amber-400/40" : "border-sky-400/40";
  const dot = tone === "amber" ? "bg-amber-400" : "bg-sky-400";
  return (
    <div
      className={`mt-1 flex items-center gap-2 rounded-full border ${ring} bg-black/45 px-3 py-1 backdrop-blur-sm`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-xs font-semibold text-white">{name}</span>
      <span className="text-[10px] uppercase tracking-wider text-white/50">{role}</span>
    </div>
  );
}

function Avatar({
  charKey,
  state,
  flip,
}: {
  charKey: string;
  state: NegotiationState;
  flip?: boolean;
}) {
  const sprite = spriteFor(getCharacter(charKey), state);
  if (!sprite) return null;
  return (
    <SpriteAnimator
      src={sprite.src}
      frameW={sprite.frameW}
      frames={sprite.frames}
      scale={0.92}
      flip={flip}
    />
  );
}

export default function Stage({ backgroundKey, vendor, user }: Props) {
  const bg = getBackground(backgroundKey || "nature");
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
      style={{ aspectRatio: "16 / 9" }}
    >
      {/* drifting backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: bg ? `url(${bg.src})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          animation: "negotiai-bg-drift 24s ease-in-out infinite alternate",
        }}
      />
      {/* soft vignette so avatars pop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

      {/* vendor — left, faces right (toward center) */}
      <div className="absolute bottom-[8%] left-[5%] flex flex-col items-center drop-shadow-[0_10px_15px_rgba(0,0,0,0.45)]">
        <Avatar charKey={vendor.charKey} state={vendor.state} />
        <NamePlate name={vendor.name} role="Vendor" tone="amber" />
      </div>

      {/* user — right, faces left (toward center) */}
      <div className="absolute bottom-[8%] right-[5%] flex flex-col items-center drop-shadow-[0_10px_15px_rgba(0,0,0,0.45)]">
        <Avatar charKey={user.charKey} state={user.state} flip />
        <NamePlate name={user.name} role="User" tone="sky" />
      </div>
    </div>
  );
}
