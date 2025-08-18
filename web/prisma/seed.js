const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { addDays, set, subYears, subMonths, subDays } = require("date-fns");

const prisma = new PrismaClient();

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
    availableLocations: JSON.stringify(["Wellington", "Glenn Innes"]),
    emailNewsletterSubscription: true,
    notificationPreference: "BOTH",
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
    availableLocations: JSON.stringify(["Glenn Innes", "Onehunga"]),
    emailNewsletterSubscription: false,
    notificationPreference: "SMS",
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
    availableLocations: JSON.stringify(["Glenn Innes"]),
    emailNewsletterSubscription: true,
    notificationPreference: "BOTH",
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
      "Glenn Innes",
      "Onehunga",
    ]),
    emailNewsletterSubscription: true,
    notificationPreference: "EMAIL",
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
    volunteerAgreementAccepted: true,
    healthSafetyPolicyAccepted: true,
  },
];

async function main() {
  const adminEmail = "admin@everybodyeats.nz";
  const volunteerEmail = "volunteer@example.com";

  const adminHash = await bcrypt.hash("admin123", 10);
  const volunteerHash = await bcrypt.hash("volunteer123", 10);

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
    },
  });

  // Create main sample volunteer with full profile
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
      availableLocations: JSON.stringify(["Wellington", "Glenn Innes"]),
      emailNewsletterSubscription: true,
      notificationPreference: "EMAIL",
      volunteerAgreementAccepted: true,
      healthSafetyPolicyAccepted: true,
      hashedPassword: volunteerHash,
      role: "VOLUNTEER",
      createdAt: subMonths(new Date(), 6), // Been volunteering for 6 months
    },
  });

  // Create realistic volunteers
  const extraVolunteers = [];
  for (let i = 0; i < REALISTIC_VOLUNTEERS.length; i++) {
    const volunteerData = REALISTIC_VOLUNTEERS[i];
    const u = await prisma.user.upsert({
      where: { email: volunteerData.email },
      update: {},
      create: {
        ...volunteerData,
        name: `${volunteerData.firstName} ${volunteerData.lastName}`,
        hashedPassword: volunteerHash,
        role: "VOLUNTEER",
      },
    });
    extraVolunteers.push(u);
  }

  // Create additional simple volunteers for testing capacity limits
  for (let i = 1; i <= 12; i++) {
    const email = `vol${i}@example.com`;
    const firstNames = [
      "Emma",
      "Liam",
      "Olivia",
      "Noah",
      "Ava",
      "Oliver",
      "Isabella",
      "Ethan",
      "Sophia",
      "Lucas",
      "Mia",
      "Mason",
    ];
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
    ];

    const firstName = firstNames[(i - 1) % firstNames.length];
    const lastName = lastNames[(i - 1) % lastNames.length];
    const age = 20 + (i % 40); // Ages between 20-59

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
          ["Wellington", "Glenn Innes", "Onehunga"].slice(0, (i % 3) + 1)
        ),
        emailNewsletterSubscription: i % 2 === 0,
        notificationPreference: ["EMAIL", "SMS", "BOTH", "NONE"][i % 4],
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
        hashedPassword: volunteerHash,
        role: "VOLUNTEER",
      },
    });
    extraVolunteers.push(u);
  }

  // Create friend relationships for sample volunteer
  console.log("👫 Seeding friend relationships...");
  
  // Sample volunteer's existing friends (bidirectional friendships)
  const existingFriends = [
    extraVolunteers.find(v => v.email === "sarah.chen@gmail.com"),
    extraVolunteers.find(v => v.email === "james.williams@hotmail.com"),
    extraVolunteers.find(v => v.email === "priya.patel@yahoo.com"),
    extraVolunteers.find(v => v.email === "vol1@example.com"),
    extraVolunteers.find(v => v.email === "vol3@example.com"),
  ].filter(Boolean);

  // Create bidirectional friendships
  for (const friend of existingFriends) {
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
      if (!error.message.includes('Unique constraint')) {
        throw error;
      }
    }
  }

  // Create pending friend requests TO the sample volunteer
  const pendingRequesters = [
    extraVolunteers.find(v => v.email === "mike.johnson@outlook.com"),
    extraVolunteers.find(v => v.email === "vol5@example.com"),
    extraVolunteers.find(v => v.email === "vol7@example.com"),
  ].filter(Boolean);

  for (const requester of pendingRequesters) {
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
      if (!error.message.includes('Unique constraint')) {
        throw error;
      }
    }
  }

  // Create some sent friend requests FROM the sample volunteer
  const sentRequestTargets = [
    "alex.taylor@gmail.com",
    "vol9@example.com",
  ];

  for (const targetEmail of sentRequestTargets) {
    try {
      await prisma.friendRequest.create({
        data: {
          fromUserId: volunteer.id,
          toEmail: targetEmail,
          message: "Hi! Would love to be friends and volunteer together sometime!",
          status: "PENDING",
          expiresAt: addDays(new Date(), 30),
          createdAt: subDays(new Date(), Math.floor(Math.random() * 5) + 2), // 2-6 days ago
        },
      });
    } catch (error) {
      // Skip if request already exists
      if (!error.message.includes('Unique constraint')) {
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
    const user1 = extraVolunteers.find(v => v.email === email1);
    const user2 = extraVolunteers.find(v => v.email === email2);
    
    if (user1 && user2) {
      try {
        // Create bidirectional friendship
        await prisma.friendship.create({
          data: {
            userId: user1.id,
            friendId: user2.id,
            status: "ACCEPTED",
            initiatedBy: user1.id,
            createdAt: subDays(new Date(), Math.floor(Math.random() * 120) + 30),
          },
        });

        await prisma.friendship.create({
          data: {
            userId: user2.id,
            friendId: user1.id,
            status: "ACCEPTED",
            initiatedBy: user1.id,
            createdAt: subDays(new Date(), Math.floor(Math.random() * 120) + 30),
          },
        });
      } catch (error) {
        // Skip if friendship already exists
        if (!error.message.includes('Unique constraint')) {
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

  console.log(`✅ Created ${existingFriends.length} friendships for sample volunteer`);
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
      description: "Food preparation and ingredient prep (12:00pm-5:30pm)",
    },
  });

  const kitchenPrepService = await prisma.shiftType.upsert({
    where: { name: "Kitchen Prep & Service" },
    update: {},
    create: {
      name: "Kitchen Prep & Service",
      description: "Food prep and cooking service (12:00pm-9:00pm)",
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

  const today = new Date();

  // Define shift times based on the actual roles
  const shiftConfigs = [
    {
      type: dishwasher,
      startHour: 17, // 5:30pm
      startMinute: 30,
      endHour: 21, // 9:00pm
      endMinute: 0,
      capacity: 2,
    },
    {
      type: fohSetup,
      startHour: 16, // 4:30pm
      startMinute: 30,
      endHour: 21, // 9:00pm
      endMinute: 0,
      capacity: 3,
    },
    {
      type: frontOfHouse,
      startHour: 17, // 5:30pm
      startMinute: 30,
      endHour: 21, // 9:00pm
      endMinute: 0,
      capacity: 4,
    },
    {
      type: kitchenPrep,
      startHour: 12, // 12:00pm
      startMinute: 0,
      endHour: 17, // 5:30pm
      endMinute: 30,
      capacity: 3,
    },
    {
      type: kitchenPrepService,
      startHour: 12, // 12:00pm
      startMinute: 0,
      endHour: 21, // 9:00pm
      endMinute: 0,
      capacity: 2,
    },
    {
      type: kitchenServicePack,
      startHour: 17, // 5:30pm
      startMinute: 30,
      endHour: 21, // 9:00pm
      endMinute: 0,
      capacity: 3,
    },
  ];

  const LOCATIONS = ["Wellington", "Glenn Innes", "Onehunga"];
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

      const start = set(pastDate, {
        hours: config.startHour,
        minutes: config.startMinute,
        seconds: 0,
        milliseconds: 0,
      });

      const end = set(pastDate, {
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
          capacity: config.capacity,
          notes:
            period.weeksAgo === 1 && shiftInWeek === 0
              ? "Great teamwork this shift!"
              : period.weeksAgo > 20
              ? "Early volunteer shift"
              : null,
        },
      });

      historicalShifts.push(historicalShift);

      // Create signup for sample volunteer for ALL these historical shifts
      await prisma.signup.create({
        data: {
          userId: volunteer.id,
          shiftId: historicalShift.id,
          status: "CONFIRMED",
          createdAt: addDays(start, -Math.floor(Math.random() * 7) - 1), // Signed up 1-7 days before
        },
      });

      // Also add some other volunteers to these shifts for realism
      const volunteersToAdd = Math.min(
        config.capacity - 1, // Leave space for sample volunteer
        Math.floor(Math.random() * 3) + 1 // 1-3 other volunteers
      );

      for (let v = 0; v < volunteersToAdd; v++) {
        const volunteerIndex =
          (period.weeksAgo * 10 + shiftInWeek * 3 + v) % extraVolunteers.length;
        const otherVolunteer = extraVolunteers[volunteerIndex];

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
      }
    }
  }

  // Create shifts for the next 7 days
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i + 1);

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

        const start = set(date, {
          hours: config.startHour,
          minutes: config.startMinute,
          seconds: 0,
          milliseconds: 0,
        });

        const end = set(date, {
          hours: config.endHour,
          minutes: config.endMinute,
          seconds: 0,
          milliseconds: 0,
        });

        const shift = await prisma.shift.create({
          data: {
            shiftTypeId: config.type.id,
            start,
            end,
            location,
            capacity: config.capacity,
            notes:
              i === 0 && configIndex === 0
                ? "Bring closed-toe shoes and apron"
                : null,
          },
        });
        createdShifts.push(shift);
      }
    }
  }

  // Ensure the sample volunteer is signed up for the first shift
  const firstShift = await prisma.shift.findFirst({
    orderBy: { start: "asc" },
  });
  if (firstShift) {
    await prisma.signup.upsert({
      where: {
        userId_shiftId: { userId: volunteer.id, shiftId: firstShift.id },
      },
      update: {},
      create: {
        userId: volunteer.id,
        shiftId: firstShift.id,
        status: "CONFIRMED",
      },
    });
  }

  // Make some shifts full and add a waitlisted signup to demonstrate UI state
  let extraIndex = 0;
  for (let i = 0; i < createdShifts.length; i++) {
    const s = createdShifts[i];
    // Every 4th shift: fill to capacity and add one waitlisted
    if (i % 4 === 0) {
      const capacity = s.capacity;
      // Create confirmed signups to fill the shift
      for (let c = 0; c < capacity; c++) {
        const user = extraVolunteers[(extraIndex + c) % extraVolunteers.length];
        await prisma.signup.upsert({
          where: { userId_shiftId: { userId: user.id, shiftId: s.id } },
          update: { status: "CONFIRMED" },
          create: { userId: user.id, shiftId: s.id, status: "CONFIRMED" },
        });
      }
      extraIndex = (extraIndex + capacity) % extraVolunteers.length;

      // Add one waitlisted person as well
      const waitlister = extraVolunteers[extraIndex % extraVolunteers.length];
      await prisma.signup.upsert({
        where: { userId_shiftId: { userId: waitlister.id, shiftId: s.id } },
        update: { status: "WAITLISTED" },
        create: { userId: waitlister.id, shiftId: s.id, status: "WAITLISTED" },
      });
      extraIndex = (extraIndex + 1) % extraVolunteers.length;
    }
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
        category: "MILESTONE",
        icon: "🌟",
        criteria: JSON.stringify({ type: "shifts_completed", value: 1 }),
        points: 10,
      },
      {
        name: "Getting Started",
        description: "Complete 5 volunteer shifts",
        category: "MILESTONE",
        icon: "⭐",
        criteria: JSON.stringify({ type: "shifts_completed", value: 5 }),
        points: 25,
      },
      {
        name: "Making a Difference",
        description: "Complete 10 volunteer shifts",
        category: "MILESTONE",
        icon: "🎯",
        criteria: JSON.stringify({ type: "shifts_completed", value: 10 }),
        points: 50,
      },
      {
        name: "Veteran Volunteer",
        description: "Complete 25 volunteer shifts",
        category: "MILESTONE",
        icon: "🏆",
        criteria: JSON.stringify({ type: "shifts_completed", value: 25 }),
        points: 100,
      },
      {
        name: "Community Champion",
        description: "Complete 50 volunteer shifts",
        category: "MILESTONE",
        icon: "👑",
        criteria: JSON.stringify({ type: "shifts_completed", value: 50 }),
        points: 200,
      },
      // Hour-based Achievements
      {
        name: "Time Keeper",
        description: "Volunteer for 10 hours",
        category: "DEDICATION",
        icon: "⏰",
        criteria: JSON.stringify({ type: "hours_volunteered", value: 10 }),
        points: 30,
      },
      {
        name: "Dedicated Helper",
        description: "Volunteer for 25 hours",
        category: "DEDICATION",
        icon: "💪",
        criteria: JSON.stringify({ type: "hours_volunteered", value: 25 }),
        points: 75,
      },
      {
        name: "Marathon Volunteer",
        description: "Volunteer for 50 hours",
        category: "DEDICATION",
        icon: "🏃",
        criteria: JSON.stringify({ type: "hours_volunteered", value: 50 }),
        points: 150,
      },
      {
        name: "Century Club",
        description: "Volunteer for 100 hours",
        category: "DEDICATION",
        icon: "💯",
        criteria: JSON.stringify({ type: "hours_volunteered", value: 100 }),
        points: 300,
      },
      // Consistency Achievements
      {
        name: "Consistent Helper",
        description: "Volunteer for 3 consecutive months",
        category: "DEDICATION",
        icon: "📅",
        criteria: JSON.stringify({ type: "consecutive_months", value: 3 }),
        points: 50,
      },
      {
        name: "Reliable Volunteer",
        description: "Volunteer for 6 consecutive months",
        category: "DEDICATION",
        icon: "🗓️",
        criteria: JSON.stringify({ type: "consecutive_months", value: 6 }),
        points: 100,
      },
      {
        name: "Year-Round Helper",
        description: "Volunteer for 12 consecutive months",
        category: "DEDICATION",
        icon: "🎊",
        criteria: JSON.stringify({ type: "consecutive_months", value: 12 }),
        points: 200,
      },
      // Anniversary Achievements
      {
        name: "One Year Strong",
        description: "Volunteer for one full year",
        category: "MILESTONE",
        icon: "🎂",
        criteria: JSON.stringify({ type: "years_volunteering", value: 1 }),
        points: 150,
      },
      {
        name: "Two Year Veteran",
        description: "Volunteer for two full years",
        category: "MILESTONE",
        icon: "🎉",
        criteria: JSON.stringify({ type: "years_volunteering", value: 2 }),
        points: 300,
      },
      // Community Impact
      {
        name: "Meal Master",
        description: "Help prepare an estimated 100 meals",
        category: "IMPACT",
        icon: "🍽️",
        criteria: JSON.stringify({ type: "community_impact", value: 100 }),
        points: 75,
      },
      {
        name: "Food Hero",
        description: "Help prepare an estimated 500 meals",
        category: "IMPACT",
        icon: "🦸",
        criteria: JSON.stringify({ type: "community_impact", value: 500 }),
        points: 200,
      },
      {
        name: "Hunger Fighter",
        description: "Help prepare an estimated 1000 meals",
        category: "IMPACT",
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
    console.error("Warning: Could not seed achievements:", error.message);
  }
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
