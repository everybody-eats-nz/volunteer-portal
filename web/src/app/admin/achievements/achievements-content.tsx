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
import { Plus, Edit, Trash2, Users } from "lucide-react";
import { AchievementDialog } from "./achievement-dialog";
import { type Achievement } from "@/generated/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type AchievementWithCount = Achievement & {
  _count: {
    users: number;
  };
};

interface AchievementsContentProps {
  initialAchievements: AchievementWithCount[];
}

const CATEGORY_LABELS: Record<string, string> = {
  MILESTONE: "Milestone",
  DEDICATION: "Dedication",
  SPECIALIZATION: "Specialization",
  COMMUNITY: "Community",
  IMPACT: "Impact",
};

const CATEGORY_COLORS: Record<string, string> = {
  MILESTONE: "bg-purple-100 text-purple-700 border-purple-200",
  DEDICATION: "bg-blue-100 text-blue-700 border-blue-200",
  SPECIALIZATION: "bg-green-100 text-green-700 border-green-200",
  COMMUNITY: "bg-orange-100 text-orange-700 border-orange-200",
  IMPACT: "bg-pink-100 text-pink-700 border-pink-200",
};

export function AchievementsContent({
  initialAchievements,
}: AchievementsContentProps) {
  const [achievements, setAchievements] =
    useState<AchievementWithCount[]>(initialAchievements);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] =
    useState<AchievementWithCount | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [achievementToDelete, setAchievementToDelete] =
    useState<AchievementWithCount | null>(null);
  const { toast } = useToast();

  const handleCreateAchievement = async (data: {
    name: string;
    description: string;
    category: string;
    icon: string;
    criteria: string;
    points: number;
    isActive?: boolean;
  }) => {
    try {
      const response = await fetch("/api/admin/achievements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create achievement");
      }

      const newAchievement = await response.json();
      setAchievements((prev) => [
        ...prev,
        {
          ...newAchievement,
          _count: { users: 0 },
        },
      ]);

      toast({
        title: "Success",
        description: "Achievement created successfully",
      });

      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create achievement",
        variant: "destructive",
      });
    }
  };

  const handleUpdateAchievement = async (
    id: string,
    data: {
      name: string;
      description: string;
      category: string;
      icon: string;
      criteria: string;
      points: number;
      isActive?: boolean;
    }
  ) => {
    try {
      const response = await fetch(`/api/admin/achievements/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update achievement");
      }

      const updatedAchievement = await response.json();
      setAchievements((prev) =>
        prev.map((achievement) =>
          achievement.id === id
            ? { ...updatedAchievement, _count: achievement._count }
            : achievement
        )
      );

      toast({
        title: "Success",
        description: "Achievement updated successfully",
      });

      setDialogOpen(false);
      setEditingAchievement(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update achievement",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAchievement = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/achievements/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete achievement");
      }

      const result = await response.json();

      if (result.deleted) {
        // Actually deleted
        setAchievements((prev) =>
          prev.filter((achievement) => achievement.id !== id)
        );
        toast({
          title: "Success",
          description: "Achievement deleted successfully",
        });
      } else {
        // Soft deleted (deactivated)
        setAchievements((prev) =>
          prev.map((achievement) =>
            achievement.id === id
              ? { ...achievement, isActive: false }
              : achievement
          )
        );
        toast({
          title: "Achievement Deactivated",
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete achievement",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (achievement: AchievementWithCount) => {
    setAchievementToDelete(achievement);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAchievement = async () => {
    if (achievementToDelete) {
      await handleDeleteAchievement(achievementToDelete.id);
      setDeleteDialogOpen(false);
      setAchievementToDelete(null);
    }
  };

  const openEditDialog = (achievement: AchievementWithCount) => {
    setEditingAchievement(achievement);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingAchievement(null);
    setDialogOpen(true);
  };

  // Group achievements by category
  const groupedAchievements = achievements.reduce(
    (acc, achievement) => {
      if (!acc[achievement.category]) {
        acc[achievement.category] = [];
      }
      acc[achievement.category].push(achievement);
      return acc;
    },
    {} as Record<string, AchievementWithCount[]>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Achievements</h2>
          <p className="text-slate-600 mt-1">
            Create and manage volunteer achievements
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          data-testid="create-achievement-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Achievement
        </Button>
      </div>

      {achievements.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No achievements yet
            </h3>
            <p className="text-slate-600 mb-6">
              Create your first achievement to motivate volunteers.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Achievement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedAchievements).map(
            ([category, categoryAchievements]) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-4">
                  {CATEGORY_LABELS[category] || category}
                </h3>
                <div className="grid gap-4">
                  {categoryAchievements.map((achievement) => (
                    <Card
                      key={achievement.id}
                      className={!achievement.isActive ? "opacity-50" : ""}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="text-4xl">{achievement.icon}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-lg">
                                  {achievement.name}
                                </h4>
                                <Badge
                                  variant="outline"
                                  className={CATEGORY_COLORS[achievement.category]}
                                >
                                  {CATEGORY_LABELS[achievement.category]}
                                </Badge>
                                {!achievement.isActive && (
                                  <Badge variant="outline" className="bg-slate-100 text-slate-600">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              <p className="text-slate-600 text-sm mb-2">
                                {achievement.description}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-slate-500">
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  <span>
                                    {achievement._count.users} unlocked
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium">
                                    {achievement.points}
                                  </span>{" "}
                                  points
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(achievement)}
                              data-testid={`edit-achievement-${achievement.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(achievement)}
                              data-testid={`delete-achievement-${achievement.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      <AchievementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        achievement={editingAchievement}
        onSave={
          editingAchievement
            ? (data) => handleUpdateAchievement(editingAchievement.id, data)
            : handleCreateAchievement
        }
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Achievement
            </AlertDialogTitle>
            <AlertDialogDescription>
              {achievementToDelete && achievementToDelete._count.users > 0 ? (
                <>
                  This achievement has been unlocked by{" "}
                  {achievementToDelete._count.users} volunteer(s). It will be
                  deactivated instead of deleted to preserve volunteer progress.
                </>
              ) : (
                <>
                  Are you sure you want to delete this achievement? This action
                  cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAchievement}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {achievementToDelete && achievementToDelete._count.users > 0
                ? "Deactivate"
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
