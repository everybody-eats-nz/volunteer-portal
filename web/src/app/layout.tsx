import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { SiteHeaderClientWrapper } from "@/components/site-header-client-wrapper";
import { SiteFooterWrapper } from "@/components/site-footer-wrapper";
import { Providers } from "@/components/providers";
import { MainContentWrapper } from "@/components/main-content-wrapper";
import { Toaster } from "sonner";
import { ImpersonationBanner } from "@/components/impersonation-banner";
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
  formatDetection: {
    email: false,
    telephone: false,
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/favicon.png",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#fdf8ef" />
      </head>
      <body
        className={`${jakarta.variable} ${fraunces.variable} antialiased`}
      >
        <Providers>
          <ImpersonationBanner />
          <Suspense>
            <SiteHeaderClientWrapper />
          </Suspense>
          <main className="min-h-screen">
            <Suspense>
              <MainContentWrapper>{children}</MainContentWrapper>
            </Suspense>
          </main>
          <Suspense>
            <SiteFooterWrapper />
          </Suspense>
          <Toaster position="top-right" closeButton />
        </Providers>
      </body>
    </html>
  );
}
