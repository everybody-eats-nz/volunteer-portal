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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  Users,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  Play,
  Settings,
  Eye,
  EyeOff,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MigrationProgressEvent } from "@/types/nova-migration";
import { HistoricalDataSelector } from "./historical-data-selector";

interface NovaConfig {
  baseUrl: string;
  email: string;
  password: string;
}

interface MigrationOptions {
  dryRun: boolean;
  skipExistingUsers: boolean;
  includeHistoricalData: boolean;
  batchSize: number;
}

interface BulkMigrationResult {
  success: boolean;
  totalUsers: number;
  usersProcessed: number;
  usersCreated: number;
  usersSkipped: number;
  usersWithHistory: number;
  totalShifts: number;
  totalSignups: number;
  errors: string[];
  duration: number;
  dryRun: boolean;
}

type MigrationProgressData = MigrationProgressEvent & {
  totalUsers?: number;
  usersProcessed?: number;
  usersCreated?: number;
  usersSkipped?: number;
  currentUser?: string;
};

export function NovaBulkMigration() {
  const [activeTab, setActiveTab] = useState<string>("step1");
  const [novaConfig, setNovaConfig] = useState<NovaConfig>({
    baseUrl: "https://app.everybodyeats.nz",
    email: "",
    password: "",
  });

  const [options, setOptions] = useState<MigrationOptions>({
    dryRun: true,
    skipExistingUsers: true,
    includeHistoricalData: false, // Default to false for two-step flow
    batchSize: 50,
  });

  const [migrationMode, setMigrationMode] = useState<"bulk" | "single">("bulk");
  const [singleUserEmail, setSingleUserEmail] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<BulkMigrationResult | null>(null);
  const [connectionTested, setConnectionTested] = useState(false);
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

  const testConnection = async () => {
    if (!novaConfig.baseUrl || !novaConfig.email || !novaConfig.password) {
      toast({
        title: "Missing Configuration",
        description: "Please fill in all Nova connection details",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        "/api/admin/migration/test-nova-connection",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ novaConfig }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setConnectionTested(true);
        toast({
          title: "Connection Successful",
          description: "Successfully connected to Laravel Nova",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Failed to connect to Nova",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast({
        title: "Connection Error",
        description: "Network error while testing connection",
        variant: "destructive",
      });
    }
  };

  const runMigration = async () => {
    if (!connectionTested) {
      toast({
        title: "Test Connection First",
        description: "Please test the Nova connection before running migration",
        variant: "destructive",
      });
      return;
    }

    if (migrationMode === "single" && !singleUserEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address for single user migration",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setResult(null);
    setProgressData(null);
    setCurrentStep("");
    setMigrationLogs([]);

    // Add initial log entry
    const timestamp = new Date().toLocaleTimeString('en-NZ');
    setMigrationLogs([
      `[${timestamp}] 🚀 Starting ${migrationMode} migration...`,
    ]);

    // Generate session ID for SSE
    const sessionId = `migration-${Date.now()}-${randomBytes(8).toString(
      "hex"
    )}`;

    // Connect to SSE stream using the new better-sse endpoint
    let eventSource: EventSource | null = new EventSource(
      `/api/admin/migration/progress-stream?sessionId=${sessionId}`
    );

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 2000; // 2 seconds

    const connectEventSource = () => {
      if (!eventSource) {
        eventSource = new EventSource(
          `/api/admin/migration/progress-stream?sessionId=${sessionId}`
        );
      }

      eventSource.onopen = () => {
        console.log("SSE connection opened");
        reconnectAttempts = 0;
        const timestamp = new Date().toLocaleTimeString('en-NZ');
        setMigrationLogs((prev) => [
          ...prev,
          `[${timestamp}] 📡 Connected to progress stream`,
        ]);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("SSE received:", data);

          // Add log entry with timestamp
          const timestamp = new Date().toLocaleTimeString('en-NZ');

          // Filter out ping/connected messages from logs
          if (data.type !== "connected" && data.message) {
            const logEntry = `[${timestamp}] ${data.message}`;
            setMigrationLogs((prev) => [...prev, logEntry]);
          }

          if (data.type === "status" || data.type === "progress") {
            setCurrentStep(data.message);
            setProgressData(data);
          } else if (data.type === "complete") {
            setCurrentStep("Migration completed!");
            setMigrationLogs((prev) => [
              ...prev,
              `[${timestamp}] ✅ Migration completed successfully!`,
            ]);
            eventSource?.close();
            eventSource = null;
          }
        } catch (error) {
          console.error("SSE parse error:", error);
          const timestamp = new Date().toLocaleTimeString('en-NZ');
          setMigrationLogs((prev) => [
            ...prev,
            `[${timestamp}] ⚠️ Error parsing progress data`,
          ]);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE error:", error);
        const timestamp = new Date().toLocaleTimeString('en-NZ');

        if (eventSource?.readyState === EventSource.CLOSED) {
          // Connection was closed
          setMigrationLogs((prev) => [
            ...prev,
            `[${timestamp}] 🔌 Connection closed`,
          ]);

          // Attempt to reconnect if still running and haven't exceeded max attempts
          if (isRunning && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setMigrationLogs((prev) => [
              ...prev,
              `[${timestamp}] 🔄 Reconnecting... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`,
            ]);

            eventSource?.close();
            eventSource = null;

            setTimeout(() => {
              if (isRunning) {
                connectEventSource();
              }
            }, reconnectDelay);
          } else {
            eventSource?.close();
            eventSource = null;
          }
        }
      };
    };

    // Start the connection
    connectEventSource();

    try {
      if (migrationMode === "single") {
        // Use existing single user endpoint
        const response = await fetch(
          "/api/admin/migration/scrape-user-history",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userEmail: singleUserEmail.trim(),
              novaConfig,
              sessionId,
              options: {
                dryRun: options.dryRun,
                includeShifts: options.includeHistoricalData,
                includeSignups: options.includeHistoricalData,
              },
            }),
          }
        );

        const singleUserData = await response.json();

        console.log("Single user migration response:", singleUserData);

        // Log the API response
        const timestamp = new Date().toLocaleTimeString('en-NZ');
        setMigrationLogs((prev) => [
          ...prev,
          `[${timestamp}] 📡 API Response: ${
            singleUserData.success ? "✅ Success" : "❌ Failed"
          }`,
          `[${timestamp}] 👤 User found: ${
            singleUserData.userFound ? "Yes" : "No"
          }`,
          ...(singleUserData.userFound
            ? [
                `[${timestamp}] 🆕 User created: ${
                  singleUserData.userCreated ? "Yes" : "No"
                }`,
                `[${timestamp}] 📊 Shifts imported: ${
                  singleUserData.shiftsImported || 0
                }`,
                `[${timestamp}] 📋 Signups imported: ${
                  singleUserData.signupsImported || 0
                }`,
              ]
            : []),
          ...(singleUserData.errors && singleUserData.errors.length > 0
            ? singleUserData.errors.map(
                (error: string) => `[${timestamp}] ❌ Error: ${error}`
              )
            : []),
        ]);

        // Transform single user response to match bulk migration format
        // In dry run mode, if user is found, we consider it "would be created" unless they already exist
        const wouldBeCreated = options.dryRun
          ? singleUserData.userFound && !singleUserData.userAlreadyExists
          : singleUserData.userCreated;

        const transformedData: BulkMigrationResult = {
          success: singleUserData.success,
          totalUsers: singleUserData.userFound ? 1 : 0,
          usersProcessed: 1,
          usersCreated: wouldBeCreated ? 1 : 0,
          usersSkipped: singleUserData.userFound && !wouldBeCreated ? 1 : 0,
          usersWithHistory: singleUserData.shiftsImported > 0 ? 1 : 0,
          totalShifts: singleUserData.shiftsImported || 0,
          totalSignups: singleUserData.signupsImported || 0,
          errors: singleUserData.errors || [],
          duration: 0, // Single user is fast
          dryRun: options.dryRun,
        };

        setResult(transformedData);

        if (singleUserData.success) {
          if (singleUserData.userFound) {
            toast({
              title: options.dryRun ? "Dry Run Completed" : "User Migrated",
              description: singleUserData.userCreated
                ? `User ${singleUserEmail} ${
                    options.dryRun ? "would be" : "was"
                  } migrated successfully`
                : `User ${singleUserEmail} already exists`,
            });
          } else {
            toast({
              title: "User Not Found",
              description: `User with email ${singleUserEmail} was not found in Nova. Check the email address and try again.`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Migration Failed",
            description: `Migration failed: ${
              singleUserData.errors?.[0] ||
              singleUserData.error ||
              "Unknown error"
            }`,
            variant: "destructive",
          });
        }
      } else {
        // Bulk migration
        const response = await fetch(
          "/api/admin/migration/bulk-nova-migration",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              novaConfig,
              options,
              sessionId,
            }),
          }
        );

        const data: BulkMigrationResult = await response.json();
        setResult(data);

        // Log the bulk migration results
        const timestamp = new Date().toLocaleTimeString('en-NZ');
        setMigrationLogs((prev) => [
          ...prev,
          `[${timestamp}] 🎯 Bulk Migration Results:`,
          `[${timestamp}] ✅ Success: ${data.success}`,
          `[${timestamp}] 👥 Total Users: ${data.totalUsers}`,
          `[${timestamp}] ✨ Users Created: ${data.usersCreated}`,
          `[${timestamp}] ⏭️ Users Skipped: ${data.usersSkipped}`,
          `[${timestamp}] 📊 Users with History: ${data.usersWithHistory}`,
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
            title: options.dryRun ? "Dry Run Completed" : "Migration Completed",
            description: `${data.usersCreated} users ${
              options.dryRun ? "would be" : "were"
            } migrated${
              data.usersWithHistory > 0
                ? ` with ${data.totalShifts} shifts and ${data.totalSignups} signups`
                : ""
            }`,
          });
        } else {
          toast({
            title: "Migration Failed",
            description: `Migration failed with ${data.errors.length} errors`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      const timestamp = new Date().toLocaleTimeString('en-NZ');
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setMigrationLogs((prev) => [
        ...prev,
        `[${timestamp}] 💥 Migration Error: ${errorMessage}`,
        `[${timestamp}] 🔍 Check network connection and try again`,
      ]);

      toast({
        title: "Migration Error",
        description: "Network error during migration",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
      eventSource?.close();
      eventSource = null;
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="step1" className="gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
            1
          </span>
          Create User Profiles
        </TabsTrigger>
        <TabsTrigger value="step2" className="gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
            2
          </span>
          Import Historical Data
        </TabsTrigger>
      </TabsList>

      <TabsContent value="step1" className="space-y-6">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Step 1:</strong> First, create user profiles from Nova. This
            step is fast and creates user accounts without their historical shift
            data. You can then selectively import historical data in Step 2.
          </AlertDescription>
        </Alert>

        {/* Nova Configuration */}
        <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Nova Connection Settings</CardTitle>
          </div>
          <CardDescription>
            Configure connection to your Laravel Nova admin panel to import all
            volunteer data directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Nova Base URL</Label>
              <Input
                id="baseUrl"
                value={novaConfig.baseUrl}
                onChange={(e) =>
                  setNovaConfig((prev) => ({
                    ...prev,
                    baseUrl: e.target.value,
                  }))
                }
                placeholder="https://app.everybodyeats.nz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                value={novaConfig.email}
                onChange={(e) =>
                  setNovaConfig((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="admin@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Admin Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={novaConfig.password}
                onChange={(e) =>
                  setNovaConfig((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder="Enter Nova admin password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={testConnection} variant="outline" size="sm">
              <Database className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
            {connectionTested && (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Connected
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Migration Mode Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Migration Mode</CardTitle>
          </div>
          <CardDescription>
            Choose whether to migrate all users or just a single user.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-6">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="bulk"
                name="migrationMode"
                value="bulk"
                checked={migrationMode === "bulk"}
                onChange={(e) =>
                  setMigrationMode(e.target.value as "bulk" | "single")
                }
                className="w-4 h-4"
              />
              <Label htmlFor="bulk">Bulk Migration (All Users)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="single"
                name="migrationMode"
                value="single"
                checked={migrationMode === "single"}
                onChange={(e) =>
                  setMigrationMode(e.target.value as "bulk" | "single")
                }
                className="w-4 h-4"
              />
              <Label htmlFor="single">Single User Migration</Label>
            </div>
          </div>

          {migrationMode === "single" && (
            <div className="space-y-2">
              <Label htmlFor="singleUserEmail">User Email</Label>
              <Input
                id="singleUserEmail"
                type="email"
                value={singleUserEmail}
                onChange={(e) => setSingleUserEmail(e.target.value)}
                placeholder="Enter email address to migrate"
                className="max-w-md"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Migration Options */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Migration Options</CardTitle>
          </div>
          <CardDescription>
            Configure how the migration should be performed. For best
            performance, keep &quot;Include historical shifts&quot; unchecked and import
            historical data selectively in Step 2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dryRun"
                  checked={options.dryRun}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, dryRun: !!checked }))
                  }
                />
                <Label htmlFor="dryRun">Dry Run (preview only)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skipExisting"
                  checked={options.skipExistingUsers}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({
                      ...prev,
                      skipExistingUsers: !!checked,
                    }))
                  }
                />
                <Label htmlFor="skipExisting">Skip existing users</Label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeHistory"
                    checked={options.includeHistoricalData}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({
                        ...prev,
                        includeHistoricalData: !!checked,
                      }))
                    }
                  />
                  <Label htmlFor="includeHistory">
                    Include historical shifts
                  </Label>
                </div>
                {options.includeHistoricalData && (
                  <Alert variant="destructive" className="text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Warning: Including historical data for all users may cause
                      timeouts with large datasets. Consider using Step 2 for
                      selective import instead.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="batchSize">Batch Size</Label>
                <Input
                  id="batchSize"
                  type="number"
                  min="1"
                  max="100"
                  value={options.batchSize}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      batchSize: parseInt(e.target.value) || 50,
                    }))
                  }
                  className="w-24"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Migration Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Run Migration</CardTitle>
              <CardDescription>
                {migrationMode === "bulk"
                  ? "Import all volunteer data from Nova directly into the new system."
                  : "Import a single user's data from Nova including their historical shifts."}
              </CardDescription>
            </div>
            <Button
              onClick={runMigration}
              disabled={!connectionTested || isRunning}
              size="lg"
              className="gap-2"
            >
              {isRunning ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {migrationMode === "bulk"
                    ? options.dryRun
                      ? "Preview Migration"
                      : "Start Migration"
                    : options.dryRun
                    ? "Preview User"
                    : "Migrate User"}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Real-time Progress */}
      {isRunning && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 animate-spin" />
              <CardTitle>Migration Progress</CardTitle>
            </div>
            <CardDescription>
              Real-time progress updates from the migration process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStep && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">{currentStep}</span>
              </div>
            )}

            {progressData?.stage === "processing" &&
              progressData?.totalUsers && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Users Processed</span>
                    <span>
                      {progressData.usersProcessed || 0} /{" "}
                      {progressData.totalUsers}
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

                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="text-sm font-medium text-green-800">
                        Created
                      </div>
                      <div className="text-lg font-bold text-green-900">
                        {progressData.usersCreated || 0}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-amber-50 rounded">
                      <div className="text-sm font-medium text-amber-800">
                        Skipped
                      </div>
                      <div className="text-lg font-bold text-amber-900">
                        {progressData.usersSkipped || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* Migration Logs - Always show when running or when logs exist */}
            {(isRunning || migrationLogs.length > 0) && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">Migration Logs</h4>
                  {migrationLogs.length > 0 && (
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
                  )}
                </div>
                <div
                  ref={logsContainerRef}
                  className="bg-black text-green-400 p-3 rounded-lg font-mono text-xs h-64 overflow-y-auto"
                >
                  {migrationLogs.length === 0 && isRunning ? (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                      <span className="text-gray-400">
                        Waiting for migration to start...
                      </span>
                    </div>
                  ) : (
                    <>
                      {migrationLogs.map((log, index) => (
                        <div key={index} className="mb-1 whitespace-pre-wrap">
                          {log}
                        </div>
                      ))}
                      {isRunning && (
                        <div className="flex items-center mt-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                          <span className="text-gray-400">
                            Waiting for next update...
                          </span>
                        </div>
                      )}
                    </>
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
              <CardTitle>
                {result.dryRun ? "Migration Preview" : "Migration Results"}
              </CardTitle>
            </div>
            <CardDescription>
              Completed in {(result.duration / 1000).toFixed(1)} seconds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Users</span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{result.totalUsers}</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {result.dryRun ? "Would Create" : "Created"}
                  </span>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-2xl font-bold">{result.usersCreated}</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Skipped</span>
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold">{result.usersSkipped}</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">With History</span>
                  <Database className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold">
                  {result.usersWithHistory}
                </div>
              </div>
            </div>

            {/* Historical Data Stats */}
            {result.totalShifts > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm font-medium">Shifts Imported</div>
                  <div className="text-2xl font-bold">{result.totalShifts}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm font-medium">Signups Imported</div>
                  <div className="text-2xl font-bold">
                    {result.totalSignups}
                  </div>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>
                  {result.usersProcessed} / {result.totalUsers}
                </span>
              </div>
              <Progress
                value={(result.usersProcessed / result.totalUsers) * 100}
              />
            </div>

            {/* Errors */}
            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium">
                    {result.errors.length} error(s) occurred during migration:
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
                  {result.dryRun
                    ? `Migration preview completed successfully! ${result.usersCreated} users would be migrated.`
                    : `Migration completed successfully! ${result.usersCreated} users have been migrated.`}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Next Step Prompt */}
      {result && result.success && result.usersCreated > 0 && (
        <Alert>
          <ChevronRight className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>Ready for Step 2?</strong> {result.usersCreated} user
              profile(s) created. You can now import their historical data.
            </span>
            <Button
              onClick={() => setActiveTab("step2")}
              size="sm"
              className="gap-2"
            >
              Go to Step 2
              <ChevronRight className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </TabsContent>

    <TabsContent value="step2" className="space-y-6">
      <Alert>
        <Database className="h-4 w-4" />
        <AlertDescription>
          <strong>Step 2:</strong> Select which users to import historical
          shift and signup data for. This allows you to control which users get
          their complete history migrated, avoiding timeouts with large datasets.
        </AlertDescription>
      </Alert>

      {!connectionTested && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please test your Nova connection in Step 1 first before importing
            historical data.
          </AlertDescription>
        </Alert>
      )}

      {connectionTested && (
        <HistoricalDataSelector novaConfig={novaConfig} />
      )}
    </TabsContent>
  </Tabs>
  );
}
