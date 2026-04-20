import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

import { LOCATION_ADDRESSES, type Shift } from "./dummy-data";

const SHIFT_EVENT_MAP_KEY = "@ee/calendar-shift-events";
const CALENDAR_SYNC_ENABLED_KEY = "@ee/calendar-sync-enabled";
const SHIFT_URL_BASE = "https://volunteers.everybodyeats.nz/shifts";
const NZ_TZ = "Pacific/Auckland";

type ShiftEventMap = Record<string, string>;

/* ── Persistence ── */

async function loadMap(): Promise<ShiftEventMap> {
  try {
    const raw = await AsyncStorage.getItem(SHIFT_EVENT_MAP_KEY);
    return raw ? (JSON.parse(raw) as ShiftEventMap) : {};
  } catch {
    return {};
  }
}

async function saveMap(map: ShiftEventMap): Promise<void> {
  await AsyncStorage.setItem(SHIFT_EVENT_MAP_KEY, JSON.stringify(map));
}

export async function isCalendarSyncEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(CALENDAR_SYNC_ENABLED_KEY);
  return raw === "1";
}

async function writeEnabledFlag(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(CALENDAR_SYNC_ENABLED_KEY, enabled ? "1" : "0");
}

/* ── Permissions ── */

async function ensurePermission(): Promise<boolean> {
  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Calendar.requestCalendarPermissionsAsync();
  return next.granted;
}

/* ── Event shape (mirrors server ICS so calendars dedupe visually) ── */

function buildTitle(shift: Shift): string {
  return `Everybody Eats - ${shift.shiftType.name}`;
}

function buildLocation(shift: Shift): string {
  const address = LOCATION_ADDRESSES[shift.location] ?? shift.location;
  return `Everybody Eats, ${address}`;
}

function buildShiftUrl(shiftId: string): string {
  return `${SHIFT_URL_BASE}/${shiftId}`;
}

function buildNotes(shift: Shift): string {
  const url = buildShiftUrl(shift.id);
  const desc = shift.shiftType.description ?? "";
  return [desc, `View shift details: ${url}`]
    .filter((p) => p.length > 0)
    .join("\n\n");
}

/* ── Calendar selection ── */

async function getWritableCalendarId(): Promise<string | null> {
  if (Platform.OS === "ios") {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def?.allowsModifications) return def.id;
    } catch {
      // fall through
    }
  }
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT
  );
  const writable =
    calendars.find((c) => c.allowsModifications && c.isPrimary) ??
    calendars.find((c) => c.allowsModifications);
  return writable?.id ?? null;
}

/* ── Dedup search: avoid creating a duplicate of the email .ics event ── */

async function findExistingEvent(
  shift: Shift
): Promise<Calendar.Event | null> {
  const start = new Date(shift.start);
  const end = new Date(shift.end);
  const windowStart = new Date(start.getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(end.getTime() + 60 * 60 * 1000);

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT
  );
  const calendarIds = calendars.map((c) => c.id);
  if (calendarIds.length === 0) return null;

  const events = await Calendar.getEventsAsync(
    calendarIds,
    windowStart,
    windowEnd
  );
  const url = buildShiftUrl(shift.id);
  const title = buildTitle(shift);

  return (
    events.find((e) => {
      // Strongest signal: matching shift URL
      if ((e as { url?: string }).url?.includes(url)) return true;
      if (e.notes?.includes(url)) return true;
      // Fallback: email's .ics title + same start minute
      if (e.title === title) {
        const es = new Date(e.startDate as string | number).getTime();
        if (Math.abs(es - start.getTime()) < 60 * 1000) return true;
      }
      return false;
    }) ?? null
  );
}

/* ── Verify a tracked event still exists ── */

async function eventStillExists(eventId: string): Promise<boolean> {
  try {
    const ev = await Calendar.getEventAsync(eventId);
    return !!ev;
  } catch {
    return false;
  }
}

/* ── Public API ── */

export type SyncStatus =
  | { ok: true }
  | { ok: false; reason: "permission" | "no-calendar" };

export async function addShiftToCalendar(shift: Shift): Promise<SyncStatus> {
  // Don't add shifts that have already ended.
  if (new Date(shift.end).getTime() <= Date.now()) return { ok: true };

  if (!(await ensurePermission())) return { ok: false, reason: "permission" };

  const map = await loadMap();

  if (map[shift.id] && (await eventStillExists(map[shift.id]))) {
    return { ok: true };
  }

  const existing = await findExistingEvent(shift);
  if (existing) {
    map[shift.id] = existing.id;
    await saveMap(map);
    return { ok: true };
  }

  const calendarId = await getWritableCalendarId();
  if (!calendarId) return { ok: false, reason: "no-calendar" };

  const eventId = await Calendar.createEventAsync(calendarId, {
    title: buildTitle(shift),
    startDate: new Date(shift.start),
    endDate: new Date(shift.end),
    location: buildLocation(shift),
    notes: buildNotes(shift),
    timeZone: NZ_TZ,
    alarms: [{ relativeOffset: -60 }],
    ...(Platform.OS === "ios" ? { url: buildShiftUrl(shift.id) } : {}),
  });

  map[shift.id] = eventId;
  await saveMap(map);
  return { ok: true };
}

export async function removeShiftFromCalendar(shiftId: string): Promise<void> {
  const perms = await Calendar.getCalendarPermissionsAsync();
  if (!perms.granted) return;

  const map = await loadMap();
  const eventId = map[shiftId];
  if (!eventId) return;

  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // Already gone — ignore
  }
  delete map[shiftId];
  await saveMap(map);
}

/**
 * Reconcile the device calendar with the user's current shift list.
 * - Adds events for shifts we haven't tracked yet (dedup checks run first).
 * - Removes events for shifts no longer in the list (cancellations, etc).
 * No-op when sync is disabled or permission is denied.
 */
export async function syncShifts(shifts: Shift[]): Promise<void> {
  if (!(await isCalendarSyncEnabled())) return;
  const perms = await Calendar.getCalendarPermissionsAsync();
  if (!perms.granted) return;

  // Only sync upcoming shifts the user is actually locked in for.
  // Past shifts stay out of the calendar — no point back-dating events.
  const now = Date.now();
  const eligible = shifts.filter(
    (s) =>
      (s.status === "CONFIRMED" || s.status === "PENDING") &&
      new Date(s.end).getTime() > now
  );
  const ids = new Set(eligible.map((s) => s.id));

  const map = await loadMap();

  for (const [shiftId, eventId] of Object.entries(map)) {
    if (ids.has(shiftId)) continue;
    try {
      await Calendar.deleteEventAsync(eventId);
    } catch {
      // Already gone
    }
    delete map[shiftId];
  }
  await saveMap(map);

  for (const shift of eligible) {
    if (map[shift.id]) continue;
    try {
      await addShiftToCalendar(shift);
    } catch {
      // Best-effort: skip this shift, try the next one
    }
  }
}

/**
 * Flip the user-facing "sync to calendar" setting. When enabling, requests
 * permission and runs an initial reconcile against the provided shifts.
 * Returns whether the toggle landed in the requested state.
 */
export async function setCalendarSyncEnabled(
  enabled: boolean,
  shifts?: Shift[]
): Promise<boolean> {
  if (!enabled) {
    await writeEnabledFlag(false);
    return true;
  }
  const granted = await ensurePermission();
  if (!granted) {
    await writeEnabledFlag(false);
    return false;
  }
  await writeEnabledFlag(true);
  if (shifts && shifts.length > 0) {
    await syncShifts(shifts);
  }
  return true;
}
