"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Database,
  Search,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface NovaConfig {
  baseUrl: string;
  email: string;
  password: string;
}

interface ScrapeResult {
  userEmail: string;
  success: boolean;
  userFound: boolean;
  userCreated?: boolean;
  shiftsFound: number;
  shiftsImported: number;
  signupsFound: number;
  signupsImported: number;
  errors: string[];
  timestamp: string;
}

interface MigratedUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  invitationSent: boolean;
  registrationCompleted: boolean;
}

export function NovaHistoricalData() {
  const [novaConfig, setNovaConfig] = useState<NovaConfig>({
    baseUrl: "https://app.everybodyeats.nz",
    email: "",
    password: "",
  });

  const [searchEmail, setSearchEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [migratedUsers, setMigratedUsers] = useState<MigratedUser[]>([]);
  const [scrapeResults, setScrapeResults] = useState<ScrapeResult[]>([]);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ScrapeResult | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  // Load migrated users on component mount
  useEffect(() => {
    loadMigratedUsers();
  }, []);

  const loadMigratedUsers = async () => {
    try {
      const response = await fetch("/api/admin/migration/users");
      if (response.ok) {
        const data = await response.json();
        setMigratedUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error loading migrated users:", error);
    }
  };

  const scrapeUserHistory = async (userEmail: string) => {
    if (!novaConfig.baseUrl || !novaConfig.email || !novaConfig.password) {
      toast.error("Please configure Nova connection settings first");
      setShowConfigDialog(true);
      return;
    }

    if (!userEmail) {
      toast.error("Please enter a user email");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/migration/scrape-user-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail,
          novaConfig,
          options: {
            dryRun: isDryRun,
            includeShifts: true,
            includeSignups: true,
          },
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const scrapeResult: ScrapeResult = {
          userEmail,
          success: result.success,
          userFound: result.userFound,
          userCreated: result.userCreated,
          shiftsFound: result.shiftsFound,
          shiftsImported: result.shiftsImported,
          signupsFound: result.signupsFound,
          signupsImported: result.signupsImported,
          errors: result.errors || [],
          timestamp: new Date().toISOString(),
        };

        setScrapeResults((prev) => [scrapeResult, ...prev]);
        setSelectedResult(scrapeResult);
        setShowResultDialog(true);

        if (!result.userFound) {
          toast.warning(`User ${userEmail} not found in Nova system`);
        } else if (result.success) {
          if (isDryRun) {
            toast.success(
              `Dry run completed for ${userEmail}. Found ${result.shiftsFound} shifts and ${result.signupsFound} signups.`
            );
          } else {
            toast.success(
              `Historical data imported for ${userEmail}. Created ${result.shiftsImported} shifts and ${result.signupsImported} signups.`
            );
            // Reload migrated users if we created a new user
            if (result.userCreated) {
              loadMigratedUsers();
            }
          }
        } else {
          toast.error(
            `Failed to scrape data for ${userEmail}: ${result.errors.join(
              ", "
            )}`
          );
        }
      } else {
        toast.error(`Error: ${result.error || "Unknown error occurred"}`);
      }
    } catch (error) {
      console.error("Scraping error:", error);
      toast.error("Failed to scrape user history");
    } finally {
      setIsLoading(false);
    }
  };

  const testNovaConnection = async () => {
    if (!novaConfig.baseUrl || !novaConfig.email || !novaConfig.password) {
      toast.error("Please fill in all Nova configuration fields");
      return;
    }

    setIsLoading(true);

    try {
      // Test with a dry run for a dummy email
      const response = await fetch("/api/admin/migration/scrape-user-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: "test@test.com", // Dummy email for connection test
          novaConfig,
          options: {
            dryRun: true,
            includeShifts: false,
            includeSignups: false,
          },
        }),
      });

      if (response.ok) {
        toast.success("Nova connection successful!");
        setShowConfigDialog(false);
      } else {
        const result = await response.json();
        toast.error(`Connection failed: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Connection test error:", error);
      toast.error("Failed to test Nova connection");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusBadge = (result: ScrapeResult) => {
    if (!result.userFound) {
      return <Badge variant="secondary">Not Found</Badge>;
    }
    if (result.success) {
      return <Badge variant="default">Success</Badge>;
    }
    return <Badge variant="destructive">Failed</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Nova Historical Data Scraper
          </CardTitle>
          <CardDescription>
            Scrape historical shift data from the Laravel Nova backend for
            individual users during migration. This will preserve their shift
            history and signup records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dry-run"
                checked={isDryRun}
                onCheckedChange={(checked) => setIsDryRun(!!checked)}
              />
              <Label htmlFor="dry-run">
                Dry Run (test only, no data changes)
              </Label>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowConfigDialog(true)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Configure Nova Connection
            </Button>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isDryRun
                ? "Dry run mode is enabled. This will test the scraping process without making any database changes."
                : "Live mode is enabled. This will import historical data into the database."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* User Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>Scrape User History</CardTitle>
          <CardDescription>
            Enter a user email to scrape their historical shift data from Nova.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="user-email">User Email</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="user@example.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    scrapeUserHistory(searchEmail);
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => scrapeUserHistory(searchEmail)}
                disabled={isLoading || !searchEmail}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <Clock className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isDryRun ? "Test Scrape" : "Scrape History"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions for Migrated Users */}
      {migratedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions - Migrated Users</CardTitle>
            <CardDescription>
              Scrape historical data for users who have already been migrated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-2">
                {migratedUsers
                  .slice(
                    (currentPage - 1) * usersPerPage,
                    currentPage * usersPerPage
                  )
                  .map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="text-sm">
                          {user.firstName} {user.lastName} ({user.email})
                        </span>
                        {user.registrationCompleted && (
                          <Badge variant="default" className="text-xs">
                            Registered
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => scrapeUserHistory(user.email)}
                        disabled={isLoading}
                      >
                        {isDryRun ? "Test" : "Scrape"}
                      </Button>
                    </div>
                  ))}
              </div>

              {/* Pagination Controls */}
              {migratedUsers.length > usersPerPage && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * usersPerPage + 1} to{" "}
                    {Math.min(currentPage * usersPerPage, migratedUsers.length)}{" "}
                    of {migratedUsers.length} users
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Select
                      value={currentPage.toString()}
                      onValueChange={(value) => setCurrentPage(Number(value))}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Page" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: Math.ceil(migratedUsers.length / usersPerPage) },
                          (_, i) => i + 1
                        ).map((page) => (
                          <SelectItem key={page} value={page.toString()}>
                            Page {page}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(
                            Math.ceil(migratedUsers.length / usersPerPage),
                            prev + 1
                          )
                        )
                      }
                      disabled={
                        currentPage >=
                        Math.ceil(migratedUsers.length / usersPerPage)
                      }
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results History */}
      {scrapeResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scraping Results</CardTitle>
            <CardDescription>
              History of historical data scraping operations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scrapeResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSelectedResult(result);
                    setShowResultDialog(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(result)}
                      <span className="font-medium">{result.userEmail}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {result.userFound ? (
                        <>
                          {result.shiftsFound} shifts, {result.signupsFound}{" "}
                          signups
                          {!isDryRun && result.success && (
                            <>
                              {" "}
                              → {result.shiftsImported} imported,{" "}
                              {result.signupsImported} signups
                            </>
                          )}
                        </>
                      ) : (
                        "User not found in Nova"
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatTimestamp(result.timestamp)}
                    <Eye className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nova Configuration Dialog */}
      <ResponsiveDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              Configure Nova Connection
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Enter the connection details for your Laravel Nova backend.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nova-url">Nova Base URL</Label>
              <Input
                id="nova-url"
                placeholder="https://app.everybodyeats.nz"
                value={novaConfig.baseUrl}
                onChange={(e) =>
                  setNovaConfig((prev) => ({
                    ...prev,
                    baseUrl: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="nova-email">Admin Email</Label>
              <Input
                id="nova-email"
                type="email"
                placeholder="admin@example.com"
                value={novaConfig.email}
                onChange={(e) =>
                  setNovaConfig((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="nova-password">Admin Password</Label>
              <Input
                id="nova-password"
                type="password"
                placeholder="Password"
                value={novaConfig.password}
                onChange={(e) =>
                  setNovaConfig((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={testNovaConnection}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <Clock className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Test Connection
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowConfigDialog(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Result Details Dialog */}
      <ResponsiveDialog
        open={showResultDialog}
        onOpenChange={setShowResultDialog}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              Scraping Result - {selectedResult?.userEmail}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Details of the historical data scraping operation.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {selectedResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Status</div>
                  <div>{getStatusBadge(selectedResult)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Timestamp</div>
                  <div className="text-sm">
                    {formatTimestamp(selectedResult.timestamp)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">User Found</div>
                  <div className="text-sm">
                    {selectedResult.userFound ? "Yes" : "No"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">User Created</div>
                  <div className="text-sm">
                    {selectedResult.userCreated ? "Yes" : "No"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Shifts Found</div>
                  <div className="text-sm">{selectedResult.shiftsFound}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Shifts Imported</div>
                  <div className="text-sm">{selectedResult.shiftsImported}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Signups Found</div>
                  <div className="text-sm">{selectedResult.signupsFound}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Signups Imported</div>
                  <div className="text-sm">
                    {selectedResult.signupsImported}
                  </div>
                </div>
              </div>

              {selectedResult.errors.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-destructive mb-2">
                    Errors
                  </div>
                  <div className="text-sm space-y-1">
                    {selectedResult.errors.map((error, index) => (
                      <div key={index} className="text-destructive">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => setShowResultDialog(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
