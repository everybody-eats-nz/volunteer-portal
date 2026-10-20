import { ChefHat, ConciergeBell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DayLeads } from "@/lib/day-leads";

/**
 * Who's running the day, for volunteers: the Chef and FOH Manager by first
 * name. Renders nothing when neither is listed.
 */
export function DayLeadsStrip({
  leads,
  className,
  testId = "day-leads-strip",
}: {
  leads: DayLeads | undefined;
  className?: string;
  testId?: string;
}) {
  if (!leads) return null;
  const roles = [
    { label: "Chef", name: leads.chef, Icon: ChefHat },
    { label: "FOH Manager", name: leads.fohManager, Icon: ConciergeBell },
  ].filter((role) => role.name);
  if (roles.length === 0) return null;

  return (
    <dl
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-forest-700 dark:text-cream-50/85",
        className
      )}
      data-testid={testId}
    >
      {roles.map(({ label, name, Icon }) => (
        <div key={label} className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-forest-500/10 text-forest-600 dark:bg-cream-50/10 dark:text-cream-50/75">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <dt className="text-forest-700/60 dark:text-cream-50/55">{label}</dt>
          <dd className="truncate font-semibold">{name}</dd>
        </div>
      ))}
    </dl>
  );
}
