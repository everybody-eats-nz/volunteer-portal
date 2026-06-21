import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  HomePageWrapper,
  HeroContent,
  FeatureCard,
  FeatureGrid,
} from "@/components/home-animated";
import { HeroImageCycler } from "@/components/hero-image-cycler";
import { HERO_IMAGES } from "@/components/hero-images";
import { buildPageMetadata, buildVolunteerLocationSchema } from "@/lib/seo";
import {
  VOLUNTEER_LOCATIONS,
  VOLUNTEER_ROLES,
  getVolunteerLocation,
  getUpcomingShiftCount,
  getUpcomingShifts,
  venueMapsUrl,
  type VolunteerLocation,
  type UpcomingShift,
} from "@/lib/volunteer-locations";

// Pre-render every city page at build time (and refresh ISR-style via the
// cached shift count). Unknown slugs fall through to notFound() in the page.
export function generateStaticParams() {
  return VOLUNTEER_LOCATIONS.map((l) => ({ location: l.slug }));
}

type Params = { location: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { location } = await params;
  const loc = getVolunteerLocation(location);
  if (!loc) return buildPageMetadata({ title: "Volunteer", description: "", path: "/volunteer", noIndex: true });

  return buildPageMetadata({
    title: `Volunteer in ${loc.city}`,
    description: `Volunteer with Everybody Eats in ${loc.city}. Help turn rescued food into quality three-course meals on a pay-what-you-can basis — flexible shifts, no experience needed. Sign up today.`,
    path: `/volunteer/${loc.slug}`,
  });
}

const pill =
  "inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-medium transition-all duration-200";
const pillPrimary = `${pill} bg-forest-500 text-cream-50 hover:bg-forest-600 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0`;
const pillGhost = `${pill} border border-forest-500/30 text-forest-700 hover:bg-forest-700 hover:text-cream-50 hover:border-forest-700 dark:border-cream-50/30 dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700`;
const eyebrowLight = "eyebrow text-forest-500/80 dark:text-cream-50/60";

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

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <circle cx="12" cy="11" r="3" strokeWidth={2} />
    </svg>
  );
}

/** A single real, bookable shift — role, when, where and spots left. */
function ShiftCard({
  shift,
  delay,
  showVenue,
}: {
  shift: UpcomingShift;
  delay: number;
  showVenue: boolean;
}) {
  const isFull = shift.spotsAvailable <= 0;

  return (
    <FeatureCard
      delay={delay}
      className="grain rounded-[2rem] border border-forest-500/10 bg-cream-100 dark:border-cream-50/10 dark:bg-forest-800/60"
    >
      <Link
        href={`/shifts/${shift.id}`}
        className="block p-8"
        data-testid="volunteer-shift-card"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs tracking-[0.2em] text-forest-500/70 dark:text-cream-50/50">
            {shift.dateLabel}
          </p>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isFull
                ? "bg-forest-500/10 text-forest-700/70 dark:bg-cream-50/10 dark:text-cream-50/60"
                : "bg-sun-200 text-forest-700"
            }`}
          >
            {isFull
              ? "Waitlist"
              : `${shift.spotsAvailable} ${
                  shift.spotsAvailable === 1 ? "spot" : "spots"
                } left`}
          </span>
        </div>
        <h3 className="display display-medium mt-5 text-2xl tracking-tight text-forest-700 dark:text-cream-50">
          {shift.role}
        </h3>
        <p className="mt-2 text-forest-700/75 dark:text-cream-50/70">
          {shift.timeLabel}
          {showVenue ? ` · ${shift.venue}` : ""}
        </p>
      </Link>
    </FeatureCard>
  );
}

function buildFaqs(loc: VolunteerLocation) {
  const venueList =
    loc.venues.length > 1
      ? loc.venues.map((v) => v.name).join(" and ")
      : loc.venues[0].name;
  return [
    {
      question: `Do I need experience to volunteer in ${loc.city}?`,
      answer:
        "No experience or qualifications are needed. Our team shows you everything on the night, and there's a role to suit everyone — from the kitchen to the dining room.",
    },
    {
      question: `Where is Everybody Eats in ${loc.city}?`,
      answer: `You'll find us at ${loc.venues
        .map((v) => `${v.name} (${v.address})`)
        .join(", ")}.`,
    },
    {
      question: "How much time do I need to commit?",
      answer:
        "Volunteering is flexible — pick a single shift that suits you or come back regularly. There's no long-term commitment required.",
    },
    {
      question: `How do I sign up to volunteer in ${venueList}?`,
      answer:
        "Create a free account on the Everybody Eats volunteer portal, browse upcoming shifts and book the ones that fit your schedule.",
    },
  ];
}

export default async function VolunteerLocationPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { location } = await params;
  const loc = getVolunteerLocation(location);
  if (!loc) notFound();

  const [shiftCount, upcomingShifts] = await Promise.all([
    getUpcomingShiftCount(loc.shiftLocations),
    getUpcomingShifts(loc.shiftLocations, 6),
  ]);
  const faqs = buildFaqs(loc);
  const schema = buildVolunteerLocationSchema({
    city: loc.city,
    slug: loc.slug,
    intro: loc.intro,
    venues: loc.venues,
    faqs,
  });

  const shiftsHref =
    loc.venues.length === 1
      ? `/shifts?location=${encodeURIComponent(loc.venues[0].name)}`
      : "/shifts";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <HomePageWrapper data-testid="volunteer-location-page">
        {/* ============ Hero ============ */}
        <section
          className="grain relative overflow-hidden pb-16 pt-10 sm:pb-24 sm:pt-16"
          data-testid="volunteer-hero"
        >
          <div className="mx-auto grid max-w-[88rem] items-end gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:gap-12 lg:px-12">
            <HeroContent className="relative z-10 lg:col-span-7">
              <p className={`${eyebrowLight} mb-6 flex items-center gap-3`}>
                <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
                <Link href="/volunteer" className="hover:underline">
                  Volunteer
                </Link>
                <span aria-hidden>·</span>
                {loc.reoName}
              </p>
              <h1
                className="display text-5xl leading-[0.98] tracking-tight text-forest-700 sm:text-6xl lg:text-7xl dark:text-cream-50"
                data-testid="volunteer-hero-title"
              >
                Volunteer in{" "}
                <Highlight>{loc.city}</Highlight>
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-relaxed text-forest-700/85 sm:text-xl dark:text-cream-50/85">
                {loc.intro}
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/register" className={`${pillPrimary} text-base`} data-testid="volunteer-cta-register">
                  Sign up to volunteer
                </Link>
                <Link href={shiftsHref} className={pillGhost} data-testid="volunteer-cta-shifts">
                  {shiftCount > 0
                    ? `See ${shiftCount} upcoming shift${shiftCount === 1 ? "" : "s"}`
                    : "Browse shifts"}
                </Link>
              </div>
            </HeroContent>

            <HeroContent className="relative hidden md:block lg:col-span-5">
              <div className="group relative aspect-[4/5] overflow-hidden rounded-[3rem] shadow-2xl">
                <HeroImageCycler images={HERO_IMAGES} />
              </div>
            </HeroContent>
          </div>
        </section>

        {/* ============ About + venues ============ */}
        <section
          className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12"
          data-testid="volunteer-about"
        >
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h2 className="display text-3xl tracking-tight text-forest-700 sm:text-5xl dark:text-cream-50">
                Good kai, good <em>company</em>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-forest-700/80 dark:text-cream-50/75">
                {loc.about}
              </p>
              <p className="mt-4 text-lg leading-relaxed text-forest-700/80 dark:text-cream-50/75">
                {loc.gettingThere}
              </p>
            </div>
            <div className="lg:col-span-5">
              <div className="grain rounded-[2rem] border border-forest-500/10 bg-cream-100 p-8 dark:border-cream-50/10 dark:bg-forest-800/60">
                <p className={`${eyebrowLight} mb-5`}>
                  Our {loc.city} {loc.venues.length === 1 ? "restaurant" : "restaurants"}
                </p>
                <ul className="space-y-5">
                  {loc.venues.map((venue) => (
                    <li key={venue.name}>
                      <a
                        href={venueMapsUrl(venue)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-3"
                      >
                        <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-forest-500 dark:text-forest-200" />
                        <span>
                          <span className="block font-accent text-lg font-medium text-forest-700 group-hover:underline dark:text-cream-50">
                            {venue.name}
                          </span>
                          <span className="block text-sm text-forest-700/70 dark:text-cream-50/65">
                            {venue.address}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ============ Roles ============ */}
        <section
          className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12"
          data-testid="volunteer-roles"
        >
          <div className="mb-12">
            <p className={`${eyebrowLight} mb-4 flex items-center gap-3`}>
              <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
              {upcomingShifts.length > 0 ? "What's coming up" : "Ways to help"}
            </p>
            <h2 className="display max-w-3xl text-4xl tracking-tight text-forest-700 sm:text-6xl dark:text-cream-50">
              Find your <em>role</em> in {loc.city}
            </h2>
            {upcomingShifts.length > 0 && (
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-forest-700/80 dark:text-cream-50/75">
                From the kitchen to the dining room — here are the next shifts
                you can book in {loc.city}. Tap one to see the details and sign
                up.
              </p>
            )}
          </div>

          {upcomingShifts.length > 0 ? (
            <>
              <FeatureGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingShifts.map((shift, i) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    delay={0.1 + i * 0.06}
                    showVenue={loc.venues.length > 1}
                  />
                ))}
              </FeatureGrid>
              <div className="mt-10">
                <Link href={shiftsHref} className={pillGhost} data-testid="volunteer-see-all-shifts">
                  See all {loc.city} shifts
                </Link>
              </div>
            </>
          ) : (
            <FeatureGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {VOLUNTEER_ROLES.map((role, i) => (
                <FeatureCard
                  key={role.title}
                  delay={0.1 + i * 0.08}
                  className="grain rounded-[2rem] border border-forest-500/10 bg-cream-100 p-8 dark:border-cream-50/10 dark:bg-forest-800/60"
                >
                  <p className="font-mono text-xs tracking-[0.2em] text-forest-500/70 dark:text-cream-50/50">
                    0{i + 1}
                  </p>
                  <h3 className="display display-medium mt-5 text-2xl tracking-tight text-forest-700 dark:text-cream-50">
                    {role.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-forest-700/80 dark:text-cream-50/75">
                    {role.copy}
                  </p>
                </FeatureCard>
              ))}
            </FeatureGrid>
          )}
        </section>

        {/* ============ FAQ ============ */}
        <section
          className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12"
          data-testid="volunteer-faq"
        >
          <div className="mb-12">
            <p className={`${eyebrowLight} mb-4 flex items-center gap-3`}>
              <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
              Good to know
            </p>
            <h2 className="display text-4xl tracking-tight text-forest-700 sm:text-6xl dark:text-cream-50">
              Questions, <em>answered</em>
            </h2>
          </div>
          <dl className="mx-auto grid max-w-4xl gap-px overflow-hidden rounded-3xl bg-forest-500/15 ring-1 ring-forest-500/15 dark:bg-cream-50/15 dark:ring-cream-50/15">
            {faqs.map((faq) => (
              <div key={faq.question} className="bg-background p-8">
                <dt className="display display-medium text-xl tracking-tight text-forest-700 dark:text-cream-50">
                  {faq.question}
                </dt>
                <dd className="mt-3 leading-relaxed text-forest-700/80 dark:text-cream-50/75">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ============ Final CTA ============ */}
        <section
          className="mx-auto max-w-[88rem] px-5 pb-24 sm:px-8 sm:pb-32 lg:px-12"
          data-testid="volunteer-cta-section"
        >
          <div className="grain relative overflow-hidden rounded-[3rem] bg-sun-200 px-8 py-16 text-center text-forest-700 sm:px-16 sm:py-20 dark:bg-sun-200/90">
            <div className="relative mx-auto max-w-2xl">
              <h2 className="display text-4xl tracking-tight sm:text-6xl">
                Ready to join the <em>{loc.city}</em> whānau?
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-forest-700/85">
                Ka pai! Create your free account and book your first shift — we&rsquo;d
                love to have you.
              </p>
              <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/register" className={`${pillPrimary} text-base`}>
                  Get started
                </Link>
                <Link href={shiftsHref} className={`${pill} border border-forest-700/30 text-forest-700 hover:bg-forest-700 hover:text-cream-50`}>
                  Browse shifts
                </Link>
              </div>
            </div>
          </div>
        </section>
      </HomePageWrapper>
    </>
  );
}
