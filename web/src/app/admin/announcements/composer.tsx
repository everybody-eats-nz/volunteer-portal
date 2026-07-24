"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { addDays, format } from "date-fns";
import { motion } from "motion/react";
import {
  Bell,
  CalendarIcon,
  ChevronDown,
  ClockIcon,
  ImageIcon,
  Loader2,
  Mail,
  Newspaper,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AudienceBuilder,
  EMPTY_AUDIENCE,
  countActiveAudienceFilters,
  type AudienceDraft,
} from "./audience-builder";
import { FeedPreview } from "./feed-preview";
import {
  audienceConditions,
  type Announcement,
  type LabelOption,
  type ShiftOption,
  type TargetingDraft,
  type UserOption,
} from "./types";

/** Seed values arriving via the query string ("Announce" links elsewhere). */
export interface ComposerPrefill {
  locations: string[];
  grades: string[];
  labelIds: string[];
  userIds: string[];
  shiftIds: string[];
  sendEmail: boolean;
}

interface ComposerProps {
  labels: LabelOption[];
  locations: string[];
  authorName: string;
  prefill: ComposerPrefill | null;
  onPublished: (announcement: Announcement) => void;
  onClose: () => void;
}

const EXPIRY_PRESETS = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
];

/**
 * The announcement composer: message, schedule, audience and delivery on the
 * left; a sticky rail on the right with the live feed preview, the live
 * recipient count and the publish action — so what it looks like, who gets
 * it and how it goes out stay visible the whole time.
 */
export function Composer({
  labels,
  locations,
  authorName,
  prefill,
  onPublished,
  onClose,
}: ComposerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(""); // "YYYY-MM-DDTHH:mm" or ""
  const [audience, setAudience] = useState<AudienceDraft>(() => ({
    ...EMPTY_AUDIENCE,
    targetLocations: prefill?.locations ?? [],
    targetGrades: prefill?.grades ?? [],
    targetLabelIds: prefill?.labelIds ?? [],
  }));
  const [sendNotification, setSendNotification] = useState(false);
  const [sendEmail, setSendEmail] = useState(prefill?.sendEmail ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patchAudience = useCallback(
    (patch: Partial<AudienceDraft>) =>
      setAudience((prev) => ({ ...prev, ...patch })),
    []
  );

  // Hydrate prefilled user/shift IDs into full objects so badges show names.
  const prefillUserIds = prefill?.userIds.join(",") ?? "";
  const prefillShiftIds = prefill?.shiftIds.join(",") ?? "";
  useEffect(() => {
    if (!prefillUserIds && !prefillShiftIds) return;
    let cancelled = false;
    const run = async () => {
      if (prefillUserIds) {
        try {
          const r = await fetch(
            `/api/admin/users?ids=${encodeURIComponent(prefillUserIds)}`
          );
          if (r.ok) {
            const data = (await r.json()) as UserOption[];
            if (!cancelled)
              setAudience((prev) => ({ ...prev, targetUsers: data }));
          }
        } catch {
          // IDs without names aren't useful in the UI; leave empty on failure
        }
      }
      if (prefillShiftIds) {
        try {
          const r = await fetch(
            `/api/admin/announcements/shifts?ids=${encodeURIComponent(prefillShiftIds)}`
          );
          if (r.ok) {
            const data = await r.json();
            if (!cancelled)
              setAudience((prev) => ({
                ...prev,
                targetShifts: (data.shifts ?? []) as ShiftOption[],
              }));
          }
        } catch {
          // see above
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [prefillUserIds, prefillShiftIds]);

  // The request-body shape shared by the recipient-count preview and the
  // create call, so the number the admin sees always describes the audience
  // they're about to publish to.
  const targeting: TargetingDraft = useMemo(
    () => ({
      targetLocations: audience.targetLocations,
      targetGrades: audience.targetGrades,
      targetLabelIds: audience.targetLabelIds,
      targetUserIds: audience.targetUsers.map((u) => u.id),
      targetShiftIds: audience.targetShifts.map((s) => s.id),
      targetActivityLocations: audience.activityEnabled
        ? audience.activityLocations
        : [],
      targetActivityFrom: audience.activityEnabled
        ? audience.activityFrom || null
        : null,
      targetActivityTo: audience.activityEnabled
        ? audience.activityTo || null
        : null,
      targetActivityMinShifts: audience.activityEnabled
        ? audience.activityMinShifts
        : null,
      targetActivityMaxShifts: audience.activityEnabled
        ? audience.activityMaxShifts
        : null,
    }),
    [audience]
  );

  const { count: recipientCount, counting } = useRecipientCount(targeting);

  const conditions = audienceConditions(targeting, labels);
  const activeFilters = countActiveAudienceFilters(audience);

  const isDirty =
    title.trim() !== "" || body.trim() !== "" || imageUrl !== null;
  const canPublish = title.trim() !== "" && body.trim() !== "";

  const requestClose = () => {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  };

  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const response = await fetch("/api/admin/announcements/upload-image", {
        method: "POST",
        body: fd,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Upload failed");
      }
      const { url } = await response.json();
      setImageUrl(url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish) {
      toast.error("Title and message are required");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          imageUrl,
          expiresAt: expiresAt || null,
          ...targeting,
          sendEmail,
          sendNotification,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Failed to create announcement");
      }

      const { announcement } = await response.json();
      const dispatchedVia = [
        sendNotification ? "push notifications" : null,
        sendEmail ? "emails" : null,
      ].filter(Boolean) as string[];
      toast.success(
        dispatchedVia.length > 0
          ? `Announcement published — ${dispatchedVia.join(" + ")} sending in the background`
          : "Announcement published"
      );
      onPublished(announcement);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create announcement"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const publishLabel = isSubmitting
    ? "Publishing…"
    : recipientCount !== null && !counting
      ? `Publish to ~${recipientCount} volunteer${recipientCount === 1 ? "" : "s"}`
      : "Publish announcement";

  const channelSummary = [
    "Feed",
    sendNotification ? "Push" : null,
    sendEmail ? "Email" : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <form onSubmit={handleSubmit}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── Left: the inputs ── */}
          <div className="min-w-0 space-y-5">
            <Section eyebrow="Message" hint="What volunteers will read.">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ann-title" className="sr-only">
                    Title
                  </Label>
                  <Input
                    id="ann-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title — e.g. Kitchen closed this Friday"
                    maxLength={200}
                    required
                    className="h-12 border-forest-500/20 text-base font-medium placeholder:font-normal md:text-base dark:border-white/15"
                    data-testid="announcement-title"
                  />
                </div>
                <div>
                  <Label htmlFor="ann-body" className="sr-only">
                    Message
                  </Label>
                  <Textarea
                    id="ann-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write the announcement… it lands in the feed exactly as the preview shows."
                    className="min-h-[220px] resize-y border-forest-500/20 font-mono text-sm leading-relaxed dark:border-white/15"
                    required
                    data-testid="announcement-body"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Markdown supported: **bold** · *italic* · [link](url) · -
                    for bullets
                  </p>
                </div>

                {/* Image */}
                {imageUrl ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Announcement image"
                      className="h-36 w-auto rounded-lg border object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -right-2 -top-2 h-6 w-6"
                      onClick={() => setImageUrl(null)}
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-forest-500/25 px-4 py-3 text-left transition-colors",
                      "hover:border-forest-500/50 hover:bg-cream-50/70 dark:border-white/15 dark:hover:border-white/30 dark:hover:bg-white/[0.03]",
                      isUploadingImage && "pointer-events-none opacity-50"
                    )}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleImageUpload(file);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {isUploadingImage
                        ? "Uploading…"
                        : "Add a featured image — drag & drop or click (JPEG, PNG, WebP, GIF · max 5MB)"}
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
              </div>
            </Section>

            <Section
              eyebrow="Schedule"
              hint="How long it stays in the feed."
            >
              <ExpiryPicker value={expiresAt} onChange={setExpiresAt} />
            </Section>

            <Section
              eyebrow="Audience"
              hint="Who receives it. Filters combine — each one narrows further."
            >
              <AudienceBuilder
                draft={audience}
                onPatch={patchAudience}
                labels={labels}
                locations={locations}
              />
            </Section>

            <Section eyebrow="Delivery" hint="Where it reaches them.">
              <div className="grid gap-3 sm:grid-cols-3">
                <ChannelCard
                  icon={<Newspaper className="h-4 w-4" />}
                  title="In-app feed"
                  description="Every recipient sees it in their feed."
                  locked
                />
                <ChannelCard
                  icon={<Bell className="h-4 w-4" />}
                  title="Push notification"
                  description="Alerts their phone with a plain-text preview."
                  checked={sendNotification}
                  onCheckedChange={setSendNotification}
                  testId="announcement-send-notification"
                />
                <ChannelCard
                  icon={<Mail className="h-4 w-4" />}
                  title="Email"
                  description="Sends the full announcement to their inbox."
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                  testId="announcement-send-email"
                />
              </div>
            </Section>
          </div>

          {/* ── Right: the consequences ── */}
          <aside className="space-y-4 lg:sticky lg:top-6">
            <div>
              <RailEyebrow>Live preview</RailEyebrow>
              <FeedPreview
                title={title}
                body={body}
                imageUrl={imageUrl}
                authorName={authorName}
              />
            </div>

            <div className="rounded-2xl border border-forest-500/15 bg-card p-4 dark:border-white/10">
              <RailEyebrow>Reach</RailEyebrow>
              <div className="flex items-baseline gap-2">
                <motion.span
                  key={counting ? "counting" : `${recipientCount}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="font-accent text-4xl font-semibold tabular-nums leading-none text-forest-500 dark:text-[#86d99b]"
                  data-testid="announcement-recipient-count"
                >
                  {counting || recipientCount === null ? (
                    <Loader2 className="mb-1 h-7 w-7 animate-spin opacity-50" />
                  ) : (
                    `~${recipientCount}`
                  )}
                </motion.span>
                <span className="text-sm text-muted-foreground">
                  volunteer{recipientCount === 1 ? "" : "s"} will receive this
                </span>
              </div>

              {conditions.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Everyone with a volunteer account.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5 border-l-2 border-forest-500/20 pl-3 dark:border-[#86d99b]/25">
                  {conditions.map((c, i) => (
                    <li key={c} className="text-sm leading-snug">
                      {i > 0 && (
                        <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          and
                        </span>
                      )}
                      {c}
                    </li>
                  ))}
                </ul>
              )}

              {recipientCount === 0 && !counting && activeFilters > 0 && (
                <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  No volunteers match these filters yet — loosen one to reach
                  someone.
                </p>
              )}

              <RecipientListToggle
                targeting={targeting}
                recipientCount={recipientCount}
              />
            </div>

            <div className="rounded-2xl border border-forest-500/15 bg-card p-4 dark:border-white/10">
              <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Goes out via {channelSummary}
                {expiresAt
                  ? ` · leaves the feed ${format(new Date(expiresAt), "d MMM, h:mm a")}`
                  : " · stays until deleted"}
              </div>
              <Button
                type="submit"
                disabled={isSubmitting || !canPublish}
                className="h-11 w-full gap-2 bg-forest-500 text-white hover:bg-forest-600 dark:bg-[#86d99b] dark:text-[#0f1114] dark:hover:bg-[#9be3ae]"
                data-testid="announcement-publish"
              >
                <Upload className="h-4 w-4" />
                {publishLabel}
              </Button>
              {!canPublish && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Add a title and a message to publish.
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                className="mt-2 w-full text-muted-foreground hover:text-foreground"
                onClick={requestClose}
              >
                Cancel
              </Button>
            </div>
          </aside>
        </div>
      </form>

      {/* Discard confirmation */}
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              Your draft hasn&apos;t been published — closing the composer
              throws it away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep writing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Discard draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// ─── Building blocks ────────────────────────────────────────────────────────

function Section({
  eyebrow,
  hint,
  children,
}: {
  eyebrow: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-forest-500/15 bg-card p-5 dark:border-white/10">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="font-accent text-lg font-semibold leading-none">
          {eyebrow}
        </h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </header>
      {children}
    </section>
  );
}

function RailEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-500/70 dark:text-[#86d99b]/70">
      {children}
    </p>
  );
}

function ChannelCard({
  icon,
  title,
  description,
  locked,
  checked,
  onCheckedChange,
  testId,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  locked?: boolean;
  checked?: boolean;
  onCheckedChange?: (next: boolean) => void;
  testId?: string;
}) {
  const active = locked || checked;
  return (
    <label
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3.5 transition-colors",
        active
          ? "border-forest-500/45 bg-forest-500/[0.05] dark:border-[#86d99b]/40 dark:bg-[#86d99b]/[0.06]"
          : "border-forest-500/15 hover:border-forest-500/35 dark:border-white/10 dark:hover:border-white/25",
        locked ? "cursor-default" : "cursor-pointer"
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            active
              ? "bg-forest-500 text-white dark:bg-[#86d99b] dark:text-[#0f1114]"
              : "bg-forest-500/[0.07] text-forest-500 dark:bg-white/[0.06] dark:text-[#86d99b]"
          )}
        >
          {icon}
        </span>
        {locked ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-forest-500/70 dark:text-[#86d99b]/70">
            Always on
          </span>
        ) : (
          <Switch
            checked={checked}
            onCheckedChange={onCheckedChange}
            data-testid={testId}
          />
        )}
      </span>
      <span>
        <span className="block text-sm font-medium leading-tight">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

// ─── Expiry picker ──────────────────────────────────────────────────────────

function ExpiryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const presetValue = (days: number) =>
    `${format(addDays(new Date(), days), "yyyy-MM-dd")}T23:59`;

  const activePreset = EXPIRY_PRESETS.find((p) => presetValue(p.days) === value);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={value === "" ? "default" : "outline"}
          size="sm"
          aria-pressed={value === ""}
          className="h-8 rounded-full text-xs"
          onClick={() => onChange("")}
        >
          No expiry
        </Button>
        {EXPIRY_PRESETS.map((p) => {
          const isActive = activePreset?.days === p.days;
          return (
            <Button
              key={p.days}
              type="button"
              variant={isActive ? "default" : "outline"}
              size="sm"
              aria-pressed={isActive}
              className="h-8 rounded-full text-xs"
              onClick={() => onChange(presetValue(p.days))}
              data-testid={`announcement-expiry-preset-${p.days}`}
            >
              {p.label}
            </Button>
          );
        })}
        <ExpiryDateTimePicker value={value} onChange={onChange} />
      </div>
      <p className="text-xs text-muted-foreground">
        {value
          ? `Leaves the feed ${format(new Date(value), "EEE d MMM yyyy, h:mm a")}.`
          : "Stays in the feed until you delete it."}
      </p>
    </div>
  );
}

/**
 * Date+time picker storing a `datetime-local` string ("YYYY-MM-DDTHH:mm") so
 * the submit body stays simple. The native datetime-local input has
 * frustrating cross-browser styling and no clear affordance, hence the
 * popover Calendar + time input combo.
 */
function ExpiryDateTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [datePart, timePart] = value
    ? [value.slice(0, 10), value.slice(11, 16)]
    : ["", ""];
  // Parse without UTC conversion: datetime-local strings are already in
  // local time, so splitting and re-using the parts avoids timezone drift.
  const dateValue = datePart ? new Date(`${datePart}T00:00:00`) : undefined;

  const setDate = (d: Date | undefined) => {
    if (!d) {
      onChange("");
      return;
    }
    const ymd = format(d, "yyyy-MM-dd");
    onChange(`${ymd}T${timePart || "23:59"}`);
  };

  const setTime = (t: string) => {
    if (!datePart) return; // ignore time changes until a date is picked
    onChange(`${datePart}T${t || "23:59"}`);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 justify-start gap-1.5 rounded-full text-xs font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {value ? format(new Date(value), "d MMM yyyy") : "Pick a date…"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={setDate}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {value && (
        <span className="relative">
          <ClockIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="time"
            value={timePart}
            onChange={(e) => setTime(e.target.value)}
            className="h-8 w-[110px] pl-7 text-xs"
            aria-label="Expiry time"
          />
        </span>
      )}
    </span>
  );
}

// ─── Recipient list toggle ──────────────────────────────────────────────────

type RecipientPreview = {
  id: string;
  name: string | null;
  firstName: string | null;
  email: string;
};

/**
 * "See exactly who" — expands the reach count into the actual matched
 * volunteers, fetched with the same matching logic the send path uses.
 * Refetches (debounced) whenever the targeting changes while open.
 */
function RecipientListToggle({
  targeting,
  recipientCount,
}: {
  targeting: TargetingDraft;
  recipientCount: number | null;
}) {
  const [open, setOpen] = useState(false);
  const serialized = JSON.stringify(targeting);
  const [result, setResult] = useState<{
    recipients: RecipientPreview[];
    total: number;
    key: string | null;
  }>({ recipients: [], total: 0, key: null });

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/announcements/recipients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: serialized,
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          setResult({
            recipients: data.recipients ?? [],
            total: data.total ?? 0,
            key: serialized,
          });
        } else {
          setResult({ recipients: [], total: 0, key: serialized });
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setResult((prev) => ({ ...prev, key: serialized }));
        }
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, serialized]);

  if (recipientCount === 0) return null;

  const loading = open && result.key !== serialized;
  const capped = result.total > result.recipients.length;

  return (
    <div className="mt-3 border-t border-forest-500/10 pt-2 dark:border-white/[0.07]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 py-1 text-xs font-medium text-forest-500 transition-colors hover:text-forest-600 dark:text-[#86d99b] dark:hover:text-[#9be3ae]"
        data-testid="announcement-recipient-list-toggle"
      >
        {open ? "Hide the list" : "See exactly who"}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className="mt-1.5 max-h-60 overflow-y-auto rounded-lg border border-forest-500/10 dark:border-white/[0.07]"
          data-testid="announcement-recipient-list"
        >
          {loading ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-3.5 animate-pulse rounded bg-forest-500/[0.08] motion-reduce:animate-none dark:bg-white/[0.06]"
                  style={{ width: `${80 - i * 15}%` }}
                />
              ))}
            </div>
          ) : result.recipients.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              No one matches right now.
            </p>
          ) : (
            <ul className="divide-y divide-forest-500/[0.07] dark:divide-white/[0.05]">
              {result.recipients.map((r) => (
                <li key={r.id}>
                  <a
                    href={`/admin/volunteers/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block px-3 py-1.5 transition-colors hover:bg-cream-50/70 dark:hover:bg-white/[0.03]"
                  >
                    <span className="block truncate text-xs font-medium">
                      {r.name ?? r.firstName ?? r.email}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {r.email}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {!loading && capped && (
            <p className="border-t border-forest-500/10 px-3 py-1.5 text-[11px] text-muted-foreground dark:border-white/[0.07]">
              Showing the first {result.recipients.length} of {result.total}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Live recipient count ───────────────────────────────────────────────────

/**
 * Debounced live count of volunteers matching the current targeting. Uses
 * the same parse path as the create route, so the preview can't drift from
 * what publishing would actually send. "Counting" is derived: the shown
 * count belongs to `key`, and any newer targeting means we're mid-count.
 */
function useRecipientCount(targeting: TargetingDraft) {
  const serialized = JSON.stringify(targeting);
  const [result, setResult] = useState<{
    count: number | null;
    key: string | null;
  }>({ count: null, key: null });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          "/api/admin/announcements/recipient-count",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: serialized,
            signal: controller.signal,
          }
        );
        if (response.ok) {
          const data = await response.json();
          setResult({ count: data.count ?? null, key: serialized });
        } else {
          setResult({ count: null, key: serialized });
        }
      } catch (err) {
        // On abort a newer request owns the spinner; on real errors stop
        // spinning and keep whatever count we last had.
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setResult((prev) => ({ ...prev, key: serialized }));
        }
      }
    }, 500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [serialized]);

  return { count: result.count, counting: result.key !== serialized };
}
