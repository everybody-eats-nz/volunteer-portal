"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MotionDialog,
  MotionDialogContent,
  MotionDialogHeader,
  MotionDialogTitle,
  MotionDialogDescription,
} from "@/components/motion-dialog";
import { ClipboardList, Eye } from "lucide-react";
import type { SurveyQuestion, SurveyAnswer } from "@/types/survey";

interface SurveyAssignmentItem {
  id: string;
  status: string;
  assignedAt: string | Date;
  survey: {
    id: string;
    title: string;
    questions: SurveyQuestion[];
  };
  response?: {
    id: string;
    answers: SurveyAnswer[];
    submittedAt: string | Date;
  } | null;
}

interface VolunteerSurveyHistoryProps {
  assignments: SurveyAssignmentItem[];
}

function formatAnswerValue(
  value: string | string[] | number | boolean | null | undefined
): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "PENDING":
      return "secondary";
    case "DISMISSED":
      return "outline";
    default:
      return "destructive";
  }
}

export function VolunteerSurveyHistory({
  assignments,
}: VolunteerSurveyHistoryProps) {
  const [selectedAssignment, setSelectedAssignment] =
    useState<SurveyAssignmentItem | null>(null);

  const completedCount = assignments.filter(
    (a) => a.status === "COMPLETED"
  ).length;

  return (
    <>
      <Card data-testid="survey-history-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Surveys
            <Badge variant="secondary" className="ml-1">
              {completedCount}/{assignments.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 bg-muted/50 dark:bg-muted/30 rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {assignment.survey.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Assigned{" "}
                    {format(new Date(assignment.assignedAt), "dd MMM yyyy")}
                    {assignment.status === "COMPLETED" &&
                      assignment.response?.submittedAt && (
                        <>
                          {" "}
                          &middot; Completed{" "}
                          {format(
                            new Date(assignment.response.submittedAt),
                            "dd MMM yyyy"
                          )}
                        </>
                      )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Badge variant={getStatusBadgeVariant(assignment.status)}>
                    {assignment.status.toLowerCase()}
                  </Badge>
                  {assignment.status === "COMPLETED" && assignment.response && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedAssignment(assignment)}
                      data-testid={`view-survey-response-${assignment.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <MotionDialog
        open={!!selectedAssignment}
        onOpenChange={(open) => {
          if (!open) setSelectedAssignment(null);
        }}
      >
        <MotionDialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <MotionDialogHeader>
            <MotionDialogTitle>
              {selectedAssignment?.survey.title}
            </MotionDialogTitle>
            <MotionDialogDescription>
              Completed{" "}
              {selectedAssignment?.response?.submittedAt
                ? format(
                    new Date(selectedAssignment.response.submittedAt),
                    "dd MMM yyyy 'at' h:mm a"
                  )
                : ""}
            </MotionDialogDescription>
          </MotionDialogHeader>
          <div className="space-y-4 mt-2">
            {selectedAssignment?.survey.questions.map(
              (question: SurveyQuestion) => {
                const answer = (
                  selectedAssignment.response?.answers as SurveyAnswer[]
                )?.find((a) => a.questionId === question.id);
                return (
                  <div
                    key={question.id}
                    className="p-3 bg-muted/50 dark:bg-muted/30 rounded-lg"
                  >
                    <div className="text-sm font-medium mb-1">
                      {question.text}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatAnswerValue(answer?.value)}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </MotionDialogContent>
      </MotionDialog>
    </>
  );
}
