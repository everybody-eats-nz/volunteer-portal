"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  ThemedDropdownMenu,
  ThemedDropdownMenuContent,
  ThemedDropdownMenuItem,
  ThemedDropdownMenuTrigger,
  ThemedDropdownMenuIcon,
} from "@/components/ui/themed-dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-white/90 hover:text-white hover:bg-white/10 transition-colors duration-200 rounded-lg p-2"
        aria-label="Theme selection menu"
      >
        <div className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <ThemedDropdownMenu>
      <ThemedDropdownMenuTrigger>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/90 hover:text-white hover:bg-white/10 transition-colors duration-200 rounded-lg p-2 relative"
          aria-label="Theme selection menu"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </ThemedDropdownMenuTrigger>
      <ThemedDropdownMenuContent align="end" className="w-40 p-1">
        <ThemedDropdownMenuItem
          onClick={() => setTheme("light")}
          className={
            theme === "light" ? "bg-primary/10 dark:bg-emerald-900/50" : ""
          }
        >
          <ThemedDropdownMenuIcon
            variant={theme === "light" ? "active" : "default"}
            className={
              theme === "light"
                ? "bg-primary dark:bg-emerald-700"
                : "bg-gray-100 dark:bg-emerald-900/40"
            }
          >
            <Sun
              className={`h-3.5 w-3.5 ${
                theme === "light"
                  ? "text-white dark:text-emerald-100"
                  : "text-gray-600 dark:text-emerald-400"
              }`}
            />
          </ThemedDropdownMenuIcon>
          <span
            className={`text-sm font-medium ${
              theme === "light"
                ? "text-primary dark:text-emerald-300"
                : "dark:text-gray-100"
            }`}
          >
            Light
          </span>
        </ThemedDropdownMenuItem>

        <ThemedDropdownMenuItem
          onClick={() => setTheme("dark")}
          className={
            theme === "dark" ? "bg-primary/10 dark:bg-emerald-900/50" : ""
          }
        >
          <ThemedDropdownMenuIcon
            variant={theme === "dark" ? "active" : "default"}
            className={
              theme === "dark"
                ? "bg-primary dark:bg-emerald-700"
                : "bg-gray-100 dark:bg-emerald-900/40"
            }
          >
            <Moon
              className={`h-3.5 w-3.5 ${
                theme === "dark"
                  ? "text-white dark:text-emerald-100"
                  : "text-gray-600 dark:text-emerald-400"
              }`}
            />
          </ThemedDropdownMenuIcon>
          <span
            className={`text-sm font-medium ${
              theme === "dark"
                ? "text-primary dark:text-emerald-300"
                : "dark:text-gray-100"
            }`}
          >
            Dark
          </span>
        </ThemedDropdownMenuItem>

        <ThemedDropdownMenuItem
          onClick={() => setTheme("system")}
          className={
            theme === "system" ? "bg-primary/10 dark:bg-emerald-900/50" : ""
          }
        >
          <ThemedDropdownMenuIcon
            variant={theme === "system" ? "active" : "default"}
            className={
              theme === "system"
                ? "bg-primary dark:bg-emerald-700"
                : "bg-gray-100 dark:bg-emerald-900/40"
            }
          >
            <Monitor
              className={`h-3.5 w-3.5 ${
                theme === "system"
                  ? "text-white dark:text-emerald-100"
                  : "text-gray-600 dark:text-emerald-400"
              }`}
            />
          </ThemedDropdownMenuIcon>
          <span
            className={`text-sm font-medium ${
              theme === "system"
                ? "text-primary dark:text-emerald-300"
                : "dark:text-gray-100"
            }`}
          >
            System
          </span>
        </ThemedDropdownMenuItem>
      </ThemedDropdownMenuContent>
    </ThemedDropdownMenu>
  );
}
