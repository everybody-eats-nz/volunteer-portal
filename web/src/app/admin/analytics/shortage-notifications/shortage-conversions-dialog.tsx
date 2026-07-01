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
  ShortageConversion,
  ShortageConversionsResult,
} from "@/lib/shortage-analytics";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  months: string;
  /** "all" or a specific restaurant. */
  location: string;
  title: string;
  subtitle?: string;
}

export function ShortageConversionsDialog({
  open,
  onOpenChange,
  months,
  location,
  title,
  subtitle,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[85vh] flex flex-col">
        {open ? (
          <DialogBody
            key={`${months}-${location}`}
            months={months}
            location={location}
            title={title}
            subtitle={subtitle}
          />
        ) : (
          <DialogHeader className="px-6 py-4">
            <DialogTitle>{title || "Signups from alerts"}</DialogTitle>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  months,
  location,
  title,
  subtitle,
}: {
  months: string;
  location: string;
  title: string;
  subtitle?: string;
}) {
  const [data, setData] = useState<ShortageConversionsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const params = new URLSearchParams({ months, location });

    fetch(`/api/admin/analytics/shortage-notifications/conversions?${params}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load signups");
        }
        return res.json() as Promise<ShortageConversionsResult>;
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
  }, [months, location]);

  return (
    <>
      <DialogHeader className="px-6 py-4 border-b">
        <DialogTitle className="flex items-center gap-2 text-lg">
          <UserCheck className="h-4 w-4 text-emerald-500" />
          {title}
        </DialogTitle>
        {subtitle && (
          <DialogDescription className="text-sm">{subtitle}</DialogDescription>
        )}
        {data && (
          <p className="text-xs text-muted-foreground pt-1 tabular-nums">
            {data.total.toLocaleString()} signup
            {data.total === 1 ? "" : "s"} from alerts
            {data.total > data.cap && (
              <span> · showing first {data.cap.toLocaleString()}</span>
            )}
          </p>
        )}
      </DialogHeader>

      <div className="flex-1 min-h-0">
        {loading && <DialogLoading />}
        {!loading && error && <DialogError message={error} />}
        {!loading && !error && data && data.conversions.length === 0 && (
          <DialogEmpty />
        )}
        {!loading && !error && data && data.conversions.length > 0 && (
          <ScrollArea className="h-[60vh]">
            <ul className="px-4 py-3 space-y-1">
              {data.conversions.map((c) => (
                <ConversionRow key={`${c.userId}-${c.shiftId}`} conversion={c} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>
    </>
  );
}

function getInitials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function ConversionRow({ conversion: c }: { conversion: ShortageConversion }) {
  const lag =
    c.daysToSignup === 0
      ? "signed up same day"
      : `signed up ${c.daysToSignup} day${c.daysToSignup === 1 ? "" : "s"} later`;

  return (
    <li>
      <Link
        href={`/admin/volunteers/${c.userId}`}
        className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition-colors group"
      >
        <Avatar className="h-8 w-8 shadow-sm">
          <AvatarImage src={c.profilePhotoUrl ?? ""} alt={c.name} />
          <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
            {getInitials(c.name, c.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate group-hover:text-foreground">
            {c.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{c.email}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-xs font-medium truncate max-w-[9rem]">
              {c.shiftTypeName}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] font-medium px-1.5 py-0"
            >
              {c.shiftLocation}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {formatInNZT(c.shiftDate, "d MMM")} · {lag}
          </p>
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
        Loading signups…
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
      <p className="font-medium">Couldn&rsquo;t load signups</p>
      <p className="text-xs text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}

function DialogEmpty() {
  return (
    <div className="px-6 py-10 flex flex-col items-center text-center gap-2 text-sm">
      <UserCheck className="h-5 w-5 text-muted-foreground" />
      <p className="font-medium">No signups from alerts yet</p>
      <p className="text-xs text-muted-foreground">
        No volunteers signed up after an alert in this period.
      </p>
    </div>
  );
}
