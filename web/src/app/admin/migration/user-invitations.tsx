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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Mail,
  Send,
  Users,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface MigratedUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  invitationSent: boolean;
  invitationSentAt?: string;
  invitationCount: number;
  lastSentAt?: string;
  tokenExpiresAt?: string;
  registrationCompleted: boolean;
  registrationCompletedAt?: string;
  invitationToken?: string;
}


interface InvitationResult {
  email: string;
  firstName: string;
  lastName: string;
  registrationUrl: string;
  success: boolean;
}

const isTokenExpired = (expiresAt?: string): boolean => {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
};

export function UserInvitations() {
  const [users, setUsers] = useState<MigratedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "invited" | "expired" | "completed"
  >("all");
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);
  const [invitationResults, setInvitationResults] = useState<
    InvitationResult[]
  >([]);


  const fetchMigratedUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/migration/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch migrated users:", error);
      toast.error("Failed to load migrated users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMigratedUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchTerm === "" ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const tokenExpired = isTokenExpired(user.tokenExpiresAt);
    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "pending" && !user.invitationSent) ||
      (filterStatus === "invited" &&
        user.invitationSent &&
        !user.registrationCompleted &&
        !tokenExpired) ||
      (filterStatus === "expired" &&
        user.invitationSent &&
        !user.registrationCompleted &&
        tokenExpired) ||
      (filterStatus === "completed" && user.registrationCompleted);

    return matchesSearch && matchesFilter;
  });

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const toggleAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((user) => user.id)));
    }
  };

  const sendInvitations = async () => {
    if (selectedUsers.size === 0) {
      toast.error("Please select users to send invitations to");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/admin/migration/send-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Successfully sent ${result.sent} invitations!`);

        // Show dialog with registration URLs if available
        if (result.invitations && result.invitations.length > 0) {
          setInvitationResults(result.invitations);
          setShowInvitationDialog(true);
        }

        setSelectedUsers(new Set());
        await fetchMigratedUsers(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to send invitations");
      }
    } catch (error) {
      console.error("Failed to send invitations:", error);
      toast.error("Failed to send invitations");
    } finally {
      setIsSending(false);
    }
  };

  const resendInvitation = async (userId: string) => {
    try {
      const response = await fetch("/api/admin/migration/resend-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        toast.success("Invitation resent successfully!");
        await fetchMigratedUsers();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to resend invitation");
      }
    } catch (error) {
      console.error("Failed to resend invitation:", error);
      toast.error("Failed to resend invitation");
    }
  };

  const pendingUsers = users.filter((u) => !u.invitationSent);
  const invitedUsers = users.filter(
    (u) =>
      u.invitationSent &&
      !u.registrationCompleted &&
      !isTokenExpired(u.tokenExpiresAt)
  );
  const expiredUsers = users.filter(
    (u) =>
      u.invitationSent &&
      !u.registrationCompleted &&
      isTokenExpired(u.tokenExpiresAt)
  );
  const completedUsers = users.filter((u) => u.registrationCompleted);

  const formatDateTime = (dateString?: string): string => {
    if (!dateString) return "Never";
    return (
      new Date(dateString).toLocaleDateString() +
      " at " +
      new Date(dateString).toLocaleTimeString()
    );
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("URL copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy URL");
    }
  };

  const copyAllUrls = async () => {
    const urls = invitationResults
      .map(
        (result) =>
          `${result.firstName} ${result.lastName} (${result.email}): ${result.registrationUrl}`
      )
      .join("\n");

    try {
      await navigator.clipboard.writeText(urls);
      toast.success("All URLs copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy URLs");
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card data-testid="total-migrated-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Total Migrated</span>
            </div>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card data-testid="pending-invitations-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <div className="text-2xl font-bold">{pendingUsers.length}</div>
          </CardContent>
        </Card>

        <Card data-testid="invited-users-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Invited</span>
            </div>
            <div className="text-2xl font-bold">{invitedUsers.length}</div>
          </CardContent>
        </Card>

        <Card data-testid="expired-invitations-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Expired</span>
            </div>
            <div className="text-2xl font-bold">{expiredUsers.length}</div>
          </CardContent>
        </Card>

        <Card data-testid="completed-registrations-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Completed</span>
            </div>
            <div className="text-2xl font-bold">{completedUsers.length}</div>
          </CardContent>
        </Card>
      </div>


      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Migrated Users</CardTitle>
              <CardDescription>
                Send invitation emails to migrated users to complete their
                registration
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={sendInvitations}
                disabled={selectedUsers.size === 0 || isSending}
                className="flex items-center gap-2"
                data-testid="send-invitations-button"
              >
                <Send className="h-4 w-4" />
                {isSending
                  ? "Sending..."
                  : `Send Invitations`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-users-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "all" | "pending" | "invited" | "completed")}
                className="border rounded-md px-3 py-2 text-sm"
                data-testid="filter-status-select"
              >
                <option value="all">All Users</option>
                <option value="pending">Pending Invitations</option>
                <option value="invited">Invited</option>
                <option value="expired">Expired</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* User List */}
          {isLoading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : filteredUsers.length > 0 ? (
            <div className="space-y-2">
              {/* Select All */}
              <div className="flex items-center space-x-2 py-2 border-b">
                <Checkbox
                  checked={
                    selectedUsers.size === filteredUsers.length &&
                    filteredUsers.length > 0
                  }
                  onCheckedChange={toggleAllUsers}
                />
                <span className="text-sm font-medium">
                  Select All ({filteredUsers.length} users)
                </span>
              </div>

              {/* User Rows */}
              {filteredUsers.map((user) => {
                const tokenExpired = isTokenExpired(user.tokenExpiresAt);

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedUsers.has(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>

                        {/* Invitation Statistics */}
                        {user.invitationSent && (
                          <div className="text-xs text-muted-foreground mt-1 space-y-1">
                            <div>
                              Invitations sent: {user.invitationCount}
                              {user.invitationCount > 1 && (
                                <span className="ml-1">
                                  (last: {formatDateTime(user.lastSentAt)})
                                </span>
                              )}
                            </div>
                            {user.tokenExpiresAt && (
                              <div
                                className={
                                  tokenExpired
                                    ? "text-red-600"
                                    : "text-amber-600"
                                }
                              >
                                Link {tokenExpired ? "expired" : "expires"}:{" "}
                                {formatDateTime(user.tokenExpiresAt)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {user.registrationCompleted ? (
                        <Badge
                          variant="default"
                          className="bg-green-100 text-green-800"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      ) : user.invitationSent ? (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant="secondary"
                              className={
                                tokenExpired ? "bg-red-100 text-red-800" : ""
                              }
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              {tokenExpired ? "Expired" : "Invited"}
                            </Badge>
                            {user.invitationCount > 1 && (
                              <Badge variant="outline" className="text-xs">
                                {user.invitationCount}x sent
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resendInvitation(user.id)}
                            className={
                              tokenExpired
                                ? "border-red-300 text-red-700 hover:bg-red-50"
                                : ""
                            }
                          >
                            {tokenExpired ? "Send New" : "Resend"}
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || filterStatus !== "all"
                ? "No users match your search criteria"
                : "No migrated users found. Upload and migrate users from the Upload CSV tab."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration URLs Dialog */}
      <ResponsiveDialog
        open={showInvitationDialog}
        onOpenChange={setShowInvitationDialog}
      >
        <ResponsiveDialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="registration-urls-dialog">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Registration URLs Generated
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Here are the registration URLs for the invited users. You can copy
              individual URLs or all URLs at once.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {invitationResults.length} invitation
                {invitationResults.length !== 1 ? "s" : ""} sent
              </p>
              <Button
                onClick={copyAllUrls}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                data-testid="copy-all-urls-button"
              >
                <Copy className="h-4 w-4" />
                Copy All URLs
              </Button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4">
              {invitationResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    result.success
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {result.firstName} {result.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {result.email}
                      </div>
                      {result.success ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-green-700">
                              Registration URL:
                            </span>
                            <Badge
                              variant="outline"
                              className="bg-green-100 text-green-800 border-green-300"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Sent
                            </Badge>
                          </div>
                          <div className="bg-white border rounded p-2 text-sm font-mono break-all">
                            {result.registrationUrl}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                          <span className="text-sm text-red-600">
                            Failed to generate URL
                          </span>
                        </div>
                      )}
                    </div>

                    {result.success && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() =>
                            copyToClipboard(result.registrationUrl)
                          }
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </Button>
                        <Button
                          onClick={() =>
                            window.open(result.registrationUrl, "_blank")
                          }
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> These registration URLs are secure
                and unique for each user. They expire in 7 days. You can share
                these URLs directly with users if needed, or use them for
                testing the registration flow.
              </AlertDescription>
            </Alert>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
