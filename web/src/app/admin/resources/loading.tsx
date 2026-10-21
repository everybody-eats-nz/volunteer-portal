import { Upload } from "lucide-react";

import {
  AdminPageSkeleton,
  KpiTileSkeleton,
  TableSkeleton,
} from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";

export default function AdminResourcesLoading() {
  return (
    <AdminPageSkeleton
      title="Resource Hub Management"
      description="Upload and manage resources for volunteers including training materials, policies, forms, and guides."
      actions={
        <Button disabled>
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          Upload Resource
        </Button>
      }
    >
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <KpiTileSkeleton key={i} />
        ))}
      </div>

      <div aria-hidden="true" className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <TableSkeleton
          card={false}
          rows={8}
          columns={["w-44", "w-16", "w-20", "w-24", "w-14", "w-20", "w-24", "w-20"]}
          actions
        />
      </div>
    </AdminPageSkeleton>
  );
}
