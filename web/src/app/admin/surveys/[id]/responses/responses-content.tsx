"use client";

import { useState, useMemo } from "react";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Download,
  Shield,
  CalendarDays,
  Hash,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { SurveyQuestion } from "@/types/survey";
import { formatDistanceToNow } from "date-fns";

type SortDirection = "asc" | "desc";
type SortConfig<T extends string> = { key: T; direction: SortDirection } | null;

function SortableHeader<T extends string>({
  label,
  sortKey,
  sortConfig,
  onSort,
  className,
}: {
  label: string;
  sortKey: T;
  sortConfig: SortConfig<T>;
  onSort: (key: T) => void;
  className?: string;
}) {
  const isActive = sortConfig?.key === sortKey;
  const Icon = isActive
    ? sortConfig.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon className={`h-3 w-3 ${isActive ? "text-foreground" : "text-muted-foreground/50"}`} />
      </button>
    </TableHead>
  );
}

function toggleSort<T extends string>(
  current: SortConfig<T>,
  key: T
): SortConfig<T> {
  if (current?.key === key) {
    if (current.direction === "asc") return { key, direction: "desc" };
    return null; // third click clears sort
  }
  return { key, direction: "asc" };
}

interface QuestionStats {
  questionId: string;
  questionText: string;
  questionType: string;
  totalResponses: number;
  distribution?: Record<string, number>;
  average?: number;
  textResponses?: string[];
}

interface UserData {
  id: string;
  name: string | null;
  email: string;
  defaultLocation?: string | null;
  createdAt: Date | string;
  volunteerGrade?: string;
  completedShifts?: number;
}

interface ResponseData {
  id: string;
  user: UserData;
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
  user: UserData;
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
  selectedGrade?: string;
  selectedTenure?: string;
  selectedShifts?: string;
}

export function ResponsesContent({
  survey,
  totalResponses,
  questionStats,
  responses,
  assignments,
  locations,
  selectedLocation,
  selectedGrade,
  selectedTenure,
  selectedShifts,
}: ResponsesContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(
    new Set()
  );

  type ResponseSortKey = "name" | "location" | "shifts" | "member" | "completed";
  type AssignmentSortKey = "name" | "location" | "shifts" | "member" | "status" | "assigned" | "updated";

  const [responseSortConfig, setResponseSortConfig] =
    useState<SortConfig<ResponseSortKey>>(null);
  const [assignmentSortConfig, setAssignmentSortConfig] =
    useState<SortConfig<AssignmentSortKey>>(null);

  const sortedResponses = useMemo(() => {
    if (!responseSortConfig) return responses;
    const { key, direction } = responseSortConfig;
    const sorted = [...responses].sort((a, b) => {
      let cmp = 0;
      if (key === "name") {
        cmp = (a.user.name || "").localeCompare(b.user.name || "");
      } else if (key === "location") {
        cmp = (a.user.defaultLocation || "").localeCompare(
          b.user.defaultLocation || ""
        );
      } else if (key === "shifts") {
        cmp = (a.user.completedShifts || 0) - (b.user.completedShifts || 0);
      } else if (key === "member") {
        cmp =
          new Date(a.user.createdAt).getTime() -
          new Date(b.user.createdAt).getTime();
      } else if (key === "completed") {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        cmp = dateA - dateB;
      }
      return direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [responses, responseSortConfig]);

  const sortedAssignments = useMemo(() => {
    if (!assignmentSortConfig) return assignments;
    const { key, direction } = assignmentSortConfig;
    const sorted = [...assignments].sort((a, b) => {
      let cmp = 0;
      if (key === "name") {
        cmp = (a.user.name || "").localeCompare(b.user.name || "");
      } else if (key === "location") {
        cmp = (a.user.defaultLocation || "").localeCompare(
          b.user.defaultLocation || ""
        );
      } else if (key === "shifts") {
        cmp = (a.user.completedShifts || 0) - (b.user.completedShifts || 0);
      } else if (key === "member") {
        cmp =
          new Date(a.user.createdAt).getTime() -
          new Date(b.user.createdAt).getTime();
      } else if (key === "status") {
        cmp = a.status.localeCompare(b.status);
      } else if (key === "assigned") {
        cmp =
          new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime();
      } else if (key === "updated") {
        const getUpdateTime = (item: AssignmentData) =>
          item.completedAt
            ? new Date(item.completedAt).getTime()
            : item.dismissedAt
            ? new Date(item.dismissedAt).getTime()
            : 0;
        cmp = getUpdateTime(a) - getUpdateTime(b);
      }
      return direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [assignments, assignmentSortConfig]);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams();
    const filters: Record<string, string | undefined> = {
      location: selectedLocation,
      grade: selectedGrade,
      tenure: selectedTenure,
      shifts: selectedShifts,
    };
    filters[key] = value === "all" ? undefined : value;

    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const activeFilterCount = [
    selectedLocation,
    selectedGrade,
    selectedTenure,
    selectedShifts,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    router.push(pathname);
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

  const exportCsv = () => {
    const escapeCsv = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const headers = [
      "Volunteer Name",
      "Email",
      "Completed At",
      ...survey.questions.map((q) => q.text),
    ];

    const rows = responses.map((response) => [
      response.user.name || "Unknown",
      response.user.email,
      response.completedAt
        ? new Date(response.completedAt).toISOString()
        : "-",
      ...survey.questions.map((question) => {
        const answer = response.answers?.find(
          (a) => a.questionId === question.id
        );
        return formatValue(answer?.value);
      }),
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${survey.title.replace(/[^a-zA-Z0-9]/g, "-")}-responses.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
            {activeFilterCount > 0 ? "(filtered)" : "received"}
          </p>
        </div>

        {totalResponses > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            data-testid="survey-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {locations.length > 0 && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedLocation || "all"}
              onValueChange={(v) => handleFilterChange("location", v)}
            >
              <SelectTrigger
                className="w-auto h-9 text-sm"
                data-testid="survey-location-filter"
              >
                <SelectValue placeholder="Location" />
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

        <div className="flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedGrade || "all"}
            onValueChange={(v) => handleFilterChange("grade", v)}
          >
            <SelectTrigger className="w-auto h-9 text-sm" data-testid="survey-grade-filter">
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              <SelectItem value="GREEN">Green</SelectItem>
              <SelectItem value="YELLOW">Yellow</SelectItem>
              <SelectItem value="PINK">Pink</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedTenure || "all"}
            onValueChange={(v) => handleFilterChange("tenure", v)}
          >
            <SelectTrigger className="w-auto h-9 text-sm" data-testid="survey-tenure-filter">
              <SelectValue placeholder="Tenure" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenures</SelectItem>
              <SelectItem value="lt1m">Less than 1 month</SelectItem>
              <SelectItem value="1-3m">1-3 months</SelectItem>
              <SelectItem value="3-6m">3-6 months</SelectItem>
              <SelectItem value="6-12m">6-12 months</SelectItem>
              <SelectItem value="gt1y">Over 1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedShifts || "all"}
            onValueChange={(v) => handleFilterChange("shifts", v)}
          >
            <SelectTrigger className="w-auto h-9 text-sm" data-testid="survey-shifts-filter">
              <SelectValue placeholder="Shifts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shift Counts</SelectItem>
              <SelectItem value="0-5">0-5 shifts</SelectItem>
              <SelectItem value="6-15">6-15 shifts</SelectItem>
              <SelectItem value="16-30">16-30 shifts</SelectItem>
              <SelectItem value="31-50">31-50 shifts</SelectItem>
              <SelectItem value="gt50">50+ shifts</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Button>
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
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="summary" disabled={totalResponses === 0} className="flex-1 sm:flex-initial">
            <BarChart3 className="h-4 w-4 mr-2 hidden sm:block" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="individual" disabled={totalResponses === 0} className="flex-1 sm:flex-initial">
            <List className="h-4 w-4 mr-2 hidden sm:block" />
            Responses ({totalResponses})
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex-1 sm:flex-initial">
            <Users className="h-4 w-4 mr-2 hidden sm:block" />
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
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <SortableHeader
                    label="Volunteer"
                    sortKey="name"
                    sortConfig={responseSortConfig}
                    onSort={(key) =>
                      setResponseSortConfig(toggleSort(responseSortConfig, key))
                    }
                  />
                  <SortableHeader
                    label="Location"
                    sortKey="location"
                    sortConfig={responseSortConfig}
                    onSort={(key) =>
                      setResponseSortConfig(toggleSort(responseSortConfig, key))
                    }
                  />
                  <SortableHeader
                    label="Shifts"
                    sortKey="shifts"
                    sortConfig={responseSortConfig}
                    onSort={(key) =>
                      setResponseSortConfig(toggleSort(responseSortConfig, key))
                    }
                  />
                  <SortableHeader
                    label="Member For"
                    sortKey="member"
                    sortConfig={responseSortConfig}
                    onSort={(key) =>
                      setResponseSortConfig(toggleSort(responseSortConfig, key))
                    }
                  />
                  <SortableHeader
                    label="Completed"
                    sortKey="completed"
                    sortConfig={responseSortConfig}
                    onSort={(key) =>
                      setResponseSortConfig(toggleSort(responseSortConfig, key))
                    }
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResponses.map((response) => (
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
                          <Link
                            href={`/admin/volunteers/${response.user.id}`}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {response.user.name || "Unknown"}
                          </Link>
                          <div className="text-sm text-muted-foreground">
                            {response.user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {response.user.defaultLocation || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {response.user.completedShifts ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(response.user.createdAt))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {response.completedAt
                          ? formatDistanceToNow(
                              new Date(response.completedAt),
                              { addSuffix: true }
                            )
                          : "-"}
                      </TableCell>
                    </TableRow>
                    {expandedResponses.has(response.id) && response.answers && (
                      <TableRow key={`${response.id}-details`}>
                        <TableCell colSpan={6} className="bg-muted/30 whitespace-normal">
                          <div className="p-4 space-y-4 break-words">
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
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    label="Volunteer"
                    sortKey="name"
                    sortConfig={assignmentSortConfig}
                    onSort={(key) =>
                      setAssignmentSortConfig(
                        toggleSort(assignmentSortConfig, key)
                      )
                    }
                  />
                  <SortableHeader
                    label="Location"
                    sortKey="location"
                    sortConfig={assignmentSortConfig}
                    onSort={(key) =>
                      setAssignmentSortConfig(
                        toggleSort(assignmentSortConfig, key)
                      )
                    }
                  />
                  <SortableHeader
                    label="Shifts"
                    sortKey="shifts"
                    sortConfig={assignmentSortConfig}
                    onSort={(key) =>
                      setAssignmentSortConfig(
                        toggleSort(assignmentSortConfig, key)
                      )
                    }
                  />
                  <SortableHeader
                    label="Member For"
                    sortKey="member"
                    sortConfig={assignmentSortConfig}
                    onSort={(key) =>
                      setAssignmentSortConfig(
                        toggleSort(assignmentSortConfig, key)
                      )
                    }
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    sortConfig={assignmentSortConfig}
                    onSort={(key) =>
                      setAssignmentSortConfig(
                        toggleSort(assignmentSortConfig, key)
                      )
                    }
                  />
                  <SortableHeader
                    label="Assigned"
                    sortKey="assigned"
                    sortConfig={assignmentSortConfig}
                    onSort={(key) =>
                      setAssignmentSortConfig(
                        toggleSort(assignmentSortConfig, key)
                      )
                    }
                  />
                  <SortableHeader
                    label="Updated"
                    sortKey="updated"
                    sortConfig={assignmentSortConfig}
                    onSort={(key) =>
                      setAssignmentSortConfig(
                        toggleSort(assignmentSortConfig, key)
                      )
                    }
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No assignments yet. Use the &quot;Assign Survey&quot;
                      button to assign this survey to volunteers.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div>
                          <Link
                            href={`/admin/volunteers/${assignment.user.id}`}
                            className="font-medium hover:underline"
                          >
                            {assignment.user.name || "Unknown"}
                          </Link>
                          <div className="text-sm text-muted-foreground">
                            {assignment.user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {assignment.user.defaultLocation || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {assignment.user.completedShifts ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(assignment.user.createdAt))}
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
