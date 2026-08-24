/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

/**
 * Page-local branded header for the achievements flow — eyebrow + Fraunces
 * display treatment, matching the shifts and dashboard pages
 * (new.everybodyeats.nz). Shared by the page and its loading state so the two
 * never drift. The accessible heading name keeps the word "Achievements" that
 * the e2e suite waits on.
 */
export function AchievementsPageHeader() {
  return (
    <header className="pb-2">
      <p className="eyebrow mb-4 flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
        <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
        Ngā tohu · Your volunteer milestones
      </p>
      <h1
        className="display flex flex-wrap items-baseline gap-x-3 text-4xl leading-[1.0] tracking-tight text-forest-700 sm:text-5xl lg:text-6xl dark:text-cream-50"
        data-testid="achievements-page-heading"
      >
        <span>
          Your <em>Achievements</em>
        </span>
        <Sparkle className="h-6 w-6 shrink-0 self-center text-sun-300 sm:h-7 sm:w-7" />
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-forest-700/75 dark:text-cream-50/75">
        Track your volunteer journey and see how you compare with others
      </p>
    </header>
  );
}
