import type { Metadata } from "next";
import { Libre_Franklin, Fraunces } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { SiteHeaderClientWrapper } from "@/components/site-header-client-wrapper";
import { SiteFooterWrapper } from "@/components/site-footer-wrapper";
import { Providers } from "@/components/providers";
import { MainContentWrapper } from "@/components/main-content-wrapper";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  description: "Sign up for volunteer shifts",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  // Fetch user profile data including profile photo
  let userProfile = null;
  if (session?.user?.email) {
    userProfile = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        profilePhotoUrl: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Volunteer Portal - Everybody Eats</title>
        <link href="/favicon.jpg" rel="shortcut icon" type="image/x-icon" />
      </head>
      <body
        className={`${libreFranklin.variable} ${fraunces.variable} antialiased`}
      >
        <Providers>
          <SiteHeaderClientWrapper
            session={session}
            userProfile={userProfile}
          />
          <main className="min-h-screen">
            <MainContentWrapper>{children}</MainContentWrapper>
          </main>
          <SiteFooterWrapper session={session} />
          <Toaster position="top-right" closeButton />
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
