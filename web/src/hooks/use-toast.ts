import { useCallback } from "react";
import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  const toast = useCallback(
    () =>
      ({ title, description, variant = "default" }: ToastOptions) => {
        if (variant === "destructive") {
          sonnerToast.error(title, description ? { description } : undefined);
        } else {
          sonnerToast.success(title, description ? { description } : undefined);
        }
      },
    []
  );

  return { toast: toast() };
}
