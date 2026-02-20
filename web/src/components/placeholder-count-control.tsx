"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Users } from "lucide-react";

interface PlaceholderCountControlProps {
  shiftId: string;
  initialCount: number;
}

export function PlaceholderCountControl({
  shiftId,
  initialCount,
}: PlaceholderCountControlProps) {
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const updateCount = async (newCount: number) => {
    const previous = count;
    setCount(newCount);

    try {
      const response = await fetch(
        `/api/admin/shifts/${shiftId}/placeholders`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeholderCount: newCount }),
        }
      );

      if (!response.ok) {
        setCount(previous);
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setCount(previous);
    }
  };

  return (
    <div
      className="flex items-center gap-2"
      data-testid={`placeholder-control-${shiftId}`}
    >
      <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" />
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        Walk-ins
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={count <= 0 || isPending}
          onClick={() => updateCount(count - 1)}
          data-testid={`placeholder-decrease-${shiftId}`}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span
          className="w-6 text-center text-sm font-semibold tabular-nums"
          data-testid={`placeholder-count-${shiftId}`}
        >
          {count}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={isPending}
          onClick={() => updateCount(count + 1)}
          data-testid={`placeholder-increase-${shiftId}`}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
