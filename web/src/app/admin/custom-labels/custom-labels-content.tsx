"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Edit, Trash2 } from "lucide-react";
import { CustomLabelBadge } from "@/components/custom-label-badge";
import { CustomLabelDialog } from "./custom-label-dialog";
import { type CustomLabel } from "@/generated/client";
import { useToast } from "@/hooks/use-toast";

type LabelWithCount = CustomLabel & {
  _count: {
    users: number;
  };
};

interface CustomLabelsContentProps {
  initialLabels: LabelWithCount[];
}

export function CustomLabelsContent({
  initialLabels,
}: CustomLabelsContentProps) {
  const [labels, setLabels] = useState<LabelWithCount[]>(initialLabels);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelWithCount | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState<LabelWithCount | null>(
    null
  );
  const { toast } = useToast();

  const handleCreateLabel = async (data: {
    name: string;
    color: string;
    icon?: string;
  }) => {
    try {
      const response = await fetch("/api/admin/custom-labels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create label");
      }

      const newLabel = await response.json();
      setLabels((prev) => [
        {
          ...newLabel,
          _count: { users: 0 },
        },
        ...prev,
      ]);

      toast({
        title: "Success",
        description: "Custom label created successfully",
      });

      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create label",
        variant: "destructive",
      });
    }
  };

  const handleUpdateLabel = async (
    id: string,
    data: { name: string; color: string; icon?: string }
  ) => {
    try {
      const response = await fetch(`/api/admin/custom-labels/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update label");
      }

      const updatedLabel = await response.json();
      setLabels((prev) =>
        prev.map((label) =>
          label.id === id ? { ...updatedLabel, _count: label._count } : label
        )
      );

      toast({
        title: "Success",
        description: "Custom label updated successfully",
      });

      setDialogOpen(false);
      setEditingLabel(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update label",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLabel = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/custom-labels/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete label");
      }

      setLabels((prev) => prev.filter((label) => label.id !== id));

      toast({
        title: "Success",
        description: "Custom label deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete label",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (label: LabelWithCount) => {
    setLabelToDelete(label);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteLabel = async () => {
    if (labelToDelete) {
      await handleDeleteLabel(labelToDelete.id);
      setDeleteDialogOpen(false);
      setLabelToDelete(null);
    }
  };

  const openEditDialog = (label: LabelWithCount) => {
    setEditingLabel(label);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingLabel(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Custom Labels</h2>
          <p className="text-slate-600 mt-1">
            Create and manage custom labels for volunteers (admin-only)
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="create-label-button">
          <Plus className="h-4 w-4 mr-2" />
          Add Label
        </Button>
      </div>

      <div className="grid gap-4">
        {labels.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No labels yet
              </h3>
              <p className="text-slate-600 mb-6">
                Create your first custom label to help categorize volunteers.
              </p>
              <Button onClick={openCreateDialog} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Create First Label
              </Button>
            </CardContent>
          </Card>
        ) : (
          labels.map((label) => (
            <Card key={label.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CustomLabelBadge label={label} />
                    <div className="text-sm text-slate-600">
                      {label._count.users} volunteer
                      {label._count.users !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(label)}
                      data-testid={`edit-label-${label.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(label)}
                      disabled={label._count.users > 0}
                      data-testid={`delete-label-${label.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {label._count.users > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    Remove from all volunteers before deleting
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CustomLabelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        label={editingLabel}
        onSave={
          editingLabel
            ? (data) => handleUpdateLabel(editingLabel.id, data)
            : handleCreateLabel
        }
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Custom Label
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this label? It will be removed
              from all users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLabel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Label
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
