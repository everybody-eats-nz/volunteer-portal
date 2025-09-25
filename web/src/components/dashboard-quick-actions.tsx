import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MotionContentCard } from "@/components/motion-content-card";
import { Calendar } from "lucide-react";

export function DashboardQuickActions() {
  return (
    <MotionContentCard className="h-fit" delay={0.7}>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button asChild variant="outline" className="h-auto py-4">
            <Link href="/shifts" className="flex flex-col items-center gap-2">
              <svg
                className="w-6 h-6 text-foreground dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span className="text-sm">Find Shifts</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-auto py-4">
            <Link
              href="/shifts/mine"
              className="flex flex-col items-center gap-2"
            >
              <Calendar className="w-6 h-6 text-foreground dark:text-gray-300" />
              <span className="text-sm">My Schedule</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-auto py-4">
            <Link
              href="/profile"
              className="flex flex-col items-center gap-2"
            >
              <svg
                className="w-6 h-6 text-foreground dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="text-sm">My Profile</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-auto py-4">
            <a
              href="https://everybodyeats.nz"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2"
            >
              <svg
                className="w-6 h-6 text-foreground dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <span className="text-sm">Visit Main Site</span>
            </a>
          </Button>
        </div>
      </CardContent>
    </MotionContentCard>
  );
}