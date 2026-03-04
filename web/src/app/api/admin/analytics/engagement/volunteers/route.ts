import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

import { classifyEngagement, type EngagementStatus } from "@/lib/engagement";

interface VolunteerRow {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  volunteerGrade: string;
  createdAt: Date;
  lastShiftDate: Date | null;
  totalShifts: number;
  shiftsInPeriod: number;
  engagementStatus: EngagementStatus;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const months = parseInt(searchParams.get("months") || "3", 10);
  const location = searchParams.get("location");
  const statusFilter = searchParams.get("status") as EngagementStatus | null;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const sortBy = searchParams.get("sortBy") || "lastShiftDate";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
  const search = searchParams.get("search") || "";

  try {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setMonth(periodStart.getMonth() - months);

    // Fetch all volunteers with their signups
    const volunteers = await prisma.user.findMany({
      where: {
        role: "VOLUNTEER",
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePhotoUrl: true,
        volunteerGrade: true,
        createdAt: true,
        signups: {
          where: { status: "CONFIRMED" },
          select: {
            shift: {
              select: { end: true, location: true },
            },
          },
        },
      },
    });

    // Compute engagement fields for each volunteer
    const rows: VolunteerRow[] = volunteers.map((v) => {
      const completedSignups = v.signups.filter((s) => {
        const isPast = s.shift.end < now;
        const matchesLocation =
          !location || location === "all" || s.shift.location === location;
        return isPast && matchesLocation;
      });

      const shiftsInPeriod = completedSignups.filter(
        (s) => s.shift.end >= periodStart
      ).length;

      const totalShifts = completedSignups.length;

      const lastShiftDate =
        completedSignups.length > 0
          ? completedSignups.reduce(
              (latest, s) => (s.shift.end > latest ? s.shift.end : latest),
              completedSignups[0].shift.end
            )
          : null;

      return {
        id: v.id,
        name: v.name,
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        profilePhotoUrl: v.profilePhotoUrl,
        volunteerGrade: v.volunteerGrade,
        createdAt: v.createdAt,
        lastShiftDate,
        totalShifts,
        shiftsInPeriod,
        engagementStatus: classifyEngagement(totalShifts, shiftsInPeriod, months),
      };
    });

    // Filter by engagement status
    const filtered = statusFilter
      ? rows.filter((r) => r.engagementStatus === statusFilter)
      : rows;

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "user": {
          const nameA =
            a.name || `${a.firstName || ""} ${a.lastName || ""}`.trim() || a.email;
          const nameB =
            b.name || `${b.firstName || ""} ${b.lastName || ""}`.trim() || b.email;
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case "totalShifts":
          cmp = a.totalShifts - b.totalShifts;
          break;
        case "shiftsInPeriod":
          cmp = a.shiftsInPeriod - b.shiftsInPeriod;
          break;
        case "lastShiftDate": {
          const dateA = a.lastShiftDate?.getTime() || 0;
          const dateB = b.lastShiftDate?.getTime() || 0;
          cmp = dateA - dateB;
          break;
        }
        default:
          cmp = 0;
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });

    // Paginate
    const totalCount = sorted.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedRows = sorted.slice(start, start + pageSize);

    return NextResponse.json({
      volunteers: paginatedRows,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching engagement volunteers:", error);
    return NextResponse.json(
      { error: "Failed to fetch volunteer data" },
      { status: 500 }
    );
  }
}
