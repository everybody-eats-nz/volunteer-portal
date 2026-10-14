"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { swrConfig } from "@/lib/swr";
import { ThemeProvider } from "./theme-provider";
import { MotionConfig } from "./motion-config";
import { PostHogIdentifier } from "./posthog-identifier";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <PostHogIdentifier />
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <MotionConfig />
        <SWRConfig value={swrConfig}>{children}</SWRConfig>
      </ThemeProvider>
    </SessionProvider>
  );
}
