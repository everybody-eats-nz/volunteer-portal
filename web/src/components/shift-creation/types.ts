export interface TemplateOption {
  id: string;
  name: string;
  shiftTypeId: string;
  shiftTypeName: string;
  location: string;
  startTime: string;
  endTime: string;
  capacity: number;
  notes: string;
}

export interface ShiftTypeOption {
  id: string;
  name: string;
}

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export function templateTestId(name: string): string {
  return `template-${name.toLowerCase().replace(/\s+/g, "-")}-checkbox`;
}

/**
 * Template names often embed their location ("Glen Innes Dishwasher"). When
 * shown under a location group header, drop the redundant prefix. The full
 * name is still what gets submitted - this is display only.
 */
export function templateDisplayName(name: string, location: string): string {
  if (location && name.toLowerCase().startsWith(location.toLowerCase())) {
    const trimmed = name.slice(location.length).trim();
    if (trimmed.length > 0) return trimmed;
  }
  return name;
}

/** Group templates by location, following the order of known locations. */
export function groupTemplatesByLocation(
  templates: TemplateOption[],
  sortedLocations: readonly string[]
): [string, TemplateOption[]][] {
  const groups = new Map<string, TemplateOption[]>();
  for (const template of templates) {
    const key = template.location || "General";
    const list = groups.get(key) ?? [];
    list.push(template);
    groups.set(key, list);
  }
  const ordered: [string, TemplateOption[]][] = [];
  for (const location of sortedLocations) {
    const list = groups.get(location);
    if (list) {
      ordered.push([location, list]);
      groups.delete(location);
    }
  }
  // Any locations not in the canonical list (e.g. "General") come last.
  for (const [location, list] of groups) {
    ordered.push([location, list]);
  }
  return ordered;
}
