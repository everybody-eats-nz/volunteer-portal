"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getVolunteerGradeInfo } from "@/lib/volunteer-grades";
import { formatInNZT } from "@/lib/timezone";

export interface AdminOptions {
  shiftTypes: { id: string; name: string }[];
  locations: string[];
  labels: {
    id: string;
    name: string;
    icon: string | null;
    color: string;
    volunteerCount: number;
  }[];
}

const EMPTY_OPTIONS: AdminOptions = {
  shiftTypes: [],
  locations: [],
  labels: [],
};

/** Shift types, locations and volunteer tags - shared by every tab. */
export function useAdminOptions() {
  const [options, setOptions] = useState<AdminOptions>(EMPTY_OPTIONS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auto-approval/options");
      if (res.ok) setOptions(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { options, loading, refresh };
}

export interface VolunteerLike {
  id?: string;
  userId?: string;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  profilePhotoUrl: string | null;
  volunteerGrade?: "GREEN" | "YELLOW" | "PINK";
}

export function volunteerName(v: VolunteerLike) {
  const full = [v.firstName, v.lastName].filter(Boolean).join(" ").trim();
  return v.name || full || v.email;
}

function initials(label: string) {
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Volunteer identity. `asLink` is off by default because these cells sit
 * inside expandable rows - a link nested in a button is invalid HTML and
 * steals the click that was meant to open the row.
 */
export function VolunteerCell({
  volunteer,
  subtitle,
  asLink = false,
}: {
  volunteer: VolunteerLike;
  subtitle?: string;
  asLink?: boolean;
}) {
  const id = volunteer.id ?? volunteer.userId;
  const label = volunteerName(volunteer);
  const grade = volunteer.volunteerGrade
    ? getVolunteerGradeInfo(volunteer.volunteerGrade)
    : null;

  const body = (
    <>
      <Avatar className="h-8 w-8 shrink-0">
        {volunteer.profilePhotoUrl && (
          <AvatarImage src={volunteer.profilePhotoUrl} alt="" />
        )}
        <AvatarFallback className="text-xs">{initials(label)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{label}</span>
          {grade && (
            <span title={grade.label} aria-label={grade.label}>
              {grade.icon}
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {subtitle ?? volunteer.email}
        </span>
      </span>
    </>
  );

  if (!id || !asLink) {
    return <span className="flex items-center gap-2.5">{body}</span>;
  }

  return (
    <Link
      href={`/admin/volunteers/${id}`}
      className="flex items-center gap-2.5 rounded-md hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {body}
    </Link>
  );
}

/** Shift identity: what, when, where. */
export function ShiftCell({
  shift,
}: {
  shift: {
    id?: string;
    start: string | Date;
    location: string | null;
    shiftType: { name: string } | null;
  };
}) {
  const start = typeof shift.start === "string" ? new Date(shift.start) : shift.start;
  return (
    <span className="block min-w-0">
      <span className="block truncate text-sm font-medium">
        {shift.shiftType?.name ?? "Unknown shift"}
      </span>
      <span className="block truncate text-xs text-muted-foreground tabular-nums">
        {formatInNZT(start, "EEE d MMM yyyy")}
        {shift.location ? ` · ${shift.location}` : ""}
      </span>
    </span>
  );
}

export function ScopeBadges({
  global,
  shiftTypeName,
  location,
}: {
  global: boolean;
  shiftTypeName: string | null;
  location: string | null;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="font-normal">
        {global ? "Every shift type" : (shiftTypeName ?? "Unknown shift type")}
      </Badge>
      <Badge variant="outline" className="font-normal">
        {location ?? "Every location"}
      </Badge>
    </span>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/** Explicit way through to a volunteer, for use outside a clickable row. */
export function VolunteerProfileLink({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/admin/volunteers/${userId}`}
      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-14 text-center",
        className
      )}
    >
      <Icon className="h-8 w-8 text-muted-foreground/50" aria-hidden />
      <p className="font-medium">{title}</p>
      {children && (
        <div className="max-w-md text-sm text-muted-foreground">{children}</div>
      )}
    </div>
  );
}
