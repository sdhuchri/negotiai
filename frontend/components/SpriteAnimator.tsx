"use client";

import type { CSSProperties } from "react";
import { FRAME_H, FPS } from "@/lib/characters";

interface Props {
  src: string;
  frameW: number;
  frames: number;
  /** display scale relative to the source frame height (FRAME_H) */
  scale?: number;
  /** mirror horizontally (e.g. so the right-side actor faces the center) */
  flip?: boolean;
  /** when false, holds frame 0 (a static idle pose) */
  playing?: boolean;
  className?: string;
}

/**
 * Renders a CraftPix animation as a CSS sprite-sheet flipbook.
 * The sheet is a horizontal strip of `frames` frames; steps() snaps across them.
 * No WebGL / Spine runtime — pure CSS, GPU-friendly.
 */
export default function SpriteAnimator({
  src,
  frameW,
  frames,
  scale = 1,
  flip = false,
  playing = true,
  className,
}: Props) {
  const w = Math.round(frameW * scale);
  const h = Math.round(FRAME_H * scale);

  const style: CSSProperties = {
    width: w,
    height: h,
    backgroundImage: `url(${src})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${w * frames}px ${h}px`,
    // consumed by the @keyframes negotiai-sprite in globals.css
    ["--sprite-end" as string]: `-${w * frames}px`,
    animationName: playing ? "negotiai-sprite" : "none",
    animationDuration: `${frames / FPS}s`,
    animationTimingFunction: `steps(${frames})`,
    animationIterationCount: "infinite",
    transform: flip ? "scaleX(-1)" : undefined,
  };

  return <div className={className} style={style} aria-hidden />;
}
