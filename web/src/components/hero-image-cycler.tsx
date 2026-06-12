"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type CycleImage = { src: string; alt: string };

const INTERVAL_MS = 5500;

/** Pick a random index in [0, len) that isn't `current` — keeps the walk
 *  from showing the same frame twice in a row. */
function randomNext(current: number, len: number): number {
  const r = Math.floor(Math.random() * (len - 1));
  return r >= current ? r + 1 : r;
}

/**
 * Crossfading hero image rotation in a random order. The first image renders
 * on the server (priority — it's the desktop LCP element); the rest are mounted
 * only once cycling actually starts, so phones (where the hero image is hidden)
 * and reduced-motion users never download them. After the first frame the order
 * is a random walk, so the sequence differs every visit.
 */
export function HeroImageCycler({ images }: { images: CycleImage[] }) {
  const [frame, setFrame] = useState({ index: 0, prev: 0 });
  const [cycling, setCycling] = useState(false);

  useEffect(() => {
    if (images.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    // Mount the remaining frames shortly after hydration so they're loaded
    // before the first crossfade (and never on phones, where this never runs).
    const warm = setTimeout(() => setCycling(true), 1000);
    const id = setInterval(
      () =>
        setFrame((f) => ({
          index: randomNext(f.index, images.length),
          prev: f.index,
        })),
      INTERVAL_MS
    );
    return () => {
      clearTimeout(warm);
      clearInterval(id);
    };
  }, [images.length]);

  // The active frame fades in ON TOP of the still-opaque previous frame —
  // a plain two-way crossfade lets the page background bleed through mid-fade.
  return (
    <>
      {images.map((img, i) => {
        if (i > 0 && !cycling) return null;
        const layer =
          i === frame.index
            ? "z-20 opacity-100"
            : i === frame.prev
              ? "z-10 opacity-100"
              : "z-0 opacity-0";
        return (
          <Image
            key={img.src}
            src={img.src}
            alt={img.alt}
            fill
            priority={i === 0}
            sizes="(max-width: 1024px) 100vw, 40vw"
            className={`object-cover transition-opacity duration-1000 ease-in-out ${layer}`}
            aria-hidden={i !== frame.index}
            data-testid={i === 0 ? "hero-image" : undefined}
          />
        );
      })}
    </>
  );
}
