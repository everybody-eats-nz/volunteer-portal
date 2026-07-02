import { PrismaClient } from "../src/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🏢 Seeding restaurant locations...");

  await prisma.location.upsert({
    where: { name: "Wellington" },
    update: {},
    create: {
      name: "Wellington",
      address: "60 Dixon Street, Te Aro, Wellington, New Zealand",
      defaultMealsServed: 60,
      isActive: true,
      // Long-established restaurant - launched well outside the "New" badge window
      launchedAt: new Date("2020-01-01T00:00:00Z"),
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
      launchedAt: new Date("2020-01-01T00:00:00Z"),
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
      launchedAt: new Date("2020-01-01T00:00:00Z"),
    },
  });

  console.log("✅ Restaurant locations seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
