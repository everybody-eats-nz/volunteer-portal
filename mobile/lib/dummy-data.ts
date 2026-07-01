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
  agreementsAccepted: true,
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
  friendVisibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE';
  allowFriendRequests: boolean;
  allowFriendSuggestions: boolean;
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
  friendVisibility: 'FRIENDS_ONLY',
  allowFriendRequests: true,
  allowFriendSuggestions: true,
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
  /** Cover photo — a bundled require() asset (number) or a remote URL (string).
   *  Required: every theme (incl. the default fallback) provides a cover. */
  heroImage: number | string;
};

/**
 * Shift cover photos — the bundled Everybody Eats photo set used across the app
 * (login hero carousel + brand library). Local assets so covers load instantly
 * and work offline, and read as one brand with the marketing homepage.
 */
const SHIFT_COVERS = {
  /** Guests sharing kai in the dining room */
  diningRoom: require('@/assets/photos/6721b8345984b5e427f7d246_HOMEPAGE - HERO1-2.jpg'),
  /** Plated dishes lined up at the service pass */
  servicePass: require('@/assets/photos/6722babbc2238d67bcc7f7a1_OUR STORY 6.jpg'),
  /** Front of house (existing cover) */
  frontOfHouse: require('@/assets/photos/66da1b4267d61fe68398d065_280443354_2008401622656620_5596744644117168718_n.jpg'),
  /** Communal long table — events / media */
  communityTable: require('@/assets/photos/69d2ed111c8583513cde79a6_A. McVinnie - E.E X Kingi Oct-_K9A0991-p-2000.jpeg'),
  /** Volunteer loading the dish rack at the wash station */
  dishwasher: require('@/assets/photos/ee-dishwasher.jpg'),
  /** Volunteer at the kitchen prep bench */
  kitchenPrep: require('@/assets/photos/ee-kitchen-prep.jpg'),
  /** Kitchen team plating bowls during service */
  kitchenTeam: require('@/assets/photos/ee-kitchen-team.jpg'),
  /** Chef plating a dish at the pass */
  chefPlating: require('@/assets/photos/ee-chef-plating.jpg'),
  /** Volunteer serving a plated meal to the floor */
  fohServing: require('@/assets/photos/ee-foh-serving.jpg'),
  /** Beaming front-of-house volunteer carrying two plates through a full room */
  fohPortrait: require('@/assets/photos/ee-foh-portrait.jpg'),
  /** Two volunteers carrying plates through an event venue */
  crewPlates: require('@/assets/photos/ee-crew-plates.jpg'),
  /** Buffet / catering spread with a gathered crowd — events & info sessions */
  cateringSpread: require('@/assets/photos/ee-volunteer-team.jpg'),
  /** Volunteer holding three plated meals outdoors — pop-up service */
  servingPlates: require('@/assets/photos/ee-serving-plates.jpg'),
  /** Location-neutral cafe scene — whānau sharing kai at communal tables.
   *  Same homepage-carousel photo as the web cover; jpg here to match
   *  mobile's bundled-asset convention (web serves webp for size). */
  cafeHelpers: require('@/assets/photos/ee-cafe-helpers.jpg'),
};

export const SHIFT_TYPE_THEMES_BY_NAME: Record<string, ShiftTypeTheme> = {
  'Front of House': {
    emoji: '🌟',
    color: '#16a34a',
    colorDark: '#86efac',
    bgLight: '#f0fdf4',
    bgDark: 'rgba(22, 163, 74, 0.12)',
    heroImage: SHIFT_COVERS.frontOfHouse,
  },
  'Kitchen Prep': {
    emoji: '🔪',
    color: '#ea580c',
    colorDark: '#fb923c',
    bgLight: '#fff7ed',
    bgDark: 'rgba(234, 88, 12, 0.12)',
    heroImage: SHIFT_COVERS.kitchenPrep,
  },
  'Kitchen Service & Pack Down': {
    emoji: '📦',
    color: '#7c3aed',
    colorDark: '#a78bfa',
    bgLight: '#f5f3ff',
    bgDark: 'rgba(124, 58, 237, 0.12)',
    heroImage: SHIFT_COVERS.servicePass,
  },
  'FOH Set-Up & Service': {
    emoji: '✨',
    color: '#9333ea',
    colorDark: '#c084fc',
    bgLight: '#faf5ff',
    bgDark: 'rgba(147, 51, 234, 0.12)',
    heroImage: SHIFT_COVERS.fohServing,
  },
  'Kitchen': {
    emoji: '🧽',
    color: '#2563eb',
    colorDark: '#60a5fa',
    bgLight: '#eff6ff',
    bgDark: 'rgba(37, 99, 235, 0.12)',
    heroImage: SHIFT_COVERS.kitchenTeam,
  },
  'Kitchen Prep & Service': {
    emoji: '🍳',
    color: '#dc2626',
    colorDark: '#f87171',
    bgLight: '#fef2f2',
    bgDark: 'rgba(220, 38, 38, 0.12)',
    heroImage: SHIFT_COVERS.chefPlating,
  },
  'Dishwasher': {
    emoji: '🧽',
    color: '#2563eb',
    colorDark: '#60a5fa',
    bgLight: '#eff6ff',
    bgDark: 'rgba(37, 99, 235, 0.12)',
    heroImage: SHIFT_COVERS.dishwasher,
  },
  'FOH': {
    emoji: '✨',
    color: '#9333ea',
    colorDark: '#c084fc',
    bgLight: '#faf5ff',
    bgDark: 'rgba(147, 51, 234, 0.12)',
    heroImage: SHIFT_COVERS.diningRoom,
  },
  'Media Role': {
    emoji: '📷',
    color: '#db2777',
    colorDark: '#f472b6',
    bgLight: '#fdf2f8',
    bgDark: 'rgba(219, 39, 119, 0.12)',
    heroImage: SHIFT_COVERS.communityTable,
  },
  'Cafe Helpers': {
    emoji: '☕',
    color: '#d97706',
    colorDark: '#fbbf24',
    bgLight: '#fffbeb',
    bgDark: 'rgba(217, 119, 6, 0.12)',
    heroImage: SHIFT_COVERS.cafeHelpers,
  },
};

const DEFAULT_SHIFT_TYPE_THEME: ShiftTypeTheme = {
  emoji: '👥',
  color: '#0e3a23',
  colorDark: '#86efac',
  bgLight: '#e8f5e8',
  bgDark: 'rgba(14, 58, 35, 0.2)',
  heroImage: SHIFT_COVERS.diningRoom,
};

/**
 * Keyword fallback for shift types that aren't an exact match above. Shift type
 * names carry location/variant suffixes ("GI", "ONE", "(Onehunga)", "Pop-Up
 * Stand") and hyphenation ("Front-of-House") that an exact lookup misses, which
 * left ~20 of the live shift types on the generic dining-room cover. First rule
 * whose keyword appears in the (normalised) name wins, so order matters: the
 * most specific role keywords come first.
 *
 * MAINTENANCE: keywords are matched against live shift-type names from the DB.
 * Keep them in sync with web/src/lib/shift-themes.ts (same keywords, order and
 * emoji) so both apps resolve identically; if shift-type names change, update
 * both. */
const KEYWORD_THEME_RULES: { keywords: string[]; theme: ShiftTypeTheme }[] = [
  {
    // Unique keyword — safe near the top; also matches the accented "café".
    keywords: ['cafe', 'café', 'barista'],
    theme: {
      emoji: '☕',
      color: '#d97706',
      colorDark: '#fbbf24',
      bgLight: '#fffbeb',
      bgDark: 'rgba(217, 119, 6, 0.12)',
      heroImage: SHIFT_COVERS.cafeHelpers,
    },
  },
  {
    keywords: ['dishwash'],
    theme: {
      emoji: '🧽',
      color: '#2563eb',
      colorDark: '#60a5fa',
      bgLight: '#eff6ff',
      bgDark: 'rgba(37, 99, 235, 0.12)',
      heroImage: SHIFT_COVERS.dishwasher,
    },
  },
  {
    keywords: ['food rescue', 'rescue'],
    theme: {
      emoji: '🥕',
      color: '#65a30d',
      colorDark: '#bef264',
      bgLight: '#f7fee7',
      bgDark: 'rgba(101, 163, 13, 0.12)',
      heroImage: SHIFT_COVERS.cateringSpread,
    },
  },
  {
    keywords: ['save a bite'],
    theme: {
      emoji: '🥪',
      color: '#0d9488',
      colorDark: '#5eead4',
      bgLight: '#f0fdfa',
      bgDark: 'rgba(13, 148, 136, 0.12)',
      heroImage: SHIFT_COVERS.servingPlates,
    },
  },
  {
    keywords: ['photograph', 'socials', 'media'],
    theme: {
      emoji: '📷',
      color: '#db2777',
      colorDark: '#f472b6',
      bgLight: '#fdf2f8',
      bgDark: 'rgba(219, 39, 119, 0.12)',
      heroImage: SHIFT_COVERS.servicePass,
    },
  },
  {
    keywords: ['moving', 'packing', 'sorting'],
    theme: {
      emoji: '📦',
      color: '#7c3aed',
      colorDark: '#a78bfa',
      bgLight: '#f5f3ff',
      bgDark: 'rgba(124, 58, 237, 0.12)',
      heroImage: SHIFT_COVERS.crewPlates,
    },
  },
  {
    keywords: ['offsite'],
    theme: {
      emoji: '🚚',
      color: '#0891b2',
      colorDark: '#67e8f9',
      bgLight: '#ecfeff',
      bgDark: 'rgba(8, 145, 178, 0.12)',
      heroImage: SHIFT_COVERS.frontOfHouse,
    },
  },
  {
    // Before 'clean' so "Front of House Service & Clean Up" reads as FOH.
    keywords: ['front of house', 'foh'],
    theme: {
      emoji: '✨',
      color: '#9333ea',
      colorDark: '#c084fc',
      bgLight: '#faf5ff',
      bgDark: 'rgba(147, 51, 234, 0.12)',
      heroImage: SHIFT_COVERS.fohPortrait,
    },
  },
  {
    keywords: ['clean'],
    theme: {
      emoji: '🧹',
      color: '#2563eb',
      colorDark: '#60a5fa',
      bgLight: '#eff6ff',
      bgDark: 'rgba(37, 99, 235, 0.12)',
      heroImage: SHIFT_COVERS.dishwasher,
    },
  },
  {
    keywords: ['kitchen prep', 'prep'],
    theme: {
      emoji: '🔪',
      color: '#ea580c',
      colorDark: '#fb923c',
      bgLight: '#fff7ed',
      bgDark: 'rgba(234, 88, 12, 0.12)',
      heroImage: SHIFT_COVERS.kitchenPrep,
    },
  },
  {
    keywords: ['kitchen'],
    theme: {
      emoji: '🍳',
      color: '#dc2626',
      colorDark: '#f87171',
      bgLight: '#fef2f2',
      bgDark: 'rgba(220, 38, 38, 0.12)',
      heroImage: SHIFT_COVERS.kitchenTeam,
    },
  },
  {
    // Before 'event' so "Event Set-up" reads as a set-up shift.
    keywords: ['set up', 'setup'],
    theme: {
      emoji: '🛠️',
      color: '#d97706',
      colorDark: '#fbbf24',
      bgLight: '#fffbeb',
      bgDark: 'rgba(217, 119, 6, 0.12)',
      heroImage: SHIFT_COVERS.communityTable,
    },
  },
  {
    keywords: ['information', 'info session', 'session'],
    theme: {
      emoji: '📋',
      color: '#0891b2',
      colorDark: '#67e8f9',
      bgLight: '#ecfeff',
      bgDark: 'rgba(8, 145, 178, 0.12)',
      heroImage: SHIFT_COVERS.diningRoom,
    },
  },
  {
    keywords: ['event'],
    theme: {
      emoji: '🎉',
      color: '#9333ea',
      colorDark: '#c084fc',
      bgLight: '#faf5ff',
      bgDark: 'rgba(147, 51, 234, 0.12)',
      heroImage: SHIFT_COVERS.communityTable,
    },
  },
  {
    keywords: ['service', 'serving'],
    theme: {
      emoji: '✨',
      color: '#9333ea',
      colorDark: '#c084fc',
      bgLight: '#faf5ff',
      bgDark: 'rgba(147, 51, 234, 0.12)',
      heroImage: SHIFT_COVERS.fohServing,
    },
  },
];

export function getShiftThemeByName(name: string): ShiftTypeTheme {
  // 1. Exact, hand-curated match wins.
  const exact = SHIFT_TYPE_THEMES_BY_NAME[name];
  if (exact) return exact;

  // 2. Keyword match — flatten hyphens/slashes so "Front-of-House" and
  //    "Helper & Prep" still resolve to a role-appropriate cover.
  const normalized = name.toLowerCase().replace(/[-/]/g, ' ');
  for (const rule of KEYWORD_THEME_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.theme;
    }
  }

  // 3. Generic fallback.
  return DEFAULT_SHIFT_TYPE_THEME;
}

/** Volunteer signup info for display on shift detail */
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
  | ({ type: 'achievement'; id: string; userId?: string; userName: string; profilePhotoUrl?: string; achievementName: string; achievementIcon: string; description: string; criteria?: string; timestamp: string; isFriend: boolean } & FeedInteractions)
  | ({ type: 'photo_post'; id: string; userId?: string; userName: string; profilePhotoUrl?: string; caption: string; photos: string[]; shiftDate: string; period: 'AM' | 'PM'; location: string; timestamp: string; isFriend: boolean } & FeedInteractions)
  | ({ type: 'friend_signup'; id: string; userId?: string; userName: string; profilePhotoUrl?: string; shiftId: string; shiftTypeName: string; shiftDate: string; location: string; timestamp: string; isFriend: boolean } & FeedInteractions)
  | ({ type: 'shift_recap'; id: string; location: string; date: string; mealsServed: number; volunteerCount: number; timestamp: string } & FeedInteractions)
  | ({ type: 'new_shift'; id: string; location: string; count: number; shiftIds: string[]; shiftTypes: string[]; earliestStart: string; latestStart: string; preview: NewShiftPreview[]; timestamp: string } & FeedInteractions)
  | ({ type: 'daily_menu'; id: string; menuId: string; location: string; serviceDate: string; chefName?: string; announcement?: string; starter: MenuCourseItem[]; mains: MenuCourseItem[]; drink: MenuCourseItem[]; dessert: MenuCourseItem[]; timestamp: string } & FeedInteractions);

export type MenuCourseItem = { name: string; description?: string };

export type NewShiftPreview = {
  id: string;
  start: string;
  shiftTypeName: string;
};

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
  criteria?: string; // human-readable unlock rule, e.g. "Complete 5 volunteer shifts"
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
    criteria: 'Complete 1 volunteer shift',
    unlockedAt: '2025-06-20T00:00:00Z',
  },
  {
    id: 'ach-2',
    name: 'Making a Difference',
    description: 'Complete 10 volunteer shifts',
    icon: '⭐',
    category: 'MILESTONE',
    points: 50,
    criteria: 'Complete 10 volunteer shifts',
    unlockedAt: '2025-09-15T00:00:00Z',
  },
  {
    id: 'ach-3',
    name: 'Regular',
    description: 'Volunteer for 3 consecutive months',
    icon: '🔥',
    category: 'DEDICATION',
    points: 75,
    criteria: 'Volunteer for 3 consecutive months',
    unlockedAt: '2025-10-01T00:00:00Z',
  },
  {
    id: 'ach-4',
    name: 'Front of House Pro',
    description: 'Complete 5 Front of House shifts',
    icon: '🌟',
    category: 'SPECIALIZATION',
    points: 40,
    criteria: 'Complete 5 "Front of House" shifts',
    unlockedAt: '2025-11-10T00:00:00Z',
  },
  {
    id: 'ach-5',
    name: 'Century Club',
    description: 'Serve 1000+ meals',
    icon: '🍽️',
    category: 'IMPACT',
    points: 100,
    criteria: 'Help prepare an estimated 1000 meals',
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
    criteria: 'Complete 5 "Kitchen Prep" shifts',
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
    criteria: 'Complete 50 volunteer shifts',
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
    criteria: 'Volunteer for 6 consecutive months',
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
