import { prisma } from "@/lib/prisma";

export type CreateShiftData = {
  shiftTypeId: string;
  location: string;
  start: Date;
  end: Date;
  capacity: number;
  notes?: string | null;
};

/**
 * Core shift creation logic
 * Used by both server actions and API endpoints
 */
export async function createShiftRecord(data: CreateShiftData) {
  return await prisma.shift.create({
    data: {
      shiftTypeId: data.shiftTypeId,
      start: data.start,
      end: data.end,
      location: data.location,
      capacity: data.capacity,
      notes: data.notes ?? null,
    },
  });
}
