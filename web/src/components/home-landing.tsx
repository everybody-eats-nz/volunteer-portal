import Link from "next/link";
import Image from "next/image";
import {
  HomePageWrapper,
  HeroContent,
  FeatureCard,
  FeatureGrid,
} from "@/components/home-animated";
import {
  HeroImageCycler,
  type CycleImage,
} from "@/components/hero-image-cycler";
import { getHomeStats } from "@/lib/home-stats";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "@/lib/app-links";

/* Pill buttons — shared brand system with the marketing site
   (marketing-cms STYLEGUIDE.md: btn-primary / btn-accent / btn-ghost). */
const pill =
  "inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-medium transition-all duration-200";
const pillPrimary = `${pill} bg-forest-500 text-cream-50 hover:bg-forest-600 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0`;
const pillGhost = `${pill} border border-forest-500/30 text-forest-700 hover:bg-forest-700 hover:text-cream-50 hover:border-forest-700 dark:border-cream-50/30 dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700`;
const pillGhostOnSun = `${pill} border border-forest-700/30 text-forest-700 hover:bg-forest-700 hover:text-cream-50 hover:border-forest-700`;

const eyebrowLight = "eyebrow text-forest-500/80 dark:text-cream-50/60";

/** Sun-yellow pill underline behind a single keyword — the marketing site's
    signature hero treatment. */
function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      <span
        className="absolute -bottom-1 sm:-bottom-2 left-0 right-0 h-2 sm:h-3 bg-sun-200 -z-10 rounded-full dark:bg-sun-200/70"
        aria-hidden
      />
    </span>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

function AppStoreBadge({ className }: { className?: string }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="app-store-badge"
      className={`group inline-flex items-center gap-3 rounded-2xl bg-[#1a1410] px-5 py-3 text-cream-50 ring-1 ring-cream-50/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-sun-200/60 ${className ?? ""}`}
    >
      <svg viewBox="0 0 384 512" fill="currentColor" aria-hidden className="h-7 w-7">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      <span className="text-left leading-tight">
        <span className="block text-[0.65rem] uppercase tracking-[0.08em] text-cream-50/70">
          Download on the
        </span>
        <span className="block font-accent text-lg font-medium">App Store</span>
      </span>
    </a>
  );
}

function GooglePlayBadge({ className }: { className?: string }) {
  return (
    <a
      href={GOOGLE_PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="google-play-badge"
      className={`group inline-flex items-center gap-3 rounded-2xl bg-[#1a1410] px-5 py-3 text-cream-50 ring-1 ring-cream-50/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-sun-200/60 ${className ?? ""}`}
    >
      <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden className="h-6 w-6">
        <path d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
      </svg>
      <span className="text-left leading-tight">
        <span className="block text-[0.65rem] uppercase tracking-[0.08em] text-cream-50/70">
          Get it on
        </span>
        <span className="block font-accent text-lg font-medium">Google Play</span>
      </span>
    </a>
  );
}

/** App preview — real home-screen screenshot in a slim device frame. */
function PhoneMock() {
  return (
    <div aria-hidden className="relative mx-auto w-[250px] sm:w-[270px]">
      {/* Sun disc peeking out behind the device */}
      <div className="absolute -top-8 -left-10 h-28 w-28 rounded-full bg-sun-200 rotate-12 shadow-xl" />
      <div className="relative rotate-2 overflow-hidden rounded-[2.75rem] border border-cream-50/15 bg-forest-800 p-2 shadow-2xl">
        <Image
          src="/app-home-screen.png"
          alt=""
          width={603}
          height={1311}
          sizes="270px"
          className="h-auto w-full rounded-[2.25rem]"
        />
      </div>
    </div>
  );
}

/* Hero rotation + section photos — sourced from the marketing site's media
   library and the Wellington photo set, pre-cropped into web/public/photos. */
const HERO_IMAGES: CycleImage[] = [
  {
    src: "/photos/restaurant-tables.webp",
    alt: "People enjoying meals together at Everybody Eats restaurant",
  },
  {
    src: "/photos/wellington-ladle.webp",
    alt: "A smiling volunteer holding a ladle in the Wellington kitchen",
  },
  {
    src: "/photos/volunteer-crew.webp",
    alt: "A crew of Everybody Eats volunteers smiling together after service",
  },
  {
    src: "/photos/wellington-plating.webp",
    alt: "Two volunteers plating meals at the kitchen pass",
  },
  {
    src: "/photos/wellington-laughing.webp",
    alt: "Two volunteers laughing together over a tray of kai",
  },
  {
    src: "/photos/chef-prep.webp",
    alt: "A chef preparing trays of kai in the Everybody Eats kitchen",
  },
];

const FEATURES = [
  {
    number: "01",
    title: "Community Impact",
    copy: "Join hundreds of volunteers making a real difference in our communities across New Zealand.",
    testId: "feature-community-impact",
    image: "/photos/community-dining.webp",
    imageAlt: "Diners sharing kai outside the Everybody Eats restaurant",
  },
  {
    number: "02",
    title: "Flexible Scheduling",
    copy: "Choose shifts that fit your schedule. From prep work to service, find opportunities that work for you.",
    testId: "feature-flexible-scheduling",
    image: "/photos/plating-up.webp",
    imageAlt: "A volunteer plating up dishes during dinner service",
  },
  {
    number: "03",
    title: "Meaningful Work",
    copy: "Help fight food waste and food insecurity while building connections in your local community.",
    testId: "feature-meaningful-work",
    image: "/photos/koha-tin.webp",
    imageAlt: "A koha tin thanking diners for their pay-what-you-can support",
  },
] as const;

const nf = new Intl.NumberFormat("en-NZ");

/**
 * Public landing page — single canonical version, styled to match the
 * marketing site (new.everybodyeats.nz): cream paper surfaces, forest
 * panels, sun-yellow accents, Fraunces light display headings.
 */
export async function HomeLanding() {
  const stats = await getHomeStats();

  const marqueeItems = [
    "Kia ora — join the whānau",
    `${nf.format(stats.openShiftsCount)} shifts open right now`,
    "Rescued kai, restaurant quality",
    "Pay what you can",
    "Manaakitanga in action",
  ];

  return (
    <HomePageWrapper data-testid="home-page">
      {/* ============ Hero ============ */}
      <section
        className="grain relative overflow-hidden pb-16 pt-10 sm:pb-24 sm:pt-16"
        data-testid="hero-section"
      >
        <div className="mx-auto grid max-w-[88rem] items-end gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:gap-12 lg:px-12">
          <HeroContent className="relative z-10 lg:col-span-7">
            <p className={`${eyebrowLight} mb-6 flex items-center gap-3`}>
              <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
              Everybody Eats · Volunteer portal
            </p>
            <h1
              className="display text-5xl leading-[0.98] tracking-tight text-forest-700 sm:text-6xl lg:text-7xl dark:text-cream-50"
              data-testid="hero-title"
            >
              Making a <em>difference</em> one <Highlight>plate</Highlight> at a
              time
            </h1>
            <p
              className="mt-8 max-w-2xl text-lg leading-relaxed text-forest-700/85 sm:text-xl dark:text-cream-50/85"
              data-testid="hero-description"
            >
              Everybody Eats is an innovative, charitable restaurant,
              transforming rescued food into quality 3-course meals on a
              pay-what-you-can basis. Join us and be part of reducing food
              waste, food insecurity and social isolation in Aotearoa.
            </p>
            <div
              className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
              data-testid="hero-actions"
            >
              <Link
                href="/shifts"
                className={`${pillPrimary} group gap-2 text-base`}
                data-testid="hero-browse-shifts-button"
              >
                <span>Browse volunteer shifts</span>
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
              <Link
                href="/register"
                className={pillGhost}
                data-testid="hero-join-volunteer-button"
              >
                Join as volunteer
              </Link>
            </div>
          </HeroContent>

          <HeroContent className="relative hidden md:block lg:col-span-5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[3rem] shadow-2xl">
              <HeroImageCycler images={HERO_IMAGES} />
            </div>
          </HeroContent>
        </div>
      </section>

      {/* ============ Marquee strip ============ */}
      <div
        className="grain overflow-hidden border-y border-forest-700/20 bg-forest-500 py-4 text-cream-50"
        data-testid="home-marquee"
      >
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div
              key={dup}
              className="flex items-center gap-12"
              aria-hidden={dup === 1}
            >
              {marqueeItems.map((item) => (
                <span key={item} className="flex items-center gap-12">
                  <span className="display text-lg sm:text-xl">
                    {item}
                  </span>
                  <Sparkle className="h-5 w-5 shrink-0 text-sun-300 sm:h-6 sm:w-6" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ============ Impact stats ============ */}
      <section
        className="mx-auto max-w-[88rem] px-5 py-20 sm:px-8 sm:py-24 lg:px-12"
        data-testid="stats-section"
      >
        <div className="mb-12">
          <p className={`${eyebrowLight} mb-4 flex items-center gap-3`}>
            <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
            Our impact so far
          </p>
          <h2 className="display text-4xl tracking-tight text-forest-700 sm:text-6xl dark:text-cream-50">
            The <em>mahi</em>, in numbers
          </h2>
        </div>
        <div className="grid gap-px overflow-hidden rounded-3xl bg-forest-500/15 ring-1 ring-forest-500/15 sm:grid-cols-3 dark:bg-cream-50/15 dark:ring-cream-50/15">
          {[
            { value: stats.volunteers, label: "Volunteers strong" },
            { value: stats.mealsServed, label: "Meals served" },
            { value: stats.hoursLogged, label: "Hours of mahi" },
          ].map((s) => (
            <div key={s.label} className="bg-background px-8 py-10 sm:py-14">
              <div className="display text-5xl tracking-tight text-forest-700 tabular-nums sm:text-6xl lg:text-7xl dark:text-cream-50">
                {nf.format(s.value)}
              </div>
              <div className="mt-3 text-sm uppercase tracking-[0.15em] text-forest-500/70 dark:text-cream-50/55">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Why volunteer ============ */}
      <section
        className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12"
        data-testid="features-section"
      >
        <div className="mb-12">
          <p className={`${eyebrowLight} mb-4 flex items-center gap-3`}>
            <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
            Why volunteer
          </p>
          <h2 className="display max-w-3xl text-4xl tracking-tight text-forest-700 sm:text-6xl dark:text-cream-50">
            Good kai, good <em>company</em>
          </h2>
        </div>
        <FeatureGrid className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCard
              key={f.testId}
              delay={0.15 + i * 0.1}
              className="grain relative overflow-hidden rounded-[2rem] border border-forest-500/10 bg-cream-100 dark:border-cream-50/10 dark:bg-forest-800/60"
              data-testid={f.testId}
            >
              <div className="relative aspect-[3/2] overflow-hidden">
                <Image
                  src={f.image}
                  alt={f.imageAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="p-8 sm:p-10">
                <p className="font-mono text-xs tracking-[0.2em] text-forest-500/70 dark:text-cream-50/50">
                  {f.number}
                </p>
                <h3 className="display display-medium mt-6 text-2xl tracking-tight text-forest-700 sm:text-3xl dark:text-cream-50">
                  {f.title}
                </h3>
                <p className="mt-4 leading-relaxed text-forest-700/80 dark:text-cream-50/75">
                  {f.copy}
                </p>
              </div>
            </FeatureCard>
          ))}
        </FeatureGrid>
      </section>

      {/* ============ Mobile app ============ */}
      <section
        className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12"
        data-testid="app-section"
      >
        <div className="grain relative overflow-hidden rounded-[3rem] bg-forest-700 px-8 py-16 text-cream-50 sm:px-16 sm:py-20">
          {/* Warm sun glow — radial gradient rather than a blur filter, which
              escapes the rounded-corner clip on composited layers in Chromium */}
          <div
            className="absolute -bottom-32 -right-32 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.18),transparent)]"
            aria-hidden
          />
          <Image
            src="/patterns/kawakawa.avif"
            alt=""
            width={416}
            height={416}
            aria-hidden
            className="pointer-events-none absolute -right-8 top-0 w-80 opacity-20 sm:w-[26rem]"
          />
          <div className="relative grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="eyebrow mb-6 flex items-center gap-3 text-sun-200/90">
                <span className="inline-block h-px w-8 bg-sun-200/50" />
                New · iOS &amp; Android
              </p>
              <h2
                className="display text-4xl tracking-tight sm:text-6xl"
                data-testid="app-section-title"
              >
                Take the <em>mahi</em> with you
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream-50/85">
                Browse shifts, book in seconds and get a nudge before service —
                the Everybody Eats app keeps your volunteering whānau in your
                pocket, wherever you are.
              </p>
              <ul className="mt-8 space-y-3 text-cream-50/85">
                {[
                  "Book and manage shifts on the go",
                  "Reminders so you never miss a service",
                  "Track your hours and achievements",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Sparkle className="mt-1 h-4 w-4 shrink-0 text-sun-200" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div
                className="mt-10 flex flex-wrap items-center gap-4"
                data-testid="app-store-buttons"
              >
                <AppStoreBadge />
                <GooglePlayBadge />
              </div>
            </div>
            <div className="hidden lg:col-span-5 lg:block">
              <PhoneMock />
            </div>
          </div>
        </div>
      </section>

      {/* ============ Final CTA ============ */}
      <section
        className="mx-auto max-w-[88rem] px-5 pb-24 sm:px-8 sm:pb-32 lg:px-12"
        data-testid="cta-section"
      >
        <div
          className="grain relative overflow-hidden rounded-[3rem] bg-sun-200 px-8 py-16 text-center text-forest-700 sm:px-16 sm:py-20 dark:bg-sun-200/90"
          data-testid="final-cta-section"
        >
          <Image
            src="/patterns/kawakawa.avif"
            alt=""
            width={416}
            height={416}
            aria-hidden
            className="pointer-events-none absolute -left-10 -top-6 w-72 opacity-25 mix-blend-multiply sm:w-96"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2
              className="display text-4xl tracking-tight sm:text-6xl"
              data-testid="final-cta-title"
            >
              Ready to Make a <em>Difference</em>?
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-forest-700/85">
              Every volunteer hour contributes to stronger, more connected
              communities. Join us in our mission to ensure everybody eats.
            </p>
            <div
              className="mt-10 flex flex-col justify-center gap-3 sm:flex-row"
              data-testid="final-cta-buttons"
            >
              <Link
                href="/register"
                className={`${pillPrimary} text-base`}
                data-testid="final-get-started-button"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className={pillGhostOnSun}
                data-testid="final-sign-in-button"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>
    </HomePageWrapper>
  );
}
