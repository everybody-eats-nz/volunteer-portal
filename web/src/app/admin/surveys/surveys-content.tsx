"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Users,
  ClipboardList,
  ToggleLeft,
  ToggleRight,
  UserPlus,
} from "lucide-react";
import { SurveyDialog } from "./survey-dialog";
import { AssignSurveyDialog } from "./assign-survey-dialog";
import { useToast } from "@/hooks/use-toast";
import { SURVEY_TRIGGER_DISPLAY } from "@/types/survey";
import type { Survey, SurveyTriggerType } from "@/generated/client";
import Link from "next/link";

type SurveyWithStats = Survey & {
  creator: {
    id: string;
    name: string | null;
    email: string;
  };
  _count: {
    assignments: number;
  };
  stats: {
    totalAssignments: number;
    pending: number;
    completed: number;
    dismissed: number;
    expired: number;
  };
};

interface SurveysContentProps {
  initialSurveys: SurveyWithStats[];
}

export function SurveysContent({ initialSurveys }: SurveysContentProps) {
  const [surveys, setSurveys] = useState<SurveyWithStats[]>(initialSurveys);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<SurveyWithStats | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState<SurveyWithStats | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [surveyToAssign, setSurveyToAssign] = useState<SurveyWithStats | null>(null);
  const { toast } = useToast();

  const handleCreateSurvey = async (data: {
    title: string;
    description?: string;
    questions: unknown[];
    triggerType: SurveyTriggerType;
    triggerValue: number;
    triggerMaxValue?: number | null;
    isActive?: boolean;
  }) => {
    try {
      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create survey");
      }

      const newSurvey = await response.json();
      setSurveys((prev) => [
        {
          ...newSurvey,
          _count: { assignments: 0 },
          stats: {
            totalAssignments: 0,
            pending: 0,
            completed: 0,
            dismissed: 0,
            expired: 0,
          },
        },
        ...prev,
      ]);

      toast({
        title: "Success",
        description: "Survey created successfully",
      });

      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create survey",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSurvey = async (
    id: string,
    data: {
      title?: string;
      description?: string;
      questions?: unknown[];
      triggerType?: SurveyTriggerType;
      triggerValue?: number;
      triggerMaxValue?: number | null;
      isActive?: boolean;
    }
  ) => {
    try {
      const response = await fetch(`/api/admin/surveys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update survey");
      }

      const updatedSurvey = await response.json();
      setSurveys((prev) =>
        prev.map((survey) =>
          survey.id === id
            ? { ...updatedSurvey, _count: survey._count, stats: survey.stats }
            : survey
        )
      );

      toast({
        title: "Success",
        description: "Survey updated successfully",
      });

      setDialogOpen(false);
      setEditingSurvey(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update survey",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (survey: SurveyWithStats) => {
    await handleUpdateSurvey(survey.id, { isActive: !survey.isActive });
  };

  const handleDeleteSurvey = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/surveys/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete survey");
      }

      const result = await response.json();

      if (result.deactivated) {
        // Survey was deactivated instead of deleted
        setSurveys((prev) =>
          prev.map((survey) =>
            survey.id === id ? { ...survey, isActive: false } : survey
          )
        );
        toast({
          title: "Survey Deactivated",
          description:
            "Survey has existing responses and was deactivated instead of deleted",
        });
      } else {
        // Survey was deleted
        setSurveys((prev) => prev.filter((survey) => survey.id !== id));
        toast({
          title: "Success",
          description: "Survey deleted successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete survey",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (survey: SurveyWithStats) => {
    setSurveyToDelete(survey);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSurvey = async () => {
    if (surveyToDelete) {
      await handleDeleteSurvey(surveyToDelete.id);
      setDeleteDialogOpen(false);
      setSurveyToDelete(null);
    }
  };

  const openEditDialog = (survey: SurveyWithStats) => {
    setEditingSurvey(survey);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingSurvey(null);
    setDialogOpen(true);
  };

  const openAssignDialog = (survey: SurveyWithStats) => {
    setSurveyToAssign(survey);
    setAssignDialogOpen(true);
  };

  const handleAssignmentComplete = () => {
    // Refresh surveys to update assignment counts
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Surveys</h2>
          <p className="text-slate-600 mt-1">
            Create and manage volunteer feedback surveys
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="create-survey-button">
          <Plus className="h-4 w-4 mr-2" />
          Create Survey
        </Button>
      </div>

      <div className="grid gap-4">
        {surveys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No surveys yet
              </h3>
              <p className="text-slate-600 mb-6">
                Create your first survey to gather feedback from volunteers.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Survey
              </Button>
            </CardContent>
          </Card>
        ) : (
          surveys.map((survey) => (
            <Card
              key={survey.id}
              className={!survey.isActive ? "opacity-60" : ""}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{survey.title}</h3>
                      {!survey.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      <Badge variant="outline">
                        {SURVEY_TRIGGER_DISPLAY[survey.triggerType]?.label}
                        {survey.triggerType !== "MANUAL" && (
                          survey.triggerMaxValue
                            ? ` (${survey.triggerValue}-${survey.triggerMaxValue})`
                            : ` (${survey.triggerValue}+)`
                        )}
                      </Badge>
                    </div>
                    {survey.description && (
                      <p className="text-sm text-slate-600 mb-2">
                        {survey.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {survey.stats.totalAssignments} assigned
                      </span>
                      <span className="text-green-600">
                        {survey.stats.completed} completed
                      </span>
                      <span className="text-blue-600">
                        {survey.stats.pending} pending
                      </span>
                      {survey.stats.expired > 0 && (
                        <span className="text-orange-600">
                          {survey.stats.expired} expired
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Created by {survey.creator.name || survey.creator.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={survey.triggerType === "MANUAL" ? "default" : "outline"}
                          size="sm"
                          onClick={() => openAssignDialog(survey)}
                          data-testid={`assign-survey-${survey.id}`}
                        >
                          <UserPlus className="h-4 w-4" />
                          {survey.triggerType === "MANUAL" && (
                            <span className="ml-1">Assign</span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Assign to Users</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/surveys/${survey.id}/responses`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View Responses</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(survey)}
                        >
                          {survey.isActive ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-slate-400" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {survey.isActive ? "Deactivate" : "Activate"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(survey)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(survey)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <SurveyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        survey={editingSurvey}
        onSave={
          editingSurvey
            ? (data) => handleUpdateSurvey(editingSurvey.id, data)
            : handleCreateSurvey
        }
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Survey
            </AlertDialogTitle>
            <AlertDialogDescription>
              {surveyToDelete?.stats.totalAssignments && surveyToDelete.stats.totalAssignments > 0 ? (
                <>
                  This survey has {surveyToDelete.stats.totalAssignments} assignment(s).
                  It will be deactivated instead of deleted to preserve historical data.
                </>
              ) : (
                "Are you sure you want to delete this survey? This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSurvey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {surveyToDelete?.stats.totalAssignments && surveyToDelete.stats.totalAssignments > 0
                ? "Deactivate"
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {surveyToAssign && (
        <AssignSurveyDialog
          survey={surveyToAssign}
          open={assignDialogOpen}
          onOpenChange={(open) => {
            setAssignDialogOpen(open);
            if (!open) setSurveyToAssign(null);
          }}
          onAssigned={handleAssignmentComplete}
        />
      )}
    </div>
  );
}
