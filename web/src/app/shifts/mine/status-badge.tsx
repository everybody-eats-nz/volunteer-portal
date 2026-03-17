import { Badge } from "@/components/ui/badge";
import { Timer, CheckCircle, Users } from "lucide-react";

export function StatusBadge({
  status,
  isPast = false,
}: {
  status: string;
  isPast?: boolean;
}) {
  switch (status) {
    case "PENDING":
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50"
        >
          <Timer className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "CONFIRMED":
      return (
        <Badge className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/50">
          <CheckCircle className="h-3 w-3 mr-1" />
          {isPast ? "Completed" : "Confirmed"}
        </Badge>
      );
    case "WAITLISTED":
      return (
        <Badge variant="secondary">
          <Users className="h-3 w-3 mr-1" />
          Waitlisted
        </Badge>
      );
    default:
      return null;
  }
}
