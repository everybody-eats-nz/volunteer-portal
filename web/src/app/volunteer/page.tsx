import type { Metadata } from "next";
import Link from "next/link";
import {
  HomePageWrapper,
  HeroContent,
  FeatureCard,
  FeatureGrid,
} from "@/components/home-animated";
import { buildPageMetadata } from "@/lib/seo";
import { VOLUNTEER_LOCATIONS } from "@/lib/volunteer-locations";

export const metadata: Metadata = buildPageMetadata({
  title: "Volunteer in Wellington & Auckland",
  description:
    "Volunteer with Everybody Eats across Aotearoa. Help turn rescued food into quality three-course meals on a pay-what-you-can basis in Wellington and Auckland — flexible shifts, no experience needed.",
  path: "/volunteer",
});

const pill =
  "inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-medium transition-all duration-200";
const pillPrimary = `${pill} bg-forest-500 text-cream-50 hover:bg-forest-600 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0`;
const eyebrowLight = "eyebrow text-forest-500/80 dark:text-cream-50/60";

function Arrow({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

export default function VolunteerIndexPage() {
  return (
    <HomePageWrapper data-testid="volunteer-index-page">
      {/* ============ Hero ============ */}
      <section className="grain relative overflow-hidden pb-12 pt-10 sm:pb-16 sm:pt-16">
        <div className="mx-auto max-w-[88rem] px-5 sm:px-8 lg:px-12">
          <HeroContent className="max-w-3xl">
            <p className={`${eyebrowLight} mb-6 flex items-center gap-3`}>
              <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
              Everybody Eats · Volunteering
            </p>
            <h1 className="display text-5xl leading-[0.98] tracking-tight text-forest-700 sm:text-6xl lg:text-7xl dark:text-cream-50">
              Volunteer across <em>Aotearoa</em>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-forest-700/85 sm:text-xl dark:text-cream-50/85">
              Everybody Eats transforms rescued food into quality three-course
              meals on a pay-what-you-can basis. Volunteers are the heart of
              every service. Choose your city to find shifts near you.
            </p>
          </HeroContent>
        </div>
      </section>

      {/* ============ City cards ============ */}
      <section className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12" data-testid="volunteer-cities">
        <FeatureGrid className="grid gap-6 md:grid-cols-2">
          {VOLUNTEER_LOCATIONS.map((loc, i) => (
            <FeatureCard
              key={loc.slug}
              delay={0.1 + i * 0.1}
              className="grain group relative overflow-hidden rounded-[2rem] border border-forest-500/10 bg-cream-100 dark:border-cream-50/10 dark:bg-forest-800/60"
            >
              <Link href={`/volunteer/${loc.slug}`} className="block p-8 sm:p-10" data-testid={`volunteer-city-${loc.slug}`}>
                <p className="font-mono text-xs tracking-[0.2em] text-forest-500/70 dark:text-cream-50/50">
                  {loc.reoName}
                </p>
                <h2 className="display mt-5 flex items-center gap-3 text-3xl tracking-tight text-forest-700 sm:text-4xl dark:text-cream-50">
                  {loc.city}
                  <Arrow className="h-6 w-6 transition-transform group-hover:translate-x-1" />
                </h2>
                <p className="mt-4 leading-relaxed text-forest-700/80 dark:text-cream-50/75">
                  {loc.intro}
                </p>
                <p className="mt-5 text-sm uppercase tracking-[0.15em] text-forest-500/70 dark:text-cream-50/55">
                  {loc.venues.map((v) => v.name).join(" · ")}
                </p>
              </Link>
            </FeatureCard>
          ))}
        </FeatureGrid>
      </section>

      {/* ============ CTA ============ */}
      <section className="mx-auto max-w-[88rem] px-5 pb-24 sm:px-8 sm:pb-32 lg:px-12">
        <div className="grain relative overflow-hidden rounded-[3rem] bg-forest-700 px-8 py-16 text-center text-cream-50 sm:px-16 sm:py-20">
          <div className="relative mx-auto max-w-2xl">
            <h2 className="display text-4xl tracking-tight sm:text-6xl">
              Make a <em>difference</em>, one shift at a time
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-cream-50/85">
              No experience needed, no long-term commitment — just a few hours
              and a willingness to help. Nau mai, haere mai.
            </p>
            <div className="mt-10 flex justify-center">
              <Link href="/register" className={`${pillPrimary} text-base`}>
                Sign up to volunteer
              </Link>
            </div>
          </div>
        </div>
      </section>
    </HomePageWrapper>
  );
}
