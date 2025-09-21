const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Running production seed...");

  // Get admin credentials from environment variables or use defaults
  const adminEmail = process.env.ADMIN_EMAIL || "admin@everybodyeats.nz";
  let adminPassword = process.env.ADMIN_PASSWORD;
  const adminFirstName = process.env.ADMIN_FIRST_NAME || "Admin";
  const adminLastName = process.env.ADMIN_LAST_NAME || "User";

  // Always require ADMIN_PASSWORD environment variable for security
  if (!adminPassword) {
    console.error("❌ ADMIN_PASSWORD environment variable is required");
    console.error("   Please set ADMIN_PASSWORD to a secure initial password");
    console.error("   Example: export ADMIN_PASSWORD='YourSecurePassword123!'");
    process.exit(1);
  }

  console.log(`Creating admin user: ${adminEmail}`);

  // Hash the admin password
  const adminHash = await bcrypt.hash(adminPassword, 10);

  // Check if admin user already exists
  let adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (adminUser) {
    console.log("✅ Admin user already exists, using existing user");
  } else {
    // Create the admin user
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        hashedPassword: adminHash,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: "ADMIN",
        profileCompleted: true,
        emailVerified: true,
        dateOfBirth: new Date("1990-01-01"), // Default DOB
        phone: "021-000-0000", // Default phone
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: "021-111-1111",
        emergencyContactRelationship: "Next of Kin",
        medicalConditions: "",
        pronouns: "",
        howDidYouHearAboutUs: "System",
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
        parentalConsentReceived: true,
      },
    });

    console.log(`✅ Admin user created successfully: ${adminUser.email}`);
    console.log(`📧 Email: ${adminEmail}`);
    console.log("🔐 Initial Password: [HIDDEN] (from ADMIN_PASSWORD env var)");
    console.log(
      "⚠️  Please store your admin initial password securely and change it after first login!"
    );
  }

  // Create essential shift types
  console.log("Creating shift types...");

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

  const anywhereNeeded = await prisma.shiftType.upsert({
    where: { name: "Anywhere I'm Needed (PM)" },
    update: {},
    create: {
      name: "Anywhere I'm Needed (PM)",
      description: "Flexible placement for PM shifts starting after 4:00pm",
    },
  });

  console.log("✅ Shift types created");

  // Create shift templates for each location
  console.log("Creating shift templates...");

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

  for (const config of templateConfigs) {
    await prisma.shiftTemplate.upsert({
      where: {
        name_location: {
          name: config.name,
          location: config.location,
        },
      },
      update: {},
      create: {
        name: config.name,
        location: config.location,
        shiftTypeId: config.shiftType.id,
        startTime: config.startTime,
        endTime: config.endTime,
        capacity: config.capacity,
        notes: config.notes,
        createdBy: adminUser.id,
      },
    });
  }

  console.log("✅ Shift templates created");
  console.log("🎉 Production seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
