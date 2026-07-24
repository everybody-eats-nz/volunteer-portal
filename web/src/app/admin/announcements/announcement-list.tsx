"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { format, formatDistanceToNow } from "date-fns";
import {
  Bell,
  ChevronDown,
  Clock,
  Mail,
  Megaphone,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  audienceSummary,
  authorDisplayName,
  expiresWithin,
  isExpired,
  stripMarkdown,
  type Announcement,
  type LabelOption,
} from "./types";

interface AnnouncementListProps {
  announcements: Announcement[];
  labels: LabelOption[];
  onDelete: (ann: Announcement) => void;
  onCompose: () => void;
}

/**
 * The overview: a pulse strip of the numbers that matter, then the ledger —
 * what's live in the feed now, followed by what has expired.
 */
export function AnnouncementList({
  announcements,
  labels,
  onDelete,
  onCompose,
}: AnnouncementListProps) {
  const [query, setQuery] = useState("");

  const { live, expired } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (ann: Announcement) =>
      q === "" ||
      ann.title.toLowerCase().includes(q) ||
      ann.body.toLowerCase().includes(q) ||
      authorDisplayName(ann.author).toLowerCase().includes(q);
    const filtered = announcements.filter(matches);
    return {
      live: filtered.filter((a) => !isExpired(a)),
      expired: filtered.filter((a) => isExpired(a)),
    };
  }, [announcements, query]);

  const liveTotal = announcements.filter((a) => !isExpired(a)).length;
  const nextToExpire = announcements
    .filter((a) => !isExpired(a) && a.expiresAt)
    .sort(
      (a, b) =>
        new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime()
    )[0];

  if (announcements.length === 0) {
    return (
      <div className="rounded-2xl border border-forest-500/15 bg-card px-6 py-20 text-center dark:border-white/10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fef9c3] dark:bg-[#fef9c3]/15">
          <Megaphone className="h-6 w-6 text-[#b45309] dark:text-amber-400" />
        </div>
        <h2 className="font-accent text-xl font-semibold">
          Nothing in the feed yet
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          Announcements land in every volunteer&apos;s mobile feed — and can
          go out by push notification or email too.
        </p>
        <Button
          onClick={onCompose}
          className="mt-5 gap-2 bg-forest-500 text-white hover:bg-forest-600 dark:bg-[#86d99b] dark:text-[#0f1114] dark:hover:bg-[#9be3ae]"
        >
          <Megaphone className="h-4 w-4" />
          Write the first announcement
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pulse strip */}
      <div className="grid grid-cols-1 divide-y divide-forest-500/10 rounded-2xl border border-forest-500/15 bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-white/[0.07] dark:border-white/10">
        <PulseStat
          label="Live in the feed"
          value={String(liveTotal)}
          detail={liveTotal === 0 ? "Feed is quiet" : "Visible to volunteers"}
          live={liveTotal > 0}
        />
        <PulseStat
          label="Next to expire"
          value={
            nextToExpire
              ? formatDistanceToNow(new Date(nextToExpire.expiresAt!))
              : "—"
          }
          detail={
            nextToExpire ? nextToExpire.title : "Nothing scheduled to leave"
          }
        />
        <PulseStat
          label="Published all-time"
          value={String(announcements.length)}
          detail="Including expired"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search announcements…"
          className="h-9 border-forest-500/20 pl-9 dark:border-white/15"
          data-testid="announcement-search"
        />
      </div>

      {live.length === 0 && expired.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-muted-foreground">
          No announcements match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <>
          {live.length > 0 && (
            <section>
              <SectionHeading live>
                In the feed now · {live.length}
              </SectionHeading>
              <div className="space-y-3">
                {live.map((ann) => (
                  <AnnouncementRow
                    key={ann.id}
                    ann={ann}
                    labels={labels}
                    onDelete={() => onDelete(ann)}
                  />
                ))}
              </div>
            </section>
          )}

          {expired.length > 0 && (
            <section>
              <SectionHeading>Expired · {expired.length}</SectionHeading>
              <div className="space-y-2">
                {expired.map((ann) => (
                  <AnnouncementRow
                    key={ann.id}
                    ann={ann}
                    labels={labels}
                    onDelete={() => onDelete(ann)}
                    expired
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PulseStat({
  label,
  value,
  detail,
  live,
}: {
  label: string;
  value: string;
  detail: string;
  live?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-500/70 dark:text-[#86d99b]/70">
        {live && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest-500 opacity-40 motion-reduce:animate-none dark:bg-[#86d99b]" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-forest-500 dark:bg-[#86d99b]" />
          </span>
        )}
        {label}
      </p>
      <p className="mt-1 font-accent text-2xl font-semibold tabular-nums leading-none">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function SectionHeading({
  children,
  live,
}: {
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <h2 className="mb-2.5 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {live && (
        <span className="h-2 w-2 rounded-full bg-forest-500 dark:bg-[#86d99b]" />
      )}
      {children}
    </h2>
  );
}

// ─── Ledger row ─────────────────────────────────────────────────────────────

function AnnouncementRow({
  ann,
  labels,
  onDelete,
  expired,
}: {
  ann: Announcement;
  labels: LabelOption[];
  onDelete: () => void;
  expired?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const created = new Date(ann.createdAt);
  const expiresSoon = !expired && expiresWithin(ann, 48);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    // Lazily ask how many volunteers this announcement's stored targeting
    // matches today — same endpoint the composer preview uses.
    if (next && matchCount === null && !matchLoading) {
      setMatchLoading(true);
      fetch("/api/admin/announcements/recipient-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLocations: ann.targetLocations,
          targetGrades: ann.targetGrades,
          targetLabelIds: ann.targetLabelIds,
          targetUserIds: ann.targetUserIds,
          targetShiftIds: ann.targetShiftIds,
          targetActivityLocations: ann.targetActivityLocations,
          // The count route expects NZ calendar days (yyyy-MM-dd); format in
          // the admin's local tz, which matches how the dates were entered.
          targetActivityFrom: ann.targetActivityFrom
            ? format(new Date(ann.targetActivityFrom), "yyyy-MM-dd")
            : null,
          targetActivityTo: ann.targetActivityTo
            ? format(new Date(ann.targetActivityTo), "yyyy-MM-dd")
            : null,
          targetActivityMinShifts: ann.targetActivityMinShifts,
          targetActivityMaxShifts: ann.targetActivityMaxShifts,
        }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((data) => setMatchCount(data.count ?? null))
        .catch(() => {})
        .finally(() => setMatchLoading(false));
    }
  };

  return (
    <article
      className={cn(
        "group rounded-2xl border transition-colors",
        expired
          ? "border-forest-500/10 bg-card/50 dark:border-white/[0.06] dark:bg-card/40"
          : "border-forest-500/15 bg-card shadow-[0_1px_2px_rgb(29_83_55/0.06)] dark:border-white/10"
      )}
      data-testid="announcement-row"
    >
      <div className="flex items-start gap-4 p-4">
        {/* Date tile */}
        <div
          className={cn(
            "flex w-12 shrink-0 flex-col items-center rounded-xl border py-1.5",
            expired
              ? "border-forest-500/10 text-muted-foreground dark:border-white/[0.06]"
              : "border-[#b45309]/15 bg-[#fef9c3]/60 text-[#7c4a10] dark:border-amber-400/15 dark:bg-[#fef9c3]/10 dark:text-amber-300"
          )}
          aria-hidden="true"
        >
          <span className="font-accent text-lg font-semibold leading-none tabular-nums">
            {format(created, "d")}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {format(created, "MMM")}
          </span>
        </div>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={toggleExpanded}
              className="min-w-0 cursor-pointer text-left"
              aria-expanded={expanded}
            >
              <h3
                className={cn(
                  "font-accent text-base font-semibold leading-snug",
                  expired && "text-muted-foreground"
                )}
              >
                {ann.title}
              </h3>
              {!expanded && (
                <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                  {stripMarkdown(ann.body)}
                </p>
              )}
            </button>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={toggleExpanded}
                aria-label={expanded ? "Collapse" : "Expand"}
                aria-expanded={expanded}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    expanded && "rotate-180"
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                aria-label="Delete announcement"
                data-testid="announcement-delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Meta line */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {format(created, "h:mm a")} · {authorDisplayName(ann.author)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {audienceSummary(ann, labels)}
            </span>
          </div>

          {/* Status chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {ann.sendNotification && (
              <StatusChip
                icon={<Bell className="h-3 w-3" />}
                sent={!!ann.notificationSentAt}
              >
                {ann.notificationSentAt ? "Push sent" : "Push queued"}
              </StatusChip>
            )}
            {ann.sendEmail && (
              <StatusChip
                icon={<Mail className="h-3 w-3" />}
                sent={!!ann.emailSentAt}
              >
                {ann.emailSentAt ? "Email sent" : "Email queued"}
              </StatusChip>
            )}
            {expired ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-forest-500/15 px-2 py-0.5 text-[11px] font-medium text-muted-foreground dark:border-white/10">
                <Clock className="h-3 w-3" />
                Expired{" "}
                {formatDistanceToNow(new Date(ann.expiresAt!), {
                  addSuffix: true,
                })}
              </span>
            ) : ann.expiresAt ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  expiresSoon
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-forest-500/15 text-muted-foreground dark:border-white/10"
                )}
              >
                <Clock className="h-3 w-3" />
                Expires{" "}
                {formatDistanceToNow(new Date(ann.expiresAt), {
                  addSuffix: true,
                })}
              </span>
            ) : null}
          </div>

          {/* Expanded detail */}
          {expanded && (
            <div className="mt-3 space-y-3 border-t border-forest-500/10 pt-3 dark:border-white/[0.07]">
              {ann.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ann.imageUrl}
                  alt=""
                  className="h-36 w-auto rounded-lg object-cover"
                />
              )}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{ann.body}</ReactMarkdown>
              </div>
              <p className="text-xs text-muted-foreground">
                {matchLoading
                  ? "Counting who this audience matches today…"
                  : matchCount !== null
                    ? `This audience matches ~${matchCount} volunteer${matchCount === 1 ? "" : "s"} today.`
                    : null}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusChip({
  icon,
  sent,
  children,
}: {
  icon: React.ReactNode;
  sent: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        sent
          ? "border-forest-500/25 bg-forest-500/[0.07] text-forest-500 dark:border-[#86d99b]/25 dark:bg-[#86d99b]/10 dark:text-[#86d99b]"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      )}
    >
      {icon}
      {children}
    </span>
  );
}
