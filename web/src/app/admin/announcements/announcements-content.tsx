"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  X,
  Megaphone,
  Users,
  Clock,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  Search,
  Mail,
  Bell,
  CalendarClock,
  CalendarIcon,
  ClockIcon,
  UserPlus2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

const VOLUNTEER_GRADES = [
  { value: "GREEN", label: "Green", description: "Standard volunteers" },
  { value: "YELLOW", label: "Yellow", description: "Experienced volunteers" },
  { value: "PINK", label: "Pink", description: "Shift leaders" },
];

type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  expiresAt: string | null;
  createdBy: string;
  targetLocations: string[];
  targetGrades: string[];
  targetLabelIds: string[];
  targetUserIds: string[];
  targetShiftIds: string[];
  sendEmail: boolean;
  emailSentAt: string | null;
  sendNotification: boolean;
  notificationSentAt: string | null;
  author: {
    id: string;
    name: string | null;
    firstName: string | null;
    email: string;
  };
};

type Label = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
};

type UserOption = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
};

type ShiftOption = {
  id: string;
  start: string;
  end: string;
  location: string | null;
  shiftTypeName: string;
  signupCount: number;
};

interface AnnouncementsContentProps {
  initialAnnouncements: Announcement[];
  labels: Label[];
  locations: string[];
}

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function AnnouncementsContent({
  initialAnnouncements,
  labels,
  locations,
}: AnnouncementsContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Stable, hashable signature of the prefill query string. This is what
  // `useEffect` watches — recomputing on every render gives us a fresh
  // string each time but the value only *changes* when the query actually
  // changes, so the syncing effect runs once per URL update.
  const prefillSignature = [
    searchParams.get("userIds") ?? "",
    searchParams.get("shiftIds") ?? "",
    searchParams.get("locations") ?? "",
    searchParams.get("grades") ?? "",
    searchParams.get("labels") ?? "",
    searchParams.get("sendEmail") ?? "",
  ].join("|");
  const hasPrefill = prefillSignature !== "|||||";

  const [announcements, setAnnouncements] =
    useState<Announcement[]>(initialAnnouncements);
  const [showForm, setShowForm] = useState(hasPrefill);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Form state — synced from the query string by the effect below whenever
  // it changes, so navigating to `/admin/announcements?shiftIds=...` from
  // anywhere always lands on a freshly-seeded form.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [targetGrades, setTargetGrades] = useState<string[]>([]);
  const [targetLabelIds, setTargetLabelIds] = useState<string[]>([]);
  const [targetUsers, setTargetUsers] = useState<UserOption[]>([]);
  const [targetShifts, setTargetShifts] = useState<ShiftOption[]>([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendNotification, setSendNotification] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState<number | null>(null);
  const [isCountingRecipients, setIsCountingRecipients] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recipientDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const targetUserIds = useMemo(() => targetUsers.map((u) => u.id), [
    targetUsers,
  ]);
  const targetShiftIds = useMemo(() => targetShifts.map((s) => s.id), [
    targetShifts,
  ]);

  // Sync form state from the query string whenever it changes. The effect
  // re-runs only when `prefillSignature` changes, which means subsequent
  // "Announce" link clicks (with different params) re-seed the form even
  // though the page component never unmounts.
  useEffect(() => {
    const userIds = parseCsv(searchParams.get("userIds"));
    const shiftIds = parseCsv(searchParams.get("shiftIds"));
    const locs = parseCsv(searchParams.get("locations"));
    const grades = parseCsv(searchParams.get("grades"));
    const lbls = parseCsv(searchParams.get("labels"));
    const wantsEmail =
      searchParams.get("sendEmail") === "1" ||
      searchParams.get("sendEmail") === "true";
    const empty =
      userIds.length === 0 &&
      shiftIds.length === 0 &&
      locs.length === 0 &&
      grades.length === 0 &&
      lbls.length === 0 &&
      !wantsEmail;
    if (empty) return;

    setShowForm(true);
    setTargetLocations(locs);
    setTargetGrades(grades);
    setTargetLabelIds(lbls);
    setSendEmail(wantsEmail);

    let cancelled = false;
    const run = async () => {
      // Hydrate selected users by their IDs so the badges render with names.
      if (userIds.length > 0) {
        try {
          const r = await fetch(
            `/api/admin/users?ids=${encodeURIComponent(userIds.join(","))}`
          );
          if (r.ok) {
            const data = (await r.json()) as UserOption[];
            if (!cancelled) setTargetUsers(data);
          }
        } catch {
          // leave selection empty if hydration fails — IDs aren't useful
          // without names since the UI shows badge labels
        }
      } else {
        setTargetUsers([]);
      }

      if (shiftIds.length > 0) {
        try {
          const r = await fetch(
            `/api/admin/announcements/shifts?ids=${encodeURIComponent(shiftIds.join(","))}`
          );
          if (r.ok) {
            const data = await r.json();
            if (!cancelled) setTargetShifts(data.shifts ?? []);
          }
        } catch {
          // see above
        }
      } else {
        setTargetShifts([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillSignature]);

  const resetForm = () => {
    setTitle("");
    setBody("");
    setImageUrl(null);
    setExpiresAt("");
    setTargetLocations([]);
    setTargetGrades([]);
    setTargetLabelIds([]);
    setTargetUsers([]);
    setTargetShifts([]);
    setSendEmail(false);
    setSendNotification(false);
    setPreviewMode(false);
    setRecipientPreview(null);
    // Drop any prefill query string so reopening the form doesn't re-seed
    // it. We use replace so this doesn't add a history entry.
    if (hasPrefill) {
      router.replace(pathname);
    }
  };

  // Debounced recipient count preview
  const updateRecipientPreview = useCallback(
    (
      locs: string[],
      grades: string[],
      labelIds: string[],
      userIds: string[],
      shiftIds: string[]
    ) => {
      if (recipientDebounceRef.current) {
        clearTimeout(recipientDebounceRef.current);
      }
      setIsCountingRecipients(true);
      recipientDebounceRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            "/api/admin/announcements/recipient-count",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                targetLocations: locs,
                targetGrades: grades,
                targetLabelIds: labelIds,
                targetUserIds: userIds,
                targetShiftIds: shiftIds,
              }),
            }
          );
          if (response.ok) {
            const data = await response.json();
            setRecipientPreview(data.count ?? null);
          }
        } catch {
          // ignore preview errors
        } finally {
          setIsCountingRecipients(false);
        }
      }, 600);
    },
    []
  );

  // Recompute the preview whenever any targeting dimension changes, including
  // user/shift selections (which are object lists, not just id arrays).
  useEffect(() => {
    updateRecipientPreview(
      targetLocations,
      targetGrades,
      targetLabelIds,
      targetUserIds,
      targetShiftIds
    );
  }, [
    targetLocations,
    targetGrades,
    targetLabelIds,
    targetUserIds,
    targetShiftIds,
    updateRecipientPreview,
  ]);

  const handleLocationToggle = (loc: string) => {
    setTargetLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  };

  const handleGradeToggle = (grade: string) => {
    setTargetGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  const handleLabelToggle = (labelId: string) => {
    setTargetLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((l) => l !== labelId)
        : [...prev, labelId]
    );
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

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
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
          targetLocations,
          targetGrades,
          targetLabelIds,
          targetUserIds,
          targetShiftIds,
          sendEmail,
          sendNotification,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Failed to create announcement");
      }

      const { announcement } = await response.json();
      setAnnouncements((prev) => [announcement, ...prev]);
      resetForm();
      setShowForm(false);
      const dispatchedVia = [
        sendEmail ? "emails" : null,
        sendNotification ? "push notifications" : null,
      ].filter(Boolean) as string[];
      toast.success(
        dispatchedVia.length > 0
          ? `Announcement published — ${dispatchedVia.join(" + ")} sending in the background`
          : "Announcement published"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create announcement"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/announcements/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Failed to delete");
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast.success("Announcement deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete announcement"
      );
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const isExpired = (ann: Announcement) =>
    ann.expiresAt ? new Date(ann.expiresAt) < new Date() : false;

  const getTargetingSummary = (ann: Announcement): string => {
    const parts: string[] = [];
    if (ann.targetLocations.length > 0) {
      parts.push(ann.targetLocations.join(", "));
    }
    if (ann.targetGrades.length > 0) {
      parts.push(
        ann.targetGrades
          .map(
            (g) => VOLUNTEER_GRADES.find((vg) => vg.value === g)?.label ?? g
          )
          .join(", ") + " grade"
      );
    }
    if (ann.targetLabelIds.length > 0) {
      const labelNames = ann.targetLabelIds
        .map((id) => labels.find((l) => l.id === id)?.name ?? id)
        .join(", ");
      parts.push(labelNames);
    }
    if (ann.targetUserIds.length > 0) {
      parts.push(
        `${ann.targetUserIds.length} specific volunteer${ann.targetUserIds.length === 1 ? "" : "s"}`
      );
    }
    if (ann.targetShiftIds.length > 0) {
      parts.push(
        `${ann.targetShiftIds.length} specific shift${ann.targetShiftIds.length === 1 ? "" : "s"}`
      );
    }
    return parts.length > 0 ? parts.join(" · ") : "All volunteers";
  };

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) resetForm();
          }}
          className="gap-2"
        >
          {showForm ? (
            <>
              <X className="w-4 h-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> New Announcement
            </>
          )}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="w-5 h-5 text-orange-500" />
              New Announcement
            </CardTitle>
            <CardDescription>
              Write your announcement in Markdown. Use targeting to reach
              specific volunteer groups, and optionally send via email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="ann-title">Title *</Label>
                <Input
                  id="ann-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Important update for Auckland volunteers"
                  maxLength={200}
                  required
                />
              </div>

              {/* Body with Markdown editor/preview tabs */}
              <div className="space-y-2">
                <Label>Body * (Markdown supported)</Label>
                <Tabs
                  value={previewMode ? "preview" : "edit"}
                  onValueChange={(v) => setPreviewMode(v === "preview")}
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="edit" className="gap-1.5 text-xs h-7">
                      <EyeOff className="w-3 h-3" /> Edit
                    </TabsTrigger>
                    <TabsTrigger
                      value="preview"
                      className="gap-1.5 text-xs h-7"
                    >
                      <Eye className="w-3 h-3" /> Preview
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit" className="mt-2">
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={`Write your announcement here...\n\nMarkdown tips:\n**bold**, *italic*, [link](url)\n- bullet points\n1. numbered lists`}
                      className="min-h-[200px] font-mono text-sm resize-y"
                      required
                    />
                  </TabsContent>
                  <TabsContent value="preview" className="mt-2">
                    <div className="min-h-[200px] rounded-md border bg-muted/30 px-4 py-3">
                      {body ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{body}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Nothing to preview yet — start typing in the Edit
                          tab.
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <Label>Featured Image (optional)</Label>
                {imageUrl ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Announcement image"
                      className="h-40 w-auto rounded-lg object-cover border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => setImageUrl(null)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                      "hover:border-primary/50 hover:bg-muted/30",
                      isUploadingImage && "opacity-50 pointer-events-none"
                    )}
                    onDrop={handleFileDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                  >
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
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {isUploadingImage
                        ? "Uploading…"
                        : "Drag & drop or click to upload (JPEG, PNG, WebP, GIF · max 5MB)"}
                    </p>
                  </div>
                )}
              </div>

              {/* Expiry */}
              <div className="space-y-2">
                <Label>Expiry Date (optional)</Label>
                <ExpiryDateTimePicker
                  value={expiresAt}
                  onChange={setExpiresAt}
                />
                <p className="text-xs text-muted-foreground">
                  If set, the announcement will stop appearing in the feed
                  after this date/time.
                </p>
              </div>

              {/* Targeting */}
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Targeting
                  </h3>
                  {recipientPreview !== null && (
                    <span className="text-xs text-muted-foreground">
                      {isCountingRecipients
                        ? "Counting…"
                        : `~${recipientPreview} volunteer${recipientPreview === 1 ? "" : "s"}`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Leave all empty to send to all volunteers. Multiple
                  selections within a category use OR logic; across categories
                  use AND logic.
                </p>

                {/* Locations */}
                {locations.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Locations
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {locations.map((loc) => (
                        <label
                          key={loc}
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          <Checkbox
                            checked={targetLocations.includes(loc)}
                            onCheckedChange={() => handleLocationToggle(loc)}
                          />
                          <span className="text-sm">{loc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grades */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Volunteer Grade
                  </Label>
                  <div className="flex flex-wrap gap-4">
                    {VOLUNTEER_GRADES.map((g) => (
                      <label
                        key={g.value}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        <Checkbox
                          checked={targetGrades.includes(g.value)}
                          onCheckedChange={() => handleGradeToggle(g.value)}
                        />
                        <span className="text-sm">
                          {g.label}{" "}
                          <span className="text-muted-foreground text-xs">
                            ({g.description})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Labels */}
                {labels.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Custom Labels
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {labels.map((label) => (
                        <label
                          key={label.id}
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          <Checkbox
                            checked={targetLabelIds.includes(label.id)}
                            onCheckedChange={() => handleLabelToggle(label.id)}
                          />
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full border font-medium",
                              label.color
                            )}
                          >
                            {label.icon && (
                              <span className="mr-1">{label.icon}</span>
                            )}
                            {label.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specific users */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Specific Volunteers
                  </Label>
                  <SpecificUsersPicker
                    selected={targetUsers}
                    onChange={setTargetUsers}
                  />
                </div>

                {/* Specific shifts */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Specific Shifts
                  </Label>
                  <SpecificShiftsPicker
                    selected={targetShifts}
                    onChange={setTargetShifts}
                    locations={locations}
                  />
                </div>
              </div>

              {/* Delivery options */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={sendNotification}
                    onCheckedChange={(checked) =>
                      setSendNotification(checked === true)
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-medium text-sm flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      Also send as push notification
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Each matched volunteer gets an in-app notification and
                      a push to their mobile device. The push body uses a
                      plain-text preview of the announcement.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={sendEmail}
                    onCheckedChange={(checked) =>
                      setSendEmail(checked === true)
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-medium text-sm flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Also send as email
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Each matched volunteer receives a transactional email
                      with the full announcement on top of seeing it in
                      their feed.
                    </p>
                  </div>
                </label>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  <Upload className="w-4 h-4" />
                  {isSubmitting ? "Publishing…" : "Publish Announcement"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              No announcements yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Create one above to broadcast to volunteers in their mobile
              feed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => {
            const expired = isExpired(ann);
            const expanded = expandedIds.has(ann.id);

            return (
              <Card
                key={ann.id}
                className={cn("transition-opacity", expired && "opacity-60")}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-950 flex items-center justify-center">
                      <Megaphone className="w-4 h-4 text-orange-500" />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm leading-snug">
                            {ann.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(
                                new Date(ann.createdAt),
                                "d MMM yyyy, h:mm a"
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              by{" "}
                              {ann.author.firstName ??
                                ann.author.name ??
                                ann.author.email}
                            </span>
                            {expired && (
                              <Badge
                                variant="outline"
                                className="text-xs py-0 border-orange-300 text-orange-600"
                              >
                                Expired
                              </Badge>
                            )}
                            {ann.expiresAt && !expired && (
                              <span className="text-xs text-muted-foreground">
                                Expires{" "}
                                {format(
                                  new Date(ann.expiresAt),
                                  "d MMM, h:mm a"
                                )}
                              </span>
                            )}
                            {ann.sendNotification && (
                              <Badge
                                variant="outline"
                                className="text-xs py-0 gap-1 border-emerald-300 text-emerald-700"
                              >
                                <Bell className="w-3 h-3" />
                                {ann.notificationSentAt
                                  ? "Push sent"
                                  : "Push queued"}
                              </Badge>
                            )}
                            {ann.sendEmail && (
                              <Badge
                                variant="outline"
                                className="text-xs py-0 gap-1 border-blue-300 text-blue-700"
                              >
                                <Mail className="w-3 h-3" />
                                {ann.emailSentAt ? "Email sent" : "Email queued"}
                              </Badge>
                            )}
                          </div>
                          {/* Targeting badge */}
                          <div className="mt-1.5 flex items-center gap-1">
                            <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">
                              {getTargetingSummary(ann)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              setExpandedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(ann.id)) next.delete(ann.id);
                                else next.add(ann.id);
                                return next;
                              })
                            }
                            aria-label={expanded ? "Collapse" : "Expand"}
                          >
                            {expanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(ann)}
                            aria-label="Delete announcement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded body preview */}
                      {expanded && (
                        <div className="mt-3 pt-3 border-t space-y-3">
                          {ann.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ann.imageUrl}
                              alt=""
                              className="h-32 w-auto rounded-md object-cover"
                            />
                          )}
                          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                            <ReactMarkdown>{ann.body}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently removed
              from the feed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Specific Users picker ──────────────────────────────────────────────────

function userDisplayName(u: UserOption) {
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
  return u.name || u.email;
}

function SpecificUsersPicker({
  selected,
  onChange,
}: {
  selected: UserOption[];
  onChange: (next: UserOption[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 250);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("q", debouncedSearch);
        params.set("limit", "50");
        const r = await fetch(`/api/admin/users?${params}`, {
          signal: controller.signal,
        });
        if (!r.ok) throw new Error("fetch failed");
        const data = await r.json();
        if (!cancelled) setResults(data);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, debouncedSearch]);

  const selectedIds = new Set(selected.map((u) => u.id));

  const toggle = (u: UserOption) => {
    onChange(
      selectedIds.has(u.id)
        ? selected.filter((s) => s.id !== u.id)
        : [...selected, u]
    );
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <UserPlus2 className="w-4 h-4" />
            {selected.length > 0
              ? `${selected.length} selected · add more`
              : "Pick volunteers"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-8 h-9"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {loading ? (
              <p className="text-xs text-muted-foreground px-3 py-4">
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4">
                No matching volunteers.
              </p>
            ) : (
              results.map((u) => {
                const isSelected = selectedIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/60",
                      isSelected && "bg-muted"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {userDisplayName(u)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <Badge
              key={u.id}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5"
            >
              <span className="text-xs">{userDisplayName(u)}</span>
              <button
                type="button"
                onClick={() =>
                  onChange(selected.filter((s) => s.id !== u.id))
                }
                className="hover:bg-background/60 rounded p-0.5"
                aria-label={`Remove ${userDisplayName(u)}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Specific Shifts picker ─────────────────────────────────────────────────

function shiftDisplayLabel(s: ShiftOption) {
  const start = new Date(s.start);
  const datePart = format(start, "EEE d MMM");
  const timePart = format(start, "h:mma").toLowerCase();
  const loc = s.location ?? "—";
  return `${s.shiftTypeName} · ${datePart} ${timePart} · ${loc}`;
}

function SpecificShiftsPicker({
  selected,
  onChange,
  locations,
}: {
  selected: ShiftOption[];
  onChange: (next: ShiftOption[]) => void;
  locations: string[];
}) {
  const [open, setOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (locationFilter) params.set("location", locationFilter);
    fetch(`/api/admin/announcements/shifts?${params}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (!cancelled) setShifts(data.shifts ?? []);
      })
      .catch(() => {
        if (!cancelled) setShifts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, locationFilter]);

  const selectedIds = new Set(selected.map((s) => s.id));

  const toggle = (s: ShiftOption) => {
    onChange(
      selectedIds.has(s.id)
        ? selected.filter((x) => x.id !== s.id)
        : [...selected, s]
    );
  };

  // Group shifts by date for a scannable list.
  const grouped = shifts.reduce<Record<string, ShiftOption[]>>((acc, s) => {
    const key = format(new Date(s.start), "EEE d MMM yyyy");
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <CalendarClock className="w-4 h-4" />
            {selected.length > 0
              ? `${selected.length} selected · add more`
              : "Pick shifts"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start">
          <div className="p-2 border-b flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Location</Label>
            <select
              className="text-sm border rounded px-2 py-1 bg-background flex-1"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {loading ? (
              <p className="text-xs text-muted-foreground px-3 py-4">
                Loading shifts…
              </p>
            ) : shifts.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4">
                No upcoming shifts.
              </p>
            ) : (
              Object.entries(grouped).map(([date, dayShifts]) => (
                <div key={date} className="px-1 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 pt-2 pb-1">
                    {date}
                  </p>
                  {dayShifts.map((s) => {
                    const isSelected = selectedIds.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggle(s)}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded hover:bg-muted/60",
                          isSelected && "bg-muted"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {s.shiftTypeName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {format(new Date(s.start), "h:mma").toLowerCase()}
                            {" – "}
                            {format(new Date(s.end), "h:mma").toLowerCase()}
                            {" · "}
                            {s.location ?? "—"}
                            {" · "}
                            {s.signupCount} signed up
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <Badge
              key={s.id}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5"
            >
              <span className="text-xs">{shiftDisplayLabel(s)}</span>
              <button
                type="button"
                onClick={() =>
                  onChange(selected.filter((x) => x.id !== s.id))
                }
                className="hover:bg-background/60 rounded p-0.5"
                aria-label="Remove shift"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Expiry Date+Time picker ────────────────────────────────────────────────

/**
 * Lightweight date+time picker that stores the value as a `datetime-local`
 * string ("YYYY-MM-DDTHH:mm") so the form submit body stays simple. The
 * native datetime-local input has frustrating cross-browser styling and no
 * obvious clear affordance, hence the popover Calendar + time input + Clear
 * button combo.
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

  const display = value
    ? format(new Date(value), "EEE d MMM yyyy, h:mm a")
    : "Pick a date and time";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 justify-start gap-2 font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="w-4 h-4" />
            {display}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={setDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <div className="relative">
        <ClockIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="time"
          value={timePart}
          onChange={(e) => setTime(e.target.value)}
          disabled={!datePart}
          className="pl-8 h-9 w-[130px]"
          aria-label="Expiry time"
        />
      </div>

      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange("")}
          className="gap-1 h-9 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
