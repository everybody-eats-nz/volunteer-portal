import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import {
  Users,
  UserCheck,
  UserX,
  Mail,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  User,
} from "lucide-react";
import Link from "next/link";

export default async function GroupBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login?callbackUrl=/shifts/mine");
  }

  const { id } = await params;

  // Fetch the group booking with all related data
  const groupBooking = await prisma.groupBooking.findUnique({
    where: { id },
    include: {
      shift: {
        include: {
          shiftType: true,
        },
      },
      leader: {
        select: {
          id: true,
          name: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      signups: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              profileCompleted: true,
              emergencyContactName: true,
              emergencyContactPhone: true,
              volunteerAgreementAccepted: true,
              healthSafetyPolicyAccepted: true,
              createdAt: true,
            },
          },
        },
      },
      invitations: true,
    },
  });

  if (!groupBooking) {
    notFound();
  }

  // Check if the current user is the leader
  const isLeader = groupBooking.leaderId === userId;

  // Check if the current user is a member
  const isMember = groupBooking.signups.some((s) => s.user.id === userId);

  // If not leader or member, redirect
  if (!isLeader && !isMember) {
    redirect("/shifts/mine");
  }

  // Categorize invitations and members
  const acceptedMembers = groupBooking.signups.filter(
    (s) => s.status !== "CANCELED"
  );
  const pendingInvites = groupBooking.invitations.filter(
    (i) => i.status === "PENDING"
  );
  const declinedInvites = groupBooking.invitations.filter(
    (i) => i.status === "DECLINED"
  );
  const expiredInvites = groupBooking.invitations.filter(
    (i) => i.status === "EXPIRED"
  );

  // Check member registration status
  const membersWithStatus = acceptedMembers.map((signup) => {
    const user = signup.user;
    const hasBasicInfo = user.firstName && user.lastName && user.phone;
    const hasEmergencyContact =
      user.emergencyContactName && user.emergencyContactPhone;
    const hasAgreements =
      user.volunteerAgreementAccepted && user.healthSafetyPolicyAccepted;
    const isComplete =
      user.profileCompleted ||
      (hasBasicInfo && hasEmergencyContact && hasAgreements);

    return {
      ...signup,
      registrationStatus: isComplete ? "complete" : "incomplete",
      missingFields: {
        basicInfo: !hasBasicInfo,
        emergencyContact: !hasEmergencyContact,
        agreements: !hasAgreements,
      },
    };
  });

  const completeMembers = membersWithStatus.filter(
    (m) => m.registrationStatus === "complete"
  );
  const incompleteMembers = membersWithStatus.filter(
    (m) => m.registrationStatus === "incomplete"
  );

  function StatusBadge({ status }: { status: string }) {
    switch (status) {
      case "PENDING":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 gap-1.5"
          >
            <Timer className="h-3 w-3" />
            Pending Approval
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800 gap-1.5">
            <CheckCircle className="h-3 w-3" />
            Confirmed
          </Badge>
        );
      case "WAITLISTED":
        return (
          <Badge variant="secondary" className="gap-1.5">
            <Users className="h-3 w-3" />
            Waitlisted
          </Badge>
        );
      case "CANCELED":
        return (
          <Badge variant="destructive" className="gap-1.5">
            <XCircle className="h-3 w-3" />
            Canceled
          </Badge>
        );
      case "PARTIAL":
        return (
          <Badge variant="outline" className="gap-1.5">
            <AlertCircle className="h-3 w-3" />
            Partially Approved
          </Badge>
        );
      default:
        return null;
    }
  }

  return (
    <PageContainer testid="group-booking-detail-page">
      <PageHeader
        title={groupBooking.name}
        description={groupBooking.description || "Group booking details"}
      />

      {/* Group Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Group Status
            </CardTitle>
            <StatusBadge status={groupBooking.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {groupBooking.shift.shiftType.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(groupBooking.shift.start, "EEE, dd MMM yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Time</p>
                <p className="text-xs text-muted-foreground">
                  {format(groupBooking.shift.start, "h:mm a")} –{" "}
                  {format(groupBooking.shift.end, "h:mm a")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Location</p>
                <p className="text-xs text-muted-foreground">
                  {groupBooking.shift.location || "To be confirmed"}
                </p>
              </div>
            </div>
          </div>

          {groupBooking.notes && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Admin Notes:</p>
              <p className="text-sm">{groupBooking.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration Status Alert */}
      {incompleteMembers.length > 0 && groupBooking.status === "PENDING" && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-300">
                  Registration Incomplete
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  {incompleteMembers.length} member
                  {incompleteMembers.length > 1 ? "s have" : " has"} not
                  completed their registration. The group cannot be approved
                  until all members complete their profiles.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members Section */}
      <div className="space-y-6">
        {/* Registered Members with Complete Profiles */}
        {completeMembers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <UserCheck className="h-5 w-5" />
                Ready Members ({completeMembers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completeMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                        <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {member.user.firstName}{" "}
                          {member.user.lastName ||
                            member.user.name ||
                            member.user.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.user.id === groupBooking.leaderId && (
                        <Badge variant="outline" className="text-xs">
                          Leader
                        </Badge>
                      )}
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Profile Complete
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Members with Incomplete Profiles */}
        {incompleteMembers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-5 w-5" />
                Members Needing Action ({incompleteMembers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {incompleteMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                        <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {member.user.name || member.user.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.user.email}
                        </p>
                        <div className="flex gap-2 mt-1">
                          {member.missingFields.basicInfo && (
                            <span className="text-xs text-amber-600">
                              Missing: Basic Info
                            </span>
                          )}
                          {member.missingFields.emergencyContact && (
                            <span className="text-xs text-amber-600">
                              Missing: Emergency Contact
                            </span>
                          )}
                          {member.missingFields.agreements && (
                            <span className="text-xs text-amber-600">
                              Missing: Agreements
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Incomplete
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Mail className="h-5 w-5" />
                Pending Invitations ({pendingInvites.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                        <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Invited {format(invite.createdAt, "MMM d, yyyy")}
                        </p>
                        {invite.expiresAt < new Date() ? (
                          <p className="text-xs text-red-600">Expired</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Expires {format(invite.expiresAt, "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      Awaiting Response
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Declined/Expired Invitations */}
        {(declinedInvites.length > 0 || expiredInvites.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <UserX className="h-5 w-5" />
                Unable to Join ({declinedInvites.length + expiredInvites.length}
                )
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...declinedInvites, ...expiredInvites].map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-900/50 rounded-full">
                        <UserX className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium line-through text-gray-600">
                          {invite.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {invite.status === "DECLINED"
                            ? "Declined invitation"
                            : "Invitation expired"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300"
                    >
                      {invite.status === "DECLINED" ? "Declined" : "Expired"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/shifts/mine">Back to My Shifts</Link>
        </Button>
        {isLeader && groupBooking.status === "PENDING" && (
          <Button variant="outline" className="text-red-600 hover:bg-red-50">
            Cancel Group Booking
          </Button>
        )}
      </div>
    </PageContainer>
  );
}
