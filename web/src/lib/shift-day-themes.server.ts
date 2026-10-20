import { prisma } from "@/lib/prisma";
import {
  dayKeyToDbDate,
  toShiftDayThemeMap,
  type ShiftDayThemeMap,
} from "@/lib/shift-day-themes";

/**
 * Themes for days from `fromDayKey` onwards (and up to `toDayKey`, inclusive,
 * when given), optionally limited to some locations.
 */
export async function getShiftDayThemes({
  fromDayKey,
  toDayKey,
  locations,
}: {
  fromDayKey: string;
  toDayKey?: string;
  locations?: string[];
}): Promise<ShiftDayThemeMap> {
  const rows = await prisma.shiftDayTheme.findMany({
    where: {
      date: {
        gte: dayKeyToDbDate(fromDayKey),
        ...(toDayKey ? { lte: dayKeyToDbDate(toDayKey) } : {}),
      },
      ...(locations && locations.length > 0
        ? { location: { in: locations } }
        : {}),
    },
    select: { date: true, location: true, theme: true, closed: true },
    orderBy: [{ date: "asc" }, { location: "asc" }],
  });
  return toShiftDayThemeMap(rows);
}
