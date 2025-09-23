/**
 * Utility functions for shift operations
 */

/**
 * Determines if a shift has completed by comparing the shift end time to the current time
 * @param shiftEnd - The end date/time of the shift (as Date object or string)
 * @returns true if the shift has ended, false otherwise
 */
export function isShiftCompleted(shiftEnd: Date | string | null | undefined): boolean {
  if (!shiftEnd) {
    return false;
  }
  
  const endDate = shiftEnd instanceof Date ? shiftEnd : new Date(shiftEnd);
  const now = new Date();
  
  return now > endDate;
}

/**
 * Determines if a shift is currently in progress
 * @param shiftStart - The start date/time of the shift
 * @param shiftEnd - The end date/time of the shift
 * @returns true if the shift is currently running, false otherwise
 */
export function isShiftInProgress(
  shiftStart: Date | string | null | undefined,
  shiftEnd: Date | string | null | undefined
): boolean {
  if (!shiftStart || !shiftEnd) {
    return false;
  }
  
  const startDate = shiftStart instanceof Date ? shiftStart : new Date(shiftStart);
  const endDate = shiftEnd instanceof Date ? shiftEnd : new Date(shiftEnd);
  const now = new Date();
  
  return now >= startDate && now <= endDate;
}

/**
 * Determines if a shift is upcoming (hasn't started yet)
 * @param shiftStart - The start date/time of the shift
 * @returns true if the shift hasn't started yet, false otherwise
 */
export function isShiftUpcoming(shiftStart: Date | string | null | undefined): boolean {
  if (!shiftStart) {
    return false;
  }
  
  const startDate = shiftStart instanceof Date ? shiftStart : new Date(shiftStart);
  const now = new Date();
  
  return now < startDate;
}

/**
 * Gets the status of a shift based on its start and end times
 * @param shiftStart - The start date/time of the shift
 * @param shiftEnd - The end date/time of the shift
 * @returns 'upcoming' | 'in_progress' | 'completed'
 */
export function getShiftStatus(
  shiftStart: Date | string | null | undefined,
  shiftEnd: Date | string | null | undefined
): 'upcoming' | 'in_progress' | 'completed' {
  if (isShiftCompleted(shiftEnd)) {
    return 'completed';
  }
  
  if (isShiftInProgress(shiftStart, shiftEnd)) {
    return 'in_progress';
  }
  
  return 'upcoming';
}