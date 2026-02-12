import bcrypt from "bcrypt";
import {
  addDays,
  set,
  subYears,
  subMonths,
  subDays,
  format,
  DateValues,
} from "date-fns";
import { tz } from "@date-fns/tz";
import https from "https";

import { PrismaClient } from "../src/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AchievementCategory,
  CriteriaLogic,
  NotificationPreference,
  NotificationType,
  VolunteerGrade,
} from "@/generated/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// NZ timezone helper for seed script
const NZ_TIMEZONE = "Pacific/Auckland";
const nzTimezone = tz(NZ_TIMEZONE);

// Helper functions for timezone-aware seeding
function toNZT(date: Date) {
  return nzTimezone(date);
}

function formatInNZT(date: Date, formatStr: string) {
  const nzTime = nzTimezone(date);
  return format(nzTime, formatStr, { in: nzTimezone });
}

function setInNZT(date: Date, options: DateValues) {
  const nzDate = nzTimezone(date);
  const setDate = set(nzDate, options);
  return toNZT(setDate);
}

// Generate random profile images and names using randomuser.me for all users
async function generateRandomProfileImagesForAllUsers() {
  // Get all users from database
  const allUsers = await prisma.user.findMany({
    select: { email: true, pronouns: true, firstName: true, id: true },
  });

  const userUpdates = [];

  for (const { email, pronouns, id } of allUsers) {
    // Simple gender determination based on pronouns
    let gender = "female"; // Default for API
    if (pronouns?.includes("he/him")) {
      gender = "male";
    } else if (pronouns?.includes("she/her")) {
      gender = "female";
    } else {
      // For they/them or missing pronouns, default to female
      gender = "female";
    }

    try {
      // Get full user data from randomuser.me API
      const response = await fetch(
        `https://randomuser.me/api/?gender=${gender}&inc=name,picture&nat=us,au,ca,gb,nz`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const user = data.results[0];
        const firstName = user.name.first;
        const lastName = user.name.last;
        const photoUrl = user.picture.large;

        userUpdates.push({
          id,
          email,
          firstName,
          lastName,
          photoUrl,
        });
      }

      // Add delay to be respectful to API
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.log(
        `⚠️ Failed to get data for ${email}: ${(error as Error).message}`
      );
    }
  }

  return userUpdates;
}

function downloadImageAsBase64(url: string) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          try {
            const buffer = Buffer.concat(chunks);
            const base64 = buffer.toString("base64");
            const mimeType = "image/jpeg";
            resolve(`data:${mimeType};base64,${base64}`);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

async function downloadAndConvertProfileImages() {
  // Skip profile image downloads in CI environments to speed up workflow runs
  // Exception: Allow downloads in any Vercel environment for rich demo experience
  const isCI = process.env.CI || process.env.NODE_ENV === "test";
  const isVercel = process.env.VERCEL_ENV; // Any Vercel environment (production, preview, development)

  if (isCI && !isVercel) {
    console.log(
      "🏃 Skipping profile image downloads in CI/test environment for faster execution"
    );
    return;
  }

  if (isVercel) {
    console.log(
      `🌐 Vercel environment detected (${process.env.VERCEL_ENV}) - downloading profile images for demo`
    );
  }

  console.log(
    "🎲 Generating random profile photos from randomuser.me for all users...\n"
  );

  // Generate profile data for all users dynamically
  const userUpdates = await generateRandomProfileImagesForAllUsers();
  console.log(`📊 Found ${userUpdates.length} users to process`);

  for (const update of userUpdates) {
    try {
      console.log(
        `📸 Processing ${update.email} (${update.firstName} ${update.lastName}) with random data...`
      );

      // Download image directly as base64 (no file storage needed)
      const base64Data = await downloadImageAsBase64(update.photoUrl);

      if (base64Data) {
        await prisma.user.update({
          where: { id: update.id },
          data: {
            firstName: update.firstName,
            lastName: update.lastName,
            name: `${update.firstName} ${update.lastName}`,
            profilePhotoUrl: base64Data,
          },
        });
        console.log(
          `✅ Updated profile for ${update.email} (${update.firstName} ${update.lastName})`
        );
      }

      // Add a small delay to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.log(
        `⚠️ Failed to process ${update.email}: ${(error as Error).message}`
      );
    }
  }

  console.log("✅ Random profile images processing completed\n");
}

// Realistic sample data
const REALISTIC_VOLUNTEERS = [
  {
    email: "sarah.chen@gmail.com",
    firstName: "Sarah",
    lastName: "Chen",
    phone: "+64 21 234 5678",
    dateOfBirth: subYears(new Date(), 28),
    pronouns: "she/her",
    emergencyContactName: "David Chen",
    emergencyContactRelationship: "Partner",
    emergencyContactPhone: "+64 21 987 6543",
    medicalConditions: "No known allergies",
    willingToProvideReference: true,
    howDidYouHearAboutUs: "Instagram",
    availableDays: JSON.stringify(["Monday", "Wednesday", "Friday"]),
    availableLocations: JSON.stringify(["Wellington", "Glen Innes"]),
    emailNewsletterSubscription: true,
    notificationPreference: "BOTH",
    // Empty array means all types
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [], // Empty array means all types
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
  },
  {
    email: "james.williams@hotmail.com",
    firstName: "James",
    lastName: "Williams",
    phone: "+64 27 345 6789",
    dateOfBirth: subYears(new Date(), 34),
    pronouns: "he/him",
    emergencyContactName: "Emma Williams",
    emergencyContactRelationship: "Wife",
    emergencyContactPhone: "+64 27 456 7890",
    medicalConditions: "Mild asthma - carries inhaler",
    willingToProvideReference: true,
    howDidYouHearAboutUs: "Friend recommendation",
    availableDays: JSON.stringify(["Tuesday", "Thursday", "Saturday"]),
    availableLocations: JSON.stringify(["Wellington"]),
    emailNewsletterSubscription: true,
    notificationPreference: "EMAIL",
    // Empty array means all types
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [], // Empty array means all types
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
  },
  {
    email: "priya.patel@yahoo.com",
    firstName: "Priya",
    lastName: "Patel",
    phone: "+64 22 456 7890",
    dateOfBirth: subYears(new Date(), 25),
    pronouns: "she/her",
    emergencyContactName: "Raj Patel",
    emergencyContactRelationship: "Father",
    emergencyContactPhone: "+64 22 567 8901",
    medicalConditions: "Vegetarian diet, no medical conditions",
    willingToProvideReference: false,
    howDidYouHearAboutUs: "Facebook",
    availableDays: JSON.stringify(["Monday", "Tuesday", "Sunday"]),
    availableLocations: JSON.stringify(["Glen Innes", "Onehunga"]),
    emailNewsletterSubscription: false,
    notificationPreference: "SMS",
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [],
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
  },
  {
    email: "mike.johnson@outlook.com",
    firstName: "Mike",
    lastName: "Johnson",
    phone: "+64 21 567 8901",
    dateOfBirth: subYears(new Date(), 42),
    pronouns: "he/him",
    emergencyContactName: "Lisa Johnson",
    emergencyContactRelationship: "Sister",
    emergencyContactPhone: "+64 21 678 9012",
    medicalConditions: "None",
    willingToProvideReference: true,
    howDidYouHearAboutUs: "Community notice board",
    availableDays: JSON.stringify(["Wednesday", "Friday", "Saturday"]),
    availableLocations: JSON.stringify(["Wellington", "Onehunga"]),
    emailNewsletterSubscription: true,
    notificationPreference: "EMAIL",
    // Empty array means all types
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [], // Empty array means all types
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
  },
  {
    email: "alex.taylor@gmail.com",
    firstName: "Alex",
    lastName: "Taylor",
    phone: "+64 29 678 9012",
    dateOfBirth: subYears(new Date(), 19),
    pronouns: "they/them",
    emergencyContactName: "Morgan Taylor",
    emergencyContactRelationship: "Parent",
    emergencyContactPhone: "+64 29 789 0123",
    medicalConditions: "Lactose intolerant",
    willingToProvideReference: false,
    howDidYouHearAboutUs: "University volunteer fair",
    availableDays: JSON.stringify(["Thursday", "Friday", "Sunday"]),
    availableLocations: JSON.stringify(["Glen Innes"]),
    emailNewsletterSubscription: true,
    notificationPreference: "BOTH",
    // Empty array means all types
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [], // Empty array means all types
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
  },
  {
    email: "maria.gonzalez@gmail.com",
    firstName: "Maria",
    lastName: "Gonzalez",
    phone: "+64 22 789 0123",
    dateOfBirth: subYears(new Date(), 31),
    pronouns: "she/her",
    emergencyContactName: "Carlos Gonzalez",
    emergencyContactRelationship: "Husband",
    emergencyContactPhone: "+64 22 890 1234",
    medicalConditions: "No medical conditions",
    willingToProvideReference: true,
    howDidYouHearAboutUs: "Google search",
    availableDays: JSON.stringify(["Monday", "Wednesday", "Thursday"]),
    availableLocations: JSON.stringify(["Onehunga"]),
    emailNewsletterSubscription: true,
    notificationPreference: "EMAIL",
    // Empty array means all types
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [], // Empty array means all types
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
  },
  {
    email: "tom.brown@hotmail.com",
    firstName: "Tom",
    lastName: "Brown",
    phone: "+64 27 890 1234",
    dateOfBirth: subYears(new Date(), 56),
    pronouns: "he/him",
    emergencyContactName: "Jennifer Brown",
    emergencyContactRelationship: "Daughter",
    emergencyContactPhone: "+64 27 901 2345",
    medicalConditions: "Type 2 diabetes - well controlled",
    willingToProvideReference: true,
    howDidYouHearAboutUs: "Local newspaper",
    availableDays: JSON.stringify(["Tuesday", "Wednesday", "Saturday"]),
    availableLocations: JSON.stringify([
      "Wellington",
      "Glen Innes",
      "Onehunga",
    ]),
    emailNewsletterSubscription: true,
    notificationPreference: "EMAIL",
    // Empty array means all types
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [], // Empty array means all types
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
  },
  {
    email: "lucy.kim@yahoo.com",
    firstName: "Lucy",
    lastName: "Kim",
    phone: "+64 21 901 2345",
    dateOfBirth: subYears(new Date(), 23),
    pronouns: "she/her",
    emergencyContactName: "Grace Kim",
    emergencyContactRelationship: "Mother",
    emergencyContactPhone: "+64 21 012 3456",
    medicalConditions: "Mild peanut allergy",
    willingToProvideReference: false,
    howDidYouHearAboutUs: "TikTok",
    availableDays: JSON.stringify(["Friday", "Saturday", "Sunday"]),
    availableLocations: JSON.stringify(["Wellington"]),
    emailNewsletterSubscription: false,
    notificationPreference: "SMS",
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [],
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
  },
  // Underage volunteers (under 16) requiring parental consent
  {
    email: "emma.parker@student.ac.nz",
    firstName: "Emma",
    lastName: "Parker",
    phone: "+64 27 111 2222",
    dateOfBirth: subYears(new Date(), 16), // 16 years old
    pronouns: "she/her",
    emergencyContactName: "Sarah Parker",
    emergencyContactRelationship: "Mother",
    emergencyContactPhone: "+64 27 333 4444",
    medicalConditions: "No medical conditions",
    willingToProvideReference: false,
    howDidYouHearAboutUs: "School newsletter",
    availableDays: JSON.stringify(["Saturday", "Sunday"]),
    availableLocations: JSON.stringify(["Wellington"]),
    emailNewsletterSubscription: true,
    notificationPreference: "EMAIL",
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [],
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
    requiresParentalConsent: true,
    parentalConsentReceived: false, // Pending approval
  },
  {
    email: "jackson.smith@outlook.com",
    firstName: "Jackson",
    lastName: "Smith",
    phone: "+64 22 555 6666",
    dateOfBirth: subYears(new Date(), 17), // 17 years old
    pronouns: "he/him",
    emergencyContactName: "Michael Smith",
    emergencyContactRelationship: "Father",
    emergencyContactPhone: "+64 22 777 8888",
    medicalConditions: "None",
    willingToProvideReference: false,
    howDidYouHearAboutUs: "Friend recommendation",
    availableDays: JSON.stringify(["Friday", "Saturday"]),
    availableLocations: JSON.stringify(["Glen Innes"]),
    emailNewsletterSubscription: true,
    notificationPreference: "BOTH",
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [],
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
    requiresParentalConsent: true,
    parentalConsentReceived: true, // Already approved
    parentalConsentReceivedAt: subDays(new Date(), 5),
  },
  {
    email: "sophia.brown@gmail.com",
    firstName: "Sophia",
    lastName: "Brown",
    phone: "+64 21 999 0000",
    dateOfBirth: subYears(new Date(), 15), // 15 years old
    pronouns: "she/her",
    emergencyContactName: "Jennifer Brown",
    emergencyContactRelationship: "Mother",
    emergencyContactPhone: "+64 21 000 1111",
    medicalConditions: "Mild food allergies - avoids nuts",
    willingToProvideReference: false,
    howDidYouHearAboutUs: "Instagram",
    availableDays: JSON.stringify(["Sunday"]),
    availableLocations: JSON.stringify(["Onehunga"]),
    emailNewsletterSubscription: false,
    notificationPreference: "SMS",
    receiveShortageNotifications: false,
    excludedShortageNotificationTypes: [],
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
    requiresParentalConsent: true,
    parentalConsentReceived: false, // Pending approval
  },
  {
    email: "logan.johnson@school.nz",
    firstName: "Logan",
    lastName: "Johnson",
    phone: "+64 27 123 4567",
    dateOfBirth: subYears(new Date(), 13), // 13 years old - under 14
    pronouns: "he/him",
    emergencyContactName: "Rebecca Johnson",
    emergencyContactRelationship: "Mother",
    emergencyContactPhone: "+64 27 890 1234",
    medicalConditions: "No medical conditions",
    willingToProvideReference: false,
    howDidYouHearAboutUs: "School newsletter",
    availableDays: JSON.stringify(["Saturday"]),
    availableLocations: JSON.stringify(["Wellington"]),
    emailNewsletterSubscription: true,
    notificationPreference: "EMAIL",
    receiveShortageNotifications: false,
    excludedShortageNotificationTypes: [],
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
    requiresParentalConsent: true,
    parentalConsentReceived: true, // Already approved for testing
    parentalConsentReceivedAt: subDays(new Date(), 3),
  },
];

async function main() {
  const adminEmail = "admin@everybodyeats.nz";
  const volunteerEmail = "volunteer@example.com";

  const adminHash = await bcrypt.hash("admin123", 10);
  const volunteerHash = await bcrypt.hash("volunteer123", 10);

  // Track user signups by date to prevent multiple signups per day
  const userDailySignups = new Map(); // userId -> Set of date strings

  // Helper function to check if user can sign up for a shift on a given date
  // For today's shifts, allow multiple signups since we need to fill all shifts
  function canUserSignUpForDate(userId: string, shiftDate: Date) {
    const dateKey = formatInNZT(shiftDate, "yyyy-MM-dd"); // NZ timezone date string
    const today = new Date();
    const todayStr = formatInNZT(today, "yyyy-MM-dd");

    // For today's shifts, allow multiple signups to ensure we can fill all shifts
    if (dateKey === todayStr) {
      return true; // Allow multiple signups for today
    }

    if (!userDailySignups.has(userId)) {
      userDailySignups.set(userId, new Set());
    }

    return !userDailySignups.get(userId).has(dateKey);
  }

  // Helper function to record a user signup for a date
  function recordUserSignup(userId: string, shiftDate: Date) {
    const dateKey = formatInNZT(shiftDate, "yyyy-MM-dd");

    if (!userDailySignups.has(userId)) {
      userDailySignups.set(userId, new Set());
    }

    userDailySignups.get(userId).add(dateKey);
  }

  // Create admin user
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      firstName: "Admin",
      lastName: "User",
      name: "Admin User",
      phone: "+64 21 123 4567",
      hashedPassword: adminHash,
      role: "ADMIN",
      volunteerAgreementAccepted: true,
      healthSafetyPolicyAccepted: true,
      notificationPreference: "EMAIL",
      emailVerified: true,
    },
  });

  // Create main sample volunteer with full profile (YELLOW grade - experienced)
  const volunteer = await prisma.user.upsert({
    where: { email: volunteerEmail },
    update: {},
    create: {
      email: volunteerEmail,
      firstName: "Sample",
      lastName: "Volunteer",
      name: "Sample Volunteer",
      phone: "+64 21 555 0001",
      dateOfBirth: subYears(new Date(), 26),
      pronouns: "she/her",
      emergencyContactName: "John Volunteer",
      emergencyContactRelationship: "Brother",
      emergencyContactPhone: "+64 21 555 0002",
      medicalConditions: "None",
      willingToProvideReference: true,
      howDidYouHearAboutUs: "Website",
      availableDays: JSON.stringify(["Monday", "Wednesday", "Friday"]),
      availableLocations: JSON.stringify(["Wellington", "Glen Innes"]),
      emailNewsletterSubscription: true,
      notificationPreference: "EMAIL",
      // Empty array means all types
      receiveShortageNotifications: true,
      excludedShortageNotificationTypes: [], // Empty array means all types
      volunteerAgreementAccepted: true,
      healthSafetyPolicyAccepted: true,
      hashedPassword: volunteerHash,
      role: "VOLUNTEER",
      volunteerGrade: "YELLOW", // Experienced volunteer for testing auto-approval
      createdAt: subMonths(new Date(), 6), // Been volunteering for 6 months
      emailVerified: true,
    },
  });

  // Create realistic volunteers with varied grades
  const extraVolunteers = [];
  const gradeDistribution = [
    "YELLOW", // Sarah - experienced volunteer
    "PINK", // James - shift leader
    "GREEN", // Priya - newer volunteer
    "YELLOW", // Mike - experienced
    "GREEN", // Alex - student, newer
    "PINK", // Maria - shift leader
    "YELLOW", // Tom - experienced older volunteer
    "GREEN", // Lucy - newer young volunteer
  ];

  for (let i = 0; i < REALISTIC_VOLUNTEERS.length; i++) {
    const volunteerData = REALISTIC_VOLUNTEERS[i];
    const volunteerGrade = gradeDistribution[i] || "GREEN"; // Default to GREEN if not specified

    const u = await prisma.user.upsert({
      where: { email: volunteerData.email },
      update: {},
      create: {
        ...volunteerData,
        name: `${volunteerData.firstName} ${volunteerData.lastName}`,
        hashedPassword: volunteerHash,
        role: "VOLUNTEER",
        volunteerGrade: volunteerGrade as VolunteerGrade,
        notificationPreference: "NONE",
        emailVerified: true,
      },
    });
    extraVolunteers.push(u);
  }

  // Create additional simple volunteers for testing capacity limits
  // Need enough volunteers to fill all daily shifts (83 total spots across all locations)
  for (let i = 1; i <= 70; i++) {
    const email = `vol${i}@example.com`;
    // Placeholder names - these will be replaced by randomuser.me API data
    const lastNames = [
      "Smith",
      "Wilson",
      "Davis",
      "Miller",
      "Anderson",
      "Clark",
      "Lewis",
      "Walker",
      "Hall",
      "Young",
      "King",
      "Wright",
      "Lopez",
      "Hill",
      "Scott",
      "Green",
      "Adams",
      "Baker",
      "Gonzalez",
      "Nelson",
      "Carter",
      "Mitchell",
      "Perez",
      "Roberts",
      "Turner",
      "Phillips",
      "Campbell",
      "Parker",
      "Evans",
      "Edwards",
      "Collins",
      "Stewart",
      "Sanchez",
      "Morris",
      "Rogers",
      "Reed",
      "Cook",
      "Morgan",
      "Bell",
      "Murphy",
      "Bailey",
      "Rivera",
      "Cooper",
      "Richardson",
      "Cox",
      "Howard",
      "Ward",
      "Torres",
      "Peterson",
      "Gray",
      "Ramirez",
      "James",
      "Watson",
      "Brooks",
      "Kelly",
      "Sanders",
      "Price",
      "Bennett",
      "Wood",
      "Barnes",
      "Ross",
      "Henderson",
      "Coleman",
      "Jenkins",
      "Perry",
      "Powell",
      "Long",
      "Patterson",
      "Hughes",
      "Flores",
      "Washington",
      "Butler",
      "Simmons",
      "Foster",
      "Gonzales",
      "Bryant",
      "Alexander",
      "Russell",
      "Griffin",
      "Diaz",
    ];

    // Use simple placeholders - these will be replaced by randomuser.me API
    const firstName = `User${i}`;
    const lastName = lastNames[(i - 1) % lastNames.length];
    const age = 20 + (i % 40); // Ages between 20-59

    // Distribute grades across the additional volunteers
    // Pattern: GREEN (newer), YELLOW (experienced), PINK (leaders), repeat
    // This creates: GREEN, YELLOW, PINK, GREEN, YELLOW, PINK, etc.
    const additionalGrades = ["GREEN", "YELLOW", "PINK"];
    const volunteerGrade = additionalGrades[(i - 1) % 3] as VolunteerGrade;

    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        phone: `+64 21 555 ${String(i).padStart(4, "0")}`,
        dateOfBirth: subYears(new Date(), age),
        pronouns:
          i % 3 === 0 ? "they/them" : i % 2 === 0 ? "she/her" : "he/him",
        emergencyContactName: `Emergency Contact ${i}`,
        emergencyContactRelationship:
          i % 3 === 0 ? "Friend" : i % 2 === 0 ? "Parent" : "Sibling",
        emergencyContactPhone: `+64 21 666 ${String(i).padStart(4, "0")}`,
        medicalConditions: i % 4 === 0 ? "No known conditions" : "None",
        willingToProvideReference: i % 3 === 0,
        howDidYouHearAboutUs: [
          "Website",
          "Social media",
          "Friend",
          "Community board",
        ][i % 4],
        availableDays: JSON.stringify(
          [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ].slice(0, (i % 4) + 2)
        ),
        availableLocations: JSON.stringify(
          ["Wellington", "Glen Innes", "Onehunga"].slice(0, (i % 3) + 1)
        ),
        emailNewsletterSubscription: i % 2 === 0,
        notificationPreference: ["EMAIL", "SMS", "BOTH", "NONE"][
          i % 4
        ] as NotificationPreference,
        // Empty array means all types
        receiveShortageNotifications: true,
        excludedShortageNotificationTypes: [], // Empty array means all types
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
        hashedPassword: volunteerHash,
        role: "VOLUNTEER",
        volunteerGrade: volunteerGrade,
        emailVerified: true,
      },
    });
    extraVolunteers.push(u);
  }

  // Create friend relationships for sample volunteer
  console.log("👫 Seeding friend relationships...");

  // Sample volunteer's existing friends (bidirectional friendships)
  const existingFriends = [
    extraVolunteers.find((v) => v.email === "sarah.chen@gmail.com"),
    extraVolunteers.find((v) => v.email === "james.williams@hotmail.com"),
    extraVolunteers.find((v) => v.email === "priya.patel@yahoo.com"),
    extraVolunteers.find((v) => v.email === "vol1@example.com"),
    extraVolunteers.find((v) => v.email === "vol3@example.com"),
  ].filter(Boolean);

  // Create bidirectional friendships
  for (const friend of existingFriends) {
    if (!friend) continue;
    try {
      // Create friendship from sample volunteer to friend
      await prisma.friendship.create({
        data: {
          userId: volunteer.id,
          friendId: friend.id,
          status: "ACCEPTED",
          initiatedBy: volunteer.id,
          createdAt: subDays(new Date(), Math.floor(Math.random() * 60) + 30), // 30-90 days ago
        },
      });

      // Create friendship from friend to sample volunteer
      await prisma.friendship.create({
        data: {
          userId: friend.id,
          friendId: volunteer.id,
          status: "ACCEPTED",
          initiatedBy: volunteer.id,
          createdAt: subDays(new Date(), Math.floor(Math.random() * 60) + 30), // Same date as above
        },
      });
    } catch (error) {
      // Skip if friendship already exists
      if (!(error as Error).message.includes("Unique constraint")) {
        throw error;
      }
    }
  }

  // Create pending friend requests TO the sample volunteer
  const pendingRequesters = [
    extraVolunteers.find((v) => v.email === "mike.johnson@outlook.com"),
    extraVolunteers.find((v) => v.email === "vol5@example.com"),
    extraVolunteers.find((v) => v.email === "vol7@example.com"),
  ].filter(Boolean);

  for (const requester of pendingRequesters) {
    if (!requester) continue;
    try {
      await prisma.friendRequest.create({
        data: {
          fromUserId: requester.id,
          toEmail: volunteer.email,
          message: [
            "Hey! I saw you volunteering last week. Would love to coordinate our shifts!",
            "Let's be friends so we can volunteer together!",
            "Would be great to connect and volunteer as a team!",
          ][Math.floor(Math.random() * 3)],
          status: "PENDING",
          expiresAt: addDays(new Date(), 30), // 30 days from now
          createdAt: subDays(new Date(), Math.floor(Math.random() * 7) + 1), // 1-7 days ago
        },
      });
    } catch (error) {
      // Skip if request already exists
      if (!(error as Error).message.includes("Unique constraint")) {
        throw error;
      }
    }
  }

  // Create some sent friend requests FROM the sample volunteer
  const sentRequestTargets = ["alex.taylor@gmail.com", "vol9@example.com"];

  for (const targetEmail of sentRequestTargets) {
    try {
      await prisma.friendRequest.create({
        data: {
          fromUserId: volunteer.id,
          toEmail: targetEmail,
          message:
            "Hi! Would love to be friends and volunteer together sometime!",
          status: "PENDING",
          expiresAt: addDays(new Date(), 30),
          createdAt: subDays(new Date(), Math.floor(Math.random() * 5) + 2), // 2-6 days ago
        },
      });
    } catch (error) {
      // Skip if request already exists
      if (!(error as Error).message.includes("Unique constraint")) {
        throw error;
      }
    }
  }

  // Create some friendships between other volunteers (for realistic friend networks)
  const friendPairs = [
    ["sarah.chen@gmail.com", "james.williams@hotmail.com"],
    ["priya.patel@yahoo.com", "maria.gonzalez@gmail.com"],
    ["vol1@example.com", "vol2@example.com"],
    ["vol3@example.com", "vol4@example.com"],
    ["vol6@example.com", "vol8@example.com"],
  ];

  for (const [email1, email2] of friendPairs) {
    const user1 = extraVolunteers.find((v) => v.email === email1);
    const user2 = extraVolunteers.find((v) => v.email === email2);

    if (user1 && user2) {
      try {
        // Create bidirectional friendship
        await prisma.friendship.create({
          data: {
            userId: user1.id,
            friendId: user2.id,
            status: "ACCEPTED",
            initiatedBy: user1.id,
            createdAt: subDays(
              new Date(),
              Math.floor(Math.random() * 120) + 30
            ),
          },
        });

        await prisma.friendship.create({
          data: {
            userId: user2.id,
            friendId: user1.id,
            status: "ACCEPTED",
            initiatedBy: user1.id,
            createdAt: subDays(
              new Date(),
              Math.floor(Math.random() * 120) + 30
            ),
          },
        });
      } catch (error) {
        // Skip if friendship already exists
        if (!(error as Error).message.includes("Unique constraint")) {
          throw error;
        }
      }
    }
  }

  // Set different privacy settings for some volunteers
  await prisma.user.update({
    where: { email: "sarah.chen@gmail.com" },
    data: { friendVisibility: "PUBLIC" },
  });

  await prisma.user.update({
    where: { email: "alex.taylor@gmail.com" },
    data: { friendVisibility: "PRIVATE" },
  });

  await prisma.user.update({
    where: { email: "vol10@example.com" },
    data: { allowFriendRequests: false },
  });

  console.log(
    `✅ Created ${existingFriends.length} friendships for sample volunteer`
  );
  console.log(`✅ Created ${pendingRequesters.length} pending friend requests`);
  console.log(`✅ Created ${sentRequestTargets.length} sent friend requests`);
  console.log(`✅ Created ${friendPairs.length} other volunteer friendships`);

  // Create updated shift types
  const dishwasher = await prisma.shiftType.upsert({
    where: { name: "Dishwasher" },
    update: {},
    create: {
      name: "Dishwasher",
      description: "Dishwashing and kitchen cleaning duties (5:30pm-9:00pm)",
    },
  });

  const fohSetup = await prisma.shiftType.upsert({
    where: { name: "FOH Set-Up & Service" },
    update: {},
    create: {
      name: "FOH Set-Up & Service",
      description: "Front of house setup and service support (4:30pm-9:00pm)",
    },
  });

  const frontOfHouse = await prisma.shiftType.upsert({
    where: { name: "Front of House" },
    update: {},
    create: {
      name: "Front of House",
      description: "Guest service and dining room support (5:30pm-9:00pm)",
    },
  });

  const kitchenPrep = await prisma.shiftType.upsert({
    where: { name: "Kitchen Prep" },
    update: {},
    create: {
      name: "Kitchen Prep",
      description: "Food preparation and ingredient prep ending at 4:00pm",
    },
  });

  const kitchenServicePack = await prisma.shiftType.upsert({
    where: { name: "Kitchen Service & Pack Down" },
    update: {},
    create: {
      name: "Kitchen Service & Pack Down",
      description: "Cooking service and kitchen cleanup (5:30pm-9:00pm)",
    },
  });

  const mediaRole = await prisma.shiftType.upsert({
    where: { name: "Media Role" },
    update: {},
    create: {
      name: "Media Role",
      description:
        "Photography, social media content creation, and community engagement (5:00pm-7:00pm)",
    },
  });

  // Create restaurant locations
  await prisma.location.upsert({
    where: { name: "Wellington" },
    update: {},
    create: {
      name: "Wellington",
      address: "60 Dixon Street, Te Aro, Wellington, New Zealand",
      defaultMealsServed: 60,
      isActive: true,
    },
  });

  await prisma.location.upsert({
    where: { name: "Glen Innes" },
    update: {},
    create: {
      name: "Glen Innes",
      address: "133 Line Road, Glen Innes, Auckland, New Zealand",
      defaultMealsServed: 60,
      isActive: true,
    },
  });

  await prisma.location.upsert({
    where: { name: "Onehunga" },
    update: {},
    create: {
      name: "Onehunga",
      address: "306 Onehunga Mall, Auckland, New Zealand",
      defaultMealsServed: 60,
      isActive: true,
    },
  });

  // Create site settings
  await prisma.siteSetting.upsert({
    where: { key: "PARENTAL_CONSENT_FORM_URL" },
    update: {},
    create: {
      key: "PARENTAL_CONSENT_FORM_URL",
      value: "/parental-consent-form.pdf",
      description: "URL for parental consent form PDF that parents must complete for volunteers under 16",
      category: "DOCUMENTS",
    },
  });

  const today = new Date();

  // Define shift times and location-specific capacities
  const shiftConfigs = [
    {
      type: dishwasher,
      startHour: 17, // 5:30pm
      startMinute: 30,
      endHour: 21, // 9:00pm
      endMinute: 0,
      capacities: {
        Wellington: 3, // 3 dishwasher
        "Glen Innes": 2, // 2 dishwasher
        Onehunga: 2, // 2 dishwasher
      },
    },
    {
      type: fohSetup,
      startHour: 16, // 4:30pm
      startMinute: 30,
      endHour: 21, // 9:00pm
      endMinute: 0,
      capacities: {
        Wellington: 2, // 2 front of house + setup
        "Glen Innes": 1, // 1 front of house + setup
        Onehunga: 2, // 2 front of house + setup
      },
    },
    {
      type: frontOfHouse,
      startHour: 17, // 5:30pm
      startMinute: 30,
      endHour: 21, // 9:00pm
      endMinute: 0,
      capacities: {
        Wellington: 8, // 8 front of house
        "Glen Innes": 8, // 8 front of house
        Onehunga: 10, // 10 front of house
      },
    },
    {
      type: kitchenPrep,
      startHour: 12, // 12:00pm
      startMinute: 0,
      endHour: 16, // 4:00pm
      endMinute: 0,
      capacities: {
        Wellington: 7, // 7 kitchen prep
        "Glen Innes": 5, // 5 kitchen prep
        Onehunga: 6, // 6 kitchen prep
      },
    },
    {
      type: kitchenServicePack,
      startHour: 17, // 5:30pm
      startMinute: 30,
      endHour: 21, // 9:00pm
      endMinute: 0,
      capacities: {
        Wellington: 6, // 6 kitchen service
        "Glen Innes": 4, // 4 kitchen service
        Onehunga: 6, // 6 kitchen service
      },
    },
    {
      type: mediaRole,
      startHour: 17, // 5:00pm
      startMinute: 0,
      endHour: 19, // 7:00pm
      endMinute: 0,
      capacities: {
        Wellington: 1, // 1 media role
        "Glen Innes": 1, // 1 media role
        Onehunga: 1, // 1 media role
      },
    },
  ];

  const LOCATIONS = ["Wellington", "Glen Innes", "Onehunga"];
  const createdShifts = [];

  // Create historical shifts for the past 4 weeks to show volunteer history
  const historicalShifts = [];

  // Extended historical data - past 6 months for better achievement demonstration
  const extendedHistoricalPeriods = [
    // 6 months ago - started volunteering
    { weeksAgo: 24, shiftsPerWeek: 1 },
    { weeksAgo: 23, shiftsPerWeek: 1 },
    { weeksAgo: 22, shiftsPerWeek: 2 },
    { weeksAgo: 21, shiftsPerWeek: 1 },

    // 5 months ago - getting regular
    { weeksAgo: 20, shiftsPerWeek: 2 },
    { weeksAgo: 19, shiftsPerWeek: 2 },
    { weeksAgo: 18, shiftsPerWeek: 2 },
    { weeksAgo: 17, shiftsPerWeek: 3 },

    // 4 months ago - very active
    { weeksAgo: 16, shiftsPerWeek: 3 },
    { weeksAgo: 15, shiftsPerWeek: 2 },
    { weeksAgo: 14, shiftsPerWeek: 3 },
    { weeksAgo: 13, shiftsPerWeek: 2 },

    // 3 months ago - consistent volunteer
    { weeksAgo: 12, shiftsPerWeek: 2 },
    { weeksAgo: 11, shiftsPerWeek: 3 },
    { weeksAgo: 10, shiftsPerWeek: 2 },
    { weeksAgo: 9, shiftsPerWeek: 2 },

    // 2 months ago - experienced
    { weeksAgo: 8, shiftsPerWeek: 2 },
    { weeksAgo: 7, shiftsPerWeek: 3 },
    { weeksAgo: 6, shiftsPerWeek: 2 },
    { weeksAgo: 5, shiftsPerWeek: 2 },

    // Recent weeks
    { weeksAgo: 4, shiftsPerWeek: 2 },
    { weeksAgo: 3, shiftsPerWeek: 3 },
    { weeksAgo: 2, shiftsPerWeek: 2 },
    { weeksAgo: 1, shiftsPerWeek: 2 },
  ];

  // Create extended historical shifts
  for (const period of extendedHistoricalPeriods) {
    for (
      let shiftInWeek = 0;
      shiftInWeek < period.shiftsPerWeek;
      shiftInWeek++
    ) {
      // Vary the days - Monday, Wednesday, Friday pattern mostly
      const dayOffset = shiftInWeek === 0 ? 1 : shiftInWeek === 1 ? 3 : 5; // Mon, Wed, Fri
      const pastDate = addDays(today, -(period.weeksAgo * 7) + dayOffset);

      // Rotate through different shift types and locations for variety
      const shiftTypeIndex =
        (period.weeksAgo + shiftInWeek) % shiftConfigs.length;
      const locationIndex = (period.weeksAgo + shiftInWeek) % LOCATIONS.length;
      const config = shiftConfigs[shiftTypeIndex];
      const location = LOCATIONS[locationIndex];

      const start = setInNZT(pastDate, {
        hours: config.startHour,
        minutes: config.startMinute,
        seconds: 0,
        milliseconds: 0,
      });

      const end = setInNZT(pastDate, {
        hours: config.endHour,
        minutes: config.endMinute,
        seconds: 0,
        milliseconds: 0,
      });

      const historicalShift = await prisma.shift.create({
        data: {
          shiftTypeId: config.type.id,
          start,
          end,
          location,
          capacity:
            config.capacities[location as keyof typeof config.capacities],
          notes:
            period.weeksAgo === 1 && shiftInWeek === 0
              ? "Great teamwork this shift!"
              : period.weeksAgo > 20
              ? "Early volunteer shift"
              : null,
        },
      });

      historicalShifts.push(historicalShift);

      // Create signup for sample volunteer for historical shifts (respecting daily limit)
      if (canUserSignUpForDate(volunteer.id, historicalShift.start)) {
        await prisma.signup.create({
          data: {
            userId: volunteer.id,
            shiftId: historicalShift.id,
            status: "CONFIRMED",
            createdAt: addDays(start, -Math.floor(Math.random() * 7) - 1), // Signed up 1-7 days before
          },
        });
        recordUserSignup(volunteer.id, historicalShift.start);
      }

      // Also add some other volunteers to these shifts for realism
      const volunteersToAdd = Math.min(
        config.capacities[location as keyof typeof config.capacities] - 1, // Leave space for sample volunteer
        Math.floor(Math.random() * 3) + 1 // 1-3 other volunteers
      );

      for (let v = 0; v < volunteersToAdd; v++) {
        const volunteerIndex =
          (period.weeksAgo * 10 + shiftInWeek * 3 + v) % extraVolunteers.length;
        const otherVolunteer = extraVolunteers[volunteerIndex];

        // Check if this volunteer can sign up for this date
        if (canUserSignUpForDate(otherVolunteer.id, historicalShift.start)) {
          await prisma.signup.upsert({
            where: {
              userId_shiftId: {
                userId: otherVolunteer.id,
                shiftId: historicalShift.id,
              },
            },
            update: {},
            create: {
              userId: otherVolunteer.id,
              shiftId: historicalShift.id,
              status: "CONFIRMED",
            },
          });
          recordUserSignup(otherVolunteer.id, historicalShift.start);
        }
      }
    }
  }

  // Create friend recommendations by adding shared shifts with non-friends
  console.log("🤝 Seeding friend recommendations...");

  // Get volunteers who are NOT friends with the sample volunteer
  const nonFriends = extraVolunteers.filter(
    (v) =>
      !existingFriends.some((f) => f && f.id === v.id) &&
      !pendingRequesters.some((r) => r && r.id === v.id) &&
      !sentRequestTargets.includes(v.email)
  );

  // Select a few volunteers to be recommended friends (shared 5+ shifts in last 3 months)
  const recommendedFriendCandidates = [
    nonFriends.find((v) => v.email === "emma.brown@gmail.com"),
    nonFriends.find((v) => v.email === "liam.wilson@hotmail.com"),
    nonFriends.find((v) => v.email === "vol2@example.com"),
  ].filter(Boolean);

  // Get sample volunteer's recent shifts (last 3 months)
  const threeMonthsAgo = subMonths(new Date(), 3);
  const sampleVolunteerRecentSignups = await prisma.signup.findMany({
    where: {
      userId: volunteer.id,
      status: "CONFIRMED",
      shift: {
        start: {
          gte: threeMonthsAgo,
        },
      },
    },
    include: {
      shift: true,
    },
    orderBy: {
      shift: {
        start: "desc",
      },
    },
  });

  // For each recommended friend candidate, sign them up for 5-7 of the same recent shifts
  for (const recommendedFriend of recommendedFriendCandidates) {
    if (!recommendedFriend) continue;
    const shiftsToShare = Math.min(
      7,
      Math.max(5, sampleVolunteerRecentSignups.length)
    );
    let sharedCount = 0;

    for (
      let i = 0;
      i < sampleVolunteerRecentSignups.length && sharedCount < shiftsToShare;
      i++
    ) {
      const signup = sampleVolunteerRecentSignups[i];

      // Check if this recommended friend can sign up for this date
      if (canUserSignUpForDate(recommendedFriend.id, signup.shift.start)) {
        try {
          await prisma.signup.create({
            data: {
              userId: recommendedFriend.id,
              shiftId: signup.shift.id,
              status: "CONFIRMED",
              createdAt: addDays(
                signup.shift.start,
                -Math.floor(Math.random() * 5) - 1
              ),
            },
          });
          recordUserSignup(recommendedFriend.id, signup.shift.start);
          sharedCount++;
        } catch (error) {
          // Skip if signup already exists
          if (!(error as Error).message.includes("Unique constraint")) {
            console.log(
              `Could not add recommended friend ${
                recommendedFriend.email
              } to shift: ${(error as Error).message}`
            );
          }
        }
      }
    }

    console.log(
      `✅ Created ${sharedCount} shared shifts with recommended friend ${recommendedFriend.email}`
    );
  }

  console.log(
    `✅ Created ${recommendedFriendCandidates.length} friend recommendation candidates`
  );

  // Create shifts for the next 14 days, but only for operating days (Sunday-Thursday)
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Only create shifts for Sunday (0) through Thursday (4)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      // Skip Friday (5) and Saturday (6) - restaurant is closed
      continue;
    }

    console.log(
      `📅 Creating shifts for ${date.toDateString()} (${
        [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ][dayOfWeek]
      })`
    );

    // Create shifts for each location and shift type
    for (
      let locationIndex = 0;
      locationIndex < LOCATIONS.length;
      locationIndex++
    ) {
      const location = LOCATIONS[locationIndex];

      for (
        let configIndex = 0;
        configIndex < shiftConfigs.length;
        configIndex++
      ) {
        const config = shiftConfigs[configIndex];

        // For today's shifts, ensure they're set to future times so they show up in the calendar
        let startHour = config.startHour;
        let startMinute = config.startMinute;
        let endHour = config.endHour;
        let endMinute = config.endMinute;

        // If this is the first day's shift and the time has already passed, set it to a future time
        if (i === 0) {
          // Today's shifts
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();

          // If the shift time has already passed, set it to start in 1 hour
          if (
            startHour < currentHour ||
            (startHour === currentHour && startMinute <= currentMinute)
          ) {
            startHour = currentHour + 1;
            startMinute = 0;
            // Adjust end time accordingly
            endHour = startHour + (config.endHour - config.startHour);
            endMinute = config.endMinute;
          }
        }

        const start = setInNZT(date, {
          hours: startHour,
          minutes: startMinute,
          seconds: 0,
          milliseconds: 0,
        });

        const end = setInNZT(date, {
          hours: endHour,
          minutes: endMinute,
          seconds: 0,
          milliseconds: 0,
        });

        const shift = await prisma.shift.create({
          data: {
            shiftTypeId: config.type.id,
            start,
            end,
            location,
            capacity:
              config.capacities[location as keyof typeof config.capacities],
            notes:
              i === 0 && configIndex === 0
                ? "Bring closed-toe shoes and apron"
                : null,
          },
          include: {
            shiftType: true,
          },
        });
        createdShifts.push(shift);
      }
    }
  }

  // SKIP signing up sample volunteer for the first shift to demonstrate filtering
  // (This ensures at least the first day is completely free for testing)

  // Make some shifts full and add a waitlisted signup to demonstrate UI state
  // Also add friends to shifts to demonstrate social features
  let extraIndex = 0;

  // Get sample volunteer's friends for social seeding
  const sampleVolunteerFriends = [
    extraVolunteers.find((v) => v.email === "sarah.chen@gmail.com"),
    extraVolunteers.find((v) => v.email === "james.williams@hotmail.com"),
    extraVolunteers.find((v) => v.email === "priya.patel@yahoo.com"),
  ].filter(Boolean);

  // Record existing historical signups to prevent conflicts
  console.log("📊 Recording existing signups to prevent daily conflicts...");
  const existingSignups = await prisma.signup.findMany({
    include: {
      shift: true,
    },
  });

  for (const signup of existingSignups) {
    recordUserSignup(signup.userId, signup.shift.start);
  }

  // Find the next two operating days (Sunday-Thursday only)
  const getNextOperatingDays = () => {
    const operatingDays = [];
    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const dayOfWeek = date.getDay();

      // Only include Sunday (0) through Thursday (4)
      if (dayOfWeek >= 0 && dayOfWeek <= 4) {
        operatingDays.push(formatInNZT(date, "yyyy-MM-dd"));
        if (operatingDays.length === 2) break;
      }
    }
    return operatingDays;
  };

  const [nextOperatingDay, secondOperatingDay] = getNextOperatingDays();
  console.log(`🎯 Next operating day (fully booked): ${nextOperatingDay}`);
  console.log(`🎯 Second operating day (nearly booked): ${secondOperatingDay}`);

  // Track spots left for second operating day across all shifts
  let secondDaySpotsLeft = 2; // Total spots to leave available for second operating day

  for (let i = 0; i < createdShifts.length; i++) {
    const s = createdShifts[i];
    const shiftDate = new Date(s.start);

    // Use date-only comparison by comparing YYYY-MM-DD strings in NZ timezone
    const shiftDateStr = formatInNZT(shiftDate, "yyyy-MM-dd");

    const isNextOperatingDay = shiftDateStr === nextOperatingDay;
    const isSecondOperatingDay = shiftDateStr === secondOperatingDay;

    // Fill shifts based on day
    let shouldFillShift = false;
    let spotsToFill = 0;

    if (isNextOperatingDay) {
      // Next operating day: completely book out ALL shifts - no spots left
      console.log(
        `📅 COMPLETELY BOOKING NEXT OPERATING DAY's shift: ${
          s.shiftType?.name || "Unknown"
        } at ${s.location} (${s.capacity} spots - FULLY BOOKED)`
      );
      shouldFillShift = true;
      spotsToFill = s.capacity;
    } else if (isSecondOperatingDay) {
      // Second operating day: leave only 1-2 spots TOTAL across all shifts
      if (secondDaySpotsLeft > 0) {
        const spotsToLeaveThisShift = Math.min(secondDaySpotsLeft, s.capacity);
        spotsToFill = s.capacity - spotsToLeaveThisShift;
        secondDaySpotsLeft -= spotsToLeaveThisShift;

        console.log(
          `📅 Nearly booking SECOND OPERATING DAY's shift: ${
            s.shiftType?.name || "Unknown"
          } at ${s.location} (${spotsToFill}/${
            s.capacity
          } spots, leaving ${spotsToLeaveThisShift}, ${secondDaySpotsLeft} spots remaining for other shifts)`
        );
      } else {
        // No more spots to leave - fully book this shift
        spotsToFill = s.capacity;
        console.log(
          `📅 FULLY booking remaining SECOND OPERATING DAY shift: ${
            s.shiftType?.name || "Unknown"
          } at ${s.location} (${s.capacity}/${
            s.capacity
          } spots - no more spots to leave)`
        );
      }
      shouldFillShift = true;
    } else {
      // Other days: every 4th shift gets filled (original logic)
      shouldFillShift = i % 4 === 0;
      spotsToFill = s.capacity;
    }

    if (shouldFillShift) {
      // Create confirmed signups to fill the shift
      for (let c = 0; c < spotsToFill; c++) {
        const user = extraVolunteers[(extraIndex + c) % extraVolunteers.length];

        // Check if user can sign up for this date
        if (canUserSignUpForDate(user.id, s.start)) {
          await prisma.signup.upsert({
            where: { userId_shiftId: { userId: user.id, shiftId: s.id } },
            update: { status: "CONFIRMED" },
            create: { userId: user.id, shiftId: s.id, status: "CONFIRMED" },
          });
          recordUserSignup(user.id, s.start);
        }
      }
      extraIndex = (extraIndex + spotsToFill) % extraVolunteers.length;

      // Add waitlisted person only for next operating day's fully booked shifts (since it's completely full)
      if (isNextOperatingDay && spotsToFill === s.capacity) {
        const waitlister = extraVolunteers[extraIndex % extraVolunteers.length];
        // Waitlisted users don't count towards daily limit since they're not confirmed
        await prisma.signup.upsert({
          where: { userId_shiftId: { userId: waitlister.id, shiftId: s.id } },
          update: { status: "WAITLISTED" },
          create: {
            userId: waitlister.id,
            shiftId: s.id,
            status: "WAITLISTED",
          },
        });
        extraIndex = (extraIndex + 1) % extraVolunteers.length;
        console.log(
          `⏳ Added waitlisted volunteer for fully booked NEXT OPERATING DAY shift: ${
            s.shiftType?.name || "Unknown"
          } at ${s.location}`
        );
      }
      // Note: Tomorrow shifts don't get waitlisted since they still have 1-2 spots available
    }

    // Add friends to shifts where sample volunteer is signed up (to show social activity)
    const shiftDay = s.start.getDate();
    const shouldSignUp = shiftDay % 3 === 0 && i % 10 === 0; // Match sample volunteer's condition

    if (shouldSignUp && sampleVolunteerFriends.length > 0) {
      // Add 1-2 friends to this shift to create social activity
      const friendsToAdd = Math.min(2, Math.floor(Math.random() * 2) + 1);

      for (let f = 0; f < friendsToAdd; f++) {
        const friend =
          sampleVolunteerFriends[f % sampleVolunteerFriends.length];

        if (!friend) continue;
        // Check if friend can sign up for this date
        if (canUserSignUpForDate(friend.id, s.start)) {
          try {
            await prisma.signup.create({
              data: {
                userId: friend.id,
                shiftId: s.id,
                status: "CONFIRMED",
              },
            });
            recordUserSignup(friend.id, s.start);
            console.log(
              `✅ Signed up friend ${
                friend.email
              } for same shift as sample volunteer on ${s.start.toDateString()}`
            );
          } catch (error) {
            // Skip if signup already exists
            if (!(error as Error).message.includes("Unique constraint")) {
              console.log(
                `Could not add friend ${friend?.email} to shift: ${
                  (error as Error).message
                }`
              );
            }
          }
        }
      }
    }

    // Only sign up sample volunteer for very specific shifts to demonstrate filtering
    // This ensures most days are free, with only 2-3 days having signups
    // (shouldSignUp and shiftDay already declared above for friend signup logic)

    if (shouldSignUp) {
      // Check if sample volunteer can sign up for this date
      if (canUserSignUpForDate(volunteer.id, s.start)) {
        try {
          await prisma.signup.create({
            data: {
              userId: volunteer.id,
              shiftId: s.id,
              status: "CONFIRMED",
            },
          });
          recordUserSignup(volunteer.id, s.start);
          console.log(
            `✅ Signed up sample volunteer for ${s.start.toDateString()}`
          );
        } catch (error) {
          // Skip if signup already exists
          if (!(error as Error).message.includes("Unique constraint")) {
            console.log(
              `Could not add sample volunteer to shift: ${
                (error as Error).message
              }`
            );
          }
        }
      }
    }
  }

  // Seed notifications
  console.log("🔔 Seeding notifications...");
  try {
    // Get some users for creating realistic notifications
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    const sampleUser = allUsers.find(
      (u) => u.email === "volunteer@example.com"
    );
    const otherUsers = allUsers.filter(
      (u) =>
        u.email !== "volunteer@example.com" &&
        u.email !== "admin@everybodyeats.nz"
    );

    if (sampleUser && otherUsers.length > 0) {
      // Create a variety of notifications for the sample user
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const notifications = [
        // Recent friend request
        {
          userId: sampleUser.id,
          type: NotificationType.FRIEND_REQUEST_RECEIVED,
          title: "New friend request",
          message: `${
            otherUsers[0].firstName || otherUsers[0].name || "Someone"
          } sent you a friend request`,
          actionUrl: "/friends?tab=requests",
          relatedId: "fake-friend-request-id",
          isRead: false,
          createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        // Shift confirmed notification
        {
          userId: sampleUser.id,
          type: NotificationType.SHIFT_CONFIRMED,
          title: "Shift confirmed",
          message:
            "Your Kitchen Prep shift on Saturday, August 24, 2025 has been confirmed",
          actionUrl: "/shifts/mine",
          relatedId: "fake-shift-id",
          isRead: false,
          createdAt: oneDayAgo,
        },
        // Friend request accepted (older, read)
        {
          userId: sampleUser.id,
          type: NotificationType.FRIEND_REQUEST_ACCEPTED,
          title: "Friend request accepted",
          message: `${
            otherUsers[1].firstName || otherUsers[1].name || "Someone"
          } accepted your friend request`,
          actionUrl: "/friends",
          relatedId: "fake-friendship-id",
          isRead: true,
          createdAt: twoDaysAgo,
        },
        // Waitlisted notification (older, read)
        {
          userId: sampleUser.id,
          type: NotificationType.SHIFT_WAITLISTED,
          title: "Added to waitlist",
          message:
            "You've been added to the waitlist for Food Service on Sunday, August 18, 2025",
          actionUrl: "/shifts/mine",
          relatedId: "fake-shift-id-2",
          isRead: true,
          createdAt: oneWeekAgo,
        },
        // Achievement unlocked (mix of read/unread)
        {
          userId: sampleUser.id,
          type: NotificationType.ACHIEVEMENT_UNLOCKED,
          title: "Achievement unlocked!",
          message: 'Congratulations! You earned the "First Steps" achievement',
          actionUrl: "/dashboard",
          relatedId: "fake-achievement-id",
          isRead: Math.random() > 0.5, // Randomly read or unread
          createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        },
      ];

      // Create notifications
      for (const notificationData of notifications) {
        await prisma.notification.create({
          data: notificationData,
        });
      }

      // Also create some notifications for other users so they have data too
      if (otherUsers.length >= 2) {
        const additionalNotifications = [
          {
            userId: otherUsers[0].id,
            type: "FRIEND_REQUEST_RECEIVED" as NotificationType,
            title: "New friend request",
            message: `${
              sampleUser.firstName || sampleUser.name || "Someone"
            } sent you a friend request`,
            actionUrl: "/friends",
            relatedId: "fake-friend-request-id-2",
            isRead: false,
            createdAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
          },
          {
            userId: otherUsers[1].id,
            type: "SHIFT_CONFIRMED" as NotificationType,
            title: "Shift confirmed",
            message:
              "Your Dishwashing shift on Friday, August 23, 2025 has been confirmed",
            actionUrl: "/shifts/mine",
            relatedId: "fake-shift-id-3",
            isRead: true,
            createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
          },
        ];

        for (const notificationData of additionalNotifications) {
          await prisma.notification.create({
            data: notificationData,
          });
        }
      }

      console.log(
        `✅ Seeded ${
          notifications.length + (otherUsers.length >= 2 ? 2 : 0)
        } notifications`
      );
    } else {
      console.log("⚠️ Could not find required users for notification seeding");
    }
  } catch (error) {
    console.error(
      "Warning: Could not seed notifications:",
      (error as Error).message
    );
  }

  // Seed achievements
  console.log("🎯 Seeding achievements...");
  try {
    // Define achievements directly here to avoid import issues
    const ACHIEVEMENT_DEFINITIONS = [
      // Milestone Achievements
      {
        name: "First Steps",
        description: "Complete your first volunteer shift",
        category: AchievementCategory.MILESTONE,
        icon: "🌟",
        criteria: JSON.stringify({ type: "shifts_completed", value: 1 }),
        points: 10,
      },
      {
        name: "Getting Started",
        description: "Complete 5 volunteer shifts",
        category: AchievementCategory.MILESTONE,
        icon: "⭐",
        criteria: JSON.stringify({ type: "shifts_completed", value: 5 }),
        points: 25,
      },
      {
        name: "Making a Difference",
        description: "Complete 10 volunteer shifts",
        category: AchievementCategory.MILESTONE,
        icon: "🎯",
        criteria: JSON.stringify({ type: "shifts_completed", value: 10 }),
        points: 50,
      },
      {
        name: "Veteran Volunteer",
        description: "Complete 25 volunteer shifts",
        category: AchievementCategory.MILESTONE,
        icon: "🏆",
        criteria: JSON.stringify({ type: "shifts_completed", value: 25 }),
        points: 100,
      },
      {
        name: "Community Champion",
        description: "Complete 50 volunteer shifts",
        category: AchievementCategory.MILESTONE,
        icon: "👑",
        criteria: JSON.stringify({ type: "shifts_completed", value: 50 }),
        points: 200,
      },
      // Hour-based Achievements
      {
        name: "Time Keeper",
        description: "Volunteer for 10 hours",
        category: AchievementCategory.DEDICATION,
        icon: "⏰",
        criteria: JSON.stringify({ type: "hours_volunteered", value: 10 }),
        points: 30,
      },
      {
        name: "Dedicated Helper",
        description: "Volunteer for 25 hours",
        category: AchievementCategory.DEDICATION,
        icon: "💪",
        criteria: JSON.stringify({ type: "hours_volunteered", value: 25 }),
        points: 75,
      },
      {
        name: "Marathon Volunteer",
        description: "Volunteer for 50 hours",
        category: AchievementCategory.DEDICATION,
        icon: "🏃",
        criteria: JSON.stringify({ type: "hours_volunteered", value: 50 }),
        points: 150,
      },
      {
        name: "Century Club",
        description: "Volunteer for 100 hours",
        category: AchievementCategory.DEDICATION,
        icon: "💯",
        criteria: JSON.stringify({ type: "hours_volunteered", value: 100 }),
        points: 300,
      },
      // Consistency Achievements
      {
        name: "Consistent Helper",
        description: "Volunteer for 3 consecutive months",
        category: AchievementCategory.DEDICATION,
        icon: "📅",
        criteria: JSON.stringify({ type: "consecutive_months", value: 3 }),
        points: 50,
      },
      {
        name: "Reliable Volunteer",
        description: "Volunteer for 6 consecutive months",
        category: AchievementCategory.DEDICATION,
        icon: "🗓️",
        criteria: JSON.stringify({ type: "consecutive_months", value: 6 }),
        points: 100,
      },
      {
        name: "Year-Round Helper",
        description: "Volunteer for 12 consecutive months",
        category: AchievementCategory.DEDICATION,
        icon: "🎊",
        criteria: JSON.stringify({ type: "consecutive_months", value: 12 }),
        points: 200,
      },
      // Anniversary Achievements
      {
        name: "One Year Strong",
        description: "Volunteer for one full year",
        category: AchievementCategory.MILESTONE,
        icon: "🎂",
        criteria: JSON.stringify({ type: "years_volunteering", value: 1 }),
        points: 150,
      },
      {
        name: "Two Year Veteran",
        description: "Volunteer for two full years",
        category: AchievementCategory.MILESTONE,
        icon: "🎉",
        criteria: JSON.stringify({ type: "years_volunteering", value: 2 }),
        points: 300,
      },
      // Community Impact
      {
        name: "Meal Master",
        description: "Help prepare an estimated 100 meals",
        category: AchievementCategory.IMPACT,
        icon: "🍽️",
        criteria: JSON.stringify({ type: "community_impact", value: 100 }),
        points: 75,
      },
      {
        name: "Food Hero",
        description: "Help prepare an estimated 500 meals",
        category: AchievementCategory.IMPACT,
        icon: "🦸",
        criteria: JSON.stringify({ type: "community_impact", value: 500 }),
        points: 200,
      },
      {
        name: "Hunger Fighter",
        description: "Help prepare an estimated 1000 meals",
        category: AchievementCategory.IMPACT,
        icon: "⚔️",
        criteria: JSON.stringify({ type: "community_impact", value: 1000 }),
        points: 400,
      },
    ];

    // Create achievements
    for (const achievementDef of ACHIEVEMENT_DEFINITIONS) {
      await prisma.achievement.upsert({
        where: { name: achievementDef.name },
        update: {
          description: achievementDef.description,
          category: achievementDef.category,
          icon: achievementDef.icon,
          criteria: achievementDef.criteria,
          points: achievementDef.points,
          isActive: true,
        },
        create: {
          name: achievementDef.name,
          description: achievementDef.description,
          category: achievementDef.category,
          icon: achievementDef.icon,
          criteria: achievementDef.criteria,
          points: achievementDef.points,
          isActive: true,
        },
      });
    }
    console.log(`✅ Seeded ${ACHIEVEMENT_DEFINITIONS.length} achievements`);

    // Calculate sample volunteer's achievements
    const completedShifts = await prisma.signup.count({
      where: {
        userId: volunteer.id,
        status: "CONFIRMED",
        shift: { end: { lt: new Date() } },
      },
    });
    console.log(`📊 Sample volunteer has completed ${completedShifts} shifts`);
  } catch (error) {
    console.error(
      "Warning: Could not seed achievements:",
      (error as Error).message
    );
  }

  // Seed auto-accept rules
  console.log("⚡ Seeding auto-accept rules...");
  try {
    // Get admin user for creating rules
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!adminUser) {
      console.log("⚠️ No admin user found, skipping auto-accept rules seeding");
    } else {
      const autoAcceptRules = [
        // Rule 1: Auto-approve experienced volunteers (YELLOW grade) with good attendance
        {
          name: "Experienced Volunteer Fast Track",
          description:
            "Automatically approve experienced volunteers (Yellow grade) with good attendance records",
          enabled: true,
          priority: 10,
          global: true, // Apply to all shift types
          shiftTypeId: null,
          minVolunteerGrade: VolunteerGrade.YELLOW,
          minCompletedShifts: 5,
          minAttendanceRate: 85.0,
          minAccountAgeDays: 30,
          maxDaysInAdvance: null,
          requireShiftTypeExperience: false,
          criteriaLogic: CriteriaLogic.AND,
          stopOnMatch: true,
          createdBy: adminUser.id,
        },

        // Rule 2: Auto-approve shift leaders (PINK grade) immediately
        {
          name: "Shift Leader Priority Access",
          description:
            "Automatically approve all shift leaders (Pink grade) - they have proven reliability",
          enabled: true,
          priority: 20, // Higher priority than experienced volunteers
          global: true,
          shiftTypeId: null,
          minVolunteerGrade: VolunteerGrade.PINK,
          minCompletedShifts: null,
          minAttendanceRate: null,
          minAccountAgeDays: null,
          maxDaysInAdvance: null,
          requireShiftTypeExperience: false,
          criteriaLogic: CriteriaLogic.AND,
          stopOnMatch: true,
          createdBy: adminUser.id,
        },

        // Rule 3: Auto-approve volunteers for Kitchen Prep shifts (easier entry point)
        {
          name: "Kitchen Prep Open Access",
          description:
            "Auto-approve any volunteer with basic experience for Kitchen Prep shifts",
          enabled: true,
          priority: 5, // Lower priority than grade-based rules
          global: false,
          shiftTypeId: kitchenPrep.id,
          minVolunteerGrade: VolunteerGrade.GREEN,
          minCompletedShifts: 2,
          minAttendanceRate: 75.0,
          minAccountAgeDays: 14,
          maxDaysInAdvance: null,
          requireShiftTypeExperience: false,
          criteriaLogic: CriteriaLogic.AND,
          stopOnMatch: false, // Allow other rules to also match
          createdBy: adminUser.id,
        },

        // Rule 4: Auto-approve for shifts happening soon (last-minute coverage)
        {
          name: "Last-Minute Coverage",
          description:
            "Auto-approve reliable volunteers for shifts starting within 3 days",
          enabled: true,
          priority: 15,
          global: true,
          shiftTypeId: null,
          minVolunteerGrade: VolunteerGrade.GREEN,
          minCompletedShifts: 3,
          minAttendanceRate: 80.0,
          minAccountAgeDays: 21,
          maxDaysInAdvance: 3, // Only for shifts starting within 3 days
          requireShiftTypeExperience: false,
          criteriaLogic: CriteriaLogic.AND,
          stopOnMatch: true,
          createdBy: adminUser.id,
        },

        // Rule 5: Dishwasher experience required (specific skill rule)
        {
          name: "Dishwasher Veterans Only",
          description:
            "Auto-approve volunteers with dishwashing experience for dishwasher shifts",
          enabled: true,
          priority: 8,
          global: false,
          shiftTypeId: dishwasher.id,
          minVolunteerGrade: VolunteerGrade.GREEN,
          minCompletedShifts: 1,
          minAttendanceRate: null,
          minAccountAgeDays: 7,
          maxDaysInAdvance: null,
          requireShiftTypeExperience: true, // Must have done dishwashing before
          criteriaLogic: CriteriaLogic.AND,
          stopOnMatch: true,
          createdBy: adminUser.id,
        },

        // Rule 6: High-volume volunteers (OR logic example)
        {
          name: "Super Volunteer Express",
          description:
            "Auto-approve volunteers who are either very experienced OR have excellent attendance",
          enabled: true,
          priority: 12,
          global: true,
          shiftTypeId: null,
          minVolunteerGrade: VolunteerGrade.GREEN,
          minCompletedShifts: 15, // Either 15+ shifts
          minAttendanceRate: 95.0, // OR 95%+ attendance
          minAccountAgeDays: 60,
          maxDaysInAdvance: null,
          requireShiftTypeExperience: false,
          criteriaLogic: CriteriaLogic.OR, // Either condition can be true
          stopOnMatch: true,
          createdBy: adminUser.id,
        },
      ];

      // Create auto-accept rules
      for (const ruleData of autoAcceptRules) {
        await prisma.autoAcceptRule.create({
          data: ruleData,
        });
      }

      console.log(`✅ Seeded ${autoAcceptRules.length} auto-accept rules`);

      // Display volunteer grade distribution
      console.log("🎖️ Checking volunteer grade distribution...");

      const gradeStats = await prisma.user.groupBy({
        by: ["volunteerGrade"],
        where: { role: "VOLUNTEER" },
        _count: { volunteerGrade: true },
      });

      for (const stat of gradeStats) {
        const gradeInfo = {
          GREEN: { emoji: "🟢", name: "Standard" },
          YELLOW: { emoji: "🟡", name: "Experienced" },
          PINK: { emoji: "🩷", name: "Shift Leader" },
        };
        const info = gradeInfo[
          stat.volunteerGrade as keyof typeof gradeInfo
        ] || {
          emoji: "❓",
          name: "Unknown",
        };
        console.log(
          `   ${info.emoji} ${stat.volunteerGrade} (${info.name}): ${stat._count.volunteerGrade} volunteers`
        );
      }

      // Optional: Promote some volunteers based on their extensive shift history if they need it
      console.log(
        "🔄 Checking for any needed grade promotions based on shift history..."
      );

      const userShiftCounts = await prisma.user.findMany({
        where: { role: "VOLUNTEER" },
        include: {
          signups: {
            where: {
              status: "CONFIRMED",
              shift: { end: { lt: new Date() } }, // Only completed shifts
            },
          },
        },
      });

      let promotions = 0;
      for (const user of userShiftCounts) {
        const shiftCount = user.signups.length;
        let recommendedGrade: VolunteerGrade = VolunteerGrade.GREEN; // Default

        if (shiftCount >= 25) {
          recommendedGrade = VolunteerGrade.PINK; // Shift leader after 25 shifts
        } else if (shiftCount >= 10) {
          recommendedGrade = VolunteerGrade.YELLOW; // Experienced after 10 shifts
        }

        // Only promote if they're below what their shift count suggests
        const gradePriority = { GREEN: 0, YELLOW: 1, PINK: 2 };
        const currentPriority =
          gradePriority[user.volunteerGrade as keyof typeof gradePriority];
        const recommendedPriority =
          gradePriority[recommendedGrade as keyof typeof gradePriority];

        if (currentPriority < recommendedPriority) {
          await prisma.user.update({
            where: { id: user.id },
            data: { volunteerGrade: recommendedGrade },
          });
          console.log(
            `   📈 Promoted ${user.email} from ${user.volunteerGrade} → ${recommendedGrade} (${shiftCount} completed shifts)`
          );
          promotions++;
        }
      }

      if (promotions === 0) {
        console.log(
          "   ✅ All volunteer grades are appropriate for their experience level"
        );
      } else {
        console.log(
          `   ✅ Applied ${promotions} promotions based on shift history`
        );
      }

      console.log("✅ Auto-accept rules seeding completed");
    }
  } catch (error) {
    console.error(
      "Warning: Could not seed auto-accept rules:",
      (error as Error).message
    );
  }

  // Download and convert profile images after all users are created
  // Create shift templates for location-specific capacities
  console.log("📋 Seeding shift templates...");

  const templateConfigs = [
    // Wellington templates
    {
      name: "Wellington Kitchen Prep",
      location: "Wellington",
      shiftType: kitchenPrep,
      startTime: "12:00",
      endTime: "16:00",
      capacity: 7,
      notes: "Food preparation and ingredient prep",
    },
    {
      name: "Wellington Kitchen Service & Pack Down",
      location: "Wellington",
      shiftType: kitchenServicePack,
      startTime: "17:30",
      endTime: "21:00",
      capacity: 6,
      notes: "Cooking service and kitchen cleanup",
    },
    {
      name: "Wellington Front of House",
      location: "Wellington",
      shiftType: frontOfHouse,
      startTime: "17:30",
      endTime: "21:00",
      capacity: 8,
      notes: "Guest service and dining room support",
    },
    {
      name: "Wellington FOH Set-Up & Service",
      location: "Wellington",
      shiftType: fohSetup,
      startTime: "16:30",
      endTime: "21:00",
      capacity: 2,
      notes: "Front of house setup and service support",
    },
    {
      name: "Wellington Dishwasher",
      location: "Wellington",
      shiftType: dishwasher,
      startTime: "17:30",
      endTime: "21:00",
      capacity: 3,
      notes: "Dishwashing and kitchen cleaning duties",
    },
    {
      name: "Wellington Media Role",
      location: "Wellington",
      shiftType: mediaRole,
      startTime: "17:00",
      endTime: "19:00",
      capacity: 1,
      notes:
        "Photography, social media content creation, and community engagement",
    },

    // Glen Innes templates
    {
      name: "Glen Innes Kitchen Prep",
      location: "Glen Innes",
      shiftType: kitchenPrep,
      startTime: "12:00",
      endTime: "16:00",
      capacity: 5,
      notes: "Food preparation and ingredient prep",
    },
    {
      name: "Glen Innes Kitchen Service & Pack Down",
      location: "Glen Innes",
      shiftType: kitchenServicePack,
      startTime: "17:30",
      endTime: "21:00",
      capacity: 4,
      notes: "Cooking service and kitchen cleanup",
    },
    {
      name: "Glen Innes Front of House",
      location: "Glen Innes",
      shiftType: frontOfHouse,
      startTime: "17:30",
      endTime: "21:00",
      capacity: 8,
      notes: "Guest service and dining room support",
    },
    {
      name: "Glen Innes FOH Set-Up & Service",
      location: "Glen Innes",
      shiftType: fohSetup,
      startTime: "16:30",
      endTime: "21:00",
      capacity: 1,
      notes: "Front of house setup and service support",
    },
    {
      name: "Glen Innes Dishwasher",
      location: "Glen Innes",
      shiftType: dishwasher,
      startTime: "17:30",
      endTime: "21:00",
      capacity: 2,
      notes: "Dishwashing and kitchen cleaning duties",
    },
    {
      name: "Glen Innes Media Role",
      location: "Glen Innes",
      shiftType: mediaRole,
      startTime: "17:00",
      endTime: "19:00",
      capacity: 1,
      notes:
        "Photography, social media content creation, and community engagement",
    },

    // Onehunga templates
    {
      name: "Onehunga Kitchen Prep",
      location: "Onehunga",
      shiftType: kitchenPrep,
      startTime: "12:00",
      endTime: "16:00",
      capacity: 6,
      notes: "Food preparation and ingredient prep",
    },
    {
      name: "Onehunga Kitchen Service & Pack Down",
      location: "Onehunga",
      shiftType: kitchenServicePack,
      startTime: "17:30",
      endTime: "21:00",
      capacity: 6,
      notes: "Cooking service and kitchen cleanup",
    },
    {
      name: "Onehunga Front of House",
      location: "Onehunga",
      shiftType: frontOfHouse,
      startTime: "17:30",
      endTime: "21:00",
      capacity: 10,
      notes: "Guest service and dining room support",
    },
    {
      name: "Onehunga FOH Set-Up & Service",
      location: "Onehunga",
      shiftType: fohSetup,
      startTime: "16:30",
      endTime: "21:00",
      capacity: 2,
      notes: "Front of house setup and service support",
    },
    {
      name: "Onehunga Dishwasher",
      location: "Onehunga",
      shiftType: dishwasher,
      startTime: "17:30",
      endTime: "21:00",
      capacity: 2,
      notes: "Dishwashing and kitchen cleaning duties",
    },
    {
      name: "Onehunga Media Role",
      location: "Onehunga",
      shiftType: mediaRole,
      startTime: "17:00",
      endTime: "19:00",
      capacity: 1,
      notes:
        "Photography, social media content creation, and community engagement",
    },
  ];

  // Create shift templates
  for (const templateConfig of templateConfigs) {
    await prisma.shiftTemplate.upsert({
      where: {
        name_location: {
          name: templateConfig.name,
          location: templateConfig.location,
        },
      },
      update: {
        shiftTypeId: templateConfig.shiftType.id,
        startTime: templateConfig.startTime,
        endTime: templateConfig.endTime,
        capacity: templateConfig.capacity,
        notes: templateConfig.notes,
      },
      create: {
        name: templateConfig.name,
        location: templateConfig.location,
        shiftTypeId: templateConfig.shiftType.id,
        startTime: templateConfig.startTime,
        endTime: templateConfig.endTime,
        capacity: templateConfig.capacity,
        notes: templateConfig.notes,
      },
    });
  }

  console.log(`✅ Seeded ${templateConfigs.length} shift templates`);

  // Seed admin notes for demonstration
  console.log("🗒️  Seeding admin notes...");

  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  // Get a few volunteers to add notes for
  const volunteersForNotes = await prisma.user.findMany({
    where: {
      role: "VOLUNTEER",
      email: {
        in: [
          "volunteer@example.com",
          "sarah.chen@gmail.com",
          "james.williams@hotmail.com",
          "priya.patel@yahoo.com",
          "mike.johnson@outlook.com",
        ],
      },
    },
    take: 5,
  });

  const adminNotesSeedData = [
    {
      volunteerId: volunteersForNotes[0]?.id, // Main volunteer
      content:
        "Excellent volunteer with great attitude. Always shows up early and helps with setup. Has kitchen experience and is very reliable.",
      createdAt: subDays(new Date(), 15),
    },
    {
      volunteerId: volunteersForNotes[0]?.id, // Second note for same volunteer
      content:
        "Update: Now comfortable with leading food prep tasks. Consider for shift leader role in future.",
      createdAt: subDays(new Date(), 3),
    },
    {
      volunteerId: volunteersForNotes[1]?.id, // Sarah Chen
      content:
        "New volunteer, very enthusiastic but needs guidance on food safety procedures. Paired well with experienced volunteers.",
      createdAt: subDays(new Date(), 20),
    },
    {
      volunteerId: volunteersForNotes[2]?.id, // James Williams
      content:
        "Strong leadership skills. Great at organizing other volunteers and managing kitchen workflow. Excellent communication.",
      createdAt: subDays(new Date(), 8),
    },
    {
      volunteerId: volunteersForNotes[3]?.id, // Priya Patel
      content:
        "Has dietary restrictions knowledge and is great with special dietary requests from clients. Very patient and kind.",
      createdAt: subDays(new Date(), 12),
    },
    {
      volunteerId: volunteersForNotes[4]?.id, // Mike Johnson
      content:
        "Missed last two shifts without notice. Follow up needed on commitment level.",
      createdAt: subDays(new Date(), 5),
    },
    {
      volunteerId: volunteersForNotes[4]?.id, // Mike Johnson - follow up note
      content:
        "Spoke with Mike about attendance. Had family emergency but didn't know how to notify us. Added to communications training list.",
      createdAt: subDays(new Date(), 1),
    },
  ];

  let createdNotesCount = 0;
  for (const noteData of adminNotesSeedData) {
    if (noteData.volunteerId && adminUser) {
      await prisma.adminNote.create({
        data: {
          volunteerId: noteData.volunteerId,
          content: noteData.content,
          createdBy: adminUser.id,
          createdAt: noteData.createdAt,
        },
      });
      createdNotesCount++;
    }
  }

  console.log(`✅ Seeded ${createdNotesCount} admin notes`);

  // Seed custom labels
  console.log("🏷️  Seeding custom labels...");

  const customLabelsData = [
    {
      name: "Under 16",
      color:
        "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
      icon: "🔞",
    },
    {
      name: "New Volunteer",
      color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
      icon: "✨",
    },
    {
      name: "Team Leader",
      color:
        "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
      icon: "👑",
    },
    {
      name: "High Priority",
      color: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
      icon: "🚨",
    },
    {
      name: "Needs Support",
      color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
      icon: "🤝",
    },
    {
      name: "VIP",
      color:
        "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
      icon: "💎",
    },
    {
      name: "Mentor",
      color: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100",
      icon: "🎓",
    },
  ];

  let createdLabelsCount = 0;
  for (const labelData of customLabelsData) {
    await prisma.customLabel.upsert({
      where: { name: labelData.name },
      update: {},
      create: labelData,
    });
    createdLabelsCount++;
  }

  console.log(`✅ Seeded ${createdLabelsCount} custom labels`);

  // Seed surveys with responses
  console.log("📋 Seeding surveys and responses...");

  // Get volunteers for survey assignments
  const volunteersForSurveys = await prisma.user.findMany({
    where: { role: "VOLUNTEER" },
    take: 20,
  });

  // Survey 1: Volunteer Experience Survey (NPS-style)
  const experienceSurvey = await prisma.survey.upsert({
    where: { id: "survey-volunteer-experience" },
    update: {},
    create: {
      id: "survey-volunteer-experience",
      title: "Volunteer Experience Survey",
      description:
        "Help us improve by sharing your experience volunteering with Everybody Eats.",
      isActive: true,
      triggerType: "SHIFTS_COMPLETED",
      triggerValue: 5,
      triggerMaxValue: null,
      createdBy: adminUser?.id || "",
      questions: [
        {
          id: "q1-nps",
          type: "rating_scale",
          text: "How likely are you to recommend volunteering at Everybody Eats to a friend?",
          required: true,
          minValue: 0,
          maxValue: 10,
          minLabel: "Not at all likely",
          maxLabel: "Extremely likely",
        },
        {
          id: "q2-satisfaction",
          type: "multiple_choice_single",
          text: "Overall, how satisfied are you with your volunteer experience?",
          required: true,
          options: [
            "Very satisfied",
            "Satisfied",
            "Neutral",
            "Dissatisfied",
            "Very dissatisfied",
          ],
        },
        {
          id: "q3-communication",
          type: "rating_scale",
          text: "How would you rate the communication from our team?",
          required: true,
          minValue: 1,
          maxValue: 5,
          minLabel: "Poor",
          maxLabel: "Excellent",
        },
        {
          id: "q4-improvements",
          type: "text_long",
          text: "What could we do to improve your volunteer experience?",
          required: false,
          placeholder: "Share your suggestions...",
          maxLength: 1000,
        },
        {
          id: "q5-recommend-location",
          type: "yes_no",
          text: "Would you recommend your current location to other volunteers?",
          required: true,
        },
      ],
    },
  });

  // Survey 2: First Shift Feedback
  const firstShiftSurvey = await prisma.survey.upsert({
    where: { id: "survey-first-shift" },
    update: {},
    create: {
      id: "survey-first-shift",
      title: "First Shift Feedback",
      description: "We'd love to hear about your first volunteering experience!",
      isActive: true,
      triggerType: "FIRST_SHIFT",
      triggerValue: 1,
      triggerMaxValue: 7,
      createdBy: adminUser?.id || "",
      questions: [
        {
          id: "q1-welcome",
          type: "rating_scale",
          text: "How welcome did you feel during your first shift?",
          required: true,
          minValue: 1,
          maxValue: 5,
          minLabel: "Not welcome at all",
          maxLabel: "Very welcome",
        },
        {
          id: "q2-training",
          type: "multiple_choice_single",
          text: "Did you feel adequately prepared for your shift?",
          required: true,
          options: [
            "Yes, completely prepared",
            "Mostly prepared",
            "Somewhat prepared",
            "Not very prepared",
            "Not prepared at all",
          ],
        },
        {
          id: "q3-highlights",
          type: "text_short",
          text: "What was the highlight of your first shift?",
          required: false,
          placeholder: "Share a memorable moment...",
          maxLength: 200,
        },
        {
          id: "q4-return",
          type: "yes_no",
          text: "Do you plan to volunteer again?",
          required: true,
        },
      ],
    },
  });

  // Survey 3: Skills Assessment (Manual assignment)
  const skillsSurvey = await prisma.survey.upsert({
    where: { id: "survey-skills-assessment" },
    update: {},
    create: {
      id: "survey-skills-assessment",
      title: "Skills Assessment Survey",
      description:
        "Help us understand your skills to assign you to the best roles.",
      isActive: true,
      triggerType: "MANUAL",
      triggerValue: 0,
      createdBy: adminUser?.id || "",
      questions: [
        {
          id: "q1-kitchen-exp",
          type: "multiple_choice_single",
          text: "What is your level of kitchen experience?",
          required: true,
          options: [
            "Professional chef/cook",
            "Home cooking enthusiast",
            "Basic cooking skills",
            "Beginner - eager to learn",
            "No cooking experience",
          ],
        },
        {
          id: "q2-skills",
          type: "multiple_choice_multi",
          text: "Which skills do you bring to volunteering?",
          required: true,
          options: [
            "Food preparation",
            "Cooking",
            "Serving/hospitality",
            "Cleaning/dishwashing",
            "Photography/social media",
            "Event coordination",
            "Team leadership",
            "First aid",
          ],
        },
        {
          id: "q3-preferred-role",
          type: "multiple_choice_single",
          text: "What role do you prefer?",
          required: true,
          options: [
            "Kitchen prep",
            "Cooking/chef assistance",
            "Front of house/serving",
            "Cleanup crew",
            "Flexible - any role",
          ],
        },
        {
          id: "q4-certifications",
          type: "text_short",
          text: "Do you have any food safety certifications? If yes, please list them.",
          required: false,
          placeholder: "e.g., Food Handler Certificate",
        },
      ],
    },
  });

  // Create survey assignments and responses
  const experienceResponses = [
    // Wellington volunteers
    { nps: 10, satisfaction: "Very satisfied", communication: 5, improvements: "Everything is great! Love the team.", recommend: true, location: "Wellington" },
    { nps: 9, satisfaction: "Very satisfied", communication: 4, improvements: "More parking would be helpful.", recommend: true, location: "Wellington" },
    { nps: 8, satisfaction: "Satisfied", communication: 4, improvements: "Would love more evening shifts available.", recommend: true, location: "Wellington" },
    { nps: 9, satisfaction: "Very satisfied", communication: 5, improvements: "", recommend: true, location: "Wellington" },
    { nps: 7, satisfaction: "Satisfied", communication: 3, improvements: "Better shift scheduling system would help.", recommend: true, location: "Wellington" },
    // Glen Innes volunteers
    { nps: 10, satisfaction: "Very satisfied", communication: 5, improvements: "The community here is amazing!", recommend: true, location: "Glen Innes" },
    { nps: 8, satisfaction: "Satisfied", communication: 4, improvements: "More training for new volunteers.", recommend: true, location: "Glen Innes" },
    { nps: 6, satisfaction: "Neutral", communication: 3, improvements: "Location is a bit hard to get to without a car.", recommend: false, location: "Glen Innes" },
    { nps: 9, satisfaction: "Very satisfied", communication: 5, improvements: "Love it here!", recommend: true, location: "Glen Innes" },
    // Onehunga volunteers
    { nps: 10, satisfaction: "Very satisfied", communication: 5, improvements: "Perfect volunteer experience.", recommend: true, location: "Onehunga" },
    { nps: 8, satisfaction: "Satisfied", communication: 4, improvements: "More variety in tasks would be nice.", recommend: true, location: "Onehunga" },
    { nps: 9, satisfaction: "Very satisfied", communication: 4, improvements: "", recommend: true, location: "Onehunga" },
  ];

  let assignmentCount = 0;
  for (let i = 0; i < Math.min(experienceResponses.length, volunteersForSurveys.length); i++) {
    const volunteer = volunteersForSurveys[i];
    const response = experienceResponses[i];

    // Update volunteer's available locations to match their survey response
    await prisma.user.update({
      where: { id: volunteer.id },
      data: { availableLocations: response.location },
    });

    const assignment = await prisma.surveyAssignment.create({
      data: {
        surveyId: experienceSurvey.id,
        userId: volunteer.id,
        status: "COMPLETED",
        assignedAt: subDays(new Date(), 30 - i),
        completedAt: subDays(new Date(), 28 - i),
      },
    });

    await prisma.surveyResponse.create({
      data: {
        assignmentId: assignment.id,
        submittedAt: subDays(new Date(), 28 - i),
        answers: [
          { questionId: "q1-nps", value: response.nps },
          { questionId: "q2-satisfaction", value: response.satisfaction },
          { questionId: "q3-communication", value: response.communication },
          { questionId: "q4-improvements", value: response.improvements },
          { questionId: "q5-recommend-location", value: response.recommend },
        ],
      },
    });

    assignmentCount++;
  }

  // Add some first shift survey responses
  const firstShiftResponses = [
    { welcome: 5, training: "Yes, completely prepared", highlight: "Meeting such welcoming people!", returnVolunteer: true },
    { welcome: 4, training: "Mostly prepared", highlight: "Seeing the smiles on guests' faces.", returnVolunteer: true },
    { welcome: 5, training: "Yes, completely prepared", highlight: "Learning new cooking techniques.", returnVolunteer: true },
    { welcome: 4, training: "Somewhat prepared", highlight: "Working as part of a team.", returnVolunteer: true },
    { welcome: 3, training: "Somewhat prepared", highlight: "The food was delicious!", returnVolunteer: true },
  ];

  for (let i = 0; i < Math.min(firstShiftResponses.length, volunteersForSurveys.length - 12); i++) {
    const volunteer = volunteersForSurveys[i + 12];
    const response = firstShiftResponses[i];

    const assignment = await prisma.surveyAssignment.create({
      data: {
        surveyId: firstShiftSurvey.id,
        userId: volunteer.id,
        status: "COMPLETED",
        assignedAt: subDays(new Date(), 14 - i),
        completedAt: subDays(new Date(), 13 - i),
      },
    });

    await prisma.surveyResponse.create({
      data: {
        assignmentId: assignment.id,
        submittedAt: subDays(new Date(), 13 - i),
        answers: [
          { questionId: "q1-welcome", value: response.welcome },
          { questionId: "q2-training", value: response.training },
          { questionId: "q3-highlights", value: response.highlight },
          { questionId: "q4-return", value: response.returnVolunteer },
        ],
      },
    });

    assignmentCount++;
  }

  // Add some pending survey assignments
  for (let i = 17; i < Math.min(20, volunteersForSurveys.length); i++) {
    const volunteer = volunteersForSurveys[i];

    await prisma.surveyAssignment.create({
      data: {
        surveyId: skillsSurvey.id,
        userId: volunteer.id,
        status: "PENDING",
        assignedAt: subDays(new Date(), 3),
      },
    });

    assignmentCount++;
  }

  console.log(`✅ Seeded 3 surveys with ${assignmentCount} assignments`);

  await downloadAndConvertProfileImages();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
