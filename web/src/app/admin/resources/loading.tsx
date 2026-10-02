import { Upload } from "lucide-react";

import {
  AdminPageSkeleton,
  TableSkeleton,
} from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminResourcesLoading() {
  return (
    <AdminPageSkeleton
      title="Resource Hub Management"
      description="Upload and manage resources for volunteers including training materials, policies, forms, and guides."
      actions={
        <Button disabled>
          <Upload className="mr-2 h-4 w-4" />
          Upload Resource
        </Button>
      }
    >
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-3">
        {["w-28", "w-20", "w-14"].map((width, i) => (
          <div key={i} className="bg-card rounded-xl border p-6 shadow-sm">
            <Skeleton className={`h-4 ${width}`} />
            <Skeleton className="mt-3 h-8 w-12" />
          </div>
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
