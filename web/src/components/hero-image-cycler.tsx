"use client";

import Image, { type StaticImageData } from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export type CycleImage = { image: StaticImageData; alt: string };

const INTERVAL_MS = 5500;

/** Pick a random index in [0, len) that isn't `current` — keeps the auto
 *  rotation from showing the same frame twice in a row. */
function randomNext(current: number, len: number): number {
  const r = Math.floor(Math.random() * (len - 1));
  return r >= current ? r + 1 : r;
}

/**
 * Crossfading hero image rotation in a random order, with pagination dots and
 * hover-revealed prev/next controls. The first image renders on the server
 * (priority — it's the desktop LCP element); the rest plus the controls mount
 * after hydration and only on desktop / non-reduced-motion, so phones (where
 * the hero image is hidden) and reduced-motion users get a single static frame.
 *
 * Auto-advance is random; the manual prev/next/dots step predictably and reset
 * the auto-advance timer so a frame you pick isn't whisked away immediately.
 */
export function HeroImageCycler({ images }: { images: CycleImage[] }) {
  const [frame, setFrame] = useState({ index: 0, prev: 0 });
  const [ready, setReady] = useState(false);

  const goTo = (next: number) =>
    setFrame((f) => (next === f.index ? f : { index: next, prev: f.index }));

  // Mount the remaining frames + controls shortly after hydration. Desktop and
  // non-reduced-motion only; phones never run this (the hero image is hidden).
  useEffect(() => {
    if (images.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const warm = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(warm);
  }, [images.length]);

  // (Re)schedule the next random auto-advance whenever the active frame changes
  // — so manual navigation naturally resets the countdown.
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(
      () =>
        setFrame((f) => ({
          index: randomNext(f.index, images.length),
          prev: f.index,
        })),
      INTERVAL_MS
    );
    return () => clearTimeout(id);
  }, [ready, frame.index, images.length]);

  const prevIndex = (frame.index - 1 + images.length) % images.length;
  const nextIndex = (frame.index + 1) % images.length;

  const arrowClass =
    "absolute top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-forest-900/25 text-cream-50 opacity-0 backdrop-blur-sm transition-opacity duration-300 hover:bg-forest-900/40 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream-50/70 group-hover:opacity-100 motion-reduce:transition-none";

  return (
    <>
      {images.map((img, i) => {
        if (i > 0 && !ready) return null;
        const layer =
          i === frame.index
            ? "z-20 opacity-100"
            : i === frame.prev
              ? "z-10 opacity-100"
              : "z-0 opacity-0";
        return (
          <Image
            key={img.image.src}
            src={img.image}
            alt={img.alt}
            fill
            priority={i === 0}
            sizes="(max-width: 1024px) 100vw, 40vw"
            className={`object-cover object-center transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${layer}`}
            aria-hidden={i !== frame.index}
            data-testid={i === 0 ? "hero-image" : undefined}
          />
        );
      })}

      {ready && (
        <>
          <button
            type="button"
            onClick={() => goTo(prevIndex)}
            aria-label="Previous photo"
            className={`${arrowClass} left-3`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goTo(nextIndex)}
            aria-label="Next photo"
            className={`${arrowClass} right-3`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center gap-2">
            {images.map((img, i) => (
              <button
                key={img.image.src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === frame.index}
                className="group/dot cursor-pointer px-0.5 py-2 focus-visible:outline-none"
              >
                <span
                  className={`block h-1.5 rounded-full shadow-sm transition-all duration-300 motion-reduce:transition-none ${
                    i === frame.index
                      ? "w-5 bg-cream-50"
                      : "w-1.5 bg-cream-50/50 group-hover/dot:bg-cream-50/80 group-focus-visible/dot:bg-cream-50/80"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
