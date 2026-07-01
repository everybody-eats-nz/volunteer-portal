"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircleIcon, CheckCircle2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ERROR_MESSAGES: Record<string, string> = {
  validation: "Some fields were missing or invalid. Check the form and try again.",
  bulk_validation:
    "Some fields were missing or invalid. Check the date range, days, and templates.",
  template_validation: "The template form had missing or invalid fields.",
  shift_type_validation: "The shift type form had missing or invalid fields.",
  startdate: "The start date is not valid.",
  enddate: "The end date is not valid.",
  range: "The end time must be after the start time.",
  past: "Shifts must start in the future.",
  date_range: "The end date must be after the start date.",
  no_shifts:
    "No shifts were created: every matching day was in the past or outside the range.",
  create: "The shift could not be saved. Please try again.",
  bulk_create: "The schedule could not be saved. Please try again.",
  template_create: "The template could not be saved. Please try again.",
  template_edit: "The template could not be updated. Please try again.",
  template_delete: "The template could not be deleted. Please try again.",
  template_invalid: "That template could not be found.",
  shift_type_create: "The shift type could not be saved. Please try again.",
  shift_type_edit: "The shift type could not be updated. Please try again.",
  shift_type_delete: "The shift type could not be deleted. Please try again.",
  shift_type_exists: "A shift type with that name already exists.",
  shift_type_invalid: "That shift type could not be found.",
  shift_type_in_use:
    "That shift type is still used by shifts, templates, or regular volunteers, so it can't be deleted.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  template_created: "Template created.",
  template_updated: "Template updated.",
  template_deleted: "Template deleted.",
  shift_type_created: "Shift type created.",
  shift_type_updated: "Shift type updated.",
  shift_type_deleted: "Shift type deleted.",
};

/**
 * Surfaces the ?error= / ?template_created= style feedback the server actions
 * redirect back with. Dismissing clears the query string.
 */
export function RedirectFeedback() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const errorCode = searchParams.get("error");
  const successKey = Object.keys(SUCCESS_MESSAGES).find(
    (key) => searchParams.get(key) === "1"
  );

  const error = errorCode
    ? ERROR_MESSAGES[errorCode] ?? "Something went wrong. Please try again."
    : null;
  const success = successKey ? SUCCESS_MESSAGES[successKey] : null;

  if (!error && !success) return null;

  const dismiss = () => {
    // Keep the active tab when clearing the feedback params
    const tab = searchParams.get("tab");
    router.replace(tab ? `${pathname}?tab=${tab}` : pathname, {
      scroll: false,
    });
  };

  return (
    <div
      role={error ? "alert" : "status"}
      data-testid="shift-creation-feedback"
      className={cn(
        "mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        error
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          : "border-forest-200 bg-forest-500/5 text-forest-600 dark:border-forest-300/40 dark:bg-forest-500/15 dark:text-forest-100"
      )}
    >
      {error ? (
        <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <CheckCircle2Icon className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p className="flex-1">{error ?? success}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss message"
        className="shrink-0 cursor-pointer rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
