"use client";

import { useState } from "react";
import { Resource, ResourceType, ResourceCategory } from "@prisma/client";
import {
  MoreHorizontal,
  Eye,
  Trash2,
  Download,
  ExternalLink,
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
import { formatFileSize } from "@/lib/storage";

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
}

const TYPE_COLORS: Record<ResourceType, string> = {
  PDF: "bg-red-100 text-red-800 border-red-200",
  IMAGE: "bg-blue-100 text-blue-800 border-blue-200",
  DOCUMENT: "bg-green-100 text-green-800 border-green-200",
  LINK: "bg-purple-100 text-purple-800 border-purple-200",
  VIDEO: "bg-orange-100 text-orange-800 border-orange-200",
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

export function AdminResourcesTable({ resources }: AdminResourcesTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          No resources found. Upload your first resource to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource) => (
              <TableRow key={resource.id}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {resource.title}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={TYPE_COLORS[resource.type]}>
                    {resource.type}
                  </Badge>
                </TableCell>
                <TableCell>{CATEGORY_LABELS[resource.category]}</TableCell>
                <TableCell>
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
                <TableCell>
                  {resource.fileSize ? formatFileSize(resource.fileSize) : "-"}
                </TableCell>
                <TableCell>
                  {resource.isPublished ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      Draft
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {resource.uploader.firstName} {resource.uploader.lastName}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(resource.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {resource.type === "LINK" || resource.type === "VIDEO" ? (
                        <DropdownMenuItem
                          onClick={() => window.open(resource.url!, "_blank")}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Link
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => window.open(resource.fileUrl!, "_blank")}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() =>
                          togglePublished(resource.id, resource.isPublished)
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {resource.isPublished ? "Unpublish" : "Publish"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(resource.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
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
    </>
  );
}
