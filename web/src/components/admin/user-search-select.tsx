"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchableUser {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role?: "VOLUNTEER" | "ADMIN";
}

export function displayUserName(user: SearchableUser): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.name || user.email;
}

interface UserSearchSelectProps {
  /** The currently selected user, or null when nothing is chosen yet. */
  value: SearchableUser | null;
  onValueChange: (user: SearchableUser | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

/**
 * Picks a user by searching the server rather than shipping every user to the
 * browser. Results come from /api/admin/volunteers/search, which returns both
 * volunteers and admins.
 */
export function UserSearchSelect({
  value,
  onValueChange,
  placeholder = "Select a person...",
  searchPlaceholder = "Search by name or email...",
  disabled = false,
  className,
  "data-testid": testId,
}: UserSearchSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchableUser[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  React.useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/volunteers/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = await response.json();
        setResults(data.volunteers || []);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("User search failed:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [query]);

  // Drop the previous query's results when reopening so the list never shows
  // stale matches from an earlier selection.
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setResults([]);
    }
  };

  const emptyMessage = !query.trim()
    ? "Type a name or email to search."
    : isSearching
    ? "Searching..."
    : "No one found.";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal min-h-9",
            !value && "text-muted-foreground",
            className
          )}
          data-testid={testId}
        >
          <span className="truncate">
            {value ? `${displayUserName(value)} (${value.email})` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        {/* The server already filtered these results — cmdk must not re-filter
            them, or it would discard matches on fields it can't see. */}
        <Command shouldFilter={false}>
          <div className="relative">
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            {isSearching && (
              <Loader2
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </div>
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {results.length > 0 && (
              <CommandGroup>
                {results.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => {
                      onValueChange(user.id === value?.id ? null : user);
                      handleOpenChange(false);
                    }}
                    data-testid={`user-search-option-${user.id}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value?.id === user.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{displayUserName(user)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                    {user.role === "ADMIN" && (
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        Admin
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
