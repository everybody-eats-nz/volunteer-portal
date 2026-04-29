import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  HomePageWrapper,
  HeroContent,
  FeatureCard,
  FeatureGrid,
  StaggerGroup,
  StaggerItem,
} from "@/components/home-animated";
import {
  getHomeStats,
  type UpcomingShift,
  type RecentActivityItem,
} from "@/lib/home-stats";
import { formatInNZT } from "@/lib/timezone";

const fmtNum = (n: number) => new Intl.NumberFormat("en-NZ").format(n);

function formatRelativeFromNow(date: Date): string {
  const diff = Date.now() - date.getTime();
  const past = diff >= 0;
  const minutes = Math.round(Math.abs(diff) / 60000);
  if (minutes < 1) return past ? "just now" : "any moment";
  if (minutes < 60) return past ? `${minutes}m ago` : `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return past ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return past ? `${days}d ago` : `in ${days}d`;
}

export async function HomeDashboard() {
  const stats = await getHomeStats();

  return (
    <HomePageWrapper data-testid="home-page">
      {/* ───────── HERO / LIVE STATUS ───────── */}
      <section
        className="relative overflow-hidden md:py-12"
        data-testid="hero-section"
      >
        <div className="paper-grid absolute inset-x-0 top-0 -z-10 h-full opacity-60" />

        <div className="grid gap-10 md:grid-cols-12 md:items-stretch">
          {/* Left: headline + CTAs */}
          <HeroContent className="md:col-span-7">
            <div className="mono-label mb-5 inline-flex items-center gap-2 text-[var(--ee-primary-text)]">
              <span>01 / Volunteer Portal</span>
              <span aria-hidden>—</span>
              <span>Everybody Eats Aotearoa</span>
            </div>

            <h1
              className="text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[0.95] tracking-tight text-foreground"
              data-testid="hero-title"
            >
              Making{" "}
              <span className="sticker italic">a difference</span>{" "}
              one plate at a time
            </h1>

            <p
              className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
              data-testid="hero-description"
            >
              Everybody Eats is an innovative, charitable restaurant,
              transforming rescued food into quality 3-course meals on a
              pay-what-you-can basis. Join us and be part of reducing food
              waste, food insecurity and social isolation in Aotearoa.
            </p>

            <div
              className="mt-8 flex flex-col gap-3 sm:flex-row"
              data-testid="hero-actions"
            >
              <Button
                asChild
                size="lg"
                className="btn-primary group"
                data-testid="hero-browse-shifts-button"
              >
                <Link href="/shifts" className="flex items-center gap-2">
                  <span>Browse volunteer shifts</span>
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="btn-outline"
                data-testid="hero-join-volunteer-button"
              >
                <Link href="/register">Join as volunteer</Link>
              </Button>
            </div>

            {/* Inline impact strip — readable next to the CTAs */}
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-current/10 pt-6">
              <div>
                <dt className="mono-label text-muted-foreground">Volunteers</dt>
                <dd className="stat-figure tnum mt-1.5 text-3xl md:text-4xl">
                  {fmtNum(stats.volunteers)}
                </dd>
              </div>
              <div>
                <dt className="mono-label text-muted-foreground">
                  Meals served
                </dt>
                <dd className="stat-figure tnum mt-1.5 text-3xl md:text-4xl">
                  {fmtNum(stats.mealsServed)}
                </dd>
              </div>
              <div>
                <dt className="mono-label text-muted-foreground">
                  Hours of mahi
                </dt>
                <dd className="stat-figure tnum mt-1.5 text-3xl md:text-4xl">
                  {fmtNum(stats.hoursLogged)}
                </dd>
              </div>
            </dl>
          </HeroContent>

          {/* Right: dashboard panel + hero photo */}
          <HeroContent className="hidden md:col-span-5 md:block">
            <div className="dash-panel sticky top-8 overflow-hidden">
              <div className="flex items-center justify-between border-b border-current/15 px-5 py-3">
                <div className="mono-label flex items-center gap-2">
                  <span className="live-dot" aria-hidden />
                  <span>Live status</span>
                </div>
                <div className="mono-label opacity-60">
                  Updated {formatRelativeFromNow(new Date(stats.generatedAt))}
                </div>
              </div>

              <div className="px-5 py-6">
                <div className="mono-label text-muted-foreground">
                  Mahi available now
                </div>
                <div className="mt-1 flex items-end gap-3">
                  <span className="stat-figure tnum text-7xl text-foreground">
                    {fmtNum(stats.openShiftsCount)}
                  </span>
                  <span className="mb-2 text-sm text-muted-foreground">
                    shifts open across {stats.activeLocations} restaurants
                  </span>
                </div>

                <ul className="mt-5 space-y-2">
                  {stats.locationStatus.map((loc) => (
                    <li
                      key={loc.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            loc.openShifts > 0
                              ? "bg-[var(--ee-primary-text)]"
                              : "bg-current/20"
                          }`}
                          aria-hidden
                        />
                        <span>{loc.name}</span>
                      </span>
                      <span className="mono-label tnum text-muted-foreground">
                        {loc.openShifts > 0
                          ? `${loc.spotsLeft} spots · ${loc.openShifts} shifts`
                          : "fully crewed"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="divider-dotted text-current" />

              <figure className="relative">
                <div className="relative aspect-[5/3] w-full overflow-hidden">
                  <Image
                    src="/hero.jpg"
                    alt="People enjoying meals together at Everybody Eats restaurant"
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 768px) 100vw, 40vw"
                    data-testid="hero-image"
                  />
                </div>
              </figure>
            </div>
          </HeroContent>
        </div>
      </section>

      {/* ───────── LIVE: OPEN SHIFTS + ACTIVITY FEED ───────── */}
      <section className="section-content py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="mono-label text-[var(--ee-primary-text)]">
              02 / Right now
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              What&rsquo;s happening across the whānau
            </h2>
          </div>
          <Link
            href="/shifts"
            className="mono-label hidden items-center gap-1 text-[var(--ee-primary-text)] hover:underline md:inline-flex"
          >
            See all shifts →
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-12 md:items-start">
          <div className="dash-panel md:col-span-7">
            <div className="flex items-center justify-between border-b border-current/15 px-5 py-3">
              <div className="mono-label flex items-center gap-2">
                <span className="live-dot" aria-hidden />
                Open shifts
              </div>
              <div className="mono-label opacity-60">
                Next {stats.upcomingShifts.length}
              </div>
            </div>
            {stats.upcomingShifts.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                No upcoming shifts published yet — check back soon.
              </div>
            ) : (
              <StaggerGroup>
                <ul className="divide-y divide-current/10">
                  {stats.upcomingShifts.map((shift) => (
                    <ShiftRow key={shift.id} shift={shift} />
                  ))}
                </ul>
              </StaggerGroup>
            )}
            <div className="border-t border-current/15 px-5 py-3 text-center">
              <Link
                href="/shifts"
                className="mono-label text-[var(--ee-primary-text)] hover:underline"
              >
                Browse all shifts →
              </Link>
            </div>
          </div>

          <div className="dash-panel flex flex-col md:col-span-5">
            <div className="flex shrink-0 items-center justify-between border-b border-current/15 px-5 py-3">
              <div className="mono-label flex items-center gap-2">
                <span className="live-dot" aria-hidden />
                Recent signups
              </div>
              <div className="mono-label opacity-60">
                {stats.recentActivity.length} updates
              </div>
            </div>
            {stats.recentActivity.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-5 py-12 text-center text-sm text-muted-foreground">
                Be the first to sign up this week.
              </div>
            ) : (
              <div className="scrollbar-hide max-h-[640px] overflow-y-auto">
                <StaggerGroup>
                  <ul className="divide-y divide-current/10">
                    {stats.recentActivity.map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))}
                  </ul>
                </StaggerGroup>
              </div>
            )}
          </div>
        </div>

        <div className="ticker-mask mt-12 overflow-hidden border-y-2 border-current/15 py-4">
          <div className="ticker-track mono-label whitespace-nowrap text-foreground">
            {Array.from({ length: 2 }).flatMap((_, repIdx) =>
              [
                `${fmtNum(stats.mealsServed)} meals served`,
                `${fmtNum(stats.volunteers)} volunteers`,
                `${fmtNum(stats.hoursLogged)} hours of mahi`,
                `${fmtNum(stats.shiftsThisWeek)} shifts this week`,
                `Pay-what-you-can`,
                `Rescued food, restaurant quality`,
                `Manaakitanga in action`,
              ].map((label, i) => (
                <span
                  key={`${repIdx}-${i}`}
                  className="inline-flex items-center gap-3"
                >
                  <span>{label}</span>
                  <span aria-hidden className="text-[var(--ee-primary-text)]">
                    ✦
                  </span>
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ───────── HOW IT WORKS / FEATURE CARDS (preserved testids) ───────── */}
      <section className="section-content py-16" data-testid="features-section">
        <div className="mb-10">
          <div className="mono-label text-[var(--ee-primary-text)]">
            03 / How volunteering works
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Three ways your time turns into{" "}
            <span className="sticker italic">manaakitanga</span>
          </h2>
        </div>

        <FeatureGrid className="grid gap-5 md:grid-cols-3">
          <FeatureCard
            className="dash-panel flex h-full flex-col p-6"
            delay={0.05}
            data-testid="feature-community-impact"
          >
            <div className="mono-label flex items-center justify-between text-[var(--ee-primary-text)]">
              <span>01 — Tāngata</span>
              <span className="opacity-50">People</span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight">
              Community Impact
            </h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              Join {fmtNum(stats.volunteers)}+ volunteers making a real
              difference in our communities across New Zealand.
            </p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="stat-figure tnum text-3xl">
                {fmtNum(stats.volunteers)}
              </span>
              <span className="mono-label text-muted-foreground">
                active whānau
              </span>
            </div>
          </FeatureCard>

          <FeatureCard
            className="dash-panel flex h-full flex-col p-6"
            delay={0.12}
            data-testid="feature-flexible-scheduling"
          >
            <div className="mono-label flex items-center justify-between text-[var(--ee-primary-text)]">
              <span>02 — Wā</span>
              <span className="opacity-50">Time</span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight">
              Flexible Scheduling
            </h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              Choose shifts that fit your schedule. From prep work to service,
              find opportunities that work for you.
            </p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="stat-figure tnum text-3xl">
                {fmtNum(stats.shiftsThisWeek)}
              </span>
              <span className="mono-label text-muted-foreground">
                shifts this week
              </span>
            </div>
          </FeatureCard>

          <FeatureCard
            className="dash-panel flex h-full flex-col p-6"
            delay={0.19}
            data-testid="feature-meaningful-work"
          >
            <div className="mono-label flex items-center justify-between text-[var(--ee-primary-text)]">
              <span>03 — Kai</span>
              <span className="opacity-50">Food</span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight">
              Meaningful Work
            </h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              Help fight food waste and food insecurity while building
              connections in your local community.
            </p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="stat-figure tnum text-3xl">
                {fmtNum(stats.mealsServed)}
              </span>
              <span className="mono-label text-muted-foreground">
                meals served
              </span>
            </div>
          </FeatureCard>
        </FeatureGrid>
      </section>

      {/* ───────── FINAL CTA (preserved testids/copy) ───────── */}
      <section className="section-content pb-20 pt-4" data-testid="cta-section">
        <div
          className="dash-panel relative overflow-hidden p-8 md:p-14"
          data-testid="final-cta-section"
          style={{
            background:
              "linear-gradient(135deg, var(--ee-primary), var(--ee-gradient-end))",
            borderColor: "transparent",
            color: "white",
          }}
        >
          <div className="paper-grid absolute inset-0 opacity-10" />
          <div className="relative grid gap-8 md:grid-cols-12 md:items-center">
            <div className="md:col-span-7">
              <div className="mono-label opacity-70">04 / Join us</div>
              <h2
                className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl"
                data-testid="final-cta-title"
              >
                Ready to Make a{" "}
                <span className="sticker italic text-[#0e3a23]">
                  Difference?
                </span>
              </h2>
              <p className="mt-4 max-w-xl text-base text-white/85 md:text-lg">
                Every volunteer hour contributes to stronger, more connected
                communities. Join us in our mission to ensure everybody eats.
              </p>
              <div
                className="mt-7 flex flex-col gap-3 sm:flex-row"
                data-testid="final-cta-buttons"
              >
                <Button
                  asChild
                  size="lg"
                  className="bg-[#f8fb69] font-semibold text-[#0e3a23] shadow-sm hover:bg-[#fcfd94]"
                  data-testid="final-get-started-button"
                >
                  <Link href="/register">Get Started</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-2 border-white/70 bg-transparent text-white hover:bg-white hover:text-[#0e3a23]"
                  data-testid="final-sign-in-button"
                >
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            </div>
            <div className="md:col-span-5">
              <div className="rounded-xl border border-white/25 bg-white/5 p-6 backdrop-blur-sm">
                <div className="mono-label opacity-80">Right now</div>
                <ul className="mt-4 space-y-3.5">
                  <CtaStat
                    label="Spots open this week"
                    value={fmtNum(stats.openSpots)}
                  />
                  <CtaStat
                    label="Volunteers in the whānau"
                    value={fmtNum(stats.volunteers)}
                  />
                  <CtaStat
                    label="Meals served, all-time"
                    value={fmtNum(stats.mealsServed)}
                  />
                </ul>
                <div className="mono-label mt-5 text-white/60">
                  Ngā mihi — thank you for being part of it.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </HomePageWrapper>
  );
}

function ShiftRow({ shift }: { shift: UpcomingShift }) {
  const day = formatInNZT(shift.start, "EEE d MMM");
  const startTime = formatInNZT(shift.start, "h:mma");
  const endTime = formatInNZT(shift.end, "h:mma");
  const fillPct = Math.min(
    100,
    Math.round((shift.confirmed / Math.max(1, shift.capacity)) * 100)
  );
  const urgent = shift.spotsLeft > 0 && fillPct >= 75;
  return (
    <StaggerItem>
      <li>
        <Link
          href={`/shifts/${shift.id}`}
          className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-4 transition-colors hover:bg-current/[0.03] md:grid-cols-[1fr_180px_auto]"
        >
          <div className="min-w-0">
            <div className="mono-label tnum text-[var(--ee-primary-text)]">
              {day} · {startTime}–{endTime}
            </div>
            <div className="mt-1 truncate text-base font-semibold">
              {shift.shiftType}
            </div>
            <div className="text-xs text-muted-foreground">
              {shift.location ?? "Location TBC"}
            </div>
          </div>
          <div className="hidden flex-col gap-1.5 md:flex">
            <div className={`cap-bar ${urgent ? "urgent" : ""}`}>
              <span style={{ width: `${fillPct}%` }} />
            </div>
            <div className="mono-label tnum flex justify-between text-muted-foreground">
              <span>
                {shift.confirmed}/{shift.capacity} crewed
              </span>
              <span>{fillPct}%</span>
            </div>
          </div>
          <div className="text-right">
            {shift.spotsLeft > 0 ? (
              <span className="mono-label inline-flex items-center gap-1 rounded-full border border-[var(--ee-primary-text)]/30 bg-[var(--ee-primary-text)]/10 px-2.5 py-1 text-[var(--ee-primary-text)]">
                <span className="tnum">{shift.spotsLeft}</span> open
              </span>
            ) : (
              <span className="mono-label inline-flex items-center rounded-full bg-current/10 px-2.5 py-1 text-muted-foreground">
                Full · waitlist
              </span>
            )}
          </div>
        </Link>
      </li>
    </StaggerItem>
  );
}

function ActivityRow({ item }: { item: RecentActivityItem }) {
  return (
    <StaggerItem>
      <li className="flex items-start gap-3 px-5 py-3.5">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ee-primary-text)]/15 text-sm font-semibold text-[var(--ee-primary-text)]">
          {item.firstName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">
            <span className="font-semibold">{item.firstName}</span>{" "}
            <span className="text-muted-foreground">signed up for</span>{" "}
            <span className="font-medium">{item.shiftType}</span>
            {item.location && (
              <>
                <span className="text-muted-foreground"> at </span>
                <span className="font-medium">{item.location}</span>
              </>
            )}
          </p>
          <div className="mono-label tnum mt-1 text-muted-foreground">
            {formatRelativeFromNow(item.createdAt)} ·{" "}
            {formatInNZT(item.start, "EEE d MMM")}
          </div>
        </div>
      </li>
    </StaggerItem>
  );
}

function CtaStat({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-white/15 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-white/85">{label}</span>
      <span className="stat-figure tnum text-2xl text-white">{value}</span>
    </li>
  );
}
