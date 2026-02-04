import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get notification logs grouped by batch (same sentAt timestamp and sentBy)
    const logs = await prisma.shortageNotificationLog.findMany({
      orderBy: { sentAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Group logs by batch (sent at same time by same admin)
    const batchMap = new Map<string, {
      sentAt: Date;
      sentBy: string;
      shifts: Map<string, {
        shiftId: string;
        shiftTypeName: string;
        shiftDate: Date;
        shiftLocation: string;
      }>;
      recipients: Array<{
        id: string;
        recipientId: string;
        recipientEmail: string;
        recipientName: string;
        success: boolean;
        errorMessage: string | null;
      }>;
      successCount: number;
      failureCount: number;
    }>();

    logs.forEach((log) => {
      // Create a batch key based on sentAt (rounded to second) and sentBy
      const batchKey = `${Math.floor(log.sentAt.getTime() / 1000)}-${log.sentBy}`;

      if (!batchMap.has(batchKey)) {
        batchMap.set(batchKey, {
          sentAt: log.sentAt,
          sentBy: log.sentBy,
          shifts: new Map(),
          recipients: [],
          successCount: 0,
          failureCount: 0,
        });
      }

      const batch = batchMap.get(batchKey)!;

      // Add shift info (deduplicated)
      if (!batch.shifts.has(log.shiftId)) {
        batch.shifts.set(log.shiftId, {
          shiftId: log.shiftId,
          shiftTypeName: log.shiftTypeName,
          shiftDate: log.shiftDate,
          shiftLocation: log.shiftLocation,
        });
      }

      // Add recipient info
      batch.recipients.push({
        id: log.id,
        recipientId: log.recipientId,
        recipientEmail: log.recipientEmail,
        recipientName: log.recipientName,
        success: log.success,
        errorMessage: log.errorMessage,
      });

      if (log.success) {
        batch.successCount++;
      } else {
        batch.failureCount++;
      }
    });

    // Convert to array format for response
    const batches = Array.from(batchMap.entries()).map(([key, batch]) => ({
      batchKey: key,
      sentAt: batch.sentAt,
      sentBy: batch.sentBy,
      shifts: Array.from(batch.shifts.values()),
      recipients: batch.recipients,
      successCount: batch.successCount,
      failureCount: batch.failureCount,
      totalCount: batch.recipients.length,
    }));

    // Get total count for pagination
    const totalCount = await prisma.shortageNotificationLog.count();

    // Get admin names for the batches
    const adminIds = [...new Set(batches.map((b) => b.sentBy))];
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, name: true, firstName: true, lastName: true },
    });

    const adminMap = new Map(
      admins.map((a) => [
        a.id,
        a.firstName && a.lastName
          ? `${a.firstName} ${a.lastName}`
          : a.name || "Unknown Admin",
      ])
    );

    // Add admin names to batches
    const batchesWithAdminNames = batches.map((batch) => ({
      ...batch,
      sentByName: adminMap.get(batch.sentBy) || "Unknown Admin",
    }));

    return NextResponse.json({
      batches: batchesWithAdminNames,
      totalCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching notification history:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification history" },
      { status: 500 }
    );
  }
}
