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
import { Loader2, AlertTriangle, Trophy } from "lucide-react";
import { formatInNZT } from "@/lib/timezone";
import type {
  MilestoneSegment,
  MilestoneSegmentResult,
  MilestoneSegmentUser,
} from "@/lib/milestone-segment-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: MilestoneSegment | null;
  title: string;
  subtitle?: string;
  months: string;
  locationFilter: string;
}

function getDisplayName(u: MilestoneSegmentUser): string {
  if (u.name) return u.name;
  if (u.firstName || u.lastName)
    return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return u.email;
}

function getInitials(u: MilestoneSegmentUser): string {
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

function buildSegmentParams(
  segment: MilestoneSegment,
  months: string,
  locationFilter: string
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("chart", segment.chart);
  p.set("segmentLocation", segment.location);
  p.set("months", months);
  if (locationFilter) p.set("location", locationFilter);
  if (segment.chart === "milestoneDistribution") {
    p.set("band", segment.band);
  } else {
    p.set("threshold", String(segment.threshold));
  }
  return p;
}

export function MilestoneUsersDialog({
  open,
  onOpenChange,
  segment,
  title,
  subtitle,
  months,
  locationFilter,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[85vh] flex flex-col">
        {segment && open ? (
          <DialogBody
            key={JSON.stringify({ segment, months, locationFilter })}
            segment={segment}
            title={title}
            subtitle={subtitle}
            months={months}
            locationFilter={locationFilter}
          />
        ) : (
          <DialogHeader className="px-6 py-4">
            <DialogTitle>{title || "Volunteers"}</DialogTitle>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface BodyProps {
  segment: MilestoneSegment;
  title: string;
  subtitle?: string;
  months: string;
  locationFilter: string;
}

function DialogBody({
  segment,
  title,
  subtitle,
  months,
  locationFilter,
}: BodyProps) {
  const [data, setData] = useState<MilestoneSegmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const params = buildSegmentParams(segment, months, locationFilter);

    fetch(`/api/admin/analytics/milestones/users?${params}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load volunteers");
        }
        return res.json() as Promise<MilestoneSegmentResult>;
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
  }, [segment, months, locationFilter]);

  return (
    <>
      <DialogHeader className="px-6 py-4 border-b">
        <DialogTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-4 w-4 text-amber-500" />
          {title}
        </DialogTitle>
        {subtitle && (
          <DialogDescription className="text-sm">{subtitle}</DialogDescription>
        )}
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
                <UserRow key={u.id} user={u} segment={segment} />
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
}: {
  user: MilestoneSegmentUser;
  segment: MilestoneSegment;
}) {
  const displayName = getDisplayName(user);
  return (
    <li>
      <Link
        href={`/admin/volunteers/${user.id}`}
        className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-colors group"
      >
        <Avatar className="h-8 w-8 shadow-sm">
          <AvatarImage src={user.profilePhotoUrl ?? ""} alt={displayName} />
          <AvatarFallback className="bg-gradient-to-br from-amber-500 to-pink-600 text-white text-xs font-semibold">
            {getInitials(user)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate group-hover:text-foreground">
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className="text-xs tabular-nums bg-slate-50 dark:bg-zinc-900/40"
          >
            {user.totalShifts.toLocaleString()} shifts
          </Badge>

          {segment.chart === "milestoneHits" && user.achievedAt && (
            <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
              {formatInNZT(user.achievedAt, "d MMM yyyy")}
            </span>
          )}

          {segment.chart === "milestoneProjections" &&
            user.projectedMonths != null && (
              <Badge
                variant={
                  user.projectedMonths <= 3
                    ? "default"
                    : user.projectedMonths <= 6
                      ? "secondary"
                      : "outline"
                }
                className="text-xs tabular-nums"
              >
                ~{user.projectedMonths} mo
              </Badge>
            )}
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
      <Trophy className="h-5 w-5 text-muted-foreground" />
      <p className="font-medium">No volunteers in this segment</p>
      <p className="text-xs text-muted-foreground">
        Try adjusting the period or location filter.
      </p>
    </div>
  );
}
