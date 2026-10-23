/**
 * Writes one volunteer's "Year in mahi" video props to JSON, ready for
 * Remotion Studio or a render.
 *
 * Usage:
 *   npm run video:props -- <email> [year]
 *   npm run video:studio -- --props=out/year-in-review/<file>.json
 *   npm run video:render -- --props=out/year-in-review/<file>.json
 *
 *   year defaults to the current NZ year (covering the year so far).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { nowInNZT } from "../src/lib/timezone";
import { getVolunteerYearInReview } from "../src/lib/year-in-review.server";

async function main() {
  const [email, yearArg] = process.argv.slice(2);
  if (!email) {
    console.error("Usage: npm run video:props -- <email> [year]");
    process.exit(1);
  }
  const year = yearArg ? Number(yearArg) : nowInNZT().getFullYear();

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  if (!user) throw new Error(`No volunteer with email ${email}`);

  const props = await getVolunteerYearInReview(user.id, year);
  if (!props) throw new Error(`${email} has no completed shifts in ${year}`);

  const dir = join(process.cwd(), "out", "year-in-review");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${user.id}-${year}.json`);
  writeFileSync(file, `${JSON.stringify(props, null, 2)}\n`);
  console.log(`Wrote ${file}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
