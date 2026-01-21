"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Loader2, UserPlus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { EmailPreviewDialog } from "@/components/email-preview-dialog";

interface User {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  role: string;
}

interface Survey {
  id: string;
  title: string;
}

interface AssignSurveyDialogProps {
  survey: Survey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: () => void;
}

export function AssignSurveyDialog({
  survey,
  open,
  onOpenChange,
  onAssigned,
}: AssignSurveyDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [existingAssignments, setExistingAssignments] = useState<Set<string>>(new Set());
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const { toast } = useToast();

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Fetch users based on search query
  const fetchUsers = useCallback(async (query: string) => {
    setIsLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("limit", "50");

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error("Failed to fetch users");

      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]);

  // Fetch existing assignments for this survey
  const fetchExistingAssignments = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/surveys/${survey.id}/responses?includeAll=true`);
      if (!response.ok) return;

      const data = await response.json();
      const assignedUserIds = new Set<string>(
        data.assignments?.map((a: { userId: string }) => a.userId) || []
      );
      setExistingAssignments(assignedUserIds);
    } catch (error) {
      console.error("Error fetching existing assignments:", error);
    }
  }, [survey.id]);

  // Load initial data when dialog opens
  useEffect(() => {
    if (open) {
      fetchUsers("");
      fetchExistingAssignments();
      setSelectedUserIds(new Set());
      setSearchQuery("");
    }
  }, [open, fetchUsers, fetchExistingAssignments]);

  // Search users when query changes
  useEffect(() => {
    if (open) {
      fetchUsers(debouncedQuery);
    }
  }, [debouncedQuery, open, fetchUsers]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleAssign = async () => {
    if (selectedUserIds.size === 0) {
      toast({
        title: "No users selected",
        description: "Please select at least one user to assign the survey to",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);
    try {
      const response = await fetch(`/api/admin/surveys/${survey.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedUserIds) }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign survey");
      }

      const result = await response.json();

      toast({
        title: "Survey Assigned",
        description: result.message,
      });

      onOpenChange(false);
      onAssigned?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign survey",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.name) {
      return user.name.slice(0, 2).toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const getDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.name || user.email;
  };

  const availableUsers = users.filter((u) => !existingAssignments.has(u.id));
  const alreadyAssignedUsers = users.filter((u) => existingAssignments.has(u.id));

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign Survey
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Select volunteers to assign &quot;{survey.title}&quot; to. They&apos;ll receive
            an email notification and see the survey on their dashboard.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex flex-col min-h-0 flex-1 space-y-4">
          {/* Search input */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="assign-survey-search"
            />
          </div>

          {/* Selected count */}
          {selectedUserIds.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <Users className="h-4 w-4" />
              {selectedUserIds.size} user{selectedUserIds.size !== 1 ? "s" : ""} selected
            </div>
          )}

          {/* User list */}
          <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
            {isLoadingUsers ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Users className="h-8 w-8 mb-2" />
                <p>No users found</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {/* Available users */}
                {availableUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    data-testid={`assign-user-${user.id}`}
                  >
                    <Checkbox
                      checked={selectedUserIds.has(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.profilePhotoUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getDisplayName(user)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    {user.role === "ADMIN" && (
                      <Badge variant="secondary" className="text-xs">
                        Admin
                      </Badge>
                    )}
                  </label>
                ))}

                {/* Already assigned users */}
                {alreadyAssignedUsers.length > 0 && (
                  <>
                    <div className="py-2 px-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Already Assigned
                      </p>
                    </div>
                    {alreadyAssignedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 p-2 rounded-lg opacity-50"
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.profilePhotoUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {getDisplayName(user)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Assigned
                        </Badge>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2 shrink-0">
            <EmailPreviewDialog
              emailType="surveyNotification"
              triggerLabel="Preview Email"
              triggerVariant="outline"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isAssigning}
              >
                Cancel
              </Button>
            <Button
              onClick={handleAssign}
              disabled={isAssigning || selectedUserIds.size === 0}
              data-testid="assign-survey-submit"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign to {selectedUserIds.size || ""} User{selectedUserIds.size !== 1 ? "s" : ""}
                </>
              )}
            </Button>
            </div>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
