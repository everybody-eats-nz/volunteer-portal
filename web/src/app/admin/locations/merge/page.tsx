import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";

import { MergeContent } from "./merge-content";
import type { MergeLocationOption, MergeSuggestion } from "./merge-content";

/** Case/punctuation-insensitive key: "GlenInnes" and "Glen Innes" collide. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default async function MergeLocationsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Orphaned shift venues (no Location row) can also need merging, so the
  // source list includes any distinct shift location alongside Location rows.
  const [locations, shiftGroups] = await Promise.all([
    prisma.location.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.shift.groupBy({
      by: ["location"],
      where: { location: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const shiftCounts: Record<string, number> = {};
  for (const group of shiftGroups) {
    if (group.location) shiftCounts[group.location] = group._count._all;
  }

  const knownNames = new Set(locations.map((loc) => loc.name));
  const orphanNames = shiftGroups
    .map((group) => group.location)
    .filter((name): name is string => name !== null && !knownNames.has(name))
    .sort();

  // Names that normalize to the same key are almost certainly the same venue
  // (a typo'd rename or an import artifact) — surface them as one-click
  // suggestions. The kept side must have a Location row; prefer the active
  // one, then the one with the most shift history.
  const entries = [
    ...locations.map((loc) => ({
      name: loc.name,
      hasRecord: true,
      isActive: loc.isActive,
      count: shiftCounts[loc.name] ?? 0,
    })),
    ...orphanNames.map((name) => ({
      name,
      hasRecord: false,
      isActive: false,
      count: shiftCounts[name] ?? 0,
    })),
  ];

  const byKey = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = normalizeName(entry.name);
    if (!key) continue;
    const group = byKey.get(key);
    if (group) {
      group.push(entry);
    } else {
      byKey.set(key, [entry]);
    }
  }

  const suggestions: MergeSuggestion[] = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const keepCandidates = group.filter((entry) => entry.hasRecord);
    if (keepCandidates.length === 0) continue;
    const keep = [...keepCandidates].sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        b.count - a.count ||
        a.name.localeCompare(b.name)
    )[0];
    for (const entry of group) {
      if (entry.name !== keep.name) {
        suggestions.push({ from: entry.name, into: keep.name });
      }
    }
  }

  const options: MergeLocationOption[] = locations;

  return (
    <AdminPageWrapper
      title="Merge duplicate locations"
      description="Fold a duplicate venue name into the real one — its history moves across, then the duplicate is removed"
    >
      <MergeContent
        locations={options}
        orphanNames={orphanNames}
        shiftCounts={shiftCounts}
        suggestions={suggestions}
      />
    </AdminPageWrapper>
  );
}
