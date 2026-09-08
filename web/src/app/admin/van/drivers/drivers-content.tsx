"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ShieldOff, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserSearchSelect,
  displayUserName,
  type SearchableUser,
} from "@/components/admin/user-search-select";
import { StatusPill } from "@/components/van/van-chrome";

export interface AdminOrganisation {
  id: string;
  name: string;
  isInternal: boolean;
}

export interface AdminDriver {
  profileId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  organisationName: string | null;
  organisationIsInternal: boolean | null;
  status: "PENDING" | "APPROVED" | "SUSPENDED";
  statusNote: string | null;
  licenceClass: string | null;
  licenceExpiryLabel: string | null;
  licenceExpired: boolean;
  approvedByName: string | null;
  approvedAtLabel: string | null;
  registeredAtLabel: string;
  tripCount: number;
}

/**
 * Driver approval. The client's requirement, in their words: "I don't just want
 * anybody drives a van." This screen is the only thing between an account and a
 * van key, so every decision records who made it.
 */
export function VanDriversContent({
  drivers,
  organisations,
}: {
  drivers: AdminDriver[];
  organisations: AdminOrganisation[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<AdminDriver | null>(null);
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const pending = drivers.filter((d) => d.status === "PENDING");
  const approved = drivers.filter((d) => d.status === "APPROVED");
  const suspended = drivers.filter((d) => d.status === "SUSPENDED");

  async function decide(
    driver: AdminDriver,
    status: AdminDriver["status"],
    statusNote: string | null
  ) {
    setBusyId(driver.profileId);
    try {
      const response = await fetch("/api/admin/van/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: driver.profileId, status, statusNote }),
      });
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error ?? "Could not save that.");
        return;
      }
      toast.success(
        status === "APPROVED"
          ? `${driver.name} can now take a van out`
          : `${driver.name} cannot take a van out`
      );
      setSuspending(null);
      setNote("");
      router.refresh();
    } catch {
      toast.error("No connection. Try again in a moment.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6" data-testid="van-drivers-page">
      {/* Self-registration is still the way most drivers arrive, so this says
          what the button is *for* rather than presenting two equal paths. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-prose text-[13px] leading-snug text-muted-foreground">
          Drivers normally register themselves by scanning the sticker in the
          van. Add somebody here when they are at the desk or on the phone
          instead — they can take a van out straight away.
        </p>
        <Button
          onClick={() => setAdding(true)}
          data-testid="van-driver-add"
          className="shrink-0"
        >
          <UserPlus aria-hidden />
          Add a driver
        </Button>
      </div>

      <Section
        title="Waiting for approval"
        count={pending.length}
        empty="Nobody is waiting."
        testid="van-drivers-pending"
      >
        {pending.map((driver) => (
          <DriverCard key={driver.profileId} driver={driver}>
            <Button
              size="sm"
              disabled={busyId === driver.profileId}
              onClick={() => void decide(driver, "APPROVED", null)}
              data-testid={`van-driver-approve-${driver.userId}`}
            >
              <Check aria-hidden />
              Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busyId === driver.profileId}
              onClick={() => {
                setSuspending(driver);
                setNote("");
              }}
            >
              Decline
            </Button>
          </DriverCard>
        ))}
      </Section>

      <Section
        title="Approved to drive"
        count={approved.length}
        empty="Nobody is approved yet."
        testid="van-drivers-approved"
      >
        {approved.map((driver) => (
          <DriverCard key={driver.profileId} driver={driver}>
            <Button
              variant="secondary"
              size="sm"
              disabled={busyId === driver.profileId}
              onClick={() => {
                setSuspending(driver);
                setNote("");
              }}
              data-testid={`van-driver-suspend-${driver.userId}`}
            >
              <ShieldOff aria-hidden />
              Put on hold
            </Button>
          </DriverCard>
        ))}
      </Section>

      {suspended.length > 0 && (
        <Section
          title="On hold"
          count={suspended.length}
          empty=""
          testid="van-drivers-suspended"
        >
          {suspended.map((driver) => (
            <DriverCard key={driver.profileId} driver={driver}>
              <Button
                size="sm"
                disabled={busyId === driver.profileId}
                onClick={() => void decide(driver, "APPROVED", null)}
              >
                <UserCheck aria-hidden />
                Let them drive again
              </Button>
            </DriverCard>
          ))}
        </Section>
      )}

      {adding && (
        <AddDriverDialog
          organisations={organisations}
          drivers={drivers}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      <Dialog
        open={suspending !== null}
        onOpenChange={(open) => {
          if (!open) setSuspending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {suspending?.status === "PENDING" ? "Decline" : "Put on hold"}:{" "}
              {suspending?.name}
            </DialogTitle>
            <DialogDescription>
              They will see this on their phone when they scan a van, so write
              it for them.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="van-driver-note">Reason (optional)</Label>
            <Input
              id="van-driver-note"
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Send a photo of your renewed licence and we will switch this back on."
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSuspending(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyId !== null}
              onClick={() =>
                suspending &&
                void decide(suspending, "SUSPENDED", note.trim() || null)
              }
              data-testid="van-driver-confirm-hold"
            >
              {suspending?.status === "PENDING" ? "Decline" : "Put on hold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Add a driver                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The office's own door into the allowed list.
 *
 * It asks for exactly what the driver's own form asks for and nothing more:
 * who they drive for, and their licence if the office happens to have it. The
 * point is the answer to "can this person take a van out", and every extra
 * field is a reason to go and do it later.
 *
 * Saving approves them, under the admin's name — which is the same decision the
 * queue records, so the audit trail reads the same either way. The dialog says
 * so out loud rather than leaving it to be discovered.
 */
function AddDriverDialog({
  organisations,
  drivers,
  onClose,
  onAdded,
}: {
  organisations: AdminOrganisation[];
  drivers: AdminDriver[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [user, setUser] = useState<SearchableUser | null>(null);
  const [organisationId, setOrganisationId] = useState(
    organisations[0]?.id ?? ""
  );
  const [licenceClass, setLicenceClass] = useState("");
  const [licenceExpiry, setLicenceExpiry] = useState("");
  const [busy, setBusy] = useState(false);

  // The list is already on this page, so the dialog can say what picking this
  // person will actually do before the admin commits to it.
  const existing = user
    ? (drivers.find((driver) => driver.userId === user.id) ?? null)
    : null;

  const valid = Boolean(user && organisationId) && !busy;

  async function save() {
    if (!user || !valid) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/van/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          organisationId,
          licenceClass: licenceClass.trim() || null,
          licenceExpiry: licenceExpiry
            ? new Date(`${licenceExpiry}T00:00:00Z`).toISOString()
            : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not add that driver.");
        return;
      }
      const name = displayUserName(user);
      toast.success(
        data.outcome === "already-approved"
          ? `${name} was already approved to drive`
          : `${name} can now take a van out`
      );
      onAdded();
    } catch {
      toast.error("No connection. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a driver</DialogTitle>
          <DialogDescription>
            They need an account on the portal first. Approving them here is
            recorded against your name, the same as approving from the queue.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="van-driver-person" className="mb-1.5 block">
              Who
            </Label>
            <UserSearchSelect
              id="van-driver-person"
              value={user}
              onValueChange={setUser}
              placeholder="Search for a person..."
              disabled={busy}
              data-testid="van-driver-add-person"
            />
            {existing && (
              <p
                className="mt-1.5 text-[13px] leading-snug text-muted-foreground"
                data-testid="van-driver-add-existing"
              >
                {existing.status === "APPROVED"
                  ? "Already approved to drive. Adding them again changes nothing."
                  : existing.status === "PENDING"
                    ? "Already waiting for approval. Saving approves them now."
                    : "Currently on hold. Saving lets them drive again."}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="van-driver-org">Drives for</Label>
            <select
              id="van-driver-org"
              value={organisationId}
              onChange={(e) => setOrganisationId(e.target.value)}
              disabled={busy}
              className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              data-testid="van-driver-add-org"
            >
              {organisations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                  {org.isInternal ? "" : " (borrowing the van)"}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              An outside organisation keeps them out of volunteer reporting and
              volunteer email.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="van-driver-licence-class">
                Licence class{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="van-driver-licence-class"
                value={licenceClass}
                onChange={(e) => setLicenceClass(e.target.value)}
                placeholder="1"
                autoComplete="off"
                disabled={busy}
                className="mt-1.5"
                data-testid="van-driver-add-licence-class"
              />
            </div>
            <div>
              <Label htmlFor="van-driver-licence-expiry">
                Expires{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="van-driver-licence-expiry"
                type="date"
                value={licenceExpiry}
                onChange={(e) => setLicenceExpiry(e.target.value)}
                disabled={busy}
                className="mt-1.5"
                data-testid="van-driver-add-licence-expiry"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!valid}
              data-testid="van-driver-add-save"
            >
              Approve to drive
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  count,
  empty,
  testid,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <section data-testid={testid}>
      <div className="flex items-baseline gap-2.5 pb-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {count === 0 ? (
        empty && (
          <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        )
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  );
}

function DriverCard({
  driver,
  children,
}: {
  driver: AdminDriver;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/volunteers/${driver.userId}`}
                className="text-[15px] font-semibold hover:underline"
              >
                {driver.name}
              </Link>
              {driver.organisationName && (
                <StatusPill
                  tone={driver.organisationIsInternal ? "neutral" : "warn"}
                >
                  {driver.organisationName}
                </StatusPill>
              )}
              {driver.licenceExpired && (
                <StatusPill tone="danger">Licence expired</StatusPill>
              )}
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {driver.email}
              {driver.phone && ` · ${driver.phone}`}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Registered {driver.registeredAtLabel}
              {driver.licenceClass && ` · class ${driver.licenceClass}`}
              {driver.licenceExpiryLabel &&
                ` · expires ${driver.licenceExpiryLabel}`}
              {driver.tripCount > 0 && ` · ${driver.tripCount} trips`}
            </p>
            {driver.approvedByName && driver.approvedAtLabel && (
              <p className="mt-1 text-[13px] text-muted-foreground/80">
                Approved by {driver.approvedByName} on {driver.approvedAtLabel}
              </p>
            )}
            {driver.statusNote && (
              <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-[13px] leading-snug">
                {driver.statusNote}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {children}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
