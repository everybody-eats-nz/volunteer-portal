import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import Image from "next/image";
import { PageHeader } from "@/components/page-header";
import {
  HomePageWrapper,
  HeroContent,
  FeatureCard,
  FeatureGrid,
} from "@/components/home-animated";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // Redirect logged-in users to their appropriate dashboard
  if (session?.user) {
    const userRole = session.user.role;

    if (userRole === "ADMIN") {
      redirect("/admin");
    } else {
      redirect("/dashboard");
    }
  }

  return (
    <HomePageWrapper data-testid="home-page">
      <section className="section-hero md:py-14" data-testid="hero-section">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <HeroContent>
            <h1
              className="text-5xl md:text-6xl font-bold leading-tight mb-6 text-foreground"
              data-testid="hero-title"
            >
              Making a difference one plate at a time
            </h1>
            <p
              className="text-lg text-muted-foreground mb-8 leading-relaxed"
              data-testid="hero-description"
            >
              Everybody Eats is an innovative, charitable restaurant,
              transforming rescued food into quality 3-course meals on a
              pay-what-you-can basis. Join us and be part of reducing food
              waste, food insecurity and social isolation in Aotearoa.
            </p>
            <div
              className="flex flex-col sm:flex-row gap-4"
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
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
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
          </HeroContent>
          <HeroContent className="hidden md:block">
            <div className="relative">
              <div
                className="aspect-[4/3] w-full rounded-2xl overflow-hidden border-2 shadow-2xl"
                style={{ borderColor: "var(--ee-border)" }}
              >
                <Image
                  src="/hero.jpg"
                  alt="People enjoying meals together at Everybody Eats restaurant"
                  fill
                  className="object-cover rounded-2xl"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  data-testid="hero-image"
                />
              </div>
            </div>
          </HeroContent>
        </div>
      </section>

      <section className="section-content py-10" data-testid="features-section">
        <div>
          <FeatureGrid className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              className="text-center p-6 card"
              delay={0.3}
              data-testid="feature-community-impact"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Community Impact</h3>
              <p className="text-muted-foreground">
                Join hundreds of volunteers making a real difference in our
                communities across New Zealand.
              </p>
            </FeatureCard>

            <FeatureCard
              className="text-center p-6 card"
              delay={0.4}
              data-testid="feature-flexible-scheduling"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Flexible Scheduling
              </h3>
              <p className="text-muted-foreground">
                Choose shifts that fit your schedule. From prep work to service,
                find opportunities that work for you.
              </p>
            </FeatureCard>

            <FeatureCard
              className="text-center p-6 card"
              delay={0.5}
              data-testid="feature-meaningful-work"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Meaningful Work</h3>
              <p className="text-muted-foreground">
                Help fight food waste and food insecurity while building
                connections in your local community.
              </p>
            </FeatureCard>
          </FeatureGrid>
        </div>
      </section>

      <section className="section-content py-4" data-testid="cta-section">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div
            className="mt-16 p-8 bg-primary-light rounded-xl"
            data-testid="final-cta-section"
          >
            <h2
              className="text-2xl font-semibold mb-4"
              data-testid="final-cta-title"
            >
              Ready to Make a Difference?
            </h2>
            <p className="text-muted-foreground mb-6">
              Every volunteer hour contributes to stronger, more connected
              communities.
              <br />
              Join us in our mission to ensure everybody eats.
            </p>
            {!session?.user && (
              <div
                className="flex flex-col sm:flex-row gap-4 justify-center"
                data-testid="final-cta-buttons"
              >
                <Button
                  asChild
                  size="lg"
                  className="btn-primary"
                  data-testid="final-get-started-button"
                >
                  <Link href="/register">Get Started</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  data-testid="final-sign-in-button"
                >
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </HomePageWrapper>
  );
}
