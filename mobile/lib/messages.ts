import { api } from "./api";

export type Role = "VOLUNTEER" | "ADMIN";

export interface TeamMessage {
  id: string;
  body: string;
  senderId: string;
  senderRole: Role;
  createdAt: string;
  sender: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    profilePhotoUrl: string | null;
  };
}

export interface DayHours {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface HoursStatus {
  location: string | null;
  isOpenNow: boolean;
  todayHours: DayHours;
  nextOpenLabel: string | null;
}

export interface ThreadFetchResult {
  thread: {
    id: string;
    status: "OPEN" | "RESOLVED";
    lastMessageAt: string;
    unread: boolean;
  };
  messages: TeamMessage[];
  hours: HoursStatus | null;
}

export function fetchTeamThread(): Promise<ThreadFetchResult> {
  return api<ThreadFetchResult>("/api/mobile/messages/thread");
}

export function sendTeamMessage(body: string): Promise<{ message: TeamMessage }> {
  return api<{ message: TeamMessage }>("/api/mobile/messages/thread/messages", {
    method: "POST",
    body: { body },
  });
}

export function markTeamThreadRead(): Promise<{ ok: true }> {
  return api<{ ok: true }>("/api/mobile/messages/thread", {
    method: "POST",
  });
}
