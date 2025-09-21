import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

interface MigratedDataResponse {
  success: boolean;
  data: {
    users: {
      total: number;
      migrated: number;
      recent: Array<{
        id: string;
        email: string;
        name: string;
        isMigrated: boolean;
        createdAt: Date;
        shiftsCount: number;
        signupsCount: number;
      }>;
    };
    shiftTypes: {
      total: number;
      recent: Array<{
        id: string;
        name: string;
        description: string;
        createdAt: Date;
        shiftsCount: number;
      }>;
    };
    shifts: {
      total: number;
      migratedFromNova: number;
      recent: Array<{
        id: string;
        start: Date;
        end: Date;
        location: string;
        capacity: number;
        notes: string;
        shiftType: {
          name: string;
        };
        signupsCount: number;
        createdAt: Date;
      }>;
    };
    signups: {
      total: number;
      migratedFromNova: number;
      recent: Array<{
        id: string;
        status: string;
        createdAt: Date;
        user: {
          email: string;
          name: string;
        };
        shift: {
          start: Date;
          end: Date;
          shiftType: {
            name: string;
          };
        };
      }>;
    };
  };
  error?: string;
}

export async function GET(_request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    console.log("[MIGRATED-DATA] Fetching migrated data summary...");

    // Get users data
    const totalUsers = await prisma.user.count();
    const migratedUsers = await prisma.user.count({
      where: { isMigrated: true },
    });

    const recentUsers = await prisma.user.findMany({
      where: { isMigrated: true },
      select: {
        id: true,
        email: true,
        name: true,
        isMigrated: true,
        createdAt: true,
        _count: {
          select: {
            signups: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get shift types data
    const totalShiftTypes = await prisma.shiftType.count();
    const recentShiftTypes = await prisma.shiftType.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            shifts: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get shifts data
    const totalShifts = await prisma.shift.count();
    const migratedShifts = await prisma.shift.count({
      where: {
        notes: {
          contains: "Nova Event ID:",
        },
      },
    });

    const recentShifts = await prisma.shift.findMany({
      where: {
        notes: {
          contains: "Nova Event ID:",
        },
      },
      select: {
        id: true,
        start: true,
        end: true,
        location: true,
        capacity: true,
        notes: true,
        createdAt: true,
        shiftType: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            signups: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get signups data
    const totalSignups = await prisma.signup.count();
    const migratedSignups = await prisma.signup.count({
      where: {
        shift: {
          notes: {
            contains: "Nova Event ID:",
          },
        },
      },
    });

    const recentSignups = await prisma.signup.findMany({
      where: {
        shift: {
          notes: {
            contains: "Nova Event ID:",
          },
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        shift: {
          select: {
            start: true,
            end: true,
            shiftType: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const response: MigratedDataResponse = {
      success: true,
      data: {
        users: {
          total: totalUsers,
          migrated: migratedUsers,
          recent: recentUsers.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name || "No name",
            isMigrated: user.isMigrated,
            createdAt: user.createdAt,
            shiftsCount: 0, // We'll calculate this from signups
            signupsCount: user._count.signups,
          })),
        },
        shiftTypes: {
          total: totalShiftTypes,
          recent: recentShiftTypes.map((st) => ({
            id: st.id,
            name: st.name,
            description: st.description || "",
            createdAt: st.createdAt,
            shiftsCount: st._count.shifts,
          })),
        },
        shifts: {
          total: totalShifts,
          migratedFromNova: migratedShifts,
          recent: recentShifts.map((shift) => ({
            id: shift.id,
            start: shift.start,
            end: shift.end,
            location: shift.location || "",
            capacity: shift.capacity,
            notes: shift.notes || "",
            shiftType: {
              name: shift.shiftType.name,
            },
            signupsCount: shift._count.signups,
            createdAt: shift.createdAt,
          })),
        },
        signups: {
          total: totalSignups,
          migratedFromNova: migratedSignups,
          recent: recentSignups.map((signup) => ({
            id: signup.id,
            status: signup.status,
            createdAt: signup.createdAt,
            user: {
              email: signup.user.email,
              name: signup.user.name || "No name",
            },
            shift: {
              start: signup.shift.start,
              end: signup.shift.end,
              shiftType: {
                name: signup.shift.shiftType.name,
              },
            },
          })),
        },
      },
    };

    console.log(
      `[MIGRATED-DATA] Summary: ${migratedUsers}/${totalUsers} users, ${migratedShifts}/${totalShifts} shifts, ${migratedSignups}/${totalSignups} signups`
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching migrated data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
