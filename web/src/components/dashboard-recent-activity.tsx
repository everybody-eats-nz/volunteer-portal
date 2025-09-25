import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MotionContentCard } from "@/components/motion-content-card";
import { CheckCircle, Clock } from "lucide-react";
import Link from "next/link";

interface DashboardRecentActivityProps {
  userId: string;
}

export async function DashboardRecentActivity({ userId }: DashboardRecentActivityProps) {
  const now = new Date();

  // Recent completed shifts (last 3)
  const recentShifts = await prisma.signup.findMany({
    where: {
      userId: userId,
      shift: { end: { lt: now } },
      status: "CONFIRMED",
    },
    include: { shift: { include: { shiftType: true } } },
    orderBy: { shift: { start: "desc" } },
    take: 3,
  });

  return (
    <MotionContentCard className="h-fit flex-1 min-w-80" delay={0.3}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-primary dark:text-emerald-400" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentShifts.length > 0 ? (
          <div className="space-y-4">
            {recentShifts.map((signup) => (
              <div
                key={signup.id}
                className="flex items-center gap-3 p-3 rounded-lg"
              >
                <div className="w-10 h-10 bg-primary/10 dark:bg-emerald-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-primary dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {signup.shift.shiftType.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(signup.shift.start, "MMM d")} •{" "}
                    {signup.shift.location}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  Completed
                </Badge>
              </div>
            ))}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/shifts/mine">View All History</Link>
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted dark:bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-muted-foreground dark:text-gray-500" />
            </div>
            <h3 className="font-semibold mb-2">No completed shifts yet</h3>
            <p className="text-muted-foreground text-sm">
              Your completed shifts will appear here after you volunteer.
            </p>
          </div>
        )}
      </CardContent>
    </MotionContentCard>
  );
}