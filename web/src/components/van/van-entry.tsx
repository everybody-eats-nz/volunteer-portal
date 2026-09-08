"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock3, KeyRound, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DriverScreen,
  FlowHeader,
  StatusPill,
} from "@/components/van/van-chrome";
import {
  StartFlow,
  type StartFlowOrganisation,
  type StartFlowPurpose,
  type StartFlowVehicle,
} from "@/components/van/start-flow";
import { formatOdo, formatSince } from "@/lib/van/format";

/**
 * What the sticker on the dashboard opens.
 *
 * The page itself is public and stays dumb: it shows the van, its rego, its
 * photo and whether it is out, and decides what to offer from that. Auth is
 * required only when the driver taps "Start trip", so somebody scanning the
 * sticker for the first time is not met by a login form.
 */

export type DriverState =
  | { kind: "anonymous" }
  | { kind: "not-registered" }
  | { kind: "pending" }
  | { kind: "suspended"; note: string | null }
  | { kind: "approved"; firstName: string };

export interface VanEntryOpenTrip {
  id: string;
  holderFirstName: string;
  isMine: boolean;
  startedAt: string;
  startOdo: number;
}

export function VanEntry({
  vehicle,
  photoUrl,
  homeCity,
  openTrip,
  driver,
  organisations,
  purposes,
  shortcut,
  autoStart,
}: {
  vehicle: StartFlowVehicle;
  photoUrl: string | null;
  homeCity: string;
  openTrip: VanEntryOpenTrip | null;
  driver: DriverState;
  organisations: StartFlowOrganisation[];
  purposes: StartFlowPurpose[];
  shortcut: {
    organisationId: string;
    organisationName: string;
    purposeId: string;
    purposeLabel: string;
  } | null;
  /** Arrived back here straight after signing in, mid-scan. */
  autoStart: boolean;
}) {
  const [starting, setStarting] = useState(
    autoStart && driver.kind === "approved" && !openTrip?.isMine
  );
  const now = new Date();

  if (starting) {
    return (
      <DriverScreen testid="van-start-flow">
        <StartFlow
          vehicle={vehicle}
          organisations={organisations}
          purposes={purposes}
          shortcut={shortcut}
          onCancel={() => setStarting(false)}
        />
      </DriverScreen>
    );
  }

  return (
    <DriverScreen testid="van-status-page">
      <FlowHeader />
      <div className="flex flex-1 flex-col">
        <div className="pt-2">
          {openTrip ? (
            <StatusPill tone="out" dot>
              Out now
            </StatusPill>
          ) : (
            <StatusPill tone="available" dot>
              Available
            </StatusPill>
          )}
          <h1
            className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em]"
            data-testid="van-name"
          >
            {vehicle.name}
          </h1>
          <p className="mt-1.5 text-[15px] tabular-nums text-muted-foreground">
            {vehicle.rego} · {homeCity} · last read{" "}
            {formatOdo(vehicle.currentOdo)} km
          </p>
        </div>

        {photoUrl && (
          <div className="relative mt-4 aspect-[16/10] w-full overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
            <Image
              src={photoUrl}
              alt={`${vehicle.name}, registration ${vehicle.rego}`}
              fill
              sizes="(max-width: 448px) 100vw, 448px"
              className="object-cover"
              priority
            />
          </div>
        )}

        {openTrip && (
          <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3.5 dark:bg-amber-400/10">
            <p className="flex items-start gap-2 text-[15px] font-semibold leading-snug text-amber-900 dark:text-amber-200">
              <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {openTrip.isMine
                  ? `You have this van out ${formatSince(new Date(openTrip.startedAt), now)}`
                  : `Out with ${openTrip.holderFirstName} ${formatSince(new Date(openTrip.startedAt), now)}`}
              </span>
            </p>
            <p className="mt-1.5 pl-6 text-[13px] leading-snug tabular-nums text-amber-800/90 dark:text-amber-200/80">
              Started at {formatOdo(openTrip.startOdo)} km.
            </p>
          </div>
        )}

        <div className="mt-auto space-y-2.5 pt-8">
          <Actions
            driver={driver}
            openTrip={openTrip}
            vehicleId={vehicle.id}
            onStart={() => setStarting(true)}
          />
        </div>
      </div>
    </DriverScreen>
  );
}

function Actions({
  driver,
  openTrip,
  vehicleId,
  onStart,
}: {
  driver: DriverState;
  openTrip: VanEntryOpenTrip | null;
  vehicleId: string;
  onStart: () => void;
}) {
  // The van is out.
  if (openTrip) {
    if (driver.kind !== "approved") {
      return (
        <SignInPrompt
          driver={driver}
          vehicleId={vehicleId}
          label="Sign in to end this trip"
        />
      );
    }

    // The driver holding it is coming back.
    if (openTrip.isMine) {
      return (
        <>
          <Button asChild size="xl" className="w-full" data-testid="van-end-open-trip">
            <Link href={`/drive/trip/${openTrip.id}/end`}>End my trip</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="w-full">
            <Link href="/drive">My trips</Link>
          </Button>
        </>
      );
    }

    // Somebody else left it open. Usually that means they forgot, and the
    // person scanning now is about to drive it — so taking it out is the
    // primary action, and the one odometer photo they take closes the previous
    // trip on the way through. Nothing invents a reading nobody observed.
    return (
      <>
        <Button
          size="xl"
          className="w-full"
          data-testid="van-take-over"
          onClick={onStart}
        >
          Take the van out
        </Button>
        <Button
          asChild
          variant="secondary"
          size="lg"
          className="w-full"
          data-testid="van-end-open-trip"
        >
          <Link href={`/drive/trip/${openTrip.id}/end`}>
            Just bringing it back
          </Link>
        </Button>
        <p className="pt-1 text-center text-[13px] leading-snug text-muted-foreground">
          Either way you photograph the odometer once. That reading closes{" "}
          {openTrip.holderFirstName}&rsquo;s trip.
        </p>
      </>
    );
  }

  switch (driver.kind) {
    case "approved":
      return (
        <>
          <Button
            size="xl"
            className="w-full"
            data-testid="van-start-trip"
            onClick={onStart}
          >
            Start trip
          </Button>
          <p className="pt-1 text-center text-[13px] text-muted-foreground">
            Driving as {driver.firstName}
          </p>
        </>
      );

    case "pending":
      return (
        <div className="rounded-xl bg-muted px-4 py-4 text-center" data-testid="van-driver-pending">
          <p className="text-[15px] font-semibold">
            Your driver account is waiting for approval
          </p>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            Someone in the office needs to okay it before you can take a van
            out. You will get an email.
          </p>
        </div>
      );

    case "suspended":
      return (
        <div className="rounded-xl bg-red-50 px-4 py-4 text-center dark:bg-red-400/10" data-testid="van-driver-suspended">
          <p className="text-[15px] font-semibold text-red-800 dark:text-red-200">
            Your driver account is on hold
          </p>
          <p className="mt-1 text-[13px] leading-snug text-red-700/90 dark:text-red-200/80">
            {driver.note ?? "Get in touch with the office and they will sort it out."}
          </p>
        </div>
      );

    case "not-registered":
      return (
        <>
          <Button asChild size="xl" className="w-full" data-testid="van-register-to-drive">
            <Link href={`/drive/register?van=${vehicleId}`}>
              Register to drive
            </Link>
          </Button>
          <p className="pt-1 text-center text-[13px] leading-snug text-muted-foreground">
            Everybody Eats checks who drives its vans, so this needs approving
            once.
          </p>
        </>
      );

    case "anonymous":
      return <SignInPrompt driver={driver} vehicleId={vehicleId} label="Start trip" />;
  }
}

function SignInPrompt({
  vehicleId,
  label,
}: {
  driver: DriverState;
  vehicleId: string;
  label: string;
}) {
  // `passkey=1` fires the passkey prompt on arrival where the device has one,
  // so a driver who has signed in before gets one system prompt rather than a
  // form. `start=1` brings them straight back into the flow they tapped.
  const callbackUrl = `/v/${vehicleId}?start=1`;
  return (
    <>
      <Button asChild size="xl" className="w-full" data-testid="van-sign-in-to-start">
        <Link
          href={`/login?passkey=1&callbackUrl=${encodeURIComponent(callbackUrl)}`}
        >
          <KeyRound aria-hidden />
          {label}
        </Link>
      </Button>
      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[13px] text-muted-foreground">
        <LogIn className="size-3.5" aria-hidden />
        One tap if you have used this phone before.
      </p>
    </>
  );
}
