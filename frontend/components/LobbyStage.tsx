"use client";

import SpriteAnimator from "./SpriteAnimator";
import { getBackground, getCharacter, spriteFor } from "@/lib/characters";
import type { Seat } from "@/lib/api";

function Plate({ name, role, tone }: { name: string; role: string; tone: "amber" | "sky" }) {
  const ring = tone === "amber" ? "border-amber-400/40" : "border-sky-400/40";
  const dot = tone === "amber" ? "bg-amber-400" : "bg-sky-400";
  return (
    <div className={`mt-1 flex items-center gap-2 rounded-full border ${ring} bg-black/45 px-3 py-1 backdrop-blur-sm`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-xs font-semibold text-white">{name}</span>
      <span className="text-[10px] uppercase tracking-wider text-white/50">{role}</span>
    </div>
  );
}

function Avatar({ seat, flip }: { seat: Seat; flip?: boolean }) {
  const s = spriteFor(getCharacter(seat.avatar_id), "idle");
  if (!s) return null;
  return <SpriteAnimator src={s.src} frameW={s.frameW} frames={s.frames} scale={0.9} flip={flip} />;
}

function WaitingSlot() {
  return (
    <div className="flex h-[230px] w-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 text-center">
      <span className="text-3xl">🪑</span>
      <span className="mt-2 px-3 text-xs text-white/50">Menunggu pihak lain bergabung…</span>
    </div>
  );
}

export default function LobbyStage({
  backgroundKey,
  user,
  vendor,
}: {
  backgroundKey?: string;
  user: Seat;
  vendor: Seat;
}) {
  const bg = getBackground(backgroundKey || "nature");
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
      style={{ aspectRatio: "16 / 9" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: bg ? `url(${bg.src})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          animation: "negotiai-bg-drift 24s ease-in-out infinite alternate",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

      <div className="absolute bottom-[8%] left-[5%] flex flex-col items-center drop-shadow-[0_10px_15px_rgba(0,0,0,0.45)]">
        {user.ready ? <Avatar seat={user} /> : <WaitingSlot />}
        {user.ready && <Plate name={user.name} role="User" tone="sky" />}
      </div>

      <div className="absolute bottom-[8%] right-[5%] flex flex-col items-center drop-shadow-[0_10px_15px_rgba(0,0,0,0.45)]">
        {vendor.ready ? <Avatar seat={vendor} flip /> : <WaitingSlot />}
        {vendor.ready && <Plate name={vendor.name} role="Vendor" tone="amber" />}
      </div>
    </div>
  );
}
