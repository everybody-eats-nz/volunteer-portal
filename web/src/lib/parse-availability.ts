/**
 * Safely parse a stored locations list that might be in JSON format or plain
 * text. Migrated rows hold values like "Wellington" or "Wellington, Glen Innes"
 * instead of JSON arrays.
 *
 * Locations need their own parser: safeParseAvailability splits on spaces and
 * re-capitalizes, which mangles multi-word restaurant names ("Glen Innes"
 * becomes ["Glen", "Innes"]). Here the original casing is preserved and only
 * commas separate entries.
 */
export function safeParseLocations(data: string | null | undefined): string[] {
  if (!data?.trim()) return [];

  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } catch {
    // Not JSON — fall through to the legacy plain-text handling below
  }

  return data
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Rewrite a stored locations list (JSON array or legacy comma-separated text)
 * after a location rename. Matches whole entries only, so renaming
 * "Wellington" leaves an entry like "Wellington City" alone. Returns the
 * updated list serialized as JSON, or null when the list doesn't reference
 * oldName. Merging into a name already present dedupes rather than
 * duplicating the entry.
 */
export function renameLocationInStoredList(
  stored: string | null | undefined,
  oldName: string,
  newName: string
): string | null {
  const entries = safeParseLocations(stored);
  if (!entries.includes(oldName)) return null;

  const renamed: string[] = [];
  for (const entry of entries) {
    const value = entry === oldName ? newName : entry;
    if (!renamed.includes(value)) renamed.push(value);
  }
  return JSON.stringify(renamed);
}

/**
 * Safely parse availability data that might be in JSON format or plain text
 * Migration data might be stored as "weekdays" or "Monday, Tuesday" instead of JSON arrays
 */
export function safeParseAvailability(data: string | null | undefined): string[] {
  if (!data?.trim()) return [];
  
  // First, try to parse as JSON (for data stored in current format)
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => typeof item === 'string' && item.trim());
    }
  } catch {
    // If JSON parsing fails, treat as plain text (for migrated data)
  }
  
  // Handle common text formats for days/locations
  const text = data.toLowerCase().trim();
  
  // Handle "weekdays" pattern
  if (text === 'weekdays') {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  }
  
  // Handle "weekends" pattern  
  if (text === 'weekends') {
    return ['Saturday', 'Sunday'];
  }
  
  // Handle comma-separated values (e.g., "Monday, Wednesday, Friday")
  if (text.includes(',')) {
    return text.split(',').map(item => {
      const trimmed = item.trim();
      // Capitalize first letter for consistency
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }).filter(Boolean);
  }
  
  // Handle space-separated values (e.g., "Monday Wednesday Friday")
  if (text.includes(' ') && !text.includes('-') && !text.includes('_')) {
    return text.split(/\s+/).map(item => {
      const trimmed = item.trim();
      // Capitalize first letter for consistency
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }).filter(Boolean);
  }
  
  // Single value - capitalize and return as array
  return [text.charAt(0).toUpperCase() + text.slice(1)];
}