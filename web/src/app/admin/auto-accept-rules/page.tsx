import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Auto-Approval",
};

/** Old route - auto-accept rules became Auto-Approval. */
export default function LegacyAutoAcceptRulesPage() {
  permanentRedirect("/admin/auto-approval");
}
