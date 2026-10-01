import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";

/**
 * Guards the admin route skeletons. A `loading.tsx` cascades to every child
 * route without its own, so an admin page missing one silently shows a
 * neighbour's skeleton (and header title) while it loads.
 */

const ADMIN_DIR = __dirname;

// Routes that never render content of their own.
const EXEMPT = new Set(["[...not-found]", "auto-accept-rules"]);

function findPageDirs(dir: string): string[] {
  const dirs: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry.startsWith("_") || EXEMPT.has(entry)) continue;
    if (existsSync(path.join(full, "page.tsx"))) dirs.push(full);
    dirs.push(...findPageDirs(full));
  }
  return dirs;
}

/** The literal `title="..."` passed to AdminPageWrapper, if the page has one. */
function pageTitle(source: string): string | undefined {
  return source.match(/<AdminPageWrapper[\s\S]*?\stitle="([^"]+)"/)?.[1];
}

const pageDirs = findPageDirs(ADMIN_DIR).map((dir) => ({
  dir,
  route: "/admin/" + path.relative(ADMIN_DIR, dir).replace(/\([^)]+\)\/?/g, ""),
}));

describe("admin route skeletons", () => {
  it("finds the admin pages", () => {
    expect(pageDirs.length).toBeGreaterThan(30);
  });

  it.each(pageDirs)("$route has its own loading.tsx", ({ dir }) => {
    expect(existsSync(path.join(dir, "loading.tsx"))).toBe(true);
  });

  it.each(pageDirs)("$route skeleton sets the same header title", ({ dir }) => {
    const title = pageTitle(readFileSync(path.join(dir, "page.tsx"), "utf8"));
    if (!title) return; // Title set elsewhere (client component or dynamic).
    const loading = readFileSync(path.join(dir, "loading.tsx"), "utf8");
    expect(loading).toContain(`title="${title}"`);
  });
});
