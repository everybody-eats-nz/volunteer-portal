import { Timer, CheckCircle, Users } from "lucide-react";

/* Brand status pills (new.everybodyeats.nz): semantic colour on a quiet
   tinted pill — confirmed/forest, pending/amber, waitlisted/sun — legible on
   both cream and forest surfaces. */
const base =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

export function StatusBadge({
  status,
  isPast = false,
}: {
  status: string;
  isPast?: boolean;
}) {
  switch (status) {
    case "PENDING":
    case "REGULAR_PENDING":
      return (
        <span
          data-testid="status-badge"
          className={`${base} bg-amber-400/15 text-amber-800 ring-amber-500/25 dark:bg-amber-300/10 dark:text-amber-200 dark:ring-amber-300/25`}
        >
          <Timer className="h-3 w-3" aria-hidden />
          Pending
        </span>
      );
    case "CONFIRMED":
      return (
        <span
          data-testid="status-badge"
          className={`${base} bg-forest-500/10 text-forest-700 ring-forest-500/20 dark:bg-forest-300/15 dark:text-forest-100 dark:ring-forest-300/25`}
        >
          <CheckCircle className="h-3 w-3" aria-hidden />
          {isPast ? "Completed" : "Confirmed"}
        </span>
      );
    case "WAITLISTED":
      return (
        <span
          data-testid="status-badge"
          className={`${base} bg-sun-200/70 text-forest-700 ring-forest-500/15 dark:bg-sun-200/15 dark:text-sun-100 dark:ring-sun-200/30`}
        >
          <Users className="h-3 w-3" aria-hidden />
          Waitlisted
        </span>
      );
    default:
      return null;
  }
}
