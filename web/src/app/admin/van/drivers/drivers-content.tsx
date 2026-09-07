"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ShieldOff, UserCheck } from "lucide-react";
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
import { StatusPill } from "@/components/van/van-chrome";

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
export function VanDriversContent({ drivers }: { drivers: AdminDriver[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<AdminDriver | null>(null);
  const [note, setNote] = useState("");

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
