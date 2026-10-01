import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";

import { NewsletterListsSkeleton } from "./newsletter-lists-skeleton";

export default function NewsletterListsLoading() {
  return (
    <AdminPageSkeleton
      title="Newsletter Lists"
      description="Manage Campaign Monitor newsletter lists for volunteer subscriptions"
    >
      <NewsletterListsSkeleton />
    </AdminPageSkeleton>
  );
}
