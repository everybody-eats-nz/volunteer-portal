import type { Role } from "@/generated/client";

export interface SerializedThread {
  id: string;
  status: "OPEN" | "RESOLVED";
  lastMessageAt: string;
  unreadForTeam: boolean;
  lastMessage: {
    body: string;
    senderRole: Role;
    createdAt: string;
  } | null;
  volunteer: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profilePhotoUrl: string | null;
    defaultLocation: string | null;
  };
}

export interface SerializedMessage {
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

export interface ThreadDetail {
  id: string;
  status: "OPEN" | "RESOLVED";
  volunteerLastReadAt: string | null;
  teamLastReadAt: string | null;
  volunteer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string;
    phone: string | null;
    profilePhotoUrl: string | null;
    defaultLocation: string | null;
    volunteerGrade: string;
    createdAt: string;
  };
  upcomingShiftCount: number;
}

export interface InboxRealtimeEvent {
  kind: "direct_message";
  threadId: string;
  directMessage: {
    id: string;
    body: string;
    senderId: string;
    senderRole: Role;
    createdAt: string;
  };
  volunteer: {
    id: string;
    name: string;
  };
}
