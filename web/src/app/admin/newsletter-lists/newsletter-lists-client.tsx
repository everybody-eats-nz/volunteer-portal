"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import NewsletterListDialog from "./newsletter-list-dialog";
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

interface NewsletterList {
  id: string;
  name: string;
  campaignMonitorId: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function NewsletterListsClient() {
  const [lists, setLists] = useState<NewsletterList[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<NewsletterList | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<NewsletterList | null>(null);
  const { toast } = useToast();

  const fetchLists = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/newsletter-lists");
      if (response.ok) {
        const data = await response.json();
        setLists(data);
      } else {
        throw new Error("Failed to fetch newsletter lists");
      }
    } catch (error) {
      console.error("Error fetching lists:", error);
      toast({
        title: "Error",
        description: "Failed to load newsletter lists",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleCreate = () => {
    setEditingList(null);
    setDialogOpen(true);
  };

  const handleEdit = (list: NewsletterList) => {
    setEditingList(list);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!listToDelete) return;

    try {
      const response = await fetch(`/api/admin/newsletter-lists/${listToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Newsletter list deleted successfully",
        });
        fetchLists();
      } else {
        throw new Error("Failed to delete newsletter list");
      }
    } catch (error) {
      console.error("Error deleting list:", error);
      toast({
        title: "Error",
        description: "Failed to delete newsletter list",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setListToDelete(null);
    }
  };

  const handleToggleActive = async (list: NewsletterList) => {
    try {
      const response = await fetch(`/api/admin/newsletter-lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !list.active }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Newsletter list ${!list.active ? "activated" : "deactivated"}`,
        });
        fetchLists();
      } else {
        throw new Error("Failed to update newsletter list");
      }
    } catch (error) {
      console.error("Error updating list:", error);
      toast({
        title: "Error",
        description: "Failed to update newsletter list",
        variant: "destructive",
      });
    }
  };

  const handleDialogSuccess = () => {
    setDialogOpen(false);
    setEditingList(null);
    fetchLists();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading newsletter lists...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Manage newsletter lists for volunteer subscriptions. Lists are integrated with Campaign Monitor.
          </p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Newsletter List
          </Button>
        </div>

        {lists.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64">
              <p className="text-muted-foreground mb-4">No newsletter lists yet</p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create First List
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {lists.map((list) => (
              <Card key={list.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-move" />
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{list.name}</CardTitle>
                          <Badge variant={list.active ? "default" : "secondary"}>
                            {list.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {list.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {list.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Campaign Monitor ID: {list.campaignMonitorId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(list)}
                      >
                        {list.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(list)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setListToDelete(list);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <NewsletterListDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        list={editingList}
        onSuccess={handleDialogSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the newsletter list &quot;{listToDelete?.name}&quot;.
              Users currently subscribed to this list will remain subscribed in Campaign Monitor,
              but won&apos;t be able to manage their subscription through this portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
