import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

interface ShiftData {
  shiftId: string;
  shiftTypeName: string;
  shiftDate: string;
  shiftLocation: string;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Each send writes one log row per recipient via a single createMany, so
    // every row in a batch shares the same (sentAt, sentBy) — Postgres returns
    // an identical now() within a transaction. Paginate by those batches
    // rather than by individual log rows, otherwise a single large send
    // (e.g. 200 recipients) fills the page and hides all older batches.
    const batchKeys = await prisma.shortageNotificationLog.groupBy({
      by: ["sentAt", "sentBy"],
      orderBy: { sentAt: "desc" },
      take: limit,
      skip: offset,
    });

    const logs =
      batchKeys.length === 0
        ? []
        : await prisma.shortageNotificationLog.findMany({
            where: {
              OR: batchKeys.map((b) => ({
                sentAt: b.sentAt,
                sentBy: b.sentBy,
              })),
            },
            orderBy: { sentAt: "desc" },
          });

    // Group logs by batch (sentAt + sentBy)
    const batchMap = new Map<string, {
      sentAt: Date;
      sentBy: string;
      shifts: ShiftData[];
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
      const batchKey = `${log.sentAt.getTime()}-${log.sentBy}`;

      if (!batchMap.has(batchKey)) {
        const shifts = log.shifts as unknown as ShiftData[];
        batchMap.set(batchKey, {
          sentAt: log.sentAt,
          sentBy: log.sentBy,
          shifts,
          recipients: [],
          successCount: 0,
          failureCount: 0,
        });
      }

      const batch = batchMap.get(batchKey)!;

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

    // Preserve the batchKeys ordering (already desc by sentAt) when emitting
    // results, so the response matches the requested page order even if the
    // raw log fetch reordered things.
    const batches = batchKeys
      .map((b) => {
        const key = `${b.sentAt.getTime()}-${b.sentBy}`;
        const batch = batchMap.get(key);
        if (!batch) return null;
        return {
          batchKey: key,
          sentAt: batch.sentAt,
          sentBy: batch.sentBy,
          shifts: batch.shifts,
          recipients: batch.recipients,
          successCount: batch.successCount,
          failureCount: batch.failureCount,
          totalCount: batch.recipients.length,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    // Count of distinct batches for pagination
    const totalBatchesResult = await prisma.$queryRaw<
      Array<{ count: bigint }>
    >`SELECT COUNT(*)::bigint AS count FROM (SELECT DISTINCT "sentAt", "sentBy" FROM "ShortageNotificationLog") sub`;
    const totalCount = Number(totalBatchesResult[0]?.count ?? 0);

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
