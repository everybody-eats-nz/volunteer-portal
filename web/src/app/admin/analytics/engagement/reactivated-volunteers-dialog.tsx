"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, AlertTriangle, UserCheck } from "lucide-react";
import { formatInNZT } from "@/lib/timezone";
import type {
  ReactivatedVolunteer,
  ReactivatedVolunteersResult,
} from "@/lib/engagement";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  months: string;
  location: string;
  days: string;
}

function getDisplayName(u: ReactivatedVolunteer): string {
  if (u.name) return u.name;
  if (u.firstName || u.lastName)
    return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return u.email;
}

function getInitials(u: ReactivatedVolunteer): string {
  if (u.name) {
    return u.name
      .split(" ")
      .map((n) => n.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }
  if (u.firstName || u.lastName) {
    return `${u.firstName?.charAt(0) ?? ""}${u.lastName?.charAt(0) ?? ""}`.toUpperCase();
  }
  return u.email.charAt(0).toUpperCase();
}

export function ReactivatedVolunteersDialog({
  open,
  onOpenChange,
  months,
  location,
  days,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[85vh] flex flex-col">
        {open ? (
          <DialogBody
            key={JSON.stringify({ months, location, days })}
            months={months}
            location={location}
            days={days}
          />
        ) : (
          <DialogHeader className="px-6 py-4">
            <DialogTitle>Reactivated volunteers</DialogTitle>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  months,
  location,
  days,
}: {
  months: string;
  location: string;
  days: string;
}) {
  const [data, setData] = useState<ReactivatedVolunteersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const params = new URLSearchParams({ months, location });
    if (days) params.set("days", days);

    fetch(`/api/admin/analytics/engagement/reactivated?${params}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load volunteers");
        }
        return res.json() as Promise<ReactivatedVolunteersResult>;
      })
      .then((result) => {
        if (ac.signal.aborted) return;
        setData(result);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
      })
      .finally(() => {
        if (ac.signal.aborted) return;
        setLoading(false);
      });

    return () => ac.abort();
  }, [months, location, days]);

  return (
    <>
      <DialogHeader className="px-6 py-4 border-b">
        <DialogTitle className="flex items-center gap-2 text-lg">
          <UserCheck className="h-4 w-4 text-emerald-500" />
          Reactivated volunteers
        </DialogTitle>
        <DialogDescription className="text-sm">
          Returned to volunteer after 6+ months away (excludes first-timers)
        </DialogDescription>
        {data && (
          <p className="text-xs text-muted-foreground pt-1 tabular-nums">
            {data.total.toLocaleString()} volunteer
            {data.total === 1 ? "" : "s"}
            {data.total > data.cap && (
              <span> · showing first {data.cap.toLocaleString()}</span>
            )}
          </p>
        )}
      </DialogHeader>

      <div className="flex-1 min-h-0">
        {loading && <DialogLoading />}
        {!loading && error && <DialogError message={error} />}
        {!loading && !error && data && data.users.length === 0 && (
          <DialogEmpty />
        )}
        {!loading && !error && data && data.users.length > 0 && (
          <ScrollArea className="h-[60vh]">
            <ul className="px-4 py-3">
              {data.users.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>
    </>
  );
}

function UserRow({ user }: { user: ReactivatedVolunteer }) {
  const displayName = getDisplayName(user);
  return (
    <li>
      <Link
        href={`/admin/volunteers/${user.id}`}
        className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-colors group"
      >
        <Avatar className="h-8 w-8 shadow-sm">
          <AvatarImage src={user.profilePhotoUrl ?? ""} alt={displayName} />
          <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
            {getInitials(user)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate group-hover:text-foreground">
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            Back {formatInNZT(user.firstBack, "d MMM yyyy")}
            {user.lastBefore && (
              <>
                {" · last seen "}
                {formatInNZT(user.lastBefore, "d MMM yyyy")}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {user.monthsAway != null && (
            <Badge
              variant="outline"
              className="text-xs tabular-nums bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            >
              {user.monthsAway} mo away
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-xs tabular-nums bg-slate-50 dark:bg-zinc-900/40"
          >
            {user.totalShifts.toLocaleString()} shifts
          </Badge>
        </div>
      </Link>
    </li>
  );
}

function DialogLoading() {
  return (
    <div className="px-6 py-6 space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading volunteers…
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DialogError({ message }: { message: string }) {
  return (
    <div className="px-6 py-10 flex flex-col items-center text-center gap-2 text-sm">
      <AlertTriangle className="h-5 w-5 text-amber-500" />
      <p className="font-medium">Couldn&rsquo;t load volunteers</p>
      <p className="text-xs text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}

function DialogEmpty() {
  return (
    <div className="px-6 py-10 flex flex-col items-center text-center gap-2 text-sm">
      <UserCheck className="h-5 w-5 text-muted-foreground" />
      <p className="font-medium">No reactivated volunteers</p>
      <p className="text-xs text-muted-foreground">
        Nobody returned after a 6-month break in this period. Try a different
        period or location.
      </p>
    </div>
  );
}
