"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Megaphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { AnnouncementList } from "./announcement-list";
import { Composer, type ComposerPrefill } from "./composer";
import {
  parseCsv,
  type Announcement,
  type LabelOption,
} from "./types";

interface AnnouncementsContentProps {
  initialAnnouncements: Announcement[];
  labels: LabelOption[];
  locations: string[];
  authorName: string;
}

/**
 * The announcements console. Two views: the overview (pulse strip + ledger)
 * and the composer, which takes over the page while writing. "Announce"
 * links elsewhere in the admin deep-link here with query params that seed
 * and open the composer.
 */
export function AnnouncementsContent({
  initialAnnouncements,
  labels,
  locations,
  authorName,
}: AnnouncementsContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Stable signature of the prefill query string — the effect below watches
  // it so a fresh "Announce" link click re-seeds the composer even though
  // this component never unmounts.
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
  const [composerOpen, setComposerOpen] = useState(hasPrefill);
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(() =>
    hasPrefill ? prefillFromParams(searchParams) : null
  );
  // Remount the composer whenever a new prefill arrives so it re-seeds.
  const [composerKey, setComposerKey] = useState(prefillSignature);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!hasPrefill) return;
    setPrefill(prefillFromParams(searchParams));
    setComposerKey(prefillSignature);
    setComposerOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillSignature]);

  const closeComposer = () => {
    setComposerOpen(false);
    setPrefill(null);
    setComposerKey(`closed-${Date.now()}`);
    // Drop any prefill query string so reopening doesn't re-seed. replace
    // avoids adding a history entry.
    if (hasPrefill) {
      router.replace(pathname);
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

  return (
    <div className="space-y-5">
      {/* Page header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-accent text-2xl font-semibold leading-tight">
            {composerOpen ? (
              <>
                New <em>announcement</em>
              </>
            ) : (
              <>
                What&apos;s <em>live</em> right now
              </>
            )}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {composerOpen
              ? "It lands in volunteers' feeds the moment you publish."
              : "Broadcasts to volunteers — in their feed, by push, or by email."}
          </p>
        </div>
        {composerOpen ? (
          <Button
            variant="outline"
            onClick={closeComposer}
            className="gap-2"
            data-testid="announcement-composer-close"
          >
            <X className="h-4 w-4" />
            Back to overview
          </Button>
        ) : (
          <Button
            onClick={() => {
              setComposerKey(`fresh-${Date.now()}`);
              setPrefill(null);
              setComposerOpen(true);
            }}
            className="gap-2 bg-forest-500 text-white hover:bg-forest-600 dark:bg-[#86d99b] dark:text-[#0f1114] dark:hover:bg-[#9be3ae]"
            data-testid="announcement-new"
          >
            <Megaphone className="h-4 w-4" />
            New announcement
          </Button>
        )}
      </div>

      {composerOpen ? (
        <Composer
          key={composerKey}
          labels={labels}
          locations={locations}
          authorName={authorName}
          prefill={prefill}
          onPublished={(announcement) => {
            setAnnouncements((prev) => [announcement, ...prev]);
            closeComposer();
          }}
          onClose={closeComposer}
        />
      ) : (
        <AnnouncementList
          announcements={announcements}
          labels={labels}
          onDelete={setDeleteTarget}
          onCompose={() => {
            setComposerKey(`fresh-${Date.now()}`);
            setPrefill(null);
            setComposerOpen(true);
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
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
              className="bg-destructive text-white hover:bg-destructive/90"
              data-testid="announcement-delete-confirm"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function prefillFromParams(params: URLSearchParams): ComposerPrefill {
  return {
    locations: parseCsv(params.get("locations")),
    grades: parseCsv(params.get("grades")),
    labelIds: parseCsv(params.get("labels")),
    userIds: parseCsv(params.get("userIds")),
    shiftIds: parseCsv(params.get("shiftIds")),
    sendEmail:
      params.get("sendEmail") === "1" || params.get("sendEmail") === "true",
  };
}
