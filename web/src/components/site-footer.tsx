"use client";

import Link from "next/link";
import { Session } from "next-auth";
import { Facebook, Instagram, Globe, Mail } from "lucide-react";
import packageJson from "../../package.json";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "@/lib/app-links";

interface SiteFooterProps {
  session?: Session | null;
}

const columnHeading = "eyebrow text-cream-50/60 mb-4";
const footerLink =
  "text-sm text-cream-50/80 hover:text-sun-200 transition-colors";

/**
 * Site footer — forest-green grain panel matching the marketing site
 * (new.everybodyeats.nz): display heading, eyebrow link columns, round
 * social icon buttons and a hairline legal strip.
 *
 * @example
 * ```tsx
 * <SiteFooter session={session} />
 * ```
 */
export function SiteFooter({ session }: SiteFooterProps) {
  const currentYear = 2026;
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <footer className="grain relative mt-16 overflow-hidden bg-forest-700 text-cream-50">
      {/* Warm sun glow — radial gradient rather than a blur filter, which
          escapes clipping on composited layers in Chromium */}
      <div
        className="absolute -bottom-32 -right-32 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.18),transparent)]"
        aria-hidden
      />
      <div className="relative max-w-[88rem] mx-auto px-5 sm:px-8 lg:px-12 pt-16 pb-10">
        <h2 className="display max-w-3xl text-4xl leading-[1.02] tracking-tight sm:text-5xl">
          Make a difference <em className="text-sun-200">one plate</em> at a
          time
        </h2>

        {/* Main footer content */}
        <div className="mt-14 mb-10 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* About section */}
          <div>
            <h3 className={columnHeading}>Everybody Eats</h3>
            <p className="text-sm leading-relaxed text-cream-50/80 mb-4">
              Transforming rescued food into quality 3-course meals on a
              pay-what-you-can basis, reducing food waste and social isolation
              in Aotearoa.
            </p>
            <p className="text-xs text-cream-50/60">
              Registered charity number:{" "}
              <a
                href="https://www.register.charities.govt.nz/Charity/CC56055"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-cream-50/80 hover:text-sun-200 underline underline-offset-4 transition-colors"
              >
                CC56055
              </a>
            </p>
          </div>

          {/* Social Media */}
          <div>
            <h3 className={columnHeading}>Connect With Us</h3>
            <div className="space-y-2.5">
              <a
                href="https://www.facebook.com/everybodyeatsnz"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 ${footerLink}`}
              >
                <Facebook size={16} className="shrink-0 opacity-70" />
                Follow us on Facebook
              </a>
              <a
                href="https://www.instagram.com/everybodyeatsnz"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 ${footerLink}`}
              >
                <Instagram size={16} className="shrink-0 opacity-70" />
                Follow us on Instagram
              </a>
              <a
                href="https://www.everybodyeats.nz"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 ${footerLink}`}
              >
                <Globe size={16} className="shrink-0 opacity-70" />
                Visit our website
              </a>
              <a
                href="mailto:info@everybodyeats.nz"
                className={`flex items-center gap-3 ${footerLink}`}
              >
                <Mail size={16} className="shrink-0 opacity-70" />
                Contact us
              </a>
            </div>
          </div>

          {/* Quick links for logged-in users */}
          {session?.user && (
            <div>
              <h3 className={columnHeading}>Quick Links</h3>
              <nav className="space-y-2.5">
                <Link href="/dashboard" className={`block ${footerLink}`}>
                  My Dashboard
                </Link>
                <Link href="/profile" className={`block ${footerLink}`}>
                  My Profile
                </Link>
                {!isAdmin && (
                  <>
                    <Link href="/shifts/mine" className={`block ${footerLink}`}>
                      My Shifts
                    </Link>
                    <Link href="/friends" className={`block ${footerLink}`}>
                      Friends
                    </Link>
                  </>
                )}
              </nav>
            </div>
          )}

          {/* Call to action for non-logged-in users */}
          {!session?.user && (
            <div>
              <h3 className={columnHeading}>Ready to Volunteer?</h3>
              <p className="text-sm text-cream-50/80 mb-4">
                Join our community of volunteers and help make a difference in
                your local community.
              </p>
              <div className="space-y-2">
                <Link
                  href="/register"
                  className="btn w-full bg-sun-200 text-forest-700 hover:bg-sun-300"
                >
                  Get Started Today
                </Link>
                <Link
                  href="/shifts"
                  className="btn w-full border border-cream-50/30 text-cream-50 hover:bg-cream-50 hover:text-forest-700"
                >
                  Browse Opportunities
                </Link>
              </div>
            </div>
          )}

          {/* Mobile app */}
          <div>
            <h3 className={columnHeading}>Get the App</h3>
            <p className="text-sm text-cream-50/80 mb-4">
              Book shifts and track your mahi from your pocket.
            </p>
            <div className="space-y-2.5">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center gap-2 ${footerLink}`}
              >
                Download on the App Store
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </a>
              <a
                href={GOOGLE_PLAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center gap-2 ${footerLink}`}
              >
                Get it on Google Play
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom footer */}
        <div className="flex flex-col gap-4 border-t border-cream-50/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-cream-50/60">
            <p>© Everybody Eats {currentYear}. All rights reserved.</p>
            <span className="hidden sm:inline text-cream-50/30">•</span>
            <p>Making a difference, one meal at a time.</p>
            <span className="hidden sm:inline text-cream-50/30">•</span>
            <span className="text-cream-50/40">v{packageJson.version}</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/everybodyeatsnz"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Everybody Eats on Facebook"
              className="grid h-9 w-9 place-items-center rounded-full border border-cream-50/20 text-cream-50/80 transition-all hover:border-sun-200 hover:bg-sun-200 hover:text-forest-700"
            >
              <Facebook size={15} />
            </a>
            <a
              href="https://www.instagram.com/everybodyeatsnz"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Everybody Eats on Instagram"
              className="grid h-9 w-9 place-items-center rounded-full border border-cream-50/20 text-cream-50/80 transition-all hover:border-sun-200 hover:bg-sun-200 hover:text-forest-700"
            >
              <Instagram size={15} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
