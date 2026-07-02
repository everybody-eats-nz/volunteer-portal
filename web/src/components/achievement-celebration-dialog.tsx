"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  points: number;
}

interface AchievementCelebrationDialogProps {
  achievements: Achievement[];
  isOpen: boolean;
  onClose: () => void;
}

/* Category chips tuned for the dark forest panel — cream + sun tints rather
   than the old rainbow, so the celebration reads as one piece with the brand
   (new.everybodyeats.nz). */
const CATEGORY_COLORS = {
  MILESTONE: "bg-sun-200/15 text-sun-200 border-sun-200/30",
  DEDICATION: "bg-cream-50/10 text-cream-50/85 border-cream-50/20",
  SPECIALIZATION: "bg-forest-300/25 text-forest-100 border-forest-300/40",
  COMMUNITY: "bg-cream-50/10 text-cream-50/85 border-cream-50/20",
  IMPACT: "bg-cream-50/10 text-cream-50/85 border-cream-50/20",
};

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

/**
 * Achievement celebration dialog — a dark forest panel with a warm sun glow,
 * paper grain and a sparkle burst, mirroring the marketing site's hero panels.
 * Fires brand-coloured confetti when new achievements unlock on dashboard visit.
 */
export function AchievementCelebrationDialog({
  achievements,
  isOpen,
  onClose,
}: AchievementCelebrationDialogProps) {
  // Trigger confetti when dialog opens
  useEffect(() => {
    if (isOpen && achievements.length > 0) {
      // Brand-palette confetti: sun yellows, forest greens and cream.
      const colors = ["#F8FB69", "#EDF03F", "#5a8b62", "#1D5337", "#FDF8EF"];

      // First burst
      confetti({
        particleCount: 110,
        spread: 75,
        origin: { y: 0.6 },
        colors,
      });

      // Second burst with delay
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors,
        });
      }, 200);

      // Third burst with delay
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors,
        });
      }, 400);
    }
  }, [isOpen, achievements.length]);

  if (!achievements.length) return null;

  const totalPoints = achievements.reduce(
    (sum, achievement) => sum + achievement.points,
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        // `.grain` is defined unlayered as `position: relative`, which beats
        // Tailwind's layered `fixed` utility on DialogContent and would push the
        // panel off-screen (relative + top-50%). Force fixed so it stays centred.
        style={{ position: "fixed" }}
        className="grain flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden rounded-[2rem] border border-cream-50/15 bg-forest-700 p-0 text-cream-50 shadow-2xl"
      >
        {/* Warm sun glow — radial gradient (not a blur filter, which escapes the
            rounded-corner clip on composited layers in Chromium). */}
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.22),transparent)]"
          aria-hidden
        />
        {/* Kawakawa leaf texture, echoing the marketing site's dark panels. */}
        <Image
          src="/patterns/kawakawa.avif"
          alt=""
          width={416}
          height={416}
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-12 w-64 opacity-[0.12]"
        />

        {/* Custom close — the default dark X is invisible on a forest panel. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full text-cream-50/70 transition-colors hover:bg-cream-50/10 hover:text-cream-50"
        >
          <X className="h-4 w-4" />
        </button>

        <DialogHeader className="relative z-[1] flex-shrink-0 px-7 pt-9">
          <DialogTitle asChild>
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-4 text-center"
            >
              {/* Sparkle burst — the signature mark instead of a party emoji. */}
              <div className="relative flex h-16 w-16 items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.35),transparent)]"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden
                />
                <motion.div
                  animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.12, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkle className="h-12 w-12 text-sun-200 drop-shadow-[0_0_12px_rgb(248_251_105/0.5)]" />
                </motion.div>
                <motion.div
                  className="absolute -right-1 top-0"
                  animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                >
                  <Sparkle className="h-4 w-4 text-sun-300" />
                </motion.div>
                <motion.div
                  className="absolute -left-1 bottom-1"
                  animate={{ scale: [0.7, 1, 0.7], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
                >
                  <Sparkle className="h-3 w-3 text-sun-200" />
                </motion.div>
              </div>

              <p className="eyebrow flex items-center gap-3 text-sun-200/90">
                <span className="inline-block h-px w-8 bg-sun-200/50" />
                Ngā mihi nui
                <span className="inline-block h-px w-8 bg-sun-200/50" />
              </p>

              <h2 className="display text-3xl leading-tight tracking-tight text-cream-50 sm:text-4xl">
                Achievement{achievements.length > 1 ? "s" : ""}{" "}
                <em>Unlocked!</em>
              </h2>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-sun-200/30 bg-sun-200/15 px-4 py-1.5 text-sm font-medium text-sun-200">
                <Sparkle className="h-3.5 w-3.5" />
                +{totalPoints} points earned
              </span>
            </motion.div>
          </DialogTitle>
        </DialogHeader>

        <div className="scrollbar-hide relative z-[1] flex-1 space-y-3 overflow-y-auto px-7 py-6">
          <AnimatePresence>
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: 0.2 + index * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <motion.div
                  className="grain flex items-center gap-3 rounded-2xl border border-cream-50/12 bg-cream-50/5 p-4"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-cream-50/10 text-2xl ring-1 ring-cream-50/10"
                    animate={{ scale: [1, 1.12, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {achievement.icon}
                  </motion.div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-base text-cream-50">
                        {achievement.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${
                          CATEGORY_COLORS[
                            achievement.category as keyof typeof CATEGORY_COLORS
                          ] ?? CATEGORY_COLORS.DEDICATION
                        }`}
                      >
                        {achievement.category}
                      </span>
                    </div>
                    <p className="mb-2 text-sm leading-relaxed text-cream-50/70">
                      {achievement.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-sun-200">
                      <Sparkle className="h-3 w-3" />
                      +{achievement.points} points
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="relative z-[1] flex shrink-0 justify-center px-7 pb-8 pt-2">
          <Button
            onClick={onClose}
            className="bg-sun-200 px-10 font-medium text-forest-700 hover:bg-sun-300 hover:text-forest-700"
          >
            Ka pai!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
