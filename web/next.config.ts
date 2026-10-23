import { withPostHogConfig } from "@posthog/nextjs-config";
import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

// Only emit the standalone bundle for the self-hosted Docker/Coolify image.
// On Vercel this MUST stay off — Vercel manages its own build output and the
// relocated standalone output breaks its post-build step
// (ENOENT .next/package.json). The Docker workflow sets BUILD_STANDALONE=1.
const standalone = process.env.BUILD_STANDALONE === "1";

const nextConfig: NextConfig = {
  // Self-contained build output for Docker deployment (opt-in via env)
  ...(standalone
    ? {
        output: "standalone" as const,

        // Serve uncompressed from the origin and let Cloudflare compress at the
        // edge (brotli). Cloudflare passes through origin gzip rather than
        // upgrading it, so disabling Next's gzip is required to get brotli to
        // the browser. The app domain is always behind the Cloudflare proxy in
        // production.
        compress: false,

        // Pin the tracing root to web/ so standalone output always has
        // server.js at its top level regardless of where the repo is checked
        // out (next build always runs from web/)
        outputFileTracingRoot: process.cwd(),
      }
    : {}),

  // Keep native/heavy packages out of the server bundle
  serverExternalPackages: ["@prisma/client", "bcrypt", "@remotion/renderer"],

  // File tracing can't be trusted with the Year in mahi renderer: it misses
  // the native compositor (and the ffmpeg beside it) that the renderer runs
  // from disk, and it resolves packages with conditional exports (remotion,
  // ws) to their ESM builds while the renderer require()s the CommonJS ones.
  // So ship the renderer and every package it depends on whole, including
  // whichever compositor npm installed (Linux x64 in CI).
  outputFileTracingIncludes: {
    "/api/year-in-review/**": packageGlobs("@remotion/renderer"),
  },

  // Configure external image domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
        port: "",
        pathname: "/platform/profilepic/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Ensure Prisma client works in serverless environment
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("@prisma/client");
    }
    return config;
  },

  // Serve the mobile-app association files as JSON. apple-app-site-association
  // has no file extension, so Next would otherwise serve it as
  // application/octet-stream — iOS requires application/json to validate
  // Universal Links. assetlinks.json is set explicitly for parity.
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },

  // Rewrites for PostHog ingestion endpoints
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  cacheComponents: true,

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

  turbopack: {},

  reactCompiler: true,
};

const posthogEnabled =
  !!process.env.POSTHOG_PERSONAL_API_KEY && !!process.env.POSTHOG_PROJECT_ID;

type NextConfigFn = (
  phase: string,
  ctx: { defaultConfig: NextConfig }
) => Promise<NextConfig>;

// The PostHog source map upload runs inside next build, so a transient PostHog
// or S3 outage would otherwise fail the build and block the deploy. Treat the
// upload as best effort: warn, then delete the .map files ourselves (a failed
// upload skips deleteAfterUpload, and .next/static is served publicly).
function withBestEffortSourcemapUpload(config: NextConfig): NextConfigFn {
  // withPostHogConfig is typed as returning NextConfig but returns an async
  // config function
  const resolveConfig = config as unknown as NextConfigFn;

  return async (phase, ctx) => {
    const resolved = await resolveConfig(phase, ctx);
    const upload = resolved.compiler?.runAfterProductionCompile;
    if (!upload) return resolved;

    return {
      ...resolved,
      compiler: {
        ...resolved.compiler,
        runAfterProductionCompile: async (metadata) => {
          try {
            await upload(metadata);
          } catch (error) {
            const message = `PostHog source map upload failed, deploying without source maps for this release: ${error instanceof Error ? error.message : String(error)}`;
            console.warn(
              process.env.GITHUB_ACTIONS ? `::warning::${message}` : message
            );
            await removeSourceMaps(metadata.distDir);
          }
        },
      },
    };
  };
}

async function removeSourceMaps(distDir: string) {
  const files = await readdir(distDir, { recursive: true });
  await Promise.all(
    files
      .filter((file) => file.endsWith(".map"))
      .map((file) => rm(path.join(distDir, file), { force: true }))
  );
}

// Globs for a package and its installed dependencies (optional ones included),
// found the way Node resolves them: the nearest node_modules up the tree.
function packageGlobs(name: string): string[] {
  const dirs = new Set<string>();

  const visit = (pkg: string, from: string) => {
    for (let dir = from; ; dir = path.dirname(dir)) {
      const pkgDir = path.join(dir, "node_modules", pkg);
      if (existsSync(path.join(pkgDir, "package.json"))) {
        if (dirs.has(pkgDir)) return;
        dirs.add(pkgDir);
        const manifest = JSON.parse(
          readFileSync(path.join(pkgDir, "package.json"), "utf8")
        );
        for (const dep of Object.keys({
          ...manifest.dependencies,
          ...manifest.optionalDependencies,
        })) {
          visit(dep, pkgDir);
        }
        return;
      }
      if (dir === path.dirname(dir)) return; // not installed (optional)
    }
  };
  visit(name, process.cwd());

  return [...dirs].map((dir) => {
    const relative = path.relative(process.cwd(), dir).split(path.sep);
    return `./${relative.join("/")}/**/*`;
  });
}

const finalConfig = posthogEnabled
  ? withBestEffortSourcemapUpload(
      withPostHogConfig(nextConfig, {
      personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
      projectId: process.env.POSTHOG_PROJECT_ID!,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        sourcemaps: {
          enabled: true,
          deleteAfterUpload: true,
        },
      })
    )
  : nextConfig;

export default finalConfig;
