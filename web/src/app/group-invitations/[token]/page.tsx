import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvitationActions } from "./invitation-actions";
import { Clock, MapPin, Users, Calendar, AlertCircle } from "lucide-react";

interface GroupInvitationPageProps {
  params: Promise<{ token: string }>;
}

function getDurationInHours(start: Date, end: Date): string {
  const durationMs = end.getTime() - start.getTime();
  const hours = durationMs / (1000 * 60 * 60);
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  return `${wholeHours}h ${minutes}m`;
}

export default async function GroupInvitationPage({
  params,
}: GroupInvitationPageProps) {
  const { token } = await params;
  const session = await getServerSession(authOptions);

  // Fetch invitation details
  const invitation = await prisma.groupInvitation.findUnique({
    where: { token },
    include: {
      groupBooking: {
        include: {
          shift: {
            include: { shiftType: true },
          },
          leader: {
            select: { name: true, email: true },
          },
          signups: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
            where: {
              status: { not: "CANCELED" },
            },
          },
        },
      },
      invitedBy: {
        select: { name: true, email: true },
      },
    },
  });

  if (!invitation) {
    notFound();
  }

  // Check if invitation has expired
  if (invitation.expiresAt < new Date()) {
    // Mark as expired if not already
    if (invitation.status === "PENDING") {
      await prisma.groupInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
    }
  }

  // Check if user is authenticated and this is their invitation
  let isAuthenticatedUser = false;
  let requiresLogin = false;
  
  if (session?.user?.email) {
    isAuthenticatedUser = invitation.email.toLowerCase() === session.user.email.toLowerCase();
  } else {
    // Check if this email is associated with an existing account
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });
    requiresLogin = !!existingUser;
  }

  // If user is authenticated but invitation is not for them, show error
  if (session?.user?.email && !isAuthenticatedUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This invitation is not for your email address. Please log out and access the invitation with the correct account, or contact the person who invited you.
            </p>
            <Button asChild className="w-full">
              <a href="/logout">Log Out</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { groupBooking } = invitation;
  const shift = groupBooking.shift;
  const duration = getDurationInHours(shift.start, shift.end);
  
  // Check various states
  const isExpired = invitation.expiresAt < new Date();
  const isShiftPast = shift.start < new Date();
  const isGroupCanceled = groupBooking.status === "CANCELED";
  const isAlreadyProcessed = invitation.status !== "PENDING";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Group Volunteer Invitation
          </h1>
          <p className="text-gray-600">
            You&apos;ve been invited to join a volunteer group
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-6 w-6" />
              {groupBooking.name}
            </CardTitle>
            {groupBooking.description && (
              <p className="text-blue-100 mt-2">{groupBooking.description}</p>
            )}
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Status Alerts */}
            {isExpired && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="font-medium text-red-900">Invitation Expired</p>
                </div>
                <p className="text-red-700 mt-1 text-sm">
                  This invitation expired on {format(invitation.expiresAt, "MMM d, yyyy 'at' h:mm a")}. 
                  Please contact the group leader for a new invitation.
                </p>
              </div>
            )}

            {isShiftPast && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-gray-600" />
                  <p className="font-medium text-gray-900">Past Event</p>
                </div>
                <p className="text-gray-700 mt-1 text-sm">
                  This volunteer shift has already passed.
                </p>
              </div>
            )}

            {isGroupCanceled && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="font-medium text-red-900">Group Canceled</p>
                </div>
                <p className="text-red-700 mt-1 text-sm">
                  This group booking has been canceled by the leader or administrators.
                </p>
              </div>
            )}

            {isAlreadyProcessed && invitation.status === "ACCEPTED" && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-900">Already Accepted</p>
                </div>
                <p className="text-green-700 mt-1 text-sm">
                  You have already accepted this invitation and joined the group.
                </p>
              </div>
            )}

            {isAlreadyProcessed && invitation.status === "DECLINED" && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-gray-600" />
                  <p className="font-medium text-gray-900">Previously Declined</p>
                </div>
                <p className="text-gray-700 mt-1 text-sm">
                  You previously declined this invitation.
                </p>
              </div>
            )}

            {/* Invitation Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Invited by</p>
                  <p className="font-medium">{invitation.invitedBy.name || invitation.invitedBy.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Group Leader</p>
                  <p className="font-medium">{groupBooking.leader.name || groupBooking.leader.email}</p>
                </div>
              </div>

              {invitation.message && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Personal message:</p>
                  <p className="text-sm italic">&quot;{invitation.message}&quot;</p>
                </div>
              )}
            </div>

            {/* Shift Details */}
            <div className="rounded-lg border p-4 bg-muted/30">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Volunteer Shift Details
              </h3>

              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-base">{shift.shiftType.name}</h4>
                  {shift.shiftType.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {shift.shiftType.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(shift.start, "EEEE, MMMM d, yyyy")}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(shift.start, "h:mm a")} - {format(shift.end, "h:mm a")}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {duration}
                    </Badge>
                  </div>
                  
                  {shift.location && (
                    <div className="flex items-center gap-2 md:col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{shift.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Group Members */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Group Members ({groupBooking.signups.length}/{groupBooking.maxMembers})
              </h4>
              <div className="space-y-2">
                {groupBooking.signups.map((signup) => (
                  <div key={signup.id} className="flex items-center justify-between bg-gray-50 rounded p-3">
                    <div>
                      <p className="font-medium text-sm">{signup.user.name || signup.user.email}</p>
                      <p className="text-xs text-muted-foreground">{signup.user.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {signup.status.toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            {!isExpired && !isShiftPast && !isGroupCanceled && !isAlreadyProcessed && (
              <div className="pt-4">
                {requiresLogin && !session ? (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-blue-900 text-sm">
                        You already have an account with this email address. Please log in to accept this invitation.
                      </p>
                    </div>
                    <Button asChild className="w-full">
                      <a href={`/login?callbackUrl=/group-invitations/${token}`}>
                        Log In to Accept Invitation
                      </a>
                    </Button>
                  </div>
                ) : !session ? (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-900 text-sm">
                        To join this group, you&apos;ll need to create a volunteer account and agree to our terms and conditions.
                      </p>
                    </div>
                    <Button asChild className="w-full">
                      <a href={`/register?callbackUrl=/group-invitations/${token}&email=${encodeURIComponent(invitation.email)}`}>
                        Create Account & Join Group
                      </a>
                    </Button>
                  </div>
                ) : (
                  <InvitationActions token={token} />
                )}
              </div>
            )}

            {/* Terms Notice */}
            {!isAlreadyProcessed && !isExpired && !isShiftPast && !isGroupCanceled && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="text-blue-900 font-medium mb-1">Please Note:</p>
                <ul className="text-blue-800 space-y-1 text-xs">
                  <li>• By accepting, you agree to our volunteer terms and conditions</li>
                  <li>• You&apos;ll receive individual confirmation once the group is approved</li>
                  <li>• Group bookings are reviewed by administrators before confirmation</li>
                  <li>• You can view and manage your volunteer commitments in your dashboard</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>Questions about volunteering? Contact us at support@everybodyeats.nz</p>
        </div>
      </div>
    </div>
  );
}