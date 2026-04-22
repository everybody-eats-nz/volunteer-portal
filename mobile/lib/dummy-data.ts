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
  medicalConditions: string;
  notificationPreference: 'EMAIL' | 'SMS' | 'BOTH' | 'NONE';
  receiveShortageNotifications: boolean;
  excludedShortageNotificationTypes: string[];
  emailNewsletterSubscription: boolean;
  newsletterLists: string[];
  defaultLocation: string | null;
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
  medicalConditions: '',
  notificationPreference: 'EMAIL',
  receiveShortageNotifications: true,
  excludedShortageNotificationTypes: [],
  emailNewsletterSubscription: true,
  newsletterLists: [],
  defaultLocation: null,
  totalShifts: 23,
  memberSince: '2025-06-15',
};

export type ShiftType = {
  id: string;
  name: string;
  description: string;
};

/** Emoji + color theming by shift type NAME — matches web app's shift-themes.ts */
export type ShiftTypeTheme = {
  emoji: string;
  color: string;
  colorDark: string;
  bgLight: string;
  bgDark: string;
  heroImage?: string;
};

export const SHIFT_TYPE_THEMES_BY_NAME: Record<string, ShiftTypeTheme> = {
  'Front of House': {
    emoji: '🌟',
    color: '#16a34a',
    colorDark: '#86efac',
    bgLight: '#f0fdf4',
    bgDark: 'rgba(22, 163, 74, 0.12)',
    heroImage: 'https://cdn.prod.website-files.com/66d7cb82647de44647142131/66da1b4267d61fe68398d065_280443354_2008401622656620_5596744644117168718_n.jpg',
  },
  'Kitchen Prep': {
    emoji: '🔪',
    color: '#ea580c',
    colorDark: '#fb923c',
    bgLight: '#fff7ed',
    bgDark: 'rgba(234, 88, 12, 0.12)',
    heroImage: 'https://cdn.prod.website-files.com/66d7cb82647de44647142131/66da1b3ff05e25dfe4f25db3_260078656_1880774448752672_8447810127498984605_n.jpg',
  },
  'Kitchen Service & Pack Down': {
    emoji: '📦',
    color: '#7c3aed',
    colorDark: '#a78bfa',
    bgLight: '#f5f3ff',
    bgDark: 'rgba(124, 58, 237, 0.12)',
    heroImage: 'https://cdn.prod.website-files.com/66d7cb82647de44647142131/66da1b42f46ae80d24cbef3e_280398558_2008401602656622_8497750126913093706_n.jpg',
  },
  'FOH Set-Up & Service': {
    emoji: '✨',
    color: '#9333ea',
    colorDark: '#c084fc',
    bgLight: '#faf5ff',
    bgDark: 'rgba(147, 51, 234, 0.12)',
  },
  'Kitchen': {
    emoji: '🧽',
    color: '#2563eb',
    colorDark: '#60a5fa',
    bgLight: '#eff6ff',
    bgDark: 'rgba(37, 99, 235, 0.12)',
  },
  'Kitchen Prep & Service': {
    emoji: '🍳',
    color: '#dc2626',
    colorDark: '#f87171',
    bgLight: '#fef2f2',
    bgDark: 'rgba(220, 38, 38, 0.12)',
  },
  'Dishwasher': {
    emoji: '🧽',
    color: '#2563eb',
    colorDark: '#60a5fa',
    bgLight: '#eff6ff',
    bgDark: 'rgba(37, 99, 235, 0.12)',
  },
  'FOH': {
    emoji: '✨',
    color: '#9333ea',
    colorDark: '#c084fc',
    bgLight: '#faf5ff',
    bgDark: 'rgba(147, 51, 234, 0.12)',
  },
  'Media Role': {
    emoji: '📷',
    color: '#db2777',
    colorDark: '#f472b6',
    bgLight: '#fdf2f8',
    bgDark: 'rgba(219, 39, 119, 0.12)',
  },
};

const DEFAULT_SHIFT_TYPE_THEME: ShiftTypeTheme = {
  emoji: '👥',
  color: '#0e3a23',
  colorDark: '#86efac',
  bgLight: '#e8f5e8',
  bgDark: 'rgba(14, 58, 35, 0.2)',
};

export function getShiftThemeByName(name: string): ShiftTypeTheme {
  return SHIFT_TYPE_THEMES_BY_NAME[name] ?? DEFAULT_SHIFT_TYPE_THEME;
}

/** Volunteer signup info for display on shift detail (before check-in) */
export type ShiftSignup = {
  id: string;
  name: string;
  profilePhotoUrl?: string;
  isFriend: boolean;
};

export const SHIFT_SIGNUPS: Record<string, ShiftSignup[]> = {
  'shift-1b': [
    { id: 'u-7', name: 'Hana Patel', profilePhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-8', name: 'Wiremu Davis', isFriend: false },
    { id: 'u-9', name: 'Olivia Ma', profilePhotoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', isFriend: false },
    { id: 'u-10', name: 'Rangi Hohepa', isFriend: false },
  ],
  'shift-1c': [
    { id: 'u-4', name: 'Mia Johnson', profilePhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-11', name: 'Tom Rivers', isFriend: false },
    { id: 'u-12', name: 'Kara Lee', profilePhotoUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face', isFriend: false },
    { id: 'u-13', name: 'Rahi Moana', isFriend: false },
    { id: 'u-14', name: 'Ella Wright', profilePhotoUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&h=200&fit=crop&crop=face', isFriend: false },
  ],
  'shift-1': [
    { id: 'u-1', name: 'You', profilePhotoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', isFriend: false },
    { id: 'u-2', name: 'Sarah Chen', profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-3', name: 'James Tūhoe', profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-4', name: 'Mia Johnson', profilePhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-5', name: 'Liam Patel', isFriend: false },
    { id: 'u-6', name: 'Te Rina Kahurangi', profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face', isFriend: false },
  ],
  'shift-2': [
    { id: 'u-1', name: 'You', profilePhotoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', isFriend: false },
    { id: 'u-7', name: 'Hana Patel', profilePhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-8', name: 'Wiremu Davis', isFriend: false },
    { id: 'u-9', name: 'Olivia Ma', profilePhotoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', isFriend: false },
  ],
  'shift-3': [
    { id: 'u-1', name: 'You', profilePhotoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', isFriend: false },
    { id: 'u-2', name: 'Sarah Chen', profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-3', name: 'James Tūhoe', profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face', isFriend: true },
  ],
  'shift-4': [
    { id: 'u-2', name: 'Sarah Chen', profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-8', name: 'Wiremu Davis', isFriend: false },
    { id: 'u-6', name: 'Te Rina Kahurangi', profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face', isFriend: false },
  ],
  'shift-5': [
    { id: 'u-7', name: 'Hana Patel', profilePhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-4', name: 'Mia Johnson', profilePhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-9', name: 'Olivia Ma', profilePhotoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', isFriend: false },
    { id: 'u-5', name: 'Liam Patel', isFriend: false },
    { id: 'u-3', name: 'James Tūhoe', profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face', isFriend: true },
  ],
  'shift-6': [
    { id: 'u-2', name: 'Sarah Chen', profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-4', name: 'Mia Johnson', profilePhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-5', name: 'Liam Patel', isFriend: false },
    { id: 'u-7', name: 'Hana Patel', profilePhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face', isFriend: true },
    { id: 'u-8', name: 'Wiremu Davis', isFriend: false },
    { id: 'u-9', name: 'Olivia Ma', profilePhotoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', isFriend: false },
    { id: 'u-6', name: 'Te Rina Kahurangi', profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face', isFriend: false },
  ],
};

/** Restaurant location addresses — matches web app's seed-production.ts */
export const LOCATION_ADDRESSES: Record<string, string> = {
  Wellington: '60 Dixon Street, Te Aro, Wellington, New Zealand',
  'Glen Innes': '133 Line Road, Glen Innes, Auckland, New Zealand',
  Onehunga: '306 Onehunga Mall, Auckland, New Zealand',
};

/** Short address for display (strips ", New Zealand") */
export function getLocationShortAddress(location: string): string {
  const full = LOCATION_ADDRESSES[location];
  return full ? full.replace(', New Zealand', '') : location;
}

/** Google Maps URL for a location */
export function getLocationMapsUrl(location: string): string {
  const address = LOCATION_ADDRESSES[location] ?? location;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Everybody Eats ${address}`)}`;
}

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
  'shift-1b': [
    { id: 'u-7', name: 'Hana Patel', role: 'Kitchen Prep', grade: 'GREEN', checkedIn: true },
    { id: 'u-8', name: 'Wiremu Davis', role: 'Kitchen Prep', grade: 'PINK', checkedIn: false },
    { id: 'u-9', name: 'Olivia Ma', role: 'Kitchen Prep', grade: 'GREEN', checkedIn: true },
    { id: 'u-10', name: 'Rangi Hohepa', role: 'Kitchen Prep', grade: 'YELLOW', checkedIn: false },
  ],
  'shift-1c': [
    { id: 'u-4', name: 'Mia Johnson', role: 'Kitchen Service', grade: 'GREEN', checkedIn: true },
    { id: 'u-11', name: 'Tom Rivers', role: 'Kitchen Service', grade: 'YELLOW', checkedIn: false },
    { id: 'u-12', name: 'Kara Lee', role: 'Kitchen Service', grade: 'GREEN', checkedIn: true },
    { id: 'u-13', name: 'Rahi Moana', role: 'Kitchen Service', grade: 'PINK', checkedIn: false },
    { id: 'u-14', name: 'Ella Wright', role: 'Kitchen Service', grade: 'GREEN', checkedIn: true },
  ],
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
  status?: 'CONFIRMED' | 'PENDING' | 'WAITLISTED' | 'REGULAR_PENDING' | null;
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

/** Past shifts the user has completed */
export const PAST_SHIFTS: Shift[] = [
  {
    id: 'shift-past-1',
    shiftType: SHIFT_TYPES[0], // Front of House
    start: daysFromNow(-3, 16, 30),
    end: daysFromNow(-3, 20, 30),
    location: 'Wellington',
    capacity: 8,
    signedUp: 8,
    status: 'CONFIRMED',
  },
  {
    id: 'shift-past-2',
    shiftType: SHIFT_TYPES[1], // Kitchen Prep
    start: daysFromNow(-7, 13, 0),
    end: daysFromNow(-7, 17, 0),
    location: 'Glen Innes',
    capacity: 6,
    signedUp: 6,
    status: 'CONFIRMED',
  },
  {
    id: 'shift-past-3',
    shiftType: SHIFT_TYPES[2], // Kitchen Service
    start: daysFromNow(-10, 16, 0),
    end: daysFromNow(-10, 21, 0),
    location: 'Wellington',
    capacity: 10,
    signedUp: 9,
    status: 'CONFIRMED',
  },
  {
    id: 'shift-past-4',
    shiftType: SHIFT_TYPES[0], // Front of House
    start: daysFromNow(-14, 16, 30),
    end: daysFromNow(-14, 20, 30),
    location: 'Onehunga',
    capacity: 8,
    signedUp: 7,
    status: 'CONFIRMED',
  },
  {
    id: 'shift-past-5',
    shiftType: SHIFT_TYPES[1], // Kitchen Prep
    start: daysFromNow(-21, 13, 0),
    end: daysFromNow(-21, 17, 0),
    location: 'Glen Innes',
    capacity: 6,
    signedUp: 5,
    status: 'CONFIRMED',
  },
];

/** Available shifts to browse */
export const AVAILABLE_SHIFTS: Shift[] = [
  // Concurrent with shift-1 (same day, Wellington, PM)
  {
    id: 'shift-1b',
    shiftType: SHIFT_TYPES[1], // Kitchen Prep
    start: daysFromNow(2, 16, 0),
    end: daysFromNow(2, 20, 0),
    location: 'Wellington',
    capacity: 6,
    signedUp: 4,
  },
  {
    id: 'shift-1c',
    shiftType: SHIFT_TYPES[2], // Kitchen Service & Pack Down
    start: daysFromNow(2, 16, 0),
    end: daysFromNow(2, 21, 0),
    location: 'Wellington',
    capacity: 8,
    signedUp: 5,
  },
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

/**
 * Get concurrent shifts — same date, same AM/PM period, same location.
 * Uses the web app's AM/PM split: before 4pm (hour < 16) = Day, 4pm onwards = Evening.
 */
export function getConcurrentShifts(shiftId: string): Shift[] {
  const allShifts = [...MY_SHIFTS, ...AVAILABLE_SHIFTS];
  const targetShift = allShifts.find((s) => s.id === shiftId);
  if (!targetShift) return [];

  const targetDate = new Date(targetShift.start);
  const targetDay = `${targetDate.getFullYear()}-${targetDate.getMonth()}-${targetDate.getDate()}`;
  const targetIsAM = targetDate.getHours() < 16;

  return allShifts.filter((s) => {
    if (s.id === shiftId) return false;
    if (s.location !== targetShift.location) return false;
    const d = new Date(s.start);
    const day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const isAM = d.getHours() < 16;
    return day === targetDay && isAM === targetIsAM;
  });
}

/** Like user */
export type LikeUser = {
  id: string;
  name: string;
  profilePhotoUrl?: string;
};

export type FeedComment = {
  id: string;
  userId: string;
  userName: string;
  profilePhotoUrl?: string;
  text: string;
  timestamp: string;
};

/** Reusable pool of dummy likers */
const LIKERS: LikeUser[] = [
  { id: 'u-2', name: 'Sarah Chen', profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face' },
  { id: 'u-3', name: 'James Tūhoe', profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face' },
  { id: 'u-4', name: 'Mia Johnson', profilePhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face' },
  { id: 'u-5', name: 'Liam Patel' },
  { id: 'u-6', name: 'Te Rina Kahurangi', profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face' },
  { id: 'u-7', name: 'Hana Patel', profilePhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face' },
  { id: 'u-8', name: 'Wiremu Davis' },
  { id: 'u-9', name: 'Olivia Ma', profilePhotoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face' },
];

/** Shared interaction fields present on every feed item */
type FeedInteractions = {
  likeCount: number;
  likedByMe: boolean;
  recentLikers: LikeUser[]; // top likers for the sheet
  commentCount: number;
};

/** Feed item types */
export type FeedItem =
  | ({ type: 'announcement'; id: string; title: string; body: string; imageUrl?: string; timestamp: string; author: string } & FeedInteractions)
  | ({ type: 'achievement'; id: string; userId?: string; userName: string; profilePhotoUrl?: string; achievementName: string; achievementIcon: string; description: string; timestamp: string; isFriend: boolean } & FeedInteractions)
  | ({ type: 'milestone'; id: string; userId?: string; userName: string; profilePhotoUrl?: string; count: number; timestamp: string; isFriend: boolean } & FeedInteractions)
  | ({ type: 'photo_post'; id: string; userId?: string; userName: string; profilePhotoUrl?: string; caption: string; photos: string[]; shiftDate: string; period: 'AM' | 'PM'; location: string; timestamp: string; isFriend: boolean } & FeedInteractions)
  | ({ type: 'friend_signup'; id: string; userId?: string; userName: string; profilePhotoUrl?: string; shiftTypeName: string; shiftDate: string; location: string; timestamp: string; isFriend: boolean } & FeedInteractions)
  | ({ type: 'shift_recap'; id: string; location: string; date: string; mealsServed: number; volunteerHours: number; volunteerCount: number; timestamp: string } & FeedInteractions);

/* ── Profile Stats & Achievements ── */

export type ProfileStats = {
  shiftsCompleted: number;
  hoursContributed: number;
  peopleServed: number;
  currentStreak: number; // consecutive months
};

export const DUMMY_STATS: ProfileStats = {
  shiftsCompleted: 23,
  hoursContributed: 89,
  peopleServed: 1340,
  currentStreak: 4,
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  category: 'MILESTONE' | 'DEDICATION' | 'SPECIALIZATION' | 'IMPACT' | 'COMMUNITY';
  points: number;
  unlockedAt?: string; // ISO date — if set, it's unlocked
  progress?: number; // 0-1, for in-progress achievements
  target?: string; // e.g. "50 shifts"
  unlockedByCount?: number; // how many volunteers have unlocked this
  friendsWhoEarned?: Array<{
    id: string;
    name: string;
    profilePhotoUrl?: string;
  }>;
};

export const DUMMY_ACHIEVEMENTS: Achievement[] = [
  // Unlocked
  {
    id: 'ach-1',
    name: 'First Steps',
    description: 'Complete your first volunteer shift',
    icon: '👣',
    category: 'MILESTONE',
    points: 10,
    unlockedAt: '2025-06-20T00:00:00Z',
  },
  {
    id: 'ach-2',
    name: 'Making a Difference',
    description: 'Complete 10 volunteer shifts',
    icon: '⭐',
    category: 'MILESTONE',
    points: 50,
    unlockedAt: '2025-09-15T00:00:00Z',
  },
  {
    id: 'ach-3',
    name: 'Regular',
    description: 'Volunteer for 3 consecutive months',
    icon: '🔥',
    category: 'DEDICATION',
    points: 75,
    unlockedAt: '2025-10-01T00:00:00Z',
  },
  {
    id: 'ach-4',
    name: 'Front of House Pro',
    description: 'Complete 5 Front of House shifts',
    icon: '🌟',
    category: 'SPECIALIZATION',
    points: 40,
    unlockedAt: '2025-11-10T00:00:00Z',
  },
  {
    id: 'ach-5',
    name: 'Century Club',
    description: 'Serve 1000+ meals',
    icon: '🍽️',
    category: 'IMPACT',
    points: 100,
    unlockedAt: '2026-01-20T00:00:00Z',
  },
  // In progress
  {
    id: 'ach-6',
    name: 'Kitchen Whiz',
    description: 'Complete 5 Kitchen Prep shifts',
    icon: '🔪',
    category: 'SPECIALIZATION',
    points: 40,
    progress: 0.6,
    target: '3 / 5 shifts',
  },
  {
    id: 'ach-7',
    name: 'Veteran',
    description: 'Complete 50 volunteer shifts',
    icon: '🏆',
    category: 'MILESTONE',
    points: 200,
    progress: 0.46,
    target: '23 / 50 shifts',
  },
  {
    id: 'ach-8',
    name: 'Ironclad',
    description: 'Volunteer for 6 consecutive months',
    icon: '💪',
    category: 'DEDICATION',
    points: 150,
    progress: 0.67,
    target: '4 / 6 months',
  },
];

/* ── Friends / Whānau ── */

export type Friend = {
  id: string;
  name: string;
  profilePhotoUrl?: string;
  grade: 'GREEN' | 'YELLOW' | 'PINK';
  shiftsTogether: number;
  mutualFriends: number;
  lastActive: string; // relative description
};

export const DUMMY_FRIENDS: Friend[] = [
  {
    id: 'u-2',
    name: 'Sarah Chen',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    grade: 'GREEN',
    shiftsTogether: 12,
    mutualFriends: 3,
    lastActive: 'Today',
  },
  {
    id: 'u-3',
    name: 'James Tūhoe',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    grade: 'PINK',
    shiftsTogether: 8,
    mutualFriends: 2,
    lastActive: 'Yesterday',
  },
  {
    id: 'u-4',
    name: 'Mia Johnson',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
    grade: 'GREEN',
    shiftsTogether: 5,
    mutualFriends: 4,
    lastActive: '2 days ago',
  },
  {
    id: 'u-7',
    name: 'Hana Patel',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
    grade: 'GREEN',
    shiftsTogether: 7,
    mutualFriends: 2,
    lastActive: 'Today',
  },
  {
    id: 'u-6',
    name: 'Te Rina Kahurangi',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
    grade: 'YELLOW',
    shiftsTogether: 3,
    mutualFriends: 1,
    lastActive: '1 week ago',
  },
];

export type FriendProfile = Friend & {
  lastName: string;
  friendsSince: string; // ISO date
  totalShifts: number;
  hoursVolunteered: number;
  shiftsThisMonth: number;
  avgPerMonth: number;
  favoriteRole: string;
  favoriteRoleCount: number;
  sharedShifts: Array<{
    id: string;
    type: string;
    date: string;
    location: string;
    isUpcoming: boolean;
  }>;
  upcomingShifts: Array<{
    id: string;
    type: string;
    date: string;
    time: string;
    location: string;
  }>;
};

export const DUMMY_FRIEND_PROFILES: Record<string, FriendProfile> = {
  'u-2': {
    ...DUMMY_FRIENDS[0],
    lastName: 'Chen',
    friendsSince: '2025-09-12T00:00:00Z',
    totalShifts: 34,
    hoursVolunteered: 128,
    shiftsThisMonth: 3,
    avgPerMonth: 4,
    favoriteRole: 'Front of House',
    favoriteRoleCount: 22,
    sharedShifts: [
      { id: 'ss-1', type: 'Evening', date: daysFromNow(2, 16).split('T')[0], location: 'Wellington', isUpcoming: true },
      { id: 'ss-2', type: 'Evening', date: daysFromNow(-3, 16).split('T')[0], location: 'Wellington', isUpcoming: false },
      { id: 'ss-3', type: 'Evening', date: daysFromNow(-10, 16).split('T')[0], location: 'Glen Innes', isUpcoming: false },
      { id: 'ss-4', type: 'Evening', date: daysFromNow(-17, 16).split('T')[0], location: 'Wellington', isUpcoming: false },
      { id: 'ss-5', type: 'Day', date: daysFromNow(-24, 13).split('T')[0], location: 'Wellington', isUpcoming: false },
    ],
    upcomingShifts: [
      { id: 'us-1', type: 'Front of House', date: daysFromNow(2, 16).split('T')[0], time: '4:30 PM', location: 'Wellington' },
      { id: 'us-2', type: 'Kitchen Prep', date: daysFromNow(6, 13).split('T')[0], time: '1:00 PM', location: 'Glen Innes' },
      { id: 'us-3', type: 'Front of House', date: daysFromNow(9, 16).split('T')[0], time: '4:30 PM', location: 'Onehunga' },
    ],
  },
  'u-3': {
    ...DUMMY_FRIENDS[1],
    lastName: 'Tūhoe',
    friendsSince: '2025-07-01T00:00:00Z',
    totalShifts: 52,
    hoursVolunteered: 196,
    shiftsThisMonth: 5,
    avgPerMonth: 6,
    favoriteRole: 'Kitchen Prep',
    favoriteRoleCount: 28,
    sharedShifts: [
      { id: 'ss-6', type: 'Evening', date: daysFromNow(2, 16).split('T')[0], location: 'Wellington', isUpcoming: true },
      { id: 'ss-7', type: 'Evening', date: daysFromNow(-7, 16).split('T')[0], location: 'Wellington', isUpcoming: false },
      { id: 'ss-8', type: 'Day', date: daysFromNow(-14, 13).split('T')[0], location: 'Glen Innes', isUpcoming: false },
    ],
    upcomingShifts: [
      { id: 'us-4', type: 'Front of House', date: daysFromNow(2, 16).split('T')[0], time: '4:30 PM', location: 'Wellington' },
      { id: 'us-5', type: 'Kitchen Prep', date: daysFromNow(4, 13).split('T')[0], time: '1:00 PM', location: 'Glen Innes' },
    ],
  },
  'u-4': {
    ...DUMMY_FRIENDS[2],
    lastName: 'Johnson',
    friendsSince: '2025-12-20T00:00:00Z',
    totalShifts: 15,
    hoursVolunteered: 56,
    shiftsThisMonth: 2,
    avgPerMonth: 3,
    favoriteRole: 'Kitchen Service & Pack Down',
    favoriteRoleCount: 8,
    sharedShifts: [
      { id: 'ss-9', type: 'Evening', date: daysFromNow(-5, 16).split('T')[0], location: 'Wellington', isUpcoming: false },
      { id: 'ss-10', type: 'Evening', date: daysFromNow(-12, 16).split('T')[0], location: 'Onehunga', isUpcoming: false },
    ],
    upcomingShifts: [
      { id: 'us-6', type: 'Kitchen Service & Pack Down', date: daysFromNow(3, 16).split('T')[0], time: '4:00 PM', location: 'Wellington' },
    ],
  },
  'u-7': {
    ...DUMMY_FRIENDS[3],
    lastName: 'Patel',
    friendsSince: '2025-10-05T00:00:00Z',
    totalShifts: 29,
    hoursVolunteered: 112,
    shiftsThisMonth: 4,
    avgPerMonth: 4,
    favoriteRole: 'Kitchen Prep',
    favoriteRoleCount: 18,
    sharedShifts: [
      { id: 'ss-11', type: 'Day', date: daysFromNow(5, 13).split('T')[0], location: 'Glen Innes', isUpcoming: true },
      { id: 'ss-12', type: 'Day', date: daysFromNow(-8, 13).split('T')[0], location: 'Glen Innes', isUpcoming: false },
      { id: 'ss-13', type: 'Evening', date: daysFromNow(-15, 16).split('T')[0], location: 'Wellington', isUpcoming: false },
    ],
    upcomingShifts: [
      { id: 'us-7', type: 'Kitchen Prep', date: daysFromNow(5, 13).split('T')[0], time: '1:00 PM', location: 'Glen Innes' },
      { id: 'us-8', type: 'Front of House', date: daysFromNow(7, 16).split('T')[0], time: '4:30 PM', location: 'Wellington' },
    ],
  },
  'u-6': {
    ...DUMMY_FRIENDS[4],
    lastName: 'Kahurangi',
    friendsSince: '2026-02-14T00:00:00Z',
    totalShifts: 8,
    hoursVolunteered: 32,
    shiftsThisMonth: 1,
    avgPerMonth: 2,
    favoriteRole: 'Front of House',
    favoriteRoleCount: 5,
    sharedShifts: [
      { id: 'ss-14', type: 'Evening', date: daysFromNow(-4, 16).split('T')[0], location: 'Wellington', isUpcoming: false },
    ],
    upcomingShifts: [
      { id: 'us-9', type: 'Front of House', date: daysFromNow(9, 16).split('T')[0], time: '4:00 PM', location: 'Onehunga' },
    ],
  },
};

/* ── Resources ── */

export type Resource = {
  id: string;
  title: string;
  description?: string;
  type: 'PDF' | 'VIDEO' | 'LINK';
  category: string;
  tags: string[];
  url: string;
  fileSize?: string;
};

/** Resources matching the live site at /resources */
export const RESOURCES: Resource[] = [
  {
    id: 'res-1',
    title: 'Your Service Guide',
    description: 'A guide to our dinner service at Everybody Eats',
    type: 'PDF',
    category: 'General',
    tags: ['orientation', 'training', 'induction', 'front-of-house', 'kitchen'],
    url: 'https://volunteers.everybodyeats.nz/resources',
    fileSize: '742 KB',
  },
  {
    id: 'res-2',
    title: 'Handling Difficult Guest Behaviour',
    description: 'A guide for what to do in the event of difficult behaviour from one of our guests',
    type: 'PDF',
    category: 'Safety',
    tags: ['h&s', 'health and safety', 'training', 'onboarding', 'induction'],
    url: 'https://volunteers.everybodyeats.nz/resources',
    fileSize: '55 KB',
  },
  {
    id: 'res-3',
    title: 'Volunteering With Us',
    description: 'A quick overview of why and how to volunteer at Everybody Eats',
    type: 'PDF',
    category: 'Training',
    tags: ['orientation'],
    url: 'https://volunteers.everybodyeats.nz/resources',
    fileSize: '7.4 MB',
  },
  {
    id: 'res-4',
    title: 'Everybody Eats: Feeding Bellies not Bins',
    description: 'RNZ story about our Wellington kitchen and mission',
    type: 'VIDEO',
    category: 'General',
    tags: [],
    url: 'https://www.youtube.com/watch?v=jak2zv8Ejyg',
  },
  {
    id: 'res-5',
    title: 'New Volunteer Platform FAQ',
    type: 'PDF',
    category: 'Guides',
    tags: [],
    url: 'https://volunteers.everybodyeats.nz/resources',
    fileSize: '122 KB',
  },
  {
    id: 'res-6',
    title: 'Our Story',
    description: 'A brief history of Everybody Eats',
    type: 'PDF',
    category: 'General',
    tags: ['orientation'],
    url: 'https://volunteers.everybodyeats.nz/resources',
    fileSize: '8.6 MB',
  },
];

/**
 * Get resources relevant to a shift type.
 * Matches by tags related to the shift type name.
 */
export function getResourcesForShiftType(shiftTypeName: string): Resource[] {
  const tagMap: Record<string, string[]> = {
    'Front of House': ['front-of-house', 'orientation', 'training', 'h&s'],
    'Kitchen Prep': ['kitchen', 'training', 'h&s', 'health and safety'],
    'Kitchen Service & Pack Down': ['kitchen', 'training', 'h&s', 'health and safety'],
    'FOH Set-Up & Service': ['front-of-house', 'orientation', 'training'],
    'Kitchen': ['kitchen', 'training', 'h&s'],
    'Kitchen Prep & Service': ['kitchen', 'training', 'h&s'],
  };

  const relevantTags = tagMap[shiftTypeName] ?? ['orientation', 'training'];
  const tagSet = new Set(relevantTags);

  return RESOURCES
    .filter((r) => r.tags.some((t) => tagSet.has(t)))
    .slice(0, 3); // Show max 3 relevant resources
}
