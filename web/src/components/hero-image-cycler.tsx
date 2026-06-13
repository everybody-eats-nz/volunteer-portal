"use client";

import Image, { type StaticImageData } from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export type CycleImage = { image: StaticImageData; alt: string };

const INTERVAL_MS = 5500;

/** A per-load random play order. Index 0 stays first so the server-rendered
 *  priority/LCP frame is the one that actually shows on load (no flash); the
 *  rest are Fisher-Yates shuffled, then we step through them left to right. */
function shuffledOrder(len: number): number[] {
  const rest = Array.from({ length: len - 1 }, (_, k) => k + 1);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [0, ...rest];
}

/**
 * Crossfading hero image rotation, with pagination dots and hover-revealed
 * prev/next controls. The first image renders on the server (priority — it's
 * the desktop LCP element); the rest plus the controls mount after hydration
 * and only on desktop / non-reduced-motion, so phones (where the hero image is
 * hidden) and reduced-motion users get a single static frame.
 *
 * The play order is shuffled once per page load, then the carousel steps
 * through it sequentially (left to right, wrapping). Manual prev/next/dots step
 * the same way and reset the auto-advance timer so a frame you pick isn't
 * whisked away immediately.
 */
export function HeroImageCycler({ images }: { images: CycleImage[] }) {
  // `order` maps a play position → an index into `images`. Identity on the
  // server / first render so it matches SSR; shuffled once `ready`.
  const [order, setOrder] = useState(() =>
    Array.from({ length: images.length }, (_, i) => i)
  );
  const [frame, setFrame] = useState({ pos: 0, prev: 0 });
  const [ready, setReady] = useState(false);

  const goToPos = (next: number) =>
    setFrame((f) => (next === f.pos ? f : { pos: next, prev: f.pos }));

  // Mount the remaining frames + controls and pick a play order shortly after
  // hydration. Desktop and non-reduced-motion only; phones never run this.
  useEffect(() => {
    if (images.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const warm = setTimeout(() => {
      setOrder(shuffledOrder(images.length));
      setReady(true);
    }, 1000);
    return () => clearTimeout(warm);
  }, [images.length]);

  // Step to the next position whenever the active frame changes — so manual
  // navigation naturally resets the countdown.
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(
      () => setFrame((f) => ({ pos: (f.pos + 1) % order.length, prev: f.pos })),
      INTERVAL_MS
    );
    return () => clearTimeout(id);
  }, [ready, frame.pos, order.length]);

  const len = order.length;
  const currentImage = order[frame.pos];
  const prevImage = order[frame.prev];

  const arrowClass =
    "absolute top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-forest-900/25 text-cream-50 opacity-0 backdrop-blur-sm transition-opacity duration-300 hover:bg-forest-900/40 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream-50/70 group-hover:opacity-100 motion-reduce:transition-none";

  return (
    <>
      {images.map((img, i) => {
        if (i > 0 && !ready) return null;
        const layer =
          i === currentImage
            ? "z-20 opacity-100"
            : i === prevImage
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
            aria-hidden={i !== currentImage}
            data-testid={i === 0 ? "hero-image" : undefined}
          />
        );
      })}

      {ready && (
        <>
          <button
            type="button"
            onClick={() => goToPos((frame.pos - 1 + len) % len)}
            aria-label="Previous photo"
            className={`${arrowClass} left-3`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goToPos((frame.pos + 1) % len)}
            aria-label="Next photo"
            className={`${arrowClass} right-3`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center gap-2">
            {order.map((_, pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => goToPos(pos)}
                aria-label={`Show photo ${pos + 1}`}
                aria-current={pos === frame.pos}
                className="group/dot cursor-pointer px-0.5 py-2 focus-visible:outline-none"
              >
                <span
                  className={`block h-1.5 rounded-full shadow-sm transition-all duration-300 motion-reduce:transition-none ${
                    pos === frame.pos
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
