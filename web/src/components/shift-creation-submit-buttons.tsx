"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { CalendarDaysIcon, Loader2 } from "lucide-react";
import Link from "next/link";

export function BulkShiftSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
      <Button
        asChild
        variant="outline"
        size="lg"
        className="order-2 sm:order-1"
        disabled={pending}
      >
        <Link href="/admin/shifts">Cancel</Link>
      </Button>
      <Button
        type="submit"
        size="lg"
        className="order-1 sm:order-2 bg-primary hover:bg-primary/90"
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating shifts...
          </>
        ) : (
          <>
            <CalendarDaysIcon className="h-4 w-4 mr-2" />
            Create Schedule
          </>
        )}
      </Button>
    </div>
  );
}
