import {
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/admin/admin-skeletons";

/**
 * Safety-net fallback for admin routes without their own `loading.tsx`.
 *
 * Every real admin page ships a skeleton that mirrors its layout and sets the
 * header title; this neutral one only covers the catch-all 404 and redirects.
 * It deliberately leaves the header alone (no AdminPageWrapper) so it never
 * shows another page's title.
 */
export default function AdminLoading() {
  return (
    <div
      data-testid="admin-page-skeleton"
      aria-busy="true"
      className="space-y-6"
    >
      <span className="sr-only" role="status">
        Loading
      </span>
      <FilterBarSkeleton />
      <TableSkeleton rows={6} />
    </div>
  );
}
