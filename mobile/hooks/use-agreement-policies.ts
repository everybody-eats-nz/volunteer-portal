import { useCallback, useEffect, useState } from "react";

import { API_URL } from "@/lib/api";

// The web app serves the canonical policy text as static markdown; the mobile
// app reads the same files so the wording can never drift between platforms.
export const AGREEMENTS = {
  volunteer: {
    title: "Volunteer Agreement",
    path: "/content/volunteer-agreement.md",
  },
  safety: {
    title: "Health & Safety Policy",
    path: "/content/health-safety-policy.md",
  },
} as const;

export type AgreementKey = keyof typeof AGREEMENTS;

type PolicyMap<T> = Record<AgreementKey, T>;

/**
 * Loads (and caches) the markdown for both required agreements. Both are
 * prefetched on mount so the reader opens with content already in hand; `load`
 * is exposed for retry-on-error.
 */
export function useAgreementPolicies() {
  const [text, setText] = useState<PolicyMap<string>>({
    volunteer: "",
    safety: "",
  });
  const [loading, setLoading] = useState<PolicyMap<boolean>>({
    volunteer: false,
    safety: false,
  });
  const [error, setError] = useState<PolicyMap<boolean>>({
    volunteer: false,
    safety: false,
  });

  const load = useCallback(async (key: AgreementKey) => {
    setLoading((s) => ({ ...s, [key]: true }));
    setError((s) => ({ ...s, [key]: false }));
    try {
      const res = await fetch(`${API_URL}${AGREEMENTS[key].path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      setText((s) => ({ ...s, [key]: body }));
    } catch {
      setError((s) => ({ ...s, [key]: true }));
    } finally {
      setLoading((s) => ({ ...s, [key]: false }));
    }
  }, []);

  useEffect(() => {
    load("volunteer");
    load("safety");
  }, [load]);

  return { text, loading, error, load };
}
