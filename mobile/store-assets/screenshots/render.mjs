#!/usr/bin/env node
/**
 * Renders every store screenshot at every store size from compose.html.
 *
 *   node mobile/store-assets/screenshots/render.mjs            # all
 *   node mobile/store-assets/screenshots/render.mjs home       # one shot
 *
 * Uses the web app's Playwright (Chromium) and sharp, so run `npm install`
 * and `npx playwright install chromium` in web/ first. Output PNGs are
 * flattened to RGB because App Store Connect rejects images with an alpha
 * channel.
 */
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRequire = createRequire(path.join(here, "../../../web/package.json"));
const { chromium } = webRequire("playwright");
const sharp = webRequire("sharp");

/** Store order. Names match source/<name>.png and the SHOTS map in compose.html. */
const SHOTS = [
  "home",
  "shifts",
  "shift-detail",
  "messages",
  "whanau",
  "celebration",
];

const SIZES = [
  // App Store: 6.9" (iPhone 16/17 Pro Max) is required; 6.5" covers older phones.
  { dir: "ios-6.9", width: 1320, height: 2868, frame: "ios" },
  { dir: "ios-6.5", width: 1284, height: 2778, frame: "ios" },
  // 6.1" / 6.3" (iPhone 16/17), for when App Store Connect asks for its own set.
  { dir: "ios-6.3", width: 1206, height: 2622, frame: "ios" },
  // Google Play phone: 9:16 (Play caps the long side at twice the short one).
  { dir: "android", width: 1080, height: 1920, frame: "android" },
];

const only = process.argv.slice(2);
const shots = only.length ? SHOTS.filter((s) => only.includes(s)) : SHOTS;
if (shots.length === 0) {
  console.error(`No such shot. Pick from: ${SHOTS.join(", ")}`);
  process.exit(1);
}

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    const outDir = path.join(here, size.dir);
    await mkdir(outDir, { recursive: true });
    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
    });
    for (const shot of shots) {
      const index = String(SHOTS.indexOf(shot) + 1).padStart(2, "0");
      const url = new URL(pathToFileURL(path.join(here, "compose.html")));
      url.search = new URLSearchParams({
        shot,
        w: String(size.width),
        h: String(size.height),
        frame: size.frame,
      }).toString();
      await page.goto(url.href);
      await page.waitForSelector("body[data-ready=true]");
      const png = await page.screenshot({ type: "png" });
      const file = path.join(outDir, `${index}-${shot}.png`);
      await sharp(png).removeAlpha().png({ compressionLevel: 9 }).toFile(file);
      console.log(path.relative(process.cwd(), file));
    }
    await page.close();
  }
} finally {
  await browser.close();
}
