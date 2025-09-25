import * as React from "react"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { type VariantProps } from "class-variance-authority"

export interface GradientButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  gradient?: "primary" | "success" | "warning" | "danger" | "info"
  asChild?: boolean
}

const gradientVariants = {
  primary: "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70",
  success: "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600",
  warning: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600",
  danger: "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600",
  info: "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600",
}

const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, gradient = "primary", children, ...props }, ref) => {
    return (
      <Button
        className={cn(
          gradientVariants[gradient],
          "text-white hover:text-white dark:text-white dark:hover:text-white",
          "shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02]",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </Button>
    )
  }
)
GradientButton.displayName = "GradientButton"

export { GradientButton }