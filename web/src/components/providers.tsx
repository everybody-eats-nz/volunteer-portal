"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { swrConfig } from "@/lib/swr";
import { ThemeProvider } from "./theme-provider";
import { MotionSettings } from "./motion-config";
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
        <MotionSettings>
          <SWRConfig value={swrConfig}>{children}</SWRConfig>
        </MotionSettings>
      </ThemeProvider>
    </SessionProvider>
  );
}
