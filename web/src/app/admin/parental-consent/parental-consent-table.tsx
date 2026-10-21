"use client";

import React, { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  CheckCircle,
  Clock,
  Phone,
  User as UserIcon,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/admin/empty-state";
import { STATUS_ICON } from "@/lib/status-styles";
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
import { EmailPreviewDialog } from "@/components/email-preview-dialog";
import type { ParentalConsentUser } from "@/lib/parental-consent";
import { volunteerProfileHref } from "@/lib/admin-navigation";

type User = ParentalConsentUser;

export function ParentalConsentTable({
  initialUsers,
}: {
  initialUsers: ParentalConsentUser[];
}) {
  const [users, setUsers] = useState<User[]>(initialUsers);
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
    }
  }, [toast]);

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
          description: `Parental consent approved for ${
            [approveDialog.user.firstName, approveDialog.user.lastName]
              .filter(Boolean)
              .join(" ") || approveDialog.user.email
          }`,
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

  const formatName = (user: User) =>
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  const formatAge = (dateOfBirth: string | null) =>
    dateOfBirth ? `${calculateAge(new Date(dateOfBirth))} years` : "Age unknown";

  const pendingUsers = users.filter(u => !u.parentalConsentReceived);
  const approvedUsers = users.filter(u => u.parentalConsentReceived);

  return (
    <>
      <div className="space-y-6">
        {/* Pending Approvals */}
        {pendingUsers.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock
                className={`h-5 w-5 ${STATUS_ICON.pending}`}
                aria-hidden="true"
              />
              Pending approval ({pendingUsers.length})
            </h3>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4">Volunteer</TableHead>
                    <TableHead className="hidden px-4 md:table-cell">
                      Phone
                    </TableHead>
                    <TableHead className="hidden px-4 lg:table-cell">
                      Emergency contact
                    </TableHead>
                    <TableHead className="hidden px-4 md:table-cell">
                      Registered
                    </TableHead>
                    <TableHead className="px-4 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="px-4 py-3 align-top whitespace-normal">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <Link
                              href={volunteerProfileHref(user.id, "/admin/parental-consent")}
                              className="font-medium hover:underline"
                            >
                              {formatName(user)}
                            </Link>
                            <span className="ml-2 text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                              {formatAge(user.dateOfBirth)}
                            </span>
                            <div className="text-sm text-muted-foreground wrap-anywhere">
                              <a
                                href={`mailto:${user.email}`}
                                className="hover:text-foreground hover:underline transition-colors"
                              >
                                {user.email}
                              </a>
                            </div>
                            {/* On a phone the contact and registered columns
                                are gone, so the phone number and sign-up date
                                fold in under the name. */}
                            <div className="mt-1 space-y-0.5 text-[13px] leading-snug text-muted-foreground md:hidden">
                              {user.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" aria-hidden="true" />
                                  <a
                                    href={`tel:${user.phone}`}
                                    className="hover:text-foreground hover:underline transition-colors"
                                  >
                                    {user.phone}
                                  </a>
                                </div>
                              )}
                              <div>
                                Registered{" "}
                                {formatDistanceToNow(new Date(user.createdAt), {
                                  addSuffix: true,
                                })}
                              </div>
                            </div>
                          </div>
                          {!user.profileCompleted && (
                            <span
                              className={`mt-0.5 shrink-0 ${STATUS_ICON.pending}`}
                              title="Profile incomplete"
                            >
                              <AlertCircle className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">Profile incomplete</span>
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden px-4 py-3 md:table-cell">
                        {user.phone ? (
                          <a
                            href={`tel:${user.phone}`}
                            className="inline-flex items-center gap-1 text-sm hover:underline"
                          >
                            <Phone className="h-3 w-3" aria-hidden="true" />
                            {user.phone}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Not provided
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden px-4 py-3 lg:table-cell">
                        {user.emergencyContactName ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {user.emergencyContactName}
                            </div>
                            {user.emergencyContactPhone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" aria-hidden="true" />
                                <a
                                  href={`tel:${user.emergencyContactPhone}`}
                                  className="hover:text-foreground hover:underline transition-colors"
                                >
                                  {user.emergencyContactPhone}
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Not provided
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden px-4 py-3 text-sm md:table-cell">
                        {formatDistanceToNow(new Date(user.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right align-top md:align-middle">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(user)}
                          disabled={approving === user.id}
                        >
                          <CheckCircle
                            className="hidden h-4 w-4 sm:block"
                            aria-hidden="true"
                          />
                          Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Approved Users */}
        {approvedUsers.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle
                className={`h-5 w-5 ${STATUS_ICON.confirmed}`}
                aria-hidden="true"
              />
              Approved ({approvedUsers.length})
            </h3>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4">Volunteer</TableHead>
                    <TableHead className="px-4">Age</TableHead>
                    <TableHead className="hidden px-4 md:table-cell">
                      Approved
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="px-4 py-3 align-top whitespace-normal">
                        <Link
                          href={volunteerProfileHref(user.id, "/admin/parental-consent")}
                          className="font-medium hover:underline"
                        >
                          {formatName(user)}
                        </Link>
                        <div className="text-sm text-muted-foreground wrap-anywhere">
                          {user.email}
                        </div>
                        {user.parentalConsentReceivedAt && (
                          <div className="mt-1 text-[13px] leading-snug text-muted-foreground md:hidden">
                            Approved{" "}
                            {formatDistanceToNow(
                              new Date(user.parentalConsentReceivedAt),
                              { addSuffix: true }
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm tabular-nums md:align-middle">
                        {formatAge(user.dateOfBirth)}
                      </TableCell>
                      <TableCell className="hidden px-4 py-3 text-sm md:table-cell">
                        {user.parentalConsentReceivedAt &&
                          formatDistanceToNow(
                            new Date(user.parentalConsentReceivedAt),
                            { addSuffix: true }
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {users.length === 0 && (
          <div className="rounded-xl border bg-card shadow-sm">
            <EmptyState
              icon={UserIcon}
              title="No volunteers under 16"
              description="All current volunteers are 16 or older."
              data-testid="parental-consent-empty-state"
            />
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <EmailPreviewDialog
                emailType="parentalConsentApproval"
                triggerLabel="Preview Email"
                triggerVariant="outline"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setApproveDialog({ isOpen: false, user: null })}
              >
                Cancel
              </Button>
              <Button onClick={confirmApproval} disabled={!!approving}>
                {approving ? "Approving..." : "Approve Consent"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

