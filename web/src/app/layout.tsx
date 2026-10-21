import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { SiteHeaderClientWrapper } from "@/components/site-header-client-wrapper";
import { SiteFooterWrapper } from "@/components/site-footer-wrapper";
import { Providers } from "@/components/providers";
import { MainContentWrapper } from "@/components/main-content-wrapper";
import { ThemedToaster } from "@/components/themed-toaster";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { getBaseUrl } from "@/lib/utils";
import { SEO_CONFIG } from "@/lib/seo";

// Body font — Plus Jakarta Sans, matching the marketing site
// (new.everybodyeats.nz).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

// Self-hosted Fraunces variable font (matches the marketing site / live Webflow)
// with all four axes: SOFT, WONK, opsz, wght.
const fraunces = localFont({
  variable: "--font-fraunces",
  display: "swap",
  src: [
    {
      path: "../../public/fonts/Fraunces-VariableFont.ttf",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "../../public/fonts/Fraunces-Italic-VariableFont.ttf",
      style: "italic",
      weight: "100 900",
    },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: "Volunteer Portal - Everybody Eats",
    template: "%s | Everybody Eats",
  },
  description: SEO_CONFIG.defaultDescription,
  keywords: [
    "volunteer",
    "New Zealand",
    "food rescue",
    "community",
    "charitable restaurant",
    "Everybody Eats",
  ],
  authors: [{ name: "Everybody Eats" }],
  creator: "Everybody Eats",
  publisher: "Everybody Eats",
  // iOS/WebKit Data Detectors rewrite the DOM before React hydrates, wrapping
  // anything that looks like a date, time or address in its own <a>. Every shift
  // page is dense with "Tuesday 25 August 2026" and "5:30 PM to 9:00 PM", so this
  // injects elements React never rendered — an element-level React #418
  // hydration mismatch, which is why iOS fails several times more often than
  // Chrome on desktop. Volunteers get dates via the calendar export instead.
  formatDetection: {
    email: false,
    telephone: false,
    date: false,
    address: false,
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/favicon.png",
  },
  // iOS Safari Smart App Banner — promotes installing/opening the mobile app.
  // Pairs with the Universal Links setup so "Open" deep-links into the app.
  itunes: {
    appId: "6760931588",
  },
  openGraph: {
    type: "website",
    locale: "en_NZ",
    url: getBaseUrl(),
    siteName: "Everybody Eats Volunteer Portal",
    title: "Volunteer Portal - Everybody Eats",
    description:
      "Join our community of volunteers making a difference in fighting food waste and food insecurity across New Zealand.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Everybody Eats Volunteer Portal",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

// The browser chrome (Safari's tab bar, Android's status bar) takes the page
// background in each scheme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf8ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1114" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        suppressHydrationWarning: the e2e test harness adds an `e2e-testing`
        class to <body> before React hydrates (to disable animations), and
        browser extensions commonly mutate <body> attributes too. Suppressing
        the resulting benign hydration warning keeps it from triggering
        Next.js's dev error overlay.
      */}
      <body
        suppressHydrationWarning
        className={`${jakarta.variable} ${fraunces.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only rounded-full bg-forest-500 px-5 py-3 text-sm font-medium text-cream-50 shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:outline-2 focus:outline-offset-2 focus:outline-forest-500"
        >
          Skip to main content
        </a>
        <Providers>
          <ImpersonationBanner />
          <Suspense>
            <SiteHeaderClientWrapper />
          </Suspense>
          {/* Suspense: reads usePathname, which cacheComponents treats as
              uncached request data during prerender */}
          <Suspense>
            <EmailVerificationBanner />
          </Suspense>
          <main id="main-content" tabIndex={-1} className="min-h-screen focus:outline-none">
            <Suspense>
              <MainContentWrapper>{children}</MainContentWrapper>
            </Suspense>
          </main>
          <Suspense>
            <SiteFooterWrapper />
          </Suspense>
          <ThemedToaster />
        </Providers>
      </body>
    </html>
  );
}
