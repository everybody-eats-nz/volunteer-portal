"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  List,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import type { SurveyQuestion } from "@/types/survey";
import { formatDistanceToNow } from "date-fns";

interface QuestionStats {
  questionId: string;
  questionText: string;
  questionType: string;
  totalResponses: number;
  distribution?: Record<string, number>;
  average?: number;
  textResponses?: string[];
}

interface ResponseData {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  completedAt: Date | null;
  answers?: Array<{
    questionId: string;
    value: string | string[] | number | boolean | null;
  }>;
}

interface ResponsesContentProps {
  survey: {
    id: string;
    title: string;
    description: string | null;
    questions: SurveyQuestion[];
  };
  totalResponses: number;
  questionStats: QuestionStats[];
  responses: ResponseData[];
}

export function ResponsesContent({
  survey,
  totalResponses,
  questionStats,
  responses,
}: ResponsesContentProps) {
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(
    new Set()
  );

  const toggleResponse = (id: string) => {
    setExpandedResponses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatValue = (
    value: string | string[] | number | boolean | null | undefined
  ): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/surveys">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Surveys
              </Link>
            </Button>
          </div>
          <h2 className="text-2xl font-bold">{survey.title}</h2>
          {survey.description && (
            <p className="text-muted-foreground mt-1">{survey.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            {totalResponses} response{totalResponses !== 1 ? "s" : ""} received
          </p>
        </div>
      </div>

      {totalResponses === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No responses yet</h3>
            <p className="text-muted-foreground">
              Responses will appear here once volunteers complete the survey.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">
              <BarChart3 className="h-4 w-4 mr-2" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="individual">
              <List className="h-4 w-4 mr-2" />
              Individual Responses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4 mt-4">
            {questionStats.map((stats) => (
              <Card key={stats.questionId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">
                    {stats.questionText}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {stats.totalResponses} response
                    {stats.totalResponses !== 1 ? "s" : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Rating scale average */}
                  {stats.questionType === "rating_scale" && stats.average && (
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-primary">
                        {stats.average.toFixed(1)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Average rating
                      </p>
                    </div>
                  )}

                  {/* Distribution for choice/rating questions */}
                  {stats.distribution && (
                    <div className="space-y-2">
                      {Object.entries(stats.distribution)
                        .sort(([a], [b]) => {
                          // Sort numerically for ratings, alphabetically otherwise
                          const numA = Number(a);
                          const numB = Number(b);
                          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                          return a.localeCompare(b);
                        })
                        .map(([key, count]) => {
                          const percentage = Math.round(
                            (count / stats.totalResponses) * 100
                          );
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{key}</span>
                                <span className="text-muted-foreground">
                                  {count} ({percentage}%)
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Text responses */}
                  {stats.textResponses && stats.textResponses.length > 0 && (
                    <div className="space-y-2">
                      {stats.textResponses.slice(0, 10).map((text, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-muted rounded-lg text-sm"
                        >
                          &ldquo;{text}&rdquo;
                        </div>
                      ))}
                      {stats.textResponses.length > 10 && (
                        <p className="text-sm text-muted-foreground">
                          And {stats.textResponses.length - 10} more responses...
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="individual" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Volunteer</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((response) => (
                    <>
                      <TableRow
                        key={response.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleResponse(response.id)}
                      >
                        <TableCell>
                          {expandedResponses.has(response.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {response.user.name || "Unknown"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {response.user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {response.completedAt
                            ? formatDistanceToNow(
                                new Date(response.completedAt),
                                { addSuffix: true }
                              )
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedResponses.has(response.id) && response.answers && (
                        <TableRow key={`${response.id}-details`}>
                          <TableCell colSpan={4} className="bg-muted/30">
                            <div className="p-4 space-y-4">
                              {survey.questions.map((question) => {
                                const answer = response.answers?.find(
                                  (a) => a.questionId === question.id
                                );
                                return (
                                  <div key={question.id}>
                                    <div className="text-sm font-medium mb-1">
                                      {question.text}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {formatValue(answer?.value)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
