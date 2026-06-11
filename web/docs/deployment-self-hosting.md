# Self-Hosting Deployment (Coolify on Vultr)

Runbook for running the volunteer portal (`web/`) on a self-hosted Vultr VPS
with Coolify, replacing Vercel. The database stays on Supabase (Sydney) and
file storage stays on Supabase Storage — only the Next.js app moves.

## Architecture

```
GitHub push to main (web/**)
   └─ GitHub Actions (.github/workflows/docker-image.yml)
        ├─ npm ci + prisma generate + npm run build   (against a throwaway Postgres)
        ├─ prisma migrate deploy                       (against PROD Supabase, if PROD_DIRECT_URL set)
        ├─ docker build (web/Dockerfile) → push ghcr.io/<repo>/web:latest
        └─ curl Coolify deploy webhook
                                                  │
Cloudflare (proxy, Auckland PoP) ── DNS ──→ Vultr Sydney VPS
                                              └─ Coolify → Docker container (node server.js)
                                                   └─ Supabase Sydney (Postgres + Storage)
```

Why the image is built in CI and not from source on the box: `next build`
requires a reachable, migrated, seeded Postgres (partial prerendering queries
it at build time). CI provides that with a service container; the runtime
image (`web/Dockerfile`) only packages the `.next/standalone` output and is
lean (no Prisma CLI, no build toolchain).

---

## 1. Provision the VPS (one-time)

- **Vultr → Optimized Cloud Compute → CPU Optimized, 4 vCPU / 8 GB / NVMe.**
- **Region: Sydney** (same as Supabase — keeps DB round-trips ~1–2 ms).
- **OS: Ubuntu 24.04 LTS.**
- Install Coolify:
  ```bash
  curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
  ```
  (The script lives on `cdn.coollabs.io`, not `coolify.io` — the latter serves
  the marketing homepage HTML.)
- Open the Coolify dashboard (`http://<vps-ip>:8000`), create the admin user.

## 2. GitHub setup (one-time)

The build inlines `NEXT_PUBLIC_*` and uploads PostHog sourcemaps, so those are
**build-time** and live in GitHub, not Coolify.

**Repository → Settings → Secrets and variables → Actions → Variables:**
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key |

**Repository → Secrets:**
| Secret | Value | Purpose |
|---|---|---|
| `PROD_DIRECT_URL` | Supabase DIRECT_URL (port 5432) | `prisma migrate deploy` on each deploy |
| `COOLIFY_WEBHOOK_URL` | Coolify app deploy webhook URL | trigger deploy after image push |
| `COOLIFY_WEBHOOK_TOKEN` | Coolify webhook token | auth for the webhook |
| `POSTHOG_PERSONAL_API_KEY` | PostHog personal API key | sourcemap upload (optional) |
| `POSTHOG_PROJECT_ID` | PostHog project id | sourcemap upload (optional) |

> `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_PROJECT_ID` are only consumed by
> `next.config.ts` at build time. Add them to the workflow `env:` if you want
> sourcemaps; without them the build skips PostHog config gracefully.

GHCR: the workflow pushes with the built-in `GITHUB_TOKEN` (no PAT needed).
The package will be created private under the repo — in Coolify use a GHCR
pull credential (a PAT with `read:packages`) or make the package public.

## 3. Coolify app setup (one-time)

1. **New Resource → Docker Image**, image `ghcr.io/<owner>/<repo>/web:latest`.
   (Add a GHCR registry credential if the package is private.)
2. **Port:** `3000`. **Health check path:** `/api/health`.
3. **Environment variables:** paste `web/.env.coolify.template` and fill values
   (see §4 and §5 for the tricky ones).
4. **Domain:** set to the production domain; enable "Generate SSL" (Let's
   Encrypt via Traefik) — but see §6 for Cloudflare ordering.
5. **Deploy webhook:** copy its URL + token into the GitHub secrets above.

## 4. The auth secret — read this before cutover ⚠️

Production currently sets **`AUTH_SECRET`** (not `NEXTAUTH_SECRET`). The code
reads the secret in three different ways:

- `auth-options.ts` → NextAuth reads `AUTH_SECRET`/`NEXTAUTH_SECRET` (web sessions)
- `proxy.ts`, `admin/impersonate`, `sse-security.ts` → read `NEXTAUTH_SECRET` **explicitly**
- `mobile-auth.ts` → signs mobile JWTs with `AUTH_SECRET` (falls back to `NEXTAUTH_SECRET`)

**Set BOTH `AUTH_SECRET` and `NEXTAUTH_SECRET` to the same value** on Coolify.

Reuse the **current production secret value** if at all possible. Rotating it:
- logs out every web user (mild — they just re-login), and
- **invalidates every mobile app session** (mobile JWTs are signed with it) —
  every mobile user must log in again.

If the current value is unrecoverable (it's stored as a sensitive var in
Vercel; `vercel env pull` returns it blank), you'll have to generate a new one
and accept the mobile logout. Generate with `openssl rand -base64 32`.

> Side note (pre-existing): `sse-security.ts` falls back to the literal
> `"fallback-secret"` when `NEXTAUTH_SECRET` is unset. Setting it properly here
> also closes that gap.

## 5. Database (Supabase pooler)

From Supabase → Project → **Connect**:

- `DATABASE_URL` → **Transaction pooler** (Supavisor, port `6543`), append
  `?pgbouncer=true`. Used by the app.
- `DIRECT_URL` → **direct connection** (port `5432`). Used only by migrations.

A single long-running container keeps connections warm, so the pooler is the
safe default. Set the same `DIRECT_URL` value as the `PROD_DIRECT_URL` GitHub
secret so CI migrations and runtime agree.

## 6. Cloudflare (DNS already here)

1. Point the app's DNS record at the VPS IP, **DNS-only (grey cloud)** first.
2. Let Coolify issue the Let's Encrypt cert (HTTP-01 needs the grey cloud).
3. Flip the record to **Proxied (orange cloud)**, SSL mode **Full (strict)**.
4. **SSE check:** the notification stream (`/api/notifications/stream-v2`) is a
   long-lived connection. It usually survives the orange-cloud proxy because the
   app sends heartbeats, but verify after cutover. If it stalls, expose it on a
   grey-clouded subdomain.
5. Apply for **Cloudflare Project Galileo** (free protection for nonprofits).

## 7. Cron jobs

Vercel Cron is gone. Recreate the two jobs as **Coolify Scheduled Tasks**
(container → Scheduled Tasks), each running a `curl` with the `CRON_SECRET`:

| Schedule (UTC) | Command |
|---|---|
| `0 4 * * *` | `curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh-website-content` |
| `0 3 * * *` | `curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/prune-chat-logs` |

> These two crons were likely **not running on Vercel** anyway: `CRON_SECRET`
> was never set in the Vercel env, and `proxy.ts` default-denied `/api/cron/*`.
> Both are fixed in this branch (`proxy.ts` allowlists `/api/cron`, and the
> routes reject a missing `CRON_SECRET` instead of accepting `"Bearer undefined"`).

## 8. Cutover

1. Deploy to a **staging subdomain** first (e.g. `staging.volunteers…`), with
   `NEXTAUTH_URL` set to that staging URL. Smoke-test:
   - Login (credentials + Google/Facebook), and the homepage redirect
   - Registration (Turnstile renders/passes), email verification resend
   - Shift signup, real-time notifications (SSE), admin dashboard
   - Mobile app against the staging API (auth, shifts, profile)
2. Set `NEXTAUTH_URL` back to the production domain.
3. Lower the production DNS record TTL (e.g. 60s) a day ahead.
4. Flip DNS to the VPS (§6). Watch PostHog error tracking + `/api/health`.
5. **Keep the Vercel deployment live for ~1 week** — rollback is just pointing
   DNS back. Then remove the project and downgrade the plan.

## 9. Local Docker sanity check (optional)

The standalone bundle's native modules are compiled for the build platform, so
build the image where it'll run (CI / linux-amd64). To smoke-test the runtime
locally on a linux-amd64 host:

```bash
cd web
npm ci && npx prisma generate && npm run build
docker build -t volunteer-portal .
docker run --rm -p 3000:3000 --env-file .env volunteer-portal
curl -fsS http://localhost:3000/api/health
```
