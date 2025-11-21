"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Loader2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  file: z.any().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateResourceDialogProps {
  children: React.ReactNode;
}

export function CreateResourceDialog({ children }: CreateResourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "PDF",
      category: "GENERAL",
      tags: "",
      url: "",
    },
  });

  const resourceType = form.watch("type");
  const isLinkOrVideo = resourceType === "LINK" || resourceType === "VIDEO";

  const onSubmit = async (values: FormValues) => {
    setIsUploading(true);
    try {
      let fileUrl: string | undefined;
      let fileName: string | undefined;
      let fileSize: number | undefined;

      // Upload file directly to Supabase if not link/video
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

      // Create resource
      const tags = values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const response = await fetch("/api/admin/resources", {
        method: "POST",
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
          isPublished: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create resource");
      }

      toast.success("Resource created successfully");
      setOpen(false);
      form.reset();
      setSelectedFile(null);
      window.location.reload();
    } catch (error) {
      console.error("Error creating resource:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create resource"
      );
    } finally {
      setIsUploading(false);
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
      if (!form.getValues("title")) {
        form.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{children}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Resource</DialogTitle>
          <DialogDescription>
            Add a new resource to the volunteer resource hub.
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
                <FormLabel>Upload File</FormLabel>
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
                  Max file size: {MAX_FILE_SIZE / 1024 / 1024}MB
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

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Create Resource
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
