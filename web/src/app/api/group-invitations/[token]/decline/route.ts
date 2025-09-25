import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // For decline, we don't require authentication as someone might want to 
    // decline without creating an account, but if they are authenticated,
    // we should verify it's their invitation
    let user = null;
    if (session?.user?.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
    }

    // Extract token from URL
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const token = segments[segments.length - 2];

    const invitation = await prisma.groupInvitation.findUnique({
      where: { token },
      include: {
        groupBooking: {
          include: {
            leader: {
              select: { name: true, email: true },
            },
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // If user is authenticated, verify the invitation is for them
    if (user && invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ 
        error: "This invitation is not for your email address",
      }, { status: 403 });
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      await prisma.groupInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    // Check if invitation is still pending
    if (invitation.status !== "PENDING") {
      return NextResponse.json({ 
        error: `Invitation has already been ${invitation.status.toLowerCase()}`,
      }, { status: 400 });
    }

    // Update invitation status to DECLINED
    await prisma.groupInvitation.update({
      where: { id: invitation.id },
      data: { status: "DECLINED" },
    });

    // TODO: Send notification email to group leader

    return NextResponse.json({
      success: true,
      message: "Invitation declined successfully",
    });

  } catch (error) {
    console.error("Error declining invitation:", error);
    return NextResponse.json(
      { error: "Failed to decline invitation" },
      { status: 500 }
    );
  }
}