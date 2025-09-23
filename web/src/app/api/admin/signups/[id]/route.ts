import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createShiftConfirmedNotification, createShiftWaitlistedNotification, createShiftCanceledNotification } from "@/lib/notifications";
import { getEmailService } from "@/lib/email-service";
import { format } from "date-fns";
import { LOCATION_ADDRESSES } from "@/lib/locations";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const { id: signupId } = await params;

  try {
    const body = await req.json();
    const { action } = body; // "approve", "reject", "cancel", "confirm", "mark_present", or "mark_absent"

    if (!["approve", "reject", "cancel", "confirm", "mark_present", "mark_absent"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Find the signup
    const signup = await prisma.signup.findUnique({
      where: { id: signupId },
      include: {
        shift: {
          include: {
            shiftType: true,
          },
        },
        user: { 
          select: { 
            id: true, 
            email: true, 
            name: true, 
            firstName: true, 
            lastName: true 
          } 
        },
      },
    });

    if (!signup) {
      console.error(`Signup not found: signupId=${signupId}`);
      
      return NextResponse.json({ 
        error: "Signup not found", 
        signupId,
        debug: "The signup may have been deleted, canceled, or the ID is incorrect. Please refresh the page to see the current status."
      }, { status: 404 });
    }

    // Different status requirements for different actions
    if (action === "approve" || action === "reject") {
      if (signup.status !== "PENDING" && signup.status !== "REGULAR_PENDING") {
        return NextResponse.json(
          { error: "Only pending signups can be approved or rejected" },
          { status: 400 }
        );
      }
    } else if (action === "cancel") {
      if (signup.status !== "CONFIRMED") {
        return NextResponse.json(
          { error: "Only confirmed signups can be cancelled" },
          { status: 400 }
        );
      }
    } else if (action === "confirm") {
      if (signup.status !== "WAITLISTED") {
        return NextResponse.json(
          { error: "Only waitlisted signups can be confirmed" },
          { status: 400 }
        );
      }
    }

    // For approval, check if there's capacity
    if (action === "approve") {
      const confirmedCount = await prisma.signup.count({
        where: {
          shiftId: signup.shiftId,
          status: "CONFIRMED",
        },
      });

      if (confirmedCount >= signup.shift.capacity) {
        // Move to waitlist instead of confirming
        const updatedSignup = await prisma.signup.update({
          where: { id: signupId },
          data: { status: "WAITLISTED" },
        });

        // Create waitlist notification
        try {
          const shiftDate = new Intl.DateTimeFormat('en-NZ', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }).format(signup.shift.start);

          await createShiftWaitlistedNotification(
            signup.user.id,
            signup.shift.shiftType.name,
            shiftDate,
            signup.shift.id
          );
        } catch (notificationError) {
          console.error("Error creating waitlist notification:", notificationError);
        }

        return NextResponse.json({
          ...updatedSignup,
          message: "Shift was full, moved to waitlist",
        });
      }

      // Approve the signup
      const updatedSignup = await prisma.signup.update({
        where: { id: signupId },
        data: { status: "CONFIRMED" },
      });

      // Send confirmation email to volunteer
      try {
        const emailService = getEmailService();
        const shiftDate = format(signup.shift.start, "EEEE, MMMM d, yyyy");
        const shiftTime = `${format(signup.shift.start, "h:mm a")} - ${format(signup.shift.end, "h:mm a")}`;
        const fullAddress = signup.shift.location 
          ? LOCATION_ADDRESSES[signup.shift.location as keyof typeof LOCATION_ADDRESSES] || signup.shift.location
          : 'TBD';
        
        await emailService.sendShiftConfirmationNotification({
          to: signup.user.email!,
          volunteerName: signup.user.name || `${signup.user.firstName || ''} ${signup.user.lastName || ''}`.trim(),
          shiftName: signup.shift.shiftType.name,
          shiftDate: shiftDate,
          shiftTime: shiftTime,
          location: fullAddress,
          shiftId: signup.shift.id,
          shiftStart: signup.shift.start,
          shiftEnd: signup.shift.end,
        });
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
      }

      // Create in-app notification
      try {
        const shiftDate = new Intl.DateTimeFormat('en-NZ', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(signup.shift.start);

        await createShiftConfirmedNotification(
          signup.user.id,
          signup.shift.shiftType.name,
          shiftDate,
          signup.shift.id
        );
      } catch (notificationError) {
        console.error("Error creating confirmation notification:", notificationError);
      }

      return NextResponse.json({
        ...updatedSignup,
        message: "Signup approved and confirmed",
      });
    }
    
    if (action === "reject") {
      // Reject the signup
      const updatedSignup = await prisma.signup.update({
        where: { id: signupId },
        data: { status: "CANCELED" },
      });

      return NextResponse.json({
        ...updatedSignup,
        message: "Signup rejected",
      });
    }
    
    if (action === "cancel") {
      // Cancel a confirmed signup
      const updatedSignup = await prisma.signup.update({
        where: { id: signupId },
        data: { status: "CANCELED" },
      });

      // Send cancellation email to volunteer
      try {
        const emailService = getEmailService();
        const shiftDate = format(signup.shift.start, "EEEE, MMMM d, yyyy");
        const shiftTime = `${format(signup.shift.start, "h:mm a")} - ${format(signup.shift.end, "h:mm a")}`;
        const fullAddress = signup.shift.location 
          ? LOCATION_ADDRESSES[signup.shift.location as keyof typeof LOCATION_ADDRESSES] || signup.shift.location
          : 'TBD';
        
        await emailService.sendVolunteerCancellationNotification({
          to: signup.user.email!,
          volunteerName: signup.user.name || `${signup.user.firstName || ''} ${signup.user.lastName || ''}`.trim(),
          shiftName: signup.shift.shiftType.name,
          shiftDate: shiftDate,
          shiftTime: shiftTime,
          location: fullAddress,
        });
      } catch (emailError) {
        console.error("Error sending cancellation email:", emailError);
        // Don't fail the API call if email fails
      }

      // Create in-app notification
      try {
        const shiftDate = new Intl.DateTimeFormat('en-NZ', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(signup.shift.start);

        await createShiftCanceledNotification(
          signup.user.id,
          signup.shift.shiftType.name,
          shiftDate,
          signup.shift.id
        );
      } catch (notificationError) {
        console.error("Error creating cancellation notification:", notificationError);
        // Don't fail the API call if notification fails
      }

      return NextResponse.json({
        ...updatedSignup,
        message: "Signup cancelled and volunteer notified",
      });
    }
    
    if (action === "confirm") {
      // Confirm a waitlisted signup (allow over-capacity)
      const updatedSignup = await prisma.signup.update({
        where: { id: signupId },
        data: { status: "CONFIRMED" },
      });

      // Send confirmation email to volunteer
      try {
        const emailService = getEmailService();
        const shiftDate = format(signup.shift.start, "EEEE, MMMM d, yyyy");
        const shiftTime = `${format(signup.shift.start, "h:mm a")} - ${format(signup.shift.end, "h:mm a")}`;
        const fullAddress = signup.shift.location 
          ? LOCATION_ADDRESSES[signup.shift.location as keyof typeof LOCATION_ADDRESSES] || signup.shift.location
          : 'TBD';
        
        await emailService.sendShiftConfirmationNotification({
          to: signup.user.email!,
          volunteerName: signup.user.name || `${signup.user.firstName || ''} ${signup.user.lastName || ''}`.trim(),
          shiftName: signup.shift.shiftType.name,
          shiftDate: shiftDate,
          shiftTime: shiftTime,
          location: fullAddress,
          shiftId: signup.shift.id,
          shiftStart: signup.shift.start,
          shiftEnd: signup.shift.end,
        });
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
        // Don't fail the API call if email fails
      }

      // Create in-app notification
      try {
        const shiftDate = new Intl.DateTimeFormat('en-NZ', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(signup.shift.start);

        await createShiftConfirmedNotification(
          signup.user.id,
          signup.shift.shiftType.name,
          shiftDate,
          signup.shift.id
        );
      } catch (notificationError) {
        console.error("Error creating confirmation notification:", notificationError);
      }

      return NextResponse.json({
        ...updatedSignup,
        message: "Signup confirmed and volunteer notified",
      });
    }

    if (action === "mark_absent") {
      // Mark volunteer as no-show for a past shift
      if (signup.status !== "CONFIRMED") {
        return NextResponse.json(
          { error: "Only confirmed signups can be marked as absent" },
          { status: 400 }
        );
      }

      // Check if shift has ended
      if (new Date() < signup.shift.end) {
        return NextResponse.json(
          { error: "Can only mark attendance for past shifts" },
          { status: 400 }
        );
      }

      const updatedSignup = await prisma.signup.update({
        where: { id: signupId },
        data: { status: "NO_SHOW" },
      });

      return NextResponse.json({
        ...updatedSignup,
        message: "Volunteer marked as no show",
      });
    }

    if (action === "mark_present") {
      // Mark volunteer as present (confirm attendance for a past shift)
      if (signup.status !== "NO_SHOW" && signup.status !== "CONFIRMED") {
        return NextResponse.json(
          { error: "Only confirmed or no-show signups can have attendance marked" },
          { status: 400 }
        );
      }

      // Check if shift has ended
      if (new Date() < signup.shift.end) {
        return NextResponse.json(
          { error: "Can only mark attendance for past shifts" },
          { status: 400 }
        );
      }

      const updatedSignup = await prisma.signup.update({
        where: { id: signupId },
        data: { status: "CONFIRMED" },
      });

      return NextResponse.json({
        ...updatedSignup,
        message: "Volunteer attendance confirmed",
      });
    }
  } catch (error) {
    console.error("Admin signup action error:", error);
    return NextResponse.json(
      { error: "Failed to process signup action" },
      { status: 500 }
    );
  }
}
