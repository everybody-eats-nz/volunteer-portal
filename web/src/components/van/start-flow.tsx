"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FlowHeader } from "@/components/van/van-chrome";
import { OdometerCapture } from "@/components/van/odometer-capture";
import { formatOdo } from "@/lib/van/format";

/**
 * Starting a trip is four or five taps and under twenty seconds.
 *
 * The QR sticker in the van already chose the vehicle and the session already
 * knows the driver, so identity is off the critical path. The photo is the
 * primary input. Selecting the purpose *is* the submit — there is no separate
 * confirm step — and the optional note lives after the trip has started rather
 * than in the way of it. When the driver's last organisation and purpose are
 * both still offerable, "Same as last time" collapses two taps into one, which
 * is the path most drivers take most days.
 */

export interface StartFlowOrganisation {
  id: string;
  name: string;
  isInternal: boolean;
  isCatchAll: boolean;
}

export interface StartFlowPurpose {
  id: string;
  label: string;
  requiresNote: boolean;
}

export interface StartFlowVehicle {
  id: string;
  name: string;
  rego: string;
  currentOdo: number;
}

type Step = "odo" | "org" | "purpose" | "external";

const STEP_INDEX: Record<Step, number> = {
  odo: 1,
  org: 2,
  purpose: 3,
  external: 3,
};

export function StartFlow({
  vehicle,
  organisations,
  purposes,
  shortcut,
  onCancel,
}: {
  vehicle: StartFlowVehicle;
  organisations: StartFlowOrganisation[];
  purposes: StartFlowPurpose[];
  shortcut: { organisationId: string; organisationName: string; purposeId: string; purposeLabel: string } | null;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("odo");
  const [odo, setOdo] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [externalName, setExternalName] = useState("");
  const [externalUse, setExternalUse] = useState("");
  const [noteFor, setNoteFor] = useState<StartFlowPurpose | null>(null);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const internal = organisations.filter((o) => o.isInternal);
  const external = organisations.filter((o) => !o.isInternal && !o.isCatchAll);
  const catchAll = organisations.find((o) => o.isCatchAll) ?? null;

  async function commit(input: {
    organisationId: string;
    externalOrgName: string | null;
    purposeId: string | null;
    purposeOther: string | null;
  }) {
    if (odo === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/van/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          startOdo: odo,
          startOdoPhotoUrl: photoUrl,
          ...input,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Could not start the trip.");
        setSubmitting(false);
        return;
      }
      router.replace(`/drive/trip/${body.tripId}?started=1`);
    } catch {
      setError("No connection. Try again in a moment.");
      setSubmitting(false);
    }
  }

  function back() {
    setError(null);
    if (step === "odo") onCancel();
    else if (step === "org") setStep("odo");
    else setStep("org");
  }

  const header = (
    <FlowHeader
      onBack={back}
      title={vehicle.name}
      sub={`${vehicle.rego} · from ${formatOdo(odo ?? vehicle.currentOdo)} km`}
      step={STEP_INDEX[step]}
      stepCount={3}
    />
  );

  if (step === "odo") {
    return (
      <>
        {header}
        <div className="flex flex-1 flex-col">
          <OdometerCapture
            lastReading={vehicle.currentOdo || null}
            heading="Photograph the odometer"
            confirmLabel="Yes, that is right"
            onConfirm={(reading, url) => {
              setOdo(reading);
              setPhotoUrl(url);
              setStep("org");
            }}
          />
        </div>
      </>
    );
  }

  if (step === "org") {
    return (
      <>
        {header}
        <div className="flex flex-1 flex-col">
          <h1 className="pt-5 text-[26px] font-semibold leading-tight tracking-[-0.02em]">
            Who is this trip for?
          </h1>

          <div className="mt-5 space-y-2">
            {shortcut && (
              <>
                <Choice
                  emphasis
                  testid="van-shortcut"
                  title={`${shortcut.organisationName} · ${shortcut.purposeLabel}`}
                  subtitle="Same as your last trip"
                  trailing={<Check className="size-5 shrink-0 text-primary dark:text-forest-200" aria-hidden />}
                  disabled={submitting}
                  onClick={() =>
                    void commit({
                      organisationId: shortcut.organisationId,
                      externalOrgName: null,
                      purposeId: shortcut.purposeId,
                      purposeOther: null,
                    })
                  }
                />
                <p className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  Or pick
                </p>
              </>
            )}

            {internal.map((org) => (
              <Choice
                key={org.id}
                title={org.name}
                disabled={submitting}
                onClick={() => {
                  setOrganisationId(org.id);
                  setNoteFor(null);
                  setStep("purpose");
                }}
              />
            ))}
            {external.map((org) => (
              <Choice
                key={org.id}
                title={org.name}
                subtitle="Borrowing the van"
                disabled={submitting}
                onClick={() => {
                  setOrganisationId(org.id);
                  setExternalName("");
                  setStep("external");
                }}
              />
            ))}
            {catchAll && (
              <Choice
                title="Other organisation"
                subtitle="Someone not on this list"
                disabled={submitting}
                onClick={() => {
                  setOrganisationId(catchAll.id);
                  setStep("external");
                }}
              />
            )}
          </div>
          <ErrorNote error={error} />
        </div>
      </>
    );
  }

  if (step === "purpose" && organisationId) {
    const orgName = organisations.find((o) => o.id === organisationId)?.name;
    return (
      <>
        {header}
        <div className="flex flex-1 flex-col">
          <h1 className="pt-5 text-[26px] font-semibold leading-tight tracking-[-0.02em]">
            What is the van doing?
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Picking one starts the trip. {orgName}.
          </p>

          <div className="mt-5 space-y-2">
            {purposes.map((purpose) => (
              <Choice
                key={purpose.id}
                testid={`van-purpose-${purpose.id}`}
                title={purpose.label}
                selected={noteFor?.id === purpose.id}
                disabled={submitting}
                onClick={() => {
                  // Whether a purpose asks for free text is a property of the
                  // purpose, not a match on its label — an admin renaming
                  // "Other" must not silently turn the prompt off.
                  if (purpose.requiresNote) {
                    setNoteFor(purpose);
                    return;
                  }
                  void commit({
                    organisationId,
                    externalOrgName: null,
                    purposeId: purpose.id,
                    purposeOther: null,
                  });
                }}
              />
            ))}
          </div>

          {noteFor && (
            <div className="mt-4">
              <Label htmlFor="van-purpose-note">What is it for?</Label>
              <Input
                id="van-purpose-note"
                autoFocus
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Taking the chiller in for a service"
                className="mt-1.5 h-12 text-base"
              />
              <Button
                size="xl"
                className="mt-4 w-full"
                data-testid="van-start-with-note"
                disabled={noteText.trim().length < 3 || submitting}
                onClick={() =>
                  void commit({
                    organisationId,
                    externalOrgName: null,
                    purposeId: noteFor.id,
                    purposeOther: noteText.trim(),
                  })
                }
              >
                Start trip
              </Button>
            </div>
          )}
          <ErrorNote error={error} />
        </div>
      </>
    );
  }

  if (step === "external" && organisationId) {
    const org = organisations.find((o) => o.id === organisationId);
    const isCatchAll = org?.isCatchAll ?? false;
    const nameOk = !isCatchAll || externalName.trim().length >= 2;
    return (
      <>
        {header}
        <div className="flex flex-1 flex-col">
          <h1 className="pt-5 text-[26px] font-semibold leading-tight tracking-[-0.02em]">
            {isCatchAll ? "Who is borrowing it?" : org?.name}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Borrowed trips still count towards the van&rsquo;s total, so this
            shows up in reporting.
          </p>

          <div className="mt-5 space-y-4">
            {isCatchAll && (
              <div>
                <Label htmlFor="van-external-org">Organisation</Label>
                <Input
                  id="van-external-org"
                  autoFocus
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                  placeholder="Wellington City Mission"
                  className="mt-1.5 h-12 text-base"
                />
              </div>
            )}
            <div>
              <Label htmlFor="van-external-use">
                What are they using it for?
              </Label>
              <Textarea
                id="van-external-use"
                autoFocus={!isCatchAll}
                value={externalUse}
                onChange={(e) => setExternalUse(e.target.value)}
                placeholder="Moving donated furniture"
                rows={3}
                className="mt-1.5 text-base"
              />
            </div>
          </div>

          <ErrorNote error={error} />

          <div className="mt-auto pt-8">
            <Button
              size="xl"
              className="w-full"
              data-testid="van-start-external"
              disabled={!nameOk || externalUse.trim().length < 3 || submitting}
              onClick={() =>
                void commit({
                  organisationId,
                  externalOrgName: isCatchAll ? externalName.trim() : null,
                  purposeId: null,
                  purposeOther: externalUse.trim(),
                })
              }
            >
              Start trip
            </Button>
          </div>
        </div>
      </>
    );
  }

  return null;
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      data-testid="van-start-error"
      className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-400/10 dark:text-red-200"
    >
      {error}
    </p>
  );
}

export function Choice({
  title,
  subtitle,
  trailing,
  selected,
  emphasis,
  disabled,
  onClick,
  testid,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  selected?: boolean;
  emphasis?: boolean;
  disabled?: boolean;
  onClick: () => void;
  testid?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className={cn(
        // min-h-14: comfortably past the 44px touch minimum, for a phone held
        // in one hand next to an open van door.
        "flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left ring-1 ring-inset transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        emphasis
          ? "bg-primary/8 ring-primary/30 hover:bg-primary/12 dark:bg-forest-500/20 dark:ring-forest-300/30"
          : "bg-card ring-border hover:bg-primary/5",
        selected && "ring-2 ring-primary"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-semibold leading-tight">
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
      {trailing}
    </button>
  );
}
