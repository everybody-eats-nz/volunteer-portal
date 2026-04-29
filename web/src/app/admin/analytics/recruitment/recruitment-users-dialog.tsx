"use client";

import { useEffect, useMemo, useState } from "react";
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
import type {
  FurthestStage,
  RecruitmentSegment,
  RecruitmentSegmentResult,
  RecruitmentSegmentUser,
} from "@/lib/recruitment-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: RecruitmentSegment | null;
  title: string;
  subtitle?: string;
  months: string;
  locationFilter: string;
}

interface StageInfo {
  label: string;
  description: string;
  className: string;
}

const STAGE_INFO: Record<FurthestStage, StageInfo> = {
  registered: {
    label: "Stopped at registration",
    description: "Created an account but didn't complete profile",
    className:
      "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900",
  },
  profileComplete: {
    label: "Stopped at profile complete",
    description: "Completed profile but no shift signups yet",
    className:
      "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  },
  signedUp: {
    label: "Signed up — no completed shift",
    description: "Has a signup but no confirmed shift completed yet",
    className:
      "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900",
  },
  completedShift: {
    label: "Completed first shift",
    description: "Reached the end of the funnel",
    className:
      "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
  },
};

const STAGE_ORDER: FurthestStage[] = [
  "completedShift",
  "signedUp",
  "profileComplete",
  "registered",
];

function getDisplayName(u: RecruitmentSegmentUser): string {
  if (u.name) return u.name;
  if (u.firstName || u.lastName)
    return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return u.email;
}

function getInitials(u: RecruitmentSegmentUser): string {
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
  segment: RecruitmentSegment,
  months: string,
  locationFilter: string
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("chart", segment.chart);
  p.set("segmentLocation", segment.location);
  p.set("months", months);
  if (locationFilter) p.set("location", locationFilter);
  if (segment.chart === "trend") p.set("monthKey", segment.monthKey);
  if (segment.chart === "funnel") p.set("stage", segment.stage);
  if (segment.chart === "timeToFirstShift") p.set("bucket", segment.bucket);
  return p;
}

export function RecruitmentUsersDialog({
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
  segment: RecruitmentSegment;
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
  const [data, setData] = useState<RecruitmentSegmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const params = buildSegmentParams(segment, months, locationFilter);

    fetch(`/api/admin/analytics/recruitment/users?${params}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load volunteers");
        }
        return res.json() as Promise<RecruitmentSegmentResult>;
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

  const grouped = useMemo(() => {
    const groups = new Map<FurthestStage, RecruitmentSegmentUser[]>();
    if (!data) return groups;
    for (const stage of STAGE_ORDER) groups.set(stage, []);
    for (const user of data.users) {
      groups.get(user.furthestStage)?.push(user);
    }
    return groups;
  }, [data]);

  return (
    <>
      <DialogHeader className="px-6 py-4 border-b">
        <DialogTitle className="flex items-center gap-2 text-lg">
          <Users className="h-4 w-4 text-violet-500" />
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
            <div className="px-6 py-4 space-y-6">
              {STAGE_ORDER.map((stage) => {
                const users = grouped.get(stage) ?? [];
                if (users.length === 0) return null;
                const info = STAGE_INFO[stage];
                return (
                  <section key={stage}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`${info.className} font-medium`}
                        >
                          {info.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {users.length.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 pl-1">
                      {info.description}
                    </p>
                    <ul className="space-y-1">
                      {users.map((u) => (
                        <UserRow key={u.id} user={u} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </>
  );
}

function UserRow({ user }: { user: RecruitmentSegmentUser }) {
  const displayName = getDisplayName(user);
  return (
    <li>
      <Link
        href={`/admin/volunteers/${user.id}`}
        className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-colors group"
      >
        <Avatar className="h-8 w-8 shadow-sm">
          <AvatarImage src={user.profilePhotoUrl ?? ""} alt={displayName} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
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
        {user.daysToFirstShift != null && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {user.daysToFirstShift === 0
              ? "same day"
              : `${user.daysToFirstShift} day${user.daysToFirstShift === 1 ? "" : "s"}`}
          </span>
        )}
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
      <Users className="h-5 w-5 text-muted-foreground" />
      <p className="font-medium">No volunteers in this segment</p>
      <p className="text-xs text-muted-foreground">
        Try adjusting the period or location filter.
      </p>
    </div>
  );
}
