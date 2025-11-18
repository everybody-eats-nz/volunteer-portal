"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  CheckCircle,
  Clock,
  Phone,
  Mail,
  User,
  AlertCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calculateAge } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  parentalConsentReceived: boolean;
  parentalConsentReceivedAt: string | null;
  parentalConsentApprovedBy: string | null;
  profileCompleted: boolean;
  createdAt: string;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export function ParentalConsentTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [approveDialog, setApproveDialog] = useState<{
    isOpen: boolean;
    user: User | null;
  }>({
    isOpen: false,
    user: null,
  });
  const [approvalNotes, setApprovalNotes] = useState("");
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/parental-consent");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        throw new Error("Failed to fetch users");
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load users requiring parental consent",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleApprove = (user: User) => {
    setApproveDialog({ isOpen: true, user });
    setApprovalNotes("");
  };

  const confirmApproval = async () => {
    if (!approveDialog.user) return;

    setApproving(approveDialog.user.id);
    try {
      const response = await fetch(
        `/api/admin/parental-consent/${approveDialog.user.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: approvalNotes }),
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: `Parental consent approved for ${approveDialog.user.firstName} ${approveDialog.user.lastName}`,
        });
        fetchUsers(); // Refresh the list
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve consent");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve consent",
        variant: "destructive",
      });
    } finally {
      setApproving(null);
      setApproveDialog({ isOpen: false, user: null });
    }
  };

  const getAge = (dateOfBirth: string) => {
    return calculateAge(new Date(dateOfBirth));
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const pendingUsers = users.filter(u => !u.parentalConsentReceived);
  const approvedUsers = users.filter(u => u.parentalConsentReceived);

  return (
    <>
      <div className="space-y-6">
        {/* Pending Approvals */}
        {pendingUsers.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              Pending Approval ({pendingUsers.length})
            </h3>
            <div className="border rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Volunteer</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Age</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Contact</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Emergency Contact</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Registered</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map((user) => (
                      <tr key={user.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium">
                                <Link
                                  href={`/admin/volunteers/${user.id}`}
                                  className="hover:underline font-medium"
                                >
                                  {user.firstName} {user.lastName}
                                </Link>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                            {!user.profileCompleted && (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            {getAge(user.dateOfBirth)} years
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                            {user.phone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {user.emergencyContactName ? (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {user.emergencyContactName}
                              </div>
                              {user.emergencyContactPhone && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {user.emergencyContactPhone}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not provided</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(user)}
                            disabled={approving === user.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Approved Users */}
        {approvedUsers.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Approved ({approvedUsers.length})
            </h3>
            <div className="border rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Volunteer</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Age</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedUsers.map((user) => (
                      <tr key={user.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium">
                              <Link
                                href={`/admin/volunteers/${user.id}`}
                                className="hover:underline font-medium"
                              >
                                {user.firstName} {user.lastName}
                              </Link>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            {getAge(user.dateOfBirth)} years
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {user.parentalConsentReceivedAt && 
                              formatDistanceToNow(new Date(user.parentalConsentReceivedAt), { addSuffix: true })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {users.length === 0 && (
          <div className="text-center py-8">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              No volunteers under 16 found
            </h3>
            <p className="text-sm text-muted-foreground">
              All current volunteers are 16 or older
            </p>
          </div>
        )}
      </div>

      {/* Approval Dialog */}
      <Dialog 
        open={approveDialog.isOpen} 
        onOpenChange={(open) => setApproveDialog({ isOpen: open, user: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Parental Consent</DialogTitle>
            <DialogDescription>
              {approveDialog.user && (
                <>
                  Are you sure you want to approve parental consent for{" "}
                  <strong>
                    {approveDialog.user.firstName} {approveDialog.user.lastName}
                  </strong>
                  ? This will allow them full access to volunteer features.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="approval-notes">Notes (optional)</Label>
              <Textarea
                id="approval-notes"
                placeholder="Add any notes about the approval (e.g., 'Received signed consent form via email')"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setApproveDialog({ isOpen: false, user: null })}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmApproval}
              disabled={!!approving}
              className="bg-green-600 hover:bg-green-700"
            >
              {approving ? "Approving..." : "Approve Consent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

