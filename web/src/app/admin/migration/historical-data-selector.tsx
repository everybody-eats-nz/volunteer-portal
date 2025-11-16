"use client";

import { useState, useEffect, useRef } from "react";
import { randomBytes } from "crypto";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Database,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  RefreshCw,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MigrationProgressEvent } from "@/types/nova-migration";

interface MigratedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  signupCount: number;
  hasHistoricalData: boolean;
  invitationSent: boolean;
}

interface NovaConfig {
  baseUrl: string;
  email: string;
  password: string;
}

interface BatchImportResult {
  success: boolean;
  totalUsers: number;
  usersProcessed: number;
  usersWithHistory: number;
  totalShifts: number;
  totalSignups: number;
  errors: string[];
  duration: number;
  userResults: {
    email: string;
    success: boolean;
    shiftsImported: number;
    signupsImported: number;
    error?: string;
  }[];
}

type MigrationProgressData = MigrationProgressEvent & {
  totalUsers?: number;
  usersProcessed?: number;
  currentUser?: string;
};

interface HistoricalDataSelectorProps {
  novaConfig: NovaConfig;
}

export function HistoricalDataSelector({
  novaConfig,
}: HistoricalDataSelectorProps) {
  const [users, setUsers] = useState<MigratedUser[]>([]);
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<BatchImportResult | null>(null);
  const [progressData, setProgressData] =
    useState<MigrationProgressData | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const { toast } = useToast();
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop =
        logsContainerRef.current.scrollHeight;
    }
  }, [migrationLogs]);

  // Load migrated users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/migration/users");
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast({
        title: "Error",
        description: "Failed to load migrated users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserSelection = (email: string) => {
    setSelectedUserEmails((prev) =>
      prev.includes(email)
        ? prev.filter((e) => e !== email)
        : [...prev, email]
    );
  };

  const selectAll = () => {
    // Select only users without historical data
    const usersWithoutHistory = users.filter((u) => !u.hasHistoricalData);
    setSelectedUserEmails(usersWithoutHistory.map((u) => u.email));
  };

  const deselectAll = () => {
    setSelectedUserEmails([]);
  };

  const importHistoricalData = async () => {
    if (selectedUserEmails.length === 0) {
      toast({
        title: "No Users Selected",
        description: "Please select at least one user to import data for",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setResult(null);
    setProgressData(null);
    setCurrentStep("");
    setMigrationLogs([]);

    // Add initial log entry
    const timestamp = new Date().toLocaleTimeString("en-NZ");
    setMigrationLogs([
      `[${timestamp}] 🚀 Starting historical data import for ${selectedUserEmails.length} users...`,
    ]);

    // Generate session ID for SSE
    const sessionId = `migration-${Date.now()}-${randomBytes(8).toString(
      "hex"
    )}`;

    // Connect to SSE stream
    let eventSource: EventSource | null = new EventSource(
      `/api/admin/migration/progress-stream?sessionId=${sessionId}`
    );

    eventSource.onopen = () => {
      console.log("SSE connection opened");
      const timestamp = new Date().toLocaleTimeString("en-NZ");
      setMigrationLogs((prev) => [
        ...prev,
        `[${timestamp}] 📡 Connected to progress stream`,
      ]);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("SSE received:", data);

        const timestamp = new Date().toLocaleTimeString("en-NZ");

        // Filter out ping/connected messages from logs
        if (data.type !== "connected" && data.message) {
          const logEntry = `[${timestamp}] ${data.message}`;
          setMigrationLogs((prev) => [...prev, logEntry]);
        }

        if (data.type === "status" || data.type === "progress") {
          setCurrentStep(data.message);
          setProgressData(data);
        } else if (data.type === "complete") {
          setCurrentStep("Import completed!");
          setMigrationLogs((prev) => [
            ...prev,
            `[${timestamp}] ✅ Historical data import completed successfully!`,
          ]);
          eventSource?.close();
          eventSource = null;
        }
      } catch (error) {
        console.error("SSE parse error:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      eventSource?.close();
      eventSource = null;
    };

    try {
      const response = await fetch("/api/admin/migration/batch-import-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmails: selectedUserEmails,
          novaConfig,
          sessionId,
          options: {
            dryRun: false,
          },
        }),
      });

      const data: BatchImportResult = await response.json();
      setResult(data);

      // Log the results
      const timestamp = new Date().toLocaleTimeString("en-NZ");
      setMigrationLogs((prev) => [
        ...prev,
        `[${timestamp}] 🎯 Import Results:`,
        `[${timestamp}] ✅ Success: ${data.success}`,
        `[${timestamp}] 👥 Total Users: ${data.totalUsers}`,
        `[${timestamp}] 📊 Users with History: ${data.usersWithHistory}`,
        `[${timestamp}] 📅 Shifts Imported: ${data.totalShifts}`,
        `[${timestamp}] 📋 Signups Imported: ${data.totalSignups}`,
        `[${timestamp}] 🕒 Duration: ${(data.duration / 1000).toFixed(1)}s`,
        ...(data.errors && data.errors.length > 0
          ? [
              `[${timestamp}] ❌ Errors (${data.errors.length}):`,
              ...data.errors.map(
                (error: string) => `[${timestamp}]   • ${error}`
              ),
            ]
          : [`[${timestamp}] 🎉 No errors occurred!`]),
      ]);

      if (data.success) {
        toast({
          title: "Import Completed",
          description: `Imported ${data.totalShifts} shifts and ${data.totalSignups} signups for ${data.usersWithHistory} users`,
        });

        // Reload users to update signup counts
        await loadUsers();
        setSelectedUserEmails([]);
      } else {
        toast({
          title: "Import Failed",
          description: `Import failed with ${data.errors.length} errors`,
          variant: "destructive",
        });
      }
    } catch (error) {
      const timestamp = new Date().toLocaleTimeString("en-NZ");
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setMigrationLogs((prev) => [
        ...prev,
        `[${timestamp}] 💥 Import Error: ${errorMessage}`,
      ]);

      toast({
        title: "Import Error",
        description: "Network error during import",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      eventSource?.close();
      eventSource = null;
    }
  };

  const usersWithoutHistory = users.filter((u) => !u.hasHistoricalData);
  const usersWithHistory = users.filter((u) => u.hasHistoricalData);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Import Historical Data</CardTitle>
            </div>
            <Button
              onClick={loadUsers}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Select migrated users to import their historical shifts and signups
            from Nova
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Users</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{users.length}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Without History</span>
                <Database className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {usersWithoutHistory.length}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">With History</span>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-900">
                {usersWithHistory.length}
              </div>
            </div>
          </div>

          {/* Selection Actions */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedUserEmails.length} user(s) selected
            </div>
            <div className="flex gap-2">
              <Button
                onClick={selectAll}
                variant="outline"
                size="sm"
                disabled={usersWithoutHistory.length === 0}
              >
                Select All Without History
              </Button>
              <Button
                onClick={deselectAll}
                variant="outline"
                size="sm"
                disabled={selectedUserEmails.length === 0}
              >
                Deselect All
              </Button>
              <Button
                onClick={importHistoricalData}
                disabled={selectedUserEmails.length === 0 || isImporting}
                size="sm"
                className="gap-2"
              >
                {isImporting ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Import Selected ({selectedUserEmails.length})
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* User Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Signup Count</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Clock className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <div className="text-sm text-muted-foreground">
                        Loading users...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="text-sm text-muted-foreground">
                        No migrated users found. Run Step 1 first to create user
                        profiles.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUserEmails.includes(user.email)}
                          onCheckedChange={() =>
                            toggleUserSelection(user.email)
                          }
                          disabled={user.hasHistoricalData}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.firstName || user.lastName || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.signupCount}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.hasHistoricalData ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Imported
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Progress */}
      {isImporting && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 animate-spin" />
              <CardTitle>Import Progress</CardTitle>
            </div>
            <CardDescription>
              Real-time progress updates from the import process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStep && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">{currentStep}</span>
              </div>
            )}

            {progressData?.stage === "processing" && progressData?.totalUsers && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Users Processed</span>
                  <span>
                    {progressData.usersProcessed || 0} / {progressData.totalUsers}
                  </span>
                </div>
                <Progress
                  value={
                    ((progressData.usersProcessed || 0) /
                      progressData.totalUsers) *
                    100
                  }
                  className="w-full"
                />

                {progressData.currentUser && (
                  <div className="text-xs text-muted-foreground">
                    Current: {progressData.currentUser}
                  </div>
                )}
              </div>
            )}

            {/* Migration Logs */}
            {migrationLogs.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">Import Logs</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const logText = migrationLogs.join("\n");
                      navigator.clipboard.writeText(logText);
                      toast({ title: "Logs copied to clipboard" });
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Copy Logs
                  </Button>
                </div>
                <div
                  ref={logsContainerRef}
                  className="bg-black text-green-400 p-3 rounded-lg font-mono text-xs h-64 overflow-y-auto"
                >
                  {migrationLogs.map((log, index) => (
                    <div key={index} className="mb-1 whitespace-pre-wrap">
                      {log}
                    </div>
                  ))}
                  {isImporting && (
                    <div className="flex items-center mt-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                      <span className="text-gray-400">
                        Waiting for next update...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <CardTitle>Import Results</CardTitle>
            </div>
            <CardDescription>
              Completed in {(result.duration / 1000).toFixed(1)} seconds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm font-medium">Users Processed</div>
                <div className="text-2xl font-bold">{result.usersProcessed}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm font-medium">With History</div>
                <div className="text-2xl font-bold">
                  {result.usersWithHistory}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm font-medium">Shifts Imported</div>
                <div className="text-2xl font-bold">{result.totalShifts}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm font-medium">Signups Imported</div>
                <div className="text-2xl font-bold">{result.totalSignups}</div>
              </div>
            </div>

            {/* Detailed Results per User */}
            {result.userResults && result.userResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">User Details</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Shifts</TableHead>
                        <TableHead>Signups</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.userResults.map((userResult, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {userResult.email}
                          </TableCell>
                          <TableCell>
                            {userResult.success ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {userResult.error || "Failed"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{userResult.shiftsImported}</TableCell>
                          <TableCell>{userResult.signupsImported}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium">
                    {result.errors.length} error(s) occurred during import:
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {result.errors.slice(0, 5).map((error, index) => (
                      <li key={index} className="truncate">
                        • {error}
                      </li>
                    ))}
                    {result.errors.length > 5 && (
                      <li className="text-muted-foreground">
                        ... and {result.errors.length - 5} more
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {result.success && result.errors.length === 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Import completed successfully! {result.totalShifts} shifts and{" "}
                  {result.totalSignups} signups have been imported for{" "}
                  {result.usersWithHistory} users.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
