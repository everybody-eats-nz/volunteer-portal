"use client";

import { SessionProvider } from "next-auth/react";
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
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
