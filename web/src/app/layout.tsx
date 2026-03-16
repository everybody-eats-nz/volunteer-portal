import type { Metadata } from "next";
import { Libre_Franklin, Fraunces } from "next/font/google";
import "./globals.css";
import { SiteHeaderClientWrapper } from "@/components/site-header-client-wrapper";
import { SiteFooterWrapper } from "@/components/site-footer-wrapper";
import { Providers } from "@/components/providers";
import { MainContentWrapper } from "@/components/main-content-wrapper";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BotProtectionClient } from "@/components/bot-protection-client";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { getBaseUrl } from "@/lib/utils";
import { SEO_CONFIG } from "@/lib/seo";

const libreFranklin = Libre_Franklin({
  variable: "--font-libre-franklin",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
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
    icon: [{ url: "/favicon.jpg", type: "image/x-icon" }],
    apple: "/favicon.jpg",
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
      <body
        className={`${libreFranklin.variable} ${fraunces.variable} antialiased`}
      >
        <Providers>
          <ImpersonationBanner />
          <SiteHeaderClientWrapper />
          <main className="min-h-screen">
            <MainContentWrapper>{children}</MainContentWrapper>
          </main>
          <SiteFooterWrapper />
          <Toaster position="top-right" closeButton />
        </Providers>
        <BotProtectionClient />
        <SpeedInsights />
      </body>
    </html>
  );
}
