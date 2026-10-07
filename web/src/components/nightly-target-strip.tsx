import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_META, StatusPill } from "@/components/budget-status";
import {
  CLOSE_TO_TARGET_RATIO,
  budgetStatus,
  budgetYearLabel,
  ratioToPercent,
  type NightlyTarget,
} from "@/lib/budget-calculations";

const money0 = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  maximumFractionDigits: 0,
});

interface NightlyTargetStripProps {
  location: string;
  /** The night's koha target; null when the venue has none for this night. */
  target: NightlyTarget | null;
  /** Koha entered so far (cash + EFTPOS + Stripe); null while none is entered. */
  koha: number | null;
}

/**
 * Tonight's koha against the nightly target, at the top of the Service Night
 * Report. Uses the same red / yellow / green thresholds as budget tracking and
 * updates live as koha is typed in.
 */
export function NightlyTargetStrip({
  location,
  target,
  koha,
}: NightlyTargetStripProps) {
  if (!target) {
    return (
      <div
        data-testid="nightly-target"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-dashed border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground"
      >
        <span className="flex items-center gap-2">
          <Target className="h-4 w-4 shrink-0" />
          No koha target set for this night.
        </span>
        <BudgetLink location={location}>Set a budget</BudgetLink>
      </div>
    );
  }

  const ratio = koha === null ? null : koha / target.amount;
  const status = koha === null ? null : budgetStatus(koha, target.amount);
  const meta = status ? STATUS_META[status] : null;
  const percent = ratio === null ? null : ratioToPercent(ratio);
  const gap = koha === null ? 0 : koha - target.amount;

  return (
    <section
      data-testid="nightly-target"
      data-status={status ?? "pending"}
      aria-label="Nightly koha target"
      className={cn(
        "rounded-xl border px-4 py-3",
        meta ? meta.surface : "border-border/70 bg-card/70"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          {percent === null || !meta ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Target className="h-5 w-5" />
            </span>
          ) : (
            <span
              data-testid="nightly-target-percent"
              className={cn(
                "font-accent text-3xl font-semibold leading-none tabular-nums",
                meta.text
              )}
            >
              {percent}%
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {koha === null ? "Tonight's koha target" : "of tonight's koha target"}
            </p>
            <p className="text-sm tabular-nums text-foreground">
              {koha === null ? (
                <>
                  <span className="font-semibold">
                    {money0.format(target.amount)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · record koha to see how tonight tracks
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold">{money0.format(koha)}</span>{" "}
                  of {money0.format(target.amount)}
                  <span className="text-muted-foreground">
                    {" "}
                    ·{" "}
                    {gap >= 0
                      ? `${money0.format(gap)} over`
                      : `${money0.format(-gap)} to go`}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <StatusPill status={status} className="py-1" />
      </div>

      <TargetBar ratio={ratio} fill={meta?.fill} />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          {target.source === "budget"
            ? `Nightly share of the ${budgetYearLabel(target.budgetYear)} budget`
            : `Standing target for ${location} - no ${budgetYearLabel(target.budgetYear)} budget set`}
        </span>
        <BudgetLink location={location} year={target.budgetYear}>
          {target.source === "budget" ? "Budget tracking" : "Set a budget"}
        </BudgetLink>
      </div>
    </section>
  );
}

/**
 * Fills with koha banked; the faint tick marks where "close to target"
 * (yellow) starts. Scales rather than resizes so the fill animates cheaply.
 */
function TargetBar({
  ratio,
  fill,
}: {
  ratio: number | null;
  fill: string | undefined;
}) {
  const width = Math.min(1, Math.max(0, ratio ?? 0));
  return (
    <div
      className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10"
      role="img"
      aria-label={
        ratio === null
          ? "No koha recorded yet"
          : `${ratioToPercent(ratio)}% of the nightly target banked`
      }
    >
      <div
        className={cn(
          "h-full w-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none",
          fill ?? "bg-muted-foreground/40"
        )}
        style={{ transform: `scaleX(${width})` }}
      />
      <span
        aria-hidden
        className="absolute inset-y-0 w-px bg-foreground/25"
        style={{ left: `${CLOSE_TO_TARGET_RATIO * 100}%` }}
      />
    </div>
  );
}

function BudgetLink({
  location,
  year,
  children,
}: {
  location: string;
  year?: number;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams({ location });
  if (year !== undefined) params.set("year", String(year));
  return (
    <Link
      href={`/admin/analytics/budget?${params.toString()}`}
      className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
