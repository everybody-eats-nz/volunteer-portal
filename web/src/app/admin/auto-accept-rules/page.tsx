import { permanentRedirect } from "next/navigation";

/** Old route - auto-accept rules became Auto-Approval. */
export default function LegacyAutoAcceptRulesPage() {
  permanentRedirect("/admin/auto-approval");
}
