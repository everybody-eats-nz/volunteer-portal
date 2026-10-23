# Runtime image for the prebuilt Next.js standalone bundle.
#
# This image packages an existing build rather than building from source,
# because `next build` requires a reachable, migrated PostgreSQL database
# (partial prerendering queries it). The CI workflow
# (.github/workflows/docker-image.yml) runs `npm run build` against a
# Postgres service container, then builds this image from the web/ context.
#
# To build locally (Linux amd64 host or CI only — native modules in the
# standalone bundle are compiled for the build platform):
#   cd web
#   npm ci && npx prisma generate && npm run build && npm run video:bundle
#   docker build -t volunteer-portal .

FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    TZ=Pacific/Auckland

# curl for container healthchecks. The rest are for rendering Year in mahi
# videos (lib/year-in-review-render.server.ts): the shared libraries Chrome
# Headless Shell needs (remotion.dev/docs/miscellaneous/linux-dependencies;
# the ALSA package was renamed in Debian trixie) and colour emoji for the
# achievement badges.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
       libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 \
       libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 \
       libpango-1.0-0 libcairo2 libcups2 \
       "$(apt-cache show libasound2t64 >/dev/null 2>&1 && echo libasound2t64 || echo libasound2)" \
       fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone output bundles server.js plus the traced node_modules.
# .next/static and public/ are not included by Next and must be copied in.
# nextjs needs ownership of .next for the ISR/data cache.
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static
COPY --chown=nextjs:nodejs public ./public

# The Year in mahi composition, bundled in CI (npm run video:bundle), and the
# Chrome Headless Shell that renders it, fetched into node_modules/.remotion
# where @remotion/renderer looks for it.
COPY --chown=nextjs:nodejs remotion-bundle ./remotion-bundle
RUN node -e "require('@remotion/renderer').ensureBrowser().then(() => console.log('Chrome Headless Shell ready'))" \
    && chown -R nextjs:nodejs node_modules/.remotion

USER nextjs

EXPOSE 3000

# Probe whatever port the app actually binds ($PORT, set by the platform),
# over IPv4 explicitly so it works even if `localhost` resolves to ::1.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

CMD ["node", "server.js"]
