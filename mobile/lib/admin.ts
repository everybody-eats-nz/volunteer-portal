import { api } from "./api";
import type { TeamMessage } from "./messages";

/**
 * Admin API client — talks to the JWT-authed /api/mobile/admin/* routes.
 * Every call requires the signed-in user to be an ADMIN; the server returns
 * 403 otherwise.
 */

export type ThreadStatus = "OPEN" | "RESOLVED";
export type SignupStatus =
  | "PENDING"
  | "REGULAR_PENDING"
  | "CONFIRMED"
  | "WAITLISTED"
  | "CANCELED"
  | "NO_SHOW";

export interface AdminThreadVolunteer {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  defaultLocation: string | null;
}

export interface AdminThreadListItem {
  id: string;
  status: ThreadStatus;
  lastMessageAt: string;
  unreadForTeam: boolean;
  lastMessage: {
    body: string;
    senderRole: "VOLUNTEER" | "ADMIN";
    createdAt: string;
  } | null;
  volunteer: AdminThreadVolunteer;
}

export interface AdminThreadDetail {
  thread: {
    id: string;
    status: ThreadStatus;
    lastMessageAt: string;
    volunteer: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      name: string | null;
      email: string;
      phone: string | null;
      profilePhotoUrl: string | null;
      defaultLocation: string | null;
      volunteerGrade: "GREEN" | "YELLOW" | "PINK";
    };
  };
  messages: TeamMessage[];
  upcomingShiftCount: number;
}

export interface TodayShiftSignup {
  id: string;
  status: SignupStatus;
  volunteer: {
    id: string;
    name: string;
    profilePhotoUrl: string | null;
  };
}

export interface TodayShift {
  id: string;
  start: string;
  end: string;
  location: string | null;
  capacity: number;
  shiftTypeName: string;
  confirmedCount: number;
  pendingCount: number;
  waitlistedCount: number;
  fillGap: number;
  signups: TodayShiftSignup[];
}

export interface PendingSignup {
  id: string;
  status: SignupStatus;
  createdAt: string;
  volunteer: {
    id: string;
    name: string;
    email: string;
    profilePhotoUrl: string | null;
    volunteerGrade: "GREEN" | "YELLOW" | "PINK";
  };
  shift: {
    id: string;
    start: string;
    end: string;
    location: string | null;
    capacity: number;
    confirmedCount: number;
    shiftTypeName: string;
  };
}

export type SignupAction =
  | "approve"
  | "reject"
  | "cancel"
  | "confirm"
  | "mark_present"
  | "mark_absent";

/* ─── Messaging ──────────────────────────────────────────────── */

interface ThreadListOptions {
  status?: ThreadStatus | "ALL";
  unreadOnly?: boolean;
  search?: string;
}

export function fetchAdminThreads(
  opts: ThreadListOptions = {}
): Promise<{ threads: AdminThreadListItem[] }> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.unreadOnly) params.set("unread", "true");
  if (opts.search) params.set("q", opts.search);
  const qs = params.toString();
  return api<{ threads: AdminThreadListItem[] }>(
    `/api/mobile/admin/messages/threads${qs ? `?${qs}` : ""}`
  );
}

export function fetchAdminThread(id: string): Promise<AdminThreadDetail> {
  return api<AdminThreadDetail>(`/api/mobile/admin/messages/threads/${id}`);
}

export function sendAdminMessage(
  threadId: string,
  body: string
): Promise<{ message: TeamMessage }> {
  return api<{ message: TeamMessage }>(
    `/api/mobile/admin/messages/threads/${threadId}/messages`,
    { method: "POST", body: { body } }
  );
}

export function markAdminThreadRead(threadId: string): Promise<{ ok: true }> {
  return api<{ ok: true }>(
    `/api/mobile/admin/messages/threads/${threadId}/read`,
    { method: "POST" }
  );
}

export function resolveAdminThread(
  threadId: string,
  status: ThreadStatus
): Promise<{ ok: true; status: ThreadStatus }> {
  return api<{ ok: true; status: ThreadStatus }>(
    `/api/mobile/admin/messages/threads/${threadId}/resolve`,
    { method: "POST", body: { status } }
  );
}

export function fetchAdminUnreadCount(): Promise<{ count: number }> {
  return api<{ count: number }>("/api/mobile/admin/messages/unread-count");
}

/* ─── Shifts ─────────────────────────────────────────────────── */

export function fetchAdminToday(
  date?: string,
  location?: string
): Promise<{ date: string; shifts: TodayShift[] }> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (location) params.set("location", location);
  const qs = params.toString();
  return api<{ date: string; shifts: TodayShift[] }>(
    `/api/mobile/admin/shifts/today${qs ? `?${qs}` : ""}`
  );
}

/* ─── Approvals ──────────────────────────────────────────────── */

export function fetchAdminPending(
  location?: string
): Promise<{ signups: PendingSignup[] }> {
  const qs = location ? `?location=${encodeURIComponent(location)}` : "";
  return api<{ signups: PendingSignup[] }>(
    `/api/mobile/admin/signups/pending${qs}`
  );
}

export function actOnSignup(
  signupId: string,
  action: SignupAction,
  opts: { sendEmail?: boolean; skipNotification?: boolean } = {}
): Promise<{ status: SignupStatus; message: string }> {
  return api<{ status: SignupStatus; message: string }>(
    `/api/mobile/admin/signups/${signupId}`,
    { method: "POST", body: { action, ...opts } }
  );
}
