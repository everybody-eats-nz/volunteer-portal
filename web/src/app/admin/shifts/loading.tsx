import { Calendar, MapPin, Plus } from "lucide-react";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";

export default function AdminShiftsLoading() {
  return (
    <AdminPageWrapper
      title="Restaurant Schedule"
      actions={
        <Button size="sm" disabled>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Shift
        </Button>
      }
    >
      <PageContainer>
        {/* Navigation Controls Skeleton */}
        <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between">
              {/* Left Section: Date Navigation & Location */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="h-10 w-48 bg-gray-200 rounded-md animate-pulse" />
                </div>

                <div className="hidden sm:block h-8 w-px bg-slate-200" />

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="h-10 w-40 bg-gray-200 rounded-md animate-pulse" />
                </div>
              </div>

              {/* Right Section: Today Button */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-20 bg-gray-200 rounded-md animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Shifts Display Skeleton - Masonry Grid */}
        <div className="space-y-8">
          {/* Day Shifts Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-1 flex-1 bg-gray-100 rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Day shift cards */}
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`day-${i}`} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-2 flex-1">
                      <div className="h-5 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-100 rounded w-1/2" />
                    </div>
                    <div className="h-8 w-16 bg-gray-200 rounded-full" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 rounded w-20" />
                      <div className="h-4 bg-gray-200 rounded w-16" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                      <div className="h-4 bg-gray-200 rounded w-12" />
                    </div>
                  </div>

                  {/* Volunteers section */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="space-y-2">
                      {Array.from({ length: Math.min(3, i + 1) }).map((_, j) => (
                        <div key={j} className="flex items-center gap-3">
                          <div className="h-6 w-6 bg-gray-200 rounded-full" />
                          <div className="h-4 bg-gray-200 rounded flex-1" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <div className="h-8 bg-gray-200 rounded flex-1" />
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evening Shifts Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
              <div className="h-1 flex-1 bg-gray-100 rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Evening shift cards */}
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={`evening-${i}`} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-2 flex-1">
                      <div className="h-5 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-100 rounded w-1/2" />
                    </div>
                    <div className="h-8 w-16 bg-gray-200 rounded-full" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 rounded w-20" />
                      <div className="h-4 bg-gray-200 rounded w-16" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                      <div className="h-4 bg-gray-200 rounded w-12" />
                    </div>
                  </div>

                  {/* Volunteers section */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="space-y-2">
                      {Array.from({ length: Math.min(2, i + 2) }).map((_, j) => (
                        <div key={j} className="flex items-center gap-3">
                          <div className="h-6 w-6 bg-gray-200 rounded-full" />
                          <div className="h-4 bg-gray-200 rounded flex-1" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <div className="h-8 bg-gray-200 rounded flex-1" />
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageContainer>
    </AdminPageWrapper>
  );
}