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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  List,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
    availableLocations?: string | null;
  };
  completedAt: Date | null;
  answers?: Array<{
    questionId: string;
    value: string | string[] | number | boolean | null;
  }>;
}

interface AssignmentData {
  id: string;
  status: string;
  assignedAt: Date;
  completedAt: Date | null;
  dismissedAt: Date | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    availableLocations?: string | null;
  };
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
  assignments: AssignmentData[];
  locations: string[];
  selectedLocation?: string;
}

export function ResponsesContent({
  survey,
  totalResponses,
  questionStats,
  responses,
  assignments,
  locations,
  selectedLocation,
}: ResponsesContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(
    new Set()
  );

  const handleLocationChange = (value: string) => {
    const params = new URLSearchParams();
    if (value !== "all") {
      params.set("location", value);
    }
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  // Calculate assignment stats
  const stats = {
    total: assignments.length,
    completed: assignments.filter((a) => a.status === "COMPLETED").length,
    pending: assignments.filter((a) => a.status === "PENDING").length,
    dismissed: assignments.filter((a) => a.status === "DISMISSED").length,
    expired: assignments.filter((a) => a.status === "EXPIRED").length,
  };
  const completionRate =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
            {totalResponses} response{totalResponses !== 1 ? "s" : ""}{" "}
            {selectedLocation ? `from ${selectedLocation}` : "received"}
          </p>
        </div>

        {/* Location Filter */}
        {locations.length > 0 && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedLocation || "all"}
              onValueChange={handleLocationChange}
            >
              <SelectTrigger
                className="w-[180px]"
                data-testid="survey-location-filter"
              >
                <SelectValue placeholder="Filter by location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Completed</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-green-600">
                {stats.completed}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({completionRate}%)
                </span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-amber-600">
                {stats.pending}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-muted-foreground">Dismissed</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-slate-500">
                {stats.dismissed}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Expired</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-red-500">
                {stats.expired}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue={totalResponses > 0 ? "summary" : "assignments"}>
        <TabsList>
          <TabsTrigger value="summary" disabled={totalResponses === 0}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="individual" disabled={totalResponses === 0}>
            <List className="h-4 w-4 mr-2" />
            Responses ({totalResponses})
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <Users className="h-4 w-4 mr-2" />
            Assignments ({assignments.length})
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

          <TabsContent value="assignments" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Volunteer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No assignments yet. Use the &quot;Assign Survey&quot;
                        button to assign this survey to volunteers.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {assignment.user.name || "Unknown"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {assignment.user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {assignment.user.availableLocations || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              assignment.status === "COMPLETED"
                                ? "default"
                                : assignment.status === "PENDING"
                                  ? "secondary"
                                  : assignment.status === "DISMISSED"
                                    ? "outline"
                                    : "destructive"
                            }
                          >
                            {assignment.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(assignment.assignedAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {assignment.status === "COMPLETED" &&
                          assignment.completedAt
                            ? formatDistanceToNow(
                                new Date(assignment.completedAt),
                                { addSuffix: true }
                              )
                            : assignment.status === "DISMISSED" &&
                                assignment.dismissedAt
                              ? formatDistanceToNow(
                                  new Date(assignment.dismissedAt),
                                  { addSuffix: true }
                                )
                              : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}
