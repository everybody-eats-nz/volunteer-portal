import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ChevronRight, QrCode } from "lucide-react";
import type { Metadata } from "next";

import { authOptions } from "@/lib/auth-options";
import { getFleetStatus } from "@/lib/van/queries";
import { formatOdo, formatSince } from "@/lib/van/format";
import { DriverScreen, FlowHeader, StatusPill } from "@/components/van/van-chrome";

export const metadata: Metadata = {
  title: "Pick a van",
  robots: { index: false, follow: false },
};

/** The fallback entry point, for anyone who cannot scan the sticker. */
export default async function VansPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/drive/vans");

  const fleet = await getFleetStatus();
  const cities = [...new Set(fleet.map((v) => v.homeCity))];
  const now = new Date();

  return (
    <DriverScreen testid="van-picker">
      <FlowHeader backHref="/drive" />
      <div className="pt-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">
          Pick a van
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Or scan the sticker inside the van to skip this step.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {cities.map((city) => (
          <section key={city}>
            <h2 className="pb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              {city}
            </h2>
            <ul className="space-y-2">
              {fleet
                .filter((v) => v.homeCity === city)
                .map((vehicle) => (
                  <li key={vehicle.id}>
                    <Link
                      href={`/v/${vehicle.id}`}
                      data-testid={`van-picker-${vehicle.id}`}
                      className="flex min-h-16 items-center gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-inset ring-border transition-colors hover:bg-primary/5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[17px] font-semibold leading-tight">
                            {vehicle.name}
                          </span>
                          {vehicle.openTrip ? (
                            <StatusPill tone="out" dot>
                              Out
                            </StatusPill>
                          ) : (
                            <StatusPill tone="available" dot>
                              Free
                            </StatusPill>
                          )}
                        </span>
                        <span className="mt-1 block truncate text-sm tabular-nums text-muted-foreground">
                          {vehicle.openTrip
                            ? `${vehicle.openTrip.holderFirstName} ${formatSince(new Date(vehicle.openTrip.startedAt), now)}`
                            : `${vehicle.rego} · ${formatOdo(vehicle.currentOdo)} km`}
                        </span>
                      </span>
                      <ChevronRight
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        {fleet.length === 0 && (
          <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            No vans are set up yet.
          </p>
        )}
      </div>

      <p className="mt-8 flex items-start gap-2.5 rounded-xl bg-primary/8 px-4 py-3.5 text-sm leading-snug text-primary dark:bg-forest-500/15 dark:text-forest-100">
        <QrCode className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Every van has a sticker on the dash. Scanning it opens this app with
          the van already chosen.
        </span>
      </p>
    </DriverScreen>
  );
}
