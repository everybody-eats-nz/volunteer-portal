"use client";

import Image, { type StaticImageData } from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export type CycleImage = { image: StaticImageData; alt: string };

const INTERVAL_MS = 5500;
const DOT_STEP = 20; // px, dot slot width (centre-to-centre spacing)
const DOT_WINDOW = 5; // visible dots
const DOT_HALF = 3; // dots rendered each side of centre (incl. one off-screen)

const mod = (n: number, m: number) => ((n % m) + m) % m;

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
 * through it sequentially. The dot strip slides under a fixed centre so the
 * active dot is always dead-centre, with the edge dots shrinking + fading for
 * an "infinite" feel. The active dot is a pill whose fill animates over the
 * slide interval. Manual prev/next/dots step the same way and reset the timer.
 */
export function HeroImageCycler({ images }: { images: CycleImage[] }) {
  // `order` maps a play position → an index into `images`. Identity on the
  // server / first render so it matches SSR; shuffled once `ready`.
  const [order, setOrder] = useState(() =>
    Array.from({ length: images.length }, (_, i) => i)
  );
  // `step` is a monotonic counter; the shown image is order[step mod len].
  // Keeping it monotonic lets the dot strip slide infinitely (always centred)
  // with no wrap-around jump.
  const [frame, setFrame] = useState({ step: 0, prev: 0 });
  const [ready, setReady] = useState(false);
  // Track which frames have finished loading so we only fade a frame in once
  // it's ready — until then the previous (loaded) frame stays visible instead
  // of a blank. Seed with the priority frame so it shows immediately.
  const [loaded, setLoaded] = useState<Set<string>>(
    () => new Set([images[0]?.image.src])
  );
  const markLoaded = (src: string) =>
    setLoaded((s) => (s.has(src) ? s : new Set(s).add(src)));

  const goToStep = (next: number) =>
    setFrame((f) => (next === f.step ? f : { step: next, prev: f.step }));

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

  // Advance whenever the active frame changes — so manual navigation naturally
  // resets the countdown.
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(
      () => setFrame((f) => ({ step: f.step + 1, prev: f.step })),
      INTERVAL_MS
    );
    return () => clearTimeout(id);
  }, [ready, frame.step]);

  const len = order.length;
  const currentImage = order[mod(frame.step, len)];
  const prevImage = order[mod(frame.prev, len)];
  const nextImage = order[mod(frame.step + 1, len)];

  // Lazy: only the frames in play are mounted (so a large rotation doesn't
  // fetch every image up front). Image 0 is the SSR/priority frame and stays
  // mounted; the active + outgoing make the crossfade; `next` is preloaded so
  // the upcoming transition is smooth.
  const mounted = new Set([0, prevImage, currentImage, nextImage]);

  // Dot strip slides so the active step sits dead-centre in the mask.
  const maskWidth = Math.min(DOT_WINDOW, len) * DOT_STEP;
  const trackTranslate = maskWidth / 2 - (frame.step * DOT_STEP + DOT_STEP / 2);
  const dotKeys: number[] = [];
  for (let k = frame.step - DOT_HALF; k <= frame.step + DOT_HALF; k++) {
    dotKeys.push(k);
  }

  const arrowClass =
    "absolute top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-forest-900/25 text-cream-50 opacity-0 backdrop-blur-sm transition-opacity duration-300 hover:bg-forest-900/40 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream-50/70 group-hover:opacity-100 motion-reduce:transition-none";

  return (
    <>
      {images.map((img, i) => {
        if (!ready) {
          if (i !== 0) return null;
        } else if (!mounted.has(i)) {
          return null;
        }
        const layer =
          i === currentImage
            ? loaded.has(img.image.src)
              ? "z-20 opacity-100"
              : "z-20 opacity-0"
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
            onLoad={() => markLoaded(img.image.src)}
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
            onClick={() => goToStep(frame.step - 1)}
            aria-label="Previous photo"
            className={`${arrowClass} left-3`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goToStep(frame.step + 1)}
            aria-label="Next photo"
            className={`${arrowClass} right-3`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center drop-shadow-sm">
            <div
              className="relative h-5 overflow-hidden"
              style={{ width: maskWidth }}
            >
              <div
                className="absolute inset-y-0 left-0 transition-transform duration-500 ease-out motion-reduce:transition-none"
                style={{ transform: `translateX(${trackTranslate}px)` }}
              >
                {dotKeys.map((k) => {
                  const dist = Math.abs(k - frame.step);
                  const isActive = k === frame.step;
                  const visible = dist <= 2;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => goToStep(k)}
                      aria-label={`Show photo ${mod(k, len) + 1}`}
                      aria-current={isActive}
                      className="absolute top-1/2 grid -translate-y-1/2 place-items-center focus-visible:outline-none"
                      style={{ left: k * DOT_STEP, width: DOT_STEP, height: 20 }}
                    >
                      {isActive ? (
                        <span className="relative block h-1.5 w-4 overflow-hidden rounded-full bg-cream-50/35">
                          <span
                            key={frame.step}
                            className="dot-progress absolute inset-y-0 left-0 block rounded-full bg-cream-50"
                            style={{ animationDuration: `${INTERVAL_MS}ms` }}
                          />
                        </span>
                      ) : (
                        <span
                          className="block h-1.5 w-1.5 rounded-full bg-cream-50 transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none"
                          style={{
                            opacity: visible ? (dist === 2 ? 0.5 : 0.6) : 0,
                            transform: dist === 2 ? "scale(0.5)" : "scale(1)",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
