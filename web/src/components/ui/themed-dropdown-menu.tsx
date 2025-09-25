"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export {
  DropdownMenu as ThemedDropdownMenu,
  DropdownMenuTrigger as ThemedDropdownMenuTrigger,
  DropdownMenuLabel as ThemedDropdownMenuLabel,
}

interface ThemedDropdownMenuContentProps extends React.ComponentPropsWithoutRef<typeof DropdownMenuContent> {
  className?: string
}

export function ThemedDropdownMenuContent({
  className,
  ...props
}: ThemedDropdownMenuContentProps) {
  return (
    <DropdownMenuContent
      className={cn(
        "bg-background dark:bg-emerald-950 border-border dark:border-emerald-900",
        className
      )}
      {...props}
    />
  )
}

interface ThemedDropdownMenuItemProps extends React.ComponentPropsWithoutRef<typeof DropdownMenuItem> {
  className?: string
  variant?: "default" | "destructive"
}

export function ThemedDropdownMenuItem({
  className,
  variant = "default",
  children,
  ...props
}: ThemedDropdownMenuItemProps) {
  return (
    <DropdownMenuItem
      className={cn(
        "cursor-pointer flex items-center gap-2 p-2 rounded-lg transition-colors",
        variant === "default" && "hover:bg-primary/5 dark:hover:bg-emerald-900/30",
        variant === "destructive" && "hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400",
        className
      )}
      {...props}
    >
      {children}
    </DropdownMenuItem>
  )
}

interface ThemedDropdownMenuIconProps {
  children: React.ReactNode
  variant?: "default" | "destructive" | "active"
  className?: string
}

export function ThemedDropdownMenuIcon({
  children,
  variant = "default",
  className
}: ThemedDropdownMenuIconProps) {
  return (
    <div
      className={cn(
        "w-6 h-6 rounded-md flex items-center justify-center",
        variant === "default" && "bg-primary/10 dark:bg-emerald-800/40",
        variant === "destructive" && "bg-red-100 dark:bg-red-900/40",
        variant === "active" && "bg-primary/10 dark:bg-emerald-800/40",
        className
      )}
    >
      {children}
    </div>
  )
}

interface ThemedDropdownMenuTextProps {
  title: string
  subtitle?: string
  className?: string
}

export function ThemedDropdownMenuText({
  title,
  subtitle,
  className
}: ThemedDropdownMenuTextProps) {
  return (
    <div className={className}>
      <div className="font-medium dark:text-gray-100">{title}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground dark:text-gray-400">
          {subtitle}
        </div>
      )}
    </div>
  )
}

interface ThemedDropdownMenuSeparatorProps extends React.ComponentPropsWithoutRef<typeof DropdownMenuSeparator> {
  className?: string
}

export function ThemedDropdownMenuSeparator({
  className,
  ...props
}: ThemedDropdownMenuSeparatorProps) {
  return (
    <DropdownMenuSeparator
      className={cn(
        "bg-border dark:bg-emerald-800/30 -mx-1 my-1 h-px",
        className
      )}
      {...props}
    />
  )
}