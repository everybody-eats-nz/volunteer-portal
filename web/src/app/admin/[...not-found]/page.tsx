import { notFound } from "next/navigation";

/**
 * Catch-all for unmatched `/admin/*` URLs.
 *
 * Next.js only renders a nested `not-found.tsx` for explicit `notFound()`
 * calls — unmatched URLs fall back to the root (chrome-less) 404. This
 * lowest-priority catch-all intercepts those URLs and calls `notFound()`, so
 * they render `admin/not-found.tsx` inside the admin layout (sidebar + header)
 * instead. Real admin routes always take precedence over this catch-all.
 */
export default function AdminCatchAllNotFound() {
  notFound();
}
