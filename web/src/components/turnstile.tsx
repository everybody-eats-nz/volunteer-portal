"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

/**
 * Cloudflare Turnstile widget (managed, interaction-only).
 *
 * Renders invisibly and only shows a challenge when Cloudflare decides one
 * is needed. Obtain a fresh single-use token at submit time via the ref:
 *
 * ```tsx
 * const turnstileRef = useRef<TurnstileHandle>(null);
 * // in the form, near the submit button:
 * <Turnstile ref={turnstileRef} />
 * // on submit:
 * const token = await turnstileRef.current?.getToken();
 * fetch(url, { headers: token ? { "x-turnstile-token": token } : {} });
 * ```
 *
 * When NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set (local dev, e2e tests)
 * the component renders nothing and getToken() resolves to null.
 */

export interface TurnstileHandle {
  /** Resolves with a fresh token, or null if Turnstile is not configured
   * or the challenge could not complete. */
  getToken: () => Promise<string | null>;
}

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: Record<string, unknown>
  ) => string;
  execute: (container: string | HTMLElement) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 20_000;

let scriptPromise: Promise<TurnstileApi | null> | null = null;

function loadTurnstile(): Promise<TurnstileApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(window.turnstile ?? null);
      script.onerror = () => {
        scriptPromise = null;
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

export const Turnstile = forwardRef<TurnstileHandle, { className?: string }>(
  function Turnstile({ className }, ref) {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const resolverRef = useRef<((token: string | null) => void) | null>(null);

    const settle = useCallback((token: string | null) => {
      resolverRef.current?.(token);
      resolverRef.current = null;
    }, []);

    useEffect(() => {
      if (!siteKey || !containerRef.current) return;

      let cancelled = false;
      const container = containerRef.current;

      loadTurnstile().then((turnstile) => {
        if (!turnstile || cancelled || widgetIdRef.current) return;
        widgetIdRef.current = turnstile.render(container, {
          sitekey: siteKey,
          appearance: "interaction-only",
          execution: "execute",
          callback: (token: string) => settle(token),
          "error-callback": () => settle(null),
          "expired-callback": () => settle(null),
          "timeout-callback": () => settle(null),
        });
      });

      return () => {
        cancelled = true;
        if (widgetIdRef.current) {
          window.turnstile?.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, settle]);

    useImperativeHandle(
      ref,
      () => ({
        getToken: async () => {
          if (!siteKey) return null;

          const turnstile = await loadTurnstile();
          const container = containerRef.current;
          if (!turnstile || !container || !widgetIdRef.current) return null;

          return new Promise<string | null>((resolve) => {
            // Abandon any in-flight request before starting a new one
            settle(null);
            resolverRef.current = resolve;

            const timeout = setTimeout(() => settle(null), TOKEN_TIMEOUT_MS);
            const originalResolve = resolverRef.current;
            resolverRef.current = (token) => {
              clearTimeout(timeout);
              originalResolve(token);
            };

            // Tokens are single-use: reset, then run the challenge
            turnstile.reset(widgetIdRef.current!);
            turnstile.execute(container);
          });
        },
      }),
      [siteKey, settle]
    );

    if (!siteKey) return null;

    return <div ref={containerRef} className={className} />;
  }
);
