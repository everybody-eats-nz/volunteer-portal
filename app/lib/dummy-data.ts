/**
 * Dummy data matching the web app's Prisma schema.
 * Replace with real API calls once mobile auth endpoints are built.
 */

import type { User } from './auth';

export const DUMMY_USER: User = {
  id: 'demo-user-1',
  name: 'Aroha Williams',
  email: 'aroha@example.com',
  role: 'VOLUNTEER',
  image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
  profileComplete: true,
};

export type UserProfile = User & {
  firstName: string;
  lastName: string;
  phone: string;
  pronouns: string;
  volunteerGrade: 'GREEN' | 'YELLOW' | 'PINK';
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  totalShifts: number;
  memberSince: string;
};

export const DUMMY_PROFILE: UserProfile = {
  ...DUMMY_USER,
  firstName: 'Aroha',
  lastName: 'Williams',
  phone: '021 123 4567',
  pronouns: 'she/her',
  volunteerGrade: 'YELLOW',
  emergencyContactName: 'Hemi Williams',
  emergencyContactRelationship: 'Partner',
  emergencyContactPhone: '021 765 4321',
  totalShifts: 23,
  memberSince: '2025-06-15',
};

export type ShiftType = {
  id: string;
  name: string;
  description: string;
};

export const SHIFT_TYPES: ShiftType[] = [
  { id: 'st-foh', name: 'Front of House', description: 'Greeting guests, serving food, clearing tables' },
  { id: 'st-prep', name: 'Kitchen Prep', description: 'Preparing ingredients and cooking' },
  { id: 'st-service', name: 'Kitchen Service & Pack Down', description: 'Plating, serving from kitchen, and cleanup' },
];

export type CrewMember = {
  id: string;
  name: string;
  role: string;
  grade: 'GREEN' | 'YELLOW' | 'PINK';
  checkedIn: boolean;
  isYou?: boolean;
};

/** Dummy crew for shift-1 (and reused for others) */
export const SHIFT_CREW: Record<string, CrewMember[]> = {
  'shift-1': [
    { id: 'u-1', name: 'Aroha Williams', role: 'Front of House', grade: 'YELLOW', checkedIn: true, isYou: true },
    { id: 'u-2', name: 'Sarah Chen', role: 'Front of House', grade: 'GREEN', checkedIn: true },
    { id: 'u-3', name: 'James Tūhoe', role: 'Front of House', grade: 'PINK', checkedIn: true },
    { id: 'u-4', name: 'Mia Johnson', role: 'Front of House', grade: 'GREEN', checkedIn: false },
    { id: 'u-5', name: 'Liam Patel', role: 'Front of House', grade: 'GREEN', checkedIn: false },
    { id: 'u-6', name: 'Te Rina Kahurangi', role: 'Front of House', grade: 'YELLOW', checkedIn: false },
  ],
  'shift-2': [
    { id: 'u-1', name: 'Aroha Williams', role: 'Kitchen Prep', grade: 'YELLOW', checkedIn: false, isYou: true },
    { id: 'u-7', name: 'Hana Patel', role: 'Kitchen Prep', grade: 'GREEN', checkedIn: false },
    { id: 'u-8', name: 'Wiremu Davis', role: 'Kitchen Prep', grade: 'PINK', checkedIn: false },
    { id: 'u-9', name: 'Olivia Ma', role: 'Kitchen Prep', grade: 'GREEN', checkedIn: false },
  ],
};

export type Shift = {
  id: string;
  shiftType: ShiftType;
  start: string; // ISO date
  end: string;
  location: string;
  capacity: number;
  signedUp: number;
  status?: 'CONFIRMED' | 'PENDING' | 'WAITLISTED' | null;
  notes?: string;
};

// Generate dates relative to today
function daysFromNow(days: number, hour: number, minute: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Shifts the user is signed up for */
export const MY_SHIFTS: Shift[] = [
  {
    id: 'shift-1',
    shiftType: SHIFT_TYPES[0], // Front of House
    start: daysFromNow(2, 16, 30),
    end: daysFromNow(2, 20, 30),
    location: 'Wellington',
    capacity: 8,
    signedUp: 6,
    status: 'CONFIRMED',
  },
  {
    id: 'shift-2',
    shiftType: SHIFT_TYPES[1], // Kitchen Prep
    start: daysFromNow(5, 13, 0),
    end: daysFromNow(5, 17, 0),
    location: 'Glen Innes',
    capacity: 6,
    signedUp: 4,
    status: 'CONFIRMED',
  },
  {
    id: 'shift-3',
    shiftType: SHIFT_TYPES[2], // Kitchen Service
    start: daysFromNow(9, 16, 0),
    end: daysFromNow(9, 21, 0),
    location: 'Onehunga',
    capacity: 10,
    signedUp: 10,
    status: 'WAITLISTED',
  },
];

/** Available shifts to browse */
export const AVAILABLE_SHIFTS: Shift[] = [
  {
    id: 'shift-4',
    shiftType: SHIFT_TYPES[0],
    start: daysFromNow(3, 16, 30),
    end: daysFromNow(3, 20, 30),
    location: 'Wellington',
    capacity: 8,
    signedUp: 3,
    notes: '2 spots urgently needed!',
  },
  {
    id: 'shift-5',
    shiftType: SHIFT_TYPES[1],
    start: daysFromNow(4, 13, 0),
    end: daysFromNow(4, 17, 0),
    location: 'Glen Innes',
    capacity: 6,
    signedUp: 5,
  },
  {
    id: 'shift-6',
    shiftType: SHIFT_TYPES[2],
    start: daysFromNow(6, 16, 0),
    end: daysFromNow(6, 21, 0),
    location: 'Onehunga',
    capacity: 10,
    signedUp: 7,
  },
  {
    id: 'shift-7',
    shiftType: SHIFT_TYPES[0],
    start: daysFromNow(7, 16, 30),
    end: daysFromNow(7, 20, 30),
    location: 'Wellington',
    capacity: 8,
    signedUp: 8,
  },
  {
    id: 'shift-8',
    shiftType: SHIFT_TYPES[1],
    start: daysFromNow(10, 13, 0),
    end: daysFromNow(10, 17, 0),
    location: 'Glen Innes',
    capacity: 6,
    signedUp: 2,
  },
];

/** Feed item types */
export type FeedItem =
  | { type: 'announcement'; id: string; title: string; body: string; timestamp: string; author: string }
  | { type: 'new_shift'; id: string; shift: Shift; timestamp: string }
  | { type: 'achievement'; id: string; userName: string; achievementName: string; achievementIcon: string; description: string; timestamp: string; isFriend: boolean }
  | { type: 'milestone'; id: string; userName: string; count: number; timestamp: string; isFriend: boolean };

function hoursAgo(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

export const FEED_ITEMS: FeedItem[] = [
  {
    type: 'announcement',
    id: 'feed-1',
    title: 'New Location Opening!',
    body: "We're excited to announce that our Onehunga kitchen is now open for evening service on Thursdays. Sign up for shifts now!",
    timestamp: hoursAgo(2),
    author: 'Everybody Eats Team',
  },
  {
    type: 'achievement',
    id: 'feed-2',
    userName: 'Sarah Chen',
    achievementName: 'Making a Difference',
    achievementIcon: 'star',
    description: 'Completed 10 volunteer shifts',
    timestamp: hoursAgo(4),
    isFriend: true,
  },
  {
    type: 'new_shift',
    id: 'feed-3',
    shift: AVAILABLE_SHIFTS[0],
    timestamp: hoursAgo(5),
  },
  {
    type: 'milestone',
    id: 'feed-4',
    userName: 'James Tūhoe',
    count: 50,
    timestamp: hoursAgo(8),
    isFriend: true,
  },
  {
    type: 'achievement',
    id: 'feed-5',
    userName: 'You',
    achievementName: 'Getting Started',
    achievementIcon: 'ribbon',
    description: 'Completed 5 volunteer shifts',
    timestamp: hoursAgo(12),
    isFriend: false,
  },
  {
    type: 'announcement',
    id: 'feed-6',
    title: 'Kitchen Safety Refresher',
    body: 'All volunteers please review the updated kitchen safety guidelines before your next shift. Check the Chat tab if you have questions!',
    timestamp: hoursAgo(24),
    author: 'Aroha (Head Chef)',
  },
  {
    type: 'new_shift',
    id: 'feed-7',
    shift: AVAILABLE_SHIFTS[2],
    timestamp: hoursAgo(26),
  },
  {
    type: 'achievement',
    id: 'feed-8',
    userName: 'Mia Johnson',
    achievementName: 'First Steps',
    achievementIcon: 'footsteps',
    description: 'Completed first volunteer shift',
    timestamp: hoursAgo(30),
    isFriend: true,
  },
];
