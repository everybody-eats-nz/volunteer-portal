"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Search,
  Mail,
  UserCheck,
  Clock,
  Filter,
  Download,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

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
}

export function MigratedUsers() {
  const [users, setUsers] = useState<MigratedUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<MigratedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "invited" | "completed">("all");
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/migration/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setFilteredUsers(data.users);
      } else {
        throw new Error("Failed to fetch users");
      }
    } catch (error) {
      console.error("Failed to fetch migrated users:", error);
      toast({
        title: "Error",
        description: "Failed to load migrated users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove toast from dependencies

  useEffect(() => {
    fetchUsers();
  }, []); // Remove fetchUsers from dependencies, only run once on mount

  useEffect(() => {
    let filtered = users;

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(user => {
        if (filterStatus === "pending") {
          return !user.invitationSent && !user.registrationCompleted;
        } else if (filterStatus === "invited") {
          return user.invitationSent && !user.registrationCompleted;
        } else if (filterStatus === "completed") {
          return user.registrationCompleted;
        }
        return true;
      });
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, filterStatus]);

  const resendInvitation = async (userId: string) => {
    try {
      const response = await fetch("/api/admin/migration/resend-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Invitation resent successfully",
        });
        fetchUsers(); // Refresh the list
      } else {
        throw new Error("Failed to resend invitation");
      }
    } catch (error) {
      console.error("Failed to resend invitation:", error);
      toast({
        title: "Error",
        description: "Failed to resend invitation",
        variant: "destructive",
      });
    }
  };

  const exportUsers = () => {
    const csv = [
      ["Email", "First Name", "Last Name", "Status", "Invitation Sent", "Registration Completed"],
      ...filteredUsers.map(user => [
        user.email,
        user.firstName || "",
        user.lastName || "",
        user.registrationCompleted ? "Completed" : user.invitationSent ? "Invited" : "Pending",
        user.invitationSentAt || "",
        user.registrationCompleted ? "Yes" : "No"
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migrated-users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getUserStatus = (user: MigratedUser) => {
    if (user.registrationCompleted) {
      return { label: "Completed", variant: "default" as const, icon: UserCheck };
    } else if (user.invitationSent) {
      return { label: "Invited", variant: "secondary" as const, icon: Mail };
    } else {
      return { label: "Pending", variant: "outline" as const, icon: Clock };
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Migrated Users</CardTitle>
          <CardDescription>Loading migrated users...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Migrated Users</CardTitle>
              <CardDescription>
                {users.length} users have been migrated from the legacy system
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={exportUsers}
                variant="outline"
                size="sm"
                disabled={filteredUsers.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={fetchUsers}
                disabled={isLoading}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "all" | "pending" | "invited" | "completed")}
                className="border rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Users</option>
                <option value="pending">Pending</option>
                <option value="invited">Invited</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pending</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {users.filter(u => !u.invitationSent && !u.registrationCompleted).length}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Invited</span>
                <Mail className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold">
                {users.filter(u => u.invitationSent && !u.registrationCompleted).length}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Completed</span>
                <UserCheck className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold">
                {users.filter(u => u.registrationCompleted).length}
              </div>
            </div>
          </div>

          {/* Users Table */}
          {filteredUsers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invitation Details</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const status = getUserStatus(user);
                    const StatusIcon = status.icon;
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="font-medium">
                            {user.firstName || user.lastName ? (
                              `${user.firstName || ""} ${user.lastName || ""}`.trim()
                            ) : (
                              <span className="text-muted-foreground">No name</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{user.email}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.invitationSent ? (
                            <div className="text-sm">
                              <div>Sent: {new Date(user.invitationSentAt!).toLocaleDateString()}</div>
                              {user.invitationCount > 1 && (
                                <div className="text-muted-foreground">
                                  Resent {user.invitationCount - 1} time(s)
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not sent</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                            >
                              <Link href={`/admin/users/${user.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {!user.registrationCompleted && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resendInvitation(user.id)}
                                disabled={isLoading}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                {user.invitationSent ? "Resend" : "Send"} Invite
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm || filterStatus !== "all"
                  ? "No users found matching your filters"
                  : "No migrated users found. Start by uploading a CSV file in the Upload CSV tab."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}