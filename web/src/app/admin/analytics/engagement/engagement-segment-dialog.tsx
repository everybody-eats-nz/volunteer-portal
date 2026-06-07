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
import { Loader2, AlertTriangle, Users } from "lucide-react";
import { formatInNZT } from "@/lib/timezone";
import type {
  EngagementSegment,
  EngagementSegmentResult,
  EngagementSegmentVolunteer,
} from "@/lib/engagement";

export interface SegmentMeta {
  title: string;
  subtitle: string;
  /** Tailwind gradient classes for the avatar fallback. */
  gradient: string;
}

export const SEGMENT_META: Record<EngagementSegment, SegmentMeta> = {
  total: {
    title: "All volunteers",
    subtitle: "Every registered volunteer in scope for this period",
    gradient: "from-slate-500 to-slate-700",
  },
  highly_active: {
    title: "Highly active volunteers",
    subtitle: "Averaging 2+ completed shifts per month in the period",
    gradient: "from-emerald-500 to-green-600",
  },
  active: {
    title: "Active volunteers",
    subtitle: "At least one completed shift in the period",
    gradient: "from-blue-500 to-indigo-600",
  },
  inactive: {
    title: "Inactive volunteers",
    subtitle: "Have volunteered before, but not during this period",
    gradient: "from-amber-500 to-orange-600",
  },
  never: {
    title: "Never volunteered",
    subtitle: "Registered but have never completed a shift",
    gradient: "from-red-500 to-rose-600",
  },
  new: {
    title: "New volunteers",
    subtitle: "Completed their first ever shift during the period",
    gradient: "from-violet-500 to-purple-600",
  },
  retention: {
    title: "Retained volunteers",
    subtitle: "Active in the prior period and again in this period",
    gradient: "from-cyan-500 to-sky-600",
  },
  reactivated: {
    title: "Reactivated volunteers",
    subtitle: "Returned after 6+ months away (excludes first-timers)",
    gradient: "from-emerald-500 to-teal-600",
  },
};

interface Props {
  segment: EngagementSegment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  months: string;
  location: string;
  days: string;
}

function getDisplayName(u: EngagementSegmentVolunteer): string {
  if (u.name) return u.name;
  if (u.firstName || u.lastName)
    return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return u.email;
}

function getInitials(u: EngagementSegmentVolunteer): string {
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

export function EngagementSegmentDialog({
  segment,
  open,
  onOpenChange,
  months,
  location,
  days,
}: Props) {
  const meta = segment ? SEGMENT_META[segment] : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[85vh] flex flex-col">
        {segment && open ? (
          <DialogBody
            key={JSON.stringify({ segment, months, location, days })}
            segment={segment}
            months={months}
            location={location}
            days={days}
          />
        ) : (
          <DialogHeader className="px-6 py-4">
            <DialogTitle>{meta?.title ?? "Volunteers"}</DialogTitle>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  segment,
  months,
  location,
  days,
}: {
  segment: EngagementSegment;
  months: string;
  location: string;
  days: string;
}) {
  const meta = SEGMENT_META[segment];
  const [data, setData] = useState<EngagementSegmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const params = new URLSearchParams({ segment, months, location });
    if (days) params.set("days", days);

    fetch(`/api/admin/analytics/engagement/segment?${params}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load volunteers");
        }
        return res.json() as Promise<EngagementSegmentResult>;
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
  }, [segment, months, location, days]);

  return (
    <>
      <DialogHeader className="px-6 py-4 border-b">
        <DialogTitle className="flex items-center gap-2 text-lg">
          <Users className="h-4 w-4 text-muted-foreground" />
          {meta.title}
        </DialogTitle>
        <DialogDescription className="text-sm">
          {meta.subtitle}
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
          <DialogEmpty subtitle={meta.subtitle} />
        )}
        {!loading && !error && data && data.users.length > 0 && (
          <ScrollArea className="h-[60vh]">
            <ul className="px-4 py-3">
              {data.users.map((u) => (
                <UserRow key={u.id} user={u} segment={segment} meta={meta} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>
    </>
  );
}

function UserRow({
  user,
  segment,
  meta,
}: {
  user: EngagementSegmentVolunteer;
  segment: EngagementSegment;
  meta: SegmentMeta;
}) {
  const displayName = getDisplayName(user);
  const isReactivated = segment === "reactivated";

  return (
    <li>
      <Link
        href={`/admin/volunteers/${user.id}`}
        className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-colors group"
      >
        <Avatar className="h-8 w-8 shadow-sm">
          <AvatarImage src={user.profilePhotoUrl ?? ""} alt={displayName} />
          <AvatarFallback
            className={`bg-gradient-to-br ${meta.gradient} text-white text-xs font-semibold`}
          >
            {getInitials(user)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate group-hover:text-foreground">
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {isReactivated ? (
              <>
                Back{" "}
                {user.firstBack ? formatInNZT(user.firstBack, "d MMM yyyy") : "—"}
                {user.lastBefore && (
                  <> · last seen {formatInNZT(user.lastBefore, "d MMM yyyy")}</>
                )}
              </>
            ) : user.lastShiftDate ? (
              <>Last shift {formatInNZT(user.lastShiftDate, "d MMM yyyy")}</>
            ) : (
              <>No completed shifts</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isReactivated && user.monthsAway != null && (
            <Badge
              variant="outline"
              className="text-xs tabular-nums bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            >
              {user.monthsAway} mo away
            </Badge>
          )}
          {!isReactivated && user.shiftsInPeriod > 0 && (
            <Badge
              variant="outline"
              className="text-xs tabular-nums bg-slate-50 dark:bg-zinc-900/40"
            >
              {user.shiftsInPeriod.toLocaleString()} in period
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-xs tabular-nums bg-slate-50 dark:bg-zinc-900/40"
          >
            {user.totalShifts.toLocaleString()} total
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

function DialogEmpty({ subtitle }: { subtitle: string }) {
  return (
    <div className="px-6 py-10 flex flex-col items-center text-center gap-2 text-sm">
      <Users className="h-5 w-5 text-muted-foreground" />
      <p className="font-medium">No volunteers in this segment</p>
      <p className="text-xs text-muted-foreground max-w-xs">{subtitle}</p>
    </div>
  );
}
