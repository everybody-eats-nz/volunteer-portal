"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DriverScreen, FlowHeader } from "@/components/van/van-chrome";
import { Choice } from "@/components/van/start-flow";

/**
 * Driver self-registration.
 *
 * Everything here is optional except who the driver drives for, because the
 * form is a request rather than a qualification: approval is a person's
 * decision. Licence *photos* are deliberately not collected yet — when they
 * land they go in private storage readable only by admins, with a retention
 * rule, and that is not something to bolt on in the same pass as the odometer
 * photos.
 */
export function DriverRegisterForm({
  organisations,
  existingStatus,
  returnToVanId,
}: {
  organisations: Array<{ id: string; name: string; isInternal: boolean }>;
  existingStatus: "PENDING" | "APPROVED" | "SUSPENDED" | null;
  returnToVanId: string | null;
}) {
  const router = useRouter();
  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [licenceClass, setLicenceClass] = useState("");
  const [licenceExpiry, setLicenceExpiry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(existingStatus === "PENDING");

  async function submit() {
    if (!organisationId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/van/driver-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId,
          licenceClass: licenceClass.trim() || null,
          licenceExpiry: licenceExpiry
            ? new Date(`${licenceExpiry}T00:00:00Z`).toISOString()
            : null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Could not send that. Try again.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      router.refresh();
    } catch {
      setError("No connection. Try again in a moment.");
      setSubmitting(false);
    }
  }

  if (existingStatus === "APPROVED") {
    return (
      <DriverScreen testid="van-register-approved">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-8" aria-hidden />
          </span>
          <h1 className="mt-6 text-2xl font-semibold">
            You are approved to drive
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Scan the sticker in the van and you are away.
          </p>
        </div>
        <div className="pb-4">
          <Button asChild size="xl" className="w-full">
            <Link href={returnToVanId ? `/v/${returnToVanId}` : "/drive"}>
              {returnToVanId ? "Back to the van" : "My trips"}
            </Link>
          </Button>
        </div>
      </DriverScreen>
    );
  }

  if (submitted) {
    return (
      <DriverScreen testid="van-register-submitted">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
            <ShieldCheck className="size-8" aria-hidden />
          </span>
          <h1 className="mt-6 text-2xl font-semibold">Sent to the office</h1>
          <p className="mt-2 max-w-xs text-[15px] leading-snug text-muted-foreground">
            Everybody Eats checks who drives its vans, so someone has to okay
            this before your first trip. You will hear back by email.
          </p>
        </div>
        <div className="pb-4">
          <Button asChild size="xl" className="w-full">
            <Link href="/drive">Done</Link>
          </Button>
        </div>
      </DriverScreen>
    );
  }

  return (
    <DriverScreen testid="van-register-form">
      <FlowHeader backHref="/drive" onBack={() => router.back()} />
      <div className="flex flex-1 flex-col pt-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">
          Register to drive
        </h1>
        <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">
          {existingStatus === "SUSPENDED"
            ? "Send your details again and the office will take another look."
            : "One form, once. After that, scanning the sticker in the van is all it takes."}
        </p>

        <div className="mt-6">
          <h2 className="pb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            Who do you drive for?
          </h2>
          <div className="space-y-2">
            {organisations.map((org) => (
              <Choice
                key={org.id}
                testid={`van-register-org-${org.id}`}
                title={org.name}
                subtitle={org.isInternal ? undefined : "Borrowing the van"}
                selected={organisationId === org.id}
                onClick={() => setOrganisationId(org.id)}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            Licence (optional)
          </h2>
          <div>
            <Label htmlFor="van-licence-class">Class</Label>
            <Input
              id="van-licence-class"
              value={licenceClass}
              onChange={(e) => setLicenceClass(e.target.value)}
              placeholder="1"
              inputMode="text"
              className="mt-1.5 h-12 text-base"
            />
          </div>
          <div>
            <Label htmlFor="van-licence-expiry">Expires</Label>
            <Input
              id="van-licence-expiry"
              type="date"
              value={licenceExpiry}
              onChange={(e) => setLicenceExpiry(e.target.value)}
              className="mt-1.5 h-12 text-base"
            />
          </div>
          <p className="text-[13px] leading-snug text-muted-foreground">
            Do not send a photo of your licence yet. When we can store those
            properly, the app will ask.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-400/10 dark:text-red-200"
          >
            {error}
          </p>
        )}

        <div className="mt-auto pt-8">
          <Button
            size="xl"
            className="w-full"
            data-testid="van-register-submit"
            disabled={!organisationId || submitting}
            onClick={() => void submit()}
          >
            Send to the office
          </Button>
        </div>
      </div>
    </DriverScreen>
  );
}
