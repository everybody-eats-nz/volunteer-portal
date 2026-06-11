import { withPostHogConfig } from "@posthog/nextjs-config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build output for Docker deployment
  output: "standalone",

  // Pin the tracing root to web/ so standalone output always has server.js
  // at its top level regardless of where the repo is checked out
  // (next build always runs from web/)
  outputFileTracingRoot: process.cwd(),

  // Keep native/heavy packages out of the server bundle
  serverExternalPackages: ["@prisma/client", "bcrypt"],

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

const finalConfig = posthogEnabled
  ? withPostHogConfig(nextConfig, {
      personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
      projectId: process.env.POSTHOG_PROJECT_ID!,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      sourcemaps: {
        enabled: true,
        deleteAfterUpload: true,
      },
    })
  : nextConfig;

export default finalConfig;
