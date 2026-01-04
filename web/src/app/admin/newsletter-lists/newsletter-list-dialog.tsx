"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface NewsletterList {
  id: string;
  name: string;
  campaignMonitorId: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
}

interface NewsletterListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: NewsletterList | null;
  onSuccess: () => void;
}

export default function NewsletterListDialog({
  open,
  onOpenChange,
  list,
  onSuccess,
}: NewsletterListDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    campaignMonitorId: "",
    description: "",
    active: true,
    displayOrder: 0,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (list) {
      setFormData({
        name: list.name,
        campaignMonitorId: list.campaignMonitorId,
        description: list.description || "",
        active: list.active,
        displayOrder: list.displayOrder,
      });
    } else {
      setFormData({
        name: "",
        campaignMonitorId: "",
        description: "",
        active: true,
        displayOrder: 0,
      });
    }
    setErrors({});
  }, [list, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const url = list
        ? `/api/admin/newsletter-lists/${list.id}`
        : "/api/admin/newsletter-lists";

      const method = list ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          description: formData.description || null,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Newsletter list ${list ? "updated" : "created"} successfully`,
        });
        onSuccess();
      } else {
        const error = await response.json();
        if (error.details) {
          const fieldErrors: Record<string, string> = {};
          error.details.forEach((detail: { path?: string[]; message: string }) => {
            if (detail.path && detail.path.length > 0) {
              fieldErrors[detail.path[0]] = detail.message;
            }
          });
          setErrors(fieldErrors);
        } else {
          throw new Error(error.error || "Failed to save newsletter list");
        }
      }
    } catch (error) {
      console.error("Error saving list:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save newsletter list",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {list ? "Edit Newsletter List" : "Create Newsletter List"}
            </DialogTitle>
            <DialogDescription>
              {list
                ? "Update the newsletter list details below."
                : "Add a new Campaign Monitor newsletter list for volunteers to subscribe to."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Auckland Newsletter"
                disabled={loading}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaignMonitorId">
                Campaign Monitor List ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="campaignMonitorId"
                value={formData.campaignMonitorId}
                onChange={(e) =>
                  setFormData({ ...formData, campaignMonitorId: e.target.value })
                }
                placeholder="e.g., d0fa752b4fe96d8b9a14e77d3c917222"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Find this ID in your Campaign Monitor account
              </p>
              {errors.campaignMonitorId && (
                <p className="text-sm text-destructive">{errors.campaignMonitorId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description for volunteers"
                rows={3}
                disabled={loading}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={(e) =>
                  setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })
                }
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first
              </p>
              {errors.displayOrder && (
                <p className="text-sm text-destructive">{errors.displayOrder}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Only active lists are shown to volunteers
                </p>
              </div>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, active: checked })
                }
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : list ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
