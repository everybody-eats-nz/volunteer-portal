"use client";

import { useState } from "react";
import { Resource, ResourceType, ResourceCategory } from "@/generated/client";
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Download,
  ExternalLink,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { formatFileSize } from "@/lib/storage-utils";
import { EditResourceDialog } from "@/components/edit-resource-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { formatInNZT } from "@/lib/timezone";

interface ResourceWithUploader extends Resource {
  uploader: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string;
  };
}

interface AdminResourcesTableProps {
  resources: ResourceWithUploader[];
  /** True when the list is narrowed by a category, type or status filter. */
  isFiltered?: boolean;
}

const TYPE_COLORS: Record<ResourceType, string> = {
  PDF: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50",
  IMAGE:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/50",
  DOCUMENT:
    "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50",
  LINK: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/50",
  VIDEO:
    "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/50",
};

const TYPE_LABELS: Record<ResourceType, string> = {
  PDF: "PDF",
  IMAGE: "Image",
  DOCUMENT: "Document",
  LINK: "Link",
  VIDEO: "Video",
};

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  TRAINING: "Training",
  POLICIES: "Policies",
  FORMS: "Forms",
  GUIDES: "Guides",
  RECIPES: "Recipes",
  SAFETY: "Safety",
  GENERAL: "General",
};

export function AdminResourcesTable({
  resources,
  isFiltered = false,
}: AdminResourcesTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editResource, setEditResource] = useState<ResourceWithUploader | null>(
    null
  );

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/resources/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete resource");
      }

      toast.success("Resource deleted successfully");
      window.location.reload();
    } catch (error) {
      console.error("Error deleting resource:", error);
      toast.error("Failed to delete resource");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const togglePublished = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/resources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update resource");
      }

      toast.success(
        `Resource ${!currentStatus ? "published" : "unpublished"} successfully`
      );
      window.location.reload();
    } catch (error) {
      console.error("Error updating resource:", error);
      toast.error("Failed to update resource");
    }
  };

  if (resources.length === 0) {
    return (
      <div className="rounded-xl border bg-card shadow-sm">
        <EmptyState
          icon={FolderOpen}
          title={isFiltered ? "No resources match these filters" : "No resources yet"}
          description={
            isFiltered
              ? "Clear the filters to see every resource."
              : "Upload your first resource to share it with volunteers."
          }
          data-testid="admin-resources-empty-state"
        />
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Title</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden xl:table-cell">Tags</TableHead>
              <TableHead className="hidden xl:table-cell">Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Uploaded by</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource) => {
              const uploaderName =
                [resource.uploader.firstName, resource.uploader.lastName]
                  .filter(Boolean)
                  .join(" ") ||
                resource.uploader.name ||
                resource.uploader.email;
              const created = formatInNZT(resource.createdAt, "d MMM yyyy");

              return (
                <TableRow key={resource.id}>
                  <TableCell className="py-3 pl-4 whitespace-normal md:max-w-[260px]">
                    <div className="font-medium break-words">
                      {resource.title}
                    </div>
                    {/* On a phone the type, category, uploader and date
                        columns are gone, so they fold in under the title. */}
                    <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground md:hidden">
                      {TYPE_LABELS[resource.type]} in{" "}
                      {CATEGORY_LABELS[resource.category]}
                    </div>
                    <div className="text-[13px] leading-snug text-muted-foreground lg:hidden">
                      Added {created} by {uploaderName}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge
                      variant="outline"
                      className={TYPE_COLORS[resource.type]}
                    >
                      {TYPE_LABELS[resource.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {CATEGORY_LABELS[resource.category]}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <div className="flex gap-1 flex-wrap max-w-[150px]">
                      {resource.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {resource.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{resource.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden tabular-nums xl:table-cell">
                    {resource.fileSize ? formatFileSize(resource.fileSize) : "-"}
                  </TableCell>
                  <TableCell className="py-3 align-top md:align-middle">
                    {resource.isPublished ? (
                      <StatusBadge tone="confirmed">Published</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Draft</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {uploaderName}
                  </TableCell>
                  <TableCell className="hidden text-sm tabular-nums text-muted-foreground lg:table-cell">
                    {created}
                  </TableCell>
                  <TableCell className="py-3 pr-4 text-right align-top md:align-middle">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${resource.title}`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {resource.type === "LINK" || resource.type === "VIDEO" ? (
                          <DropdownMenuItem
                            onClick={() => window.open(resource.url!, "_blank")}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                            Open link
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(resource.fileUrl!, "_blank")
                            }
                          >
                            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                            Download
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setEditResource(resource)}
                        >
                          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            togglePublished(resource.id, resource.isPublished)
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                          {resource.isPublished ? "Unpublish" : "Publish"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(resource.id)}
                          variant="destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              resource and remove it from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editResource && (
        <EditResourceDialog
          resource={editResource}
          open={editResource !== null}
          onOpenChange={(open) => !open && setEditResource(null)}
        />
      )}
    </>
  );
}
