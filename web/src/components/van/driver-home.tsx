"use client";

import Link from "next/link";
import { ChevronRight, QrCode, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DriverScreen, StatusPill } from "@/components/van/van-chrome";
import { formatDuration } from "@/lib/van/format";
import type { FleetStatus } from "@/lib/van/queries";

interface DayGroup {
  key: string;
  label: string;
  trips: Array<{
    id: string;
    purposeLabel: string;
    subtitle: string;
    distanceLabel: string;
    flagged: boolean;
  }>;
}

export function DriverHome({
  firstName,
  driverStatus,
  statusNote,
  today,
  recentKmLabel,
  fleet,
  viewerId,
  openTrip,
  days,
}: {
  firstName: string;
  driverStatus: "PENDING" | "APPROVED" | "SUSPENDED" | null;
  statusNote: string | null;
  today: string;
  recentKmLabel: string;
  fleet: FleetStatus;
  viewerId: string;
  openTrip: {
    id: string;
    vehicleName: string;
    orgLabel: string;
    purposeLabel: string;
    startedAt: string;
    startedAtLabel: string;
  } | null;
  days: DayGroup[];
}) {
  return (
    <DriverScreen testid="van-driver-home">
      <header className="pb-2 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {today}
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em]">
          Kia ora, {firstName}
        </h1>
      </header>

      {driverStatus === null && <RegisterCard />}
      {driverStatus === "PENDING" && (
        <StatusCard
          tone="muted"
          title="Waiting for approval"
          body="Someone in the office needs to okay your driver account before you can take a van out."
          testid="van-home-pending"
        />
      )}
      {driverStatus === "SUSPENDED" && (
        <StatusCard
          tone="danger"
          title="Your driver account is on hold"
          body={
            statusNote ??
            "Get in touch with the office and they will sort it out."
          }
          testid="van-home-suspended"
        />
      )}

      {openTrip ? (
        <section
          className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm"
          data-testid="van-home-open-trip"
        >
          <div className="flex items-center gap-2">
            <StatusPill tone="accent" dot>
              On the road
            </StatusPill>
            <span className="text-sm text-primary-foreground/80">
              {formatDuration(new Date(openTrip.startedAt), new Date())} out
            </span>
          </div>
          <p className="mt-3 text-[22px] font-semibold leading-tight">
            {openTrip.vehicleName}
          </p>
          <p className="mt-0.5 text-sm text-primary-foreground/80">
            {openTrip.orgLabel} · {openTrip.purposeLabel} · from{" "}
            {openTrip.startedAtLabel}
          </p>
          <Button
            asChild
            size="xl"
            className="mt-4 w-full bg-sun-200 text-forest-700 hover:bg-sun-300"
            data-testid="van-home-end-trip"
          >
            <Link href={`/drive/trip/${openTrip.id}/end`}>End trip</Link>
          </Button>
        </section>
      ) : (
        driverStatus === "APPROVED" && (
          <section>
            <Button
              asChild
              size="xl"
              className="w-full"
              data-testid="van-home-start-trip"
            >
              <Link href="/drive/vans">
                <Truck aria-hidden />
                Start a trip
              </Link>
            </Button>
            <p className="mt-2.5 flex items-start gap-2 px-1 text-[13px] leading-snug text-muted-foreground">
              <QrCode className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>Faster: scan the sticker on the van&rsquo;s dashboard.</span>
            </p>
          </section>
        )
      )}

      {fleet.length > 0 && (
        <section className="mt-7">
          <h2 className="pb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            The fleet right now
          </h2>
          <ul className="grid grid-cols-2 gap-2">
            {fleet.map((vehicle) => (
              <li key={vehicle.id}>
                <Link
                  href={`/v/${vehicle.id}`}
                  className="block h-full min-h-14 rounded-xl bg-card px-3 py-3 ring-1 ring-inset ring-border transition-colors hover:bg-primary/5"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        vehicle.openTrip
                          ? "bg-amber-500"
                          : "bg-primary dark:bg-forest-300"
                      )}
                      aria-hidden
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {vehicle.openTrip ? "Out" : "Free"}
                    </span>
                  </span>
                  <span className="mt-1.5 block truncate text-[15px] font-semibold leading-tight">
                    {vehicle.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                    {vehicle.openTrip
                      ? vehicle.openTrip.holderId === viewerId
                        ? "With you"
                        : `With ${vehicle.openTrip.holderFirstName}`
                      : vehicle.homeCity}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-7">
        <div className="flex items-baseline justify-between pb-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            My trips
          </h2>
          <p className="text-[13px] font-semibold tabular-nums text-muted-foreground">
            {recentKmLabel} in 30 days
          </p>
        </div>

        {days.length === 0 ? (
          <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            No trips logged yet.
          </p>
        ) : (
          <div className="space-y-5">
            {days.map((day) => (
              <div key={day.key}>
                <p className="pb-1.5 text-[13px] font-semibold text-muted-foreground">
                  {day.label}
                </p>
                <ul className="overflow-hidden rounded-xl ring-1 ring-border">
                  {day.trips.map((trip, i) => (
                    <li key={trip.id} className={i > 0 ? "border-t border-border" : ""}>
                      <Link
                        href={`/drive/trip/${trip.id}`}
                        className="flex min-h-14 items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-primary/5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold leading-tight">
                            {trip.purposeLabel}
                          </span>
                          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                            {trip.subtitle}
                          </span>
                        </span>
                        {trip.flagged && (
                          <StatusPill tone="warn">Flagged</StatusPill>
                        )}
                        <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                          {trip.distanceLabel}
                        </span>
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </DriverScreen>
  );
}

function RegisterCard() {
  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border" data-testid="van-home-register">
      <h2 className="text-[17px] font-semibold leading-tight">
        Drive one of the vans?
      </h2>
      <p className="mt-1 text-[14px] leading-snug text-muted-foreground">
        Everybody Eats checks who drives its vans, so this needs approving once.
        After that, scanning the sticker is all it takes.
      </p>
      <Button asChild size="lg" className="mt-3 w-full">
        <Link href="/drive/register">Register to drive</Link>
      </Button>
    </section>
  );
}

function StatusCard({
  tone,
  title,
  body,
  testid,
}: {
  tone: "muted" | "danger";
  title: string;
  body: string;
  testid: string;
}) {
  return (
    <section
      data-testid={testid}
      className={cn(
        "rounded-2xl px-4 py-4",
        tone === "danger"
          ? "bg-red-50 dark:bg-red-400/10"
          : "bg-muted"
      )}
    >
      <p
        className={cn(
          "text-[15px] font-semibold",
          tone === "danger" && "text-red-800 dark:text-red-200"
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "mt-1 text-[13px] leading-snug",
          tone === "danger"
            ? "text-red-700/90 dark:text-red-200/80"
            : "text-muted-foreground"
        )}
      >
        {body}
      </p>
    </section>
  );
}
