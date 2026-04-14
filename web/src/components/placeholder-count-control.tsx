"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Minus, Plus, Users, Info } from "lucide-react";

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
      className="flex items-center justify-between"
      data-testid={`placeholder-control-${shiftId}`}
    >
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        <span className="text-xs text-slate-500 dark:text-slate-400">Walk-in volunteers</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 text-slate-400 dark:text-slate-500 cursor-help" />
          </TooltipTrigger>
          <TooltipContent>Volunteers who showed up without an account</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0 text-slate-500"
          disabled={count <= 0 || isPending}
          onClick={() => updateCount(count - 1)}
          data-testid={`placeholder-decrease-${shiftId}`}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span
          className="w-5 text-center text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300"
          data-testid={`placeholder-count-${shiftId}`}
        >
          {count}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0 text-slate-500"
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
