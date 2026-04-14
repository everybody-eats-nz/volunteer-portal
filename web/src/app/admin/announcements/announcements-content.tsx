"use client";

import { useState, useRef, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface AnnouncementsContentProps {
  initialAnnouncements: Announcement[];
  labels: Label[];
  locations: string[];
}

export function AnnouncementsContent({
  initialAnnouncements,
  labels,
  locations,
}: AnnouncementsContentProps) {
  const [announcements, setAnnouncements] =
    useState<Announcement[]>(initialAnnouncements);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [targetGrades, setTargetGrades] = useState<string[]>([]);
  const [targetLabelIds, setTargetLabelIds] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState<number | null>(null);
  const [isCountingRecipients, setIsCountingRecipients] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recipientDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = () => {
    setTitle("");
    setBody("");
    setImageUrl(null);
    setExpiresAt("");
    setTargetLocations([]);
    setTargetGrades([]);
    setTargetLabelIds([]);
    setPreviewMode(false);
    setRecipientPreview(null);
  };

  // Debounced recipient count preview
  const updateRecipientPreview = useCallback(
    (locs: string[], grades: string[], labelIds: string[]) => {
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

  const handleLocationToggle = (loc: string) => {
    const next = targetLocations.includes(loc)
      ? targetLocations.filter((l) => l !== loc)
      : [...targetLocations, loc];
    setTargetLocations(next);
    updateRecipientPreview(next, targetGrades, targetLabelIds);
  };

  const handleGradeToggle = (grade: string) => {
    const next = targetGrades.includes(grade)
      ? targetGrades.filter((g) => g !== grade)
      : [...targetGrades, grade];
    setTargetGrades(next);
    updateRecipientPreview(targetLocations, next, targetLabelIds);
  };

  const handleLabelToggle = (labelId: string) => {
    const next = targetLabelIds.includes(labelId)
      ? targetLabelIds.filter((l) => l !== labelId)
      : [...targetLabelIds, labelId];
    setTargetLabelIds(next);
    updateRecipientPreview(targetLocations, targetGrades, next);
  };

  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const response = await fetch(
        "/api/admin/announcements/upload-image",
        { method: "POST", body: fd }
      );
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
      toast.success("Announcement published");
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
            (g) =>
              VOLUNTEER_GRADES.find((vg) => vg.value === g)?.label ?? g
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
              Write your announcement in Markdown. Use targeting to reach specific
              volunteer groups.
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
                    <TabsTrigger value="preview" className="gap-1.5 text-xs h-7">
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
                          Nothing to preview yet — start typing in the Edit tab.
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
                <Label htmlFor="ann-expires">Expiry Date (optional)</Label>
                <Input
                  id="ann-expires"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-auto"
                />
                <p className="text-xs text-muted-foreground">
                  If set, the announcement will stop appearing in the feed after this date/time.
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
                  Leave all empty to send to all volunteers. Multiple selections within a
                  category use OR logic; across categories use AND logic.
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
              Create one above to broadcast to volunteers in their mobile feed.
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
                className={cn(
                  "transition-opacity",
                  expired && "opacity-60"
                )}
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
                              {format(new Date(ann.createdAt), "d MMM yyyy, h:mm a")}
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
                                {format(new Date(ann.expiresAt), "d MMM, h:mm a")}
                              </span>
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
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently removed from the
              feed. This cannot be undone.
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
