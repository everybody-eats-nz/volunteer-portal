// Auto-selecting seed script based on environment
// This script determines whether to run production or development seeding

import { execSync } from "child_process";

const isProduction =
  process.env.VERCEL_ENV === "production" ||
  process.env.USE_PRODUCTION_SEED === "true";

console.log("🌱 Auto-seed: Environment detection");
console.log(`   VERCEL_ENV: ${process.env.VERCEL_ENV || "not set"}`);
console.log(
  `   USE_PRODUCTION_SEED: ${process.env.USE_PRODUCTION_SEED || "not set"}`
);
console.log(`   Is Production: ${isProduction ? "yes" : "no"}`);

if (isProduction) {
  console.log(
    "🏭 Running PRODUCTION seed (admin + shift types + templates only)..."
  );
  try {
    execSync("tsx prisma/seed-production.ts", { stdio: "inherit" });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(
      "❌ Production seed failed:",
      err && err.message ? err.message : error
    );
    process.exit(1);
  }
} else {
  console.log("🧪 Running DEVELOPMENT seed (full demo data)...");
  try {
    execSync("tsx prisma/seed-demo.ts", { stdio: "inherit" });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(
      "❌ Development seed failed:",
      err && err.message ? err.message : error
    );
    process.exit(1);
  }
}

console.log("✅ Auto-seed completed successfully!");
