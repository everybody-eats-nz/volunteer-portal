import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatInNZT, parseISOInNZT, toUTC } from "@/lib/timezone";
import {
  buildCashNights,
  type CashReconciliation,
} from "@/lib/cash-reconciliation";

const decimal = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export async function getCashReconciliation({
  location,
  from,
  to,
  now = new Date(),
}: {
  location: string;
  from: string;
  to: string;
  now?: Date;
}): Promise<CashReconciliation> {
  // UTC bounds of the NZ days. MealsServed.date is NZ midnight in UTC, so it
  // falls inside these bounds for every night in the range.
  const start = toUTC(startOfDay(parseISOInNZT(from)));
  const end = toUTC(endOfDay(parseISOInNZT(to)));

  const [records, shifts] = await Promise.all([
    prisma.mealsServed.findMany({
      where: { location, date: { gte: start, lte: end } },
      select: { date: true, cash: true, eftpos: true, stripe: true },
    }),
    // Only shifts that have finished: tonight's service isn't missing its
    // cash yet.
    prisma.shift.findMany({
      where: { location, start: { gte: start, lte: end }, end: { lte: now } },
      select: { start: true },
    }),
  ]);

  const { nights, totals } = buildCashNights(
    records.map((r) => ({
      date: formatInNZT(r.date, "yyyy-MM-dd"),
      cash: decimal(r.cash),
      eftpos: decimal(r.eftpos),
      stripe: decimal(r.stripe),
    })),
    [...new Set(shifts.map((s) => formatInNZT(s.start, "yyyy-MM-dd")))]
  );

  return { location, from, to, nights, totals };
}
