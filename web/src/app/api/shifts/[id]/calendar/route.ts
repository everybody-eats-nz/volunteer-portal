import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateICSContent } from "@/lib/calendar-utils";

/**
 * Public API endpoint to download ICS calendar file for a shift
 * This endpoint is intentionally public so calendar links work in emails
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch shift with shift type details
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        shiftType: true,
      },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Generate ICS content
    const icsContent = generateICSContent({
      id: shift.id,
      start: shift.start,
      end: shift.end,
      location: shift.location,
      shiftType: {
        name: shift.shiftType.name,
        description: shift.shiftType.description,
      },
    });

    // Return ICS file with proper headers
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="shift-${shift.shiftType.name.replace(/\s+/g, "-").toLowerCase()}.ics"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[GET /api/shifts/[id]/calendar] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate calendar file" },
      { status: 500 }
    );
  }
}
