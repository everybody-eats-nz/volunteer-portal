import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { calculateAge } from "@/lib/utils";

/**
 * Admin endpoint to identify and fix users with invalid birthdates
 * (birthdates set to today or within the past year, resulting in age 0)
 *
 * GET - List affected users
 * POST - Fix affected users by setting their dateOfBirth to null
 */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    // Find users with dateOfBirth within the last year (invalid)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const affectedUsers = await prisma.user.findMany({
      where: {
        dateOfBirth: {
          gte: oneYearAgo, // Greater than or equal to one year ago
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        requiresParentalConsent: true,
        parentalConsentReceived: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate age for each user
    const usersWithAge = affectedUsers.map((user) => ({
      ...user,
      age: user.dateOfBirth ? calculateAge(user.dateOfBirth) : null,
    }));

    return NextResponse.json({
      count: affectedUsers.length,
      users: usersWithAge,
      message: `Found ${affectedUsers.length} user(s) with invalid birthdates (less than 1 year old)`,
    });
  } catch (error) {
    console.error("Error finding affected users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    // Find users with dateOfBirth within the last year (invalid)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // First, get the affected users for reporting
    const affectedUsers = await prisma.user.findMany({
      where: {
        dateOfBirth: {
          gte: oneYearAgo,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        dateOfBirth: true,
      },
    });

    // Update all affected users: set dateOfBirth to null and reset parental consent flags
    const result = await prisma.user.updateMany({
      where: {
        dateOfBirth: {
          gte: oneYearAgo,
        },
      },
      data: {
        dateOfBirth: null,
        requiresParentalConsent: false,
        parentalConsentReceived: false,
        parentalConsentReceivedAt: null,
        parentalConsentApprovedBy: null,
      },
    });

    console.log(`Fixed ${result.count} users with invalid birthdates:`, {
      admin: currentUser.email,
      affectedUsers: affectedUsers.map((u) => ({
        email: u.email,
        name: u.name,
        oldDateOfBirth: u.dateOfBirth,
      })),
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Successfully fixed ${result.count} user(s) with invalid birthdates. Their dateOfBirth has been set to null and parental consent flags have been reset.`,
      affectedUsers: affectedUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        oldDateOfBirth: u.dateOfBirth,
      })),
    });
  } catch (error) {
    console.error("Error fixing affected users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
