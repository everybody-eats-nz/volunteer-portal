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