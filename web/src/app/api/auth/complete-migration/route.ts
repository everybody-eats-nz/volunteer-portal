import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * Complete migration for OAuth users
 * This endpoint is called after OAuth sign-in during migration flow
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Find the user with the migration token
    const migrationUser = await prisma.user.findFirst({
      where: {
        migrationInvitationToken: token,
        migrationTokenExpiresAt: { gt: new Date() },
        profileCompleted: false,
        role: "VOLUNTEER",
        isMigrated: true,
      },
    });

    if (!migrationUser) {
      console.log(`Migration token not found or invalid: ${token}`);
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Get the current OAuth user
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        email: true, 
        id: true,
        profilePhotoUrl: true,
        hashedPassword: true,
      },
    });

    if (!currentUser || currentUser.email !== migrationUser.email) {
      console.log(
        `OAuth user email (${currentUser?.email}) doesn't match migration user email (${migrationUser.email})`
      );
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // If they're different users (OAuth created a new user), we need to merge them
    if (currentUser.id !== migrationUser.id) {
      console.log(`Merging OAuth user ${currentUser.id} with migration user ${migrationUser.id}`);
      
      // Transfer OAuth data to migration user and mark as completed
      const updateData: Record<string, unknown> = {
        profileCompleted: true,
        migrationInvitationToken: null,
        migrationTokenExpiresAt: null,
      };
      
      // Transfer OAuth profile photo if migration user doesn't have one
      if (currentUser.profilePhotoUrl && !migrationUser.profilePhotoUrl) {
        updateData.profilePhotoUrl = currentUser.profilePhotoUrl;
      }
      
      // Keep OAuth hashedPassword empty since they'll use OAuth
      updateData.hashedPassword = "";
      
      // Update the migration user with OAuth data and completion status
      await prisma.user.update({
        where: { id: migrationUser.id },
        data: updateData,
      });
      
      // Delete the OAuth-created user record since we want to keep the migration one
      await prisma.user.delete({
        where: { id: currentUser.id },
      });
      
      console.log(`Deleted OAuth user ${currentUser.id}, keeping migration user ${migrationUser.id}`);
      
      // Since we deleted the OAuth user, the session will be invalid
      // Redirect to login so they can sign in again with their migrated account
      return NextResponse.redirect(new URL("/login?message=migration-complete", request.url));
    } else {
      // Same user, just mark as completed
      await prisma.user.update({
        where: { id: migrationUser.id },
        data: {
          profileCompleted: true,
          migrationInvitationToken: null,
          migrationTokenExpiresAt: null,
        },
      });
    }

    console.log(`Migration completed for user ${migrationUser.email} via OAuth`);

    // Redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("Error completing migration:", error);
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
}