"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Loader2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Resource } from "@prisma/client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MAX_FILE_SIZE, formatFileSize } from "@/lib/storage";
import { uploadFileFromClient } from "@/lib/client-storage";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["PDF", "IMAGE", "DOCUMENT", "LINK", "VIDEO"]),
  category: z.enum([
    "TRAINING",
    "POLICIES",
    "FORMS",
    "GUIDES",
    "RECIPES",
    "SAFETY",
    "GENERAL",
  ]),
  tags: z.string().optional(),
  url: z.string().url("Invalid URL").optional().or(z.literal("")),
  isPublished: z.boolean(),
  file: z.any().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditResourceDialogProps {
  resource: Resource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditResourceDialog({
  resource,
  open,
  onOpenChange,
}: EditResourceDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: resource.title,
      description: resource.description || "",
      type: resource.type,
      category: resource.category,
      tags: resource.tags.join(", "),
      url: resource.url || "",
      isPublished: resource.isPublished,
    },
  });

  // Reset form when resource changes
  useEffect(() => {
    form.reset({
      title: resource.title,
      description: resource.description || "",
      type: resource.type,
      category: resource.category,
      tags: resource.tags.join(", "),
      url: resource.url || "",
      isPublished: resource.isPublished,
    });
    setSelectedFile(null);
  }, [resource, form]);

  const resourceType = form.watch("type");
  const isLinkOrVideo = resourceType === "LINK" || resourceType === "VIDEO";

  const onSubmit = async (values: FormValues) => {
    setIsUpdating(true);
    try {
      let fileUrl = resource.fileUrl;
      let fileName = resource.fileName;
      let fileSize = resource.fileSize;

      // Upload new file directly to Supabase if provided
      if (!isLinkOrVideo && selectedFile) {
        const uploadData = await uploadFileFromClient(
          selectedFile,
          resourceType as "PDF" | "IMAGE" | "DOCUMENT",
          "resources"
        );
        fileUrl = uploadData.url;
        fileName = uploadData.fileName;
        fileSize = uploadData.fileSize;
      }

      // Update resource
      const tags = values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const response = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          type: values.type,
          category: values.category,
          tags,
          fileUrl,
          fileName,
          fileSize,
          url: isLinkOrVideo ? values.url : undefined,
          isPublished: values.isPublished,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update resource");
      }

      toast.success("Resource updated successfully");
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      console.error("Error updating resource:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update resource"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        return;
      }
      setSelectedFile(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Resource</DialogTitle>
          <DialogDescription>
            Update the resource information and file.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PDF">PDF Document</SelectItem>
                      <SelectItem value="IMAGE">Image</SelectItem>
                      <SelectItem value="DOCUMENT">
                        Document (Word, Excel, etc.)
                      </SelectItem>
                      <SelectItem value="LINK">External Link</SelectItem>
                      <SelectItem value="VIDEO">Video (YouTube, etc.)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isLinkOrVideo && (
              <div>
                <FormLabel>Current File</FormLabel>
                <div className="mt-2 mb-4">
                  <Badge variant="outline">
                    {resource.fileName || "File"}
                    {resource.fileSize && (
                      <span className="ml-2 text-muted-foreground">
                        ({formatFileSize(resource.fileSize)})
                      </span>
                    )}
                  </Badge>
                </div>

                <FormLabel>Upload New File (optional)</FormLabel>
                <div className="mt-2 flex items-center gap-4">
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    accept={
                      resourceType === "PDF"
                        ? ".pdf"
                        : resourceType === "IMAGE"
                        ? "image/*"
                        : ".doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    }
                  />
                  {selectedFile && (
                    <Badge variant="secondary">
                      {formatFileSize(selectedFile.size)}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Leave empty to keep current file. Max: {MAX_FILE_SIZE / 1024 / 1024}MB
                </p>
              </div>
            )}

            {isLinkOrVideo && (
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <LinkIcon className="mt-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="https://example.com/resource"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Resource title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the resource"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TRAINING">Training</SelectItem>
                      <SelectItem value="POLICIES">Policies</SelectItem>
                      <SelectItem value="FORMS">Forms</SelectItem>
                      <SelectItem value="GUIDES">Guides</SelectItem>
                      <SelectItem value="RECIPES">Recipes</SelectItem>
                      <SelectItem value="SAFETY">Safety</SelectItem>
                      <SelectItem value="GENERAL">General</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="orientation, kitchen, food-safety (comma separated)"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter tags separated by commas for better organization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isPublished"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Published</FormLabel>
                    <FormDescription>
                      Make this resource visible to volunteers
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Update Resource
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
