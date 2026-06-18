"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FriendsSearchProps {
  onSearchChange: (search: string) => void;
}

export function FriendsSearch({ onSearchChange }: FriendsSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, onSearchChange]);

  const handleClear = () => {
    setSearchTerm("");
  };

  return (
    <div className="relative w-full lg:max-w-md">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-500/50 dark:text-cream-50/50"
        aria-hidden
      />
      <input
        type="text"
        aria-label="Search friends by name or email"
        placeholder="Search your friends…"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="h-11 w-full rounded-full border border-forest-500/20 bg-background pl-11 pr-11 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-forest-700/45 focus-visible:border-forest-500 focus-visible:ring-[3px] focus-visible:ring-forest-500/20 dark:border-cream-50/15 dark:placeholder:text-cream-50/40 dark:focus-visible:border-cream-50/40 dark:focus-visible:ring-cream-50/10"
        data-testid="friends-search-input"
      />
      <AnimatePresence>
        {searchTerm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full text-forest-500/60 transition-colors hover:bg-forest-500/10 hover:text-forest-700 dark:text-cream-50/60 dark:hover:bg-cream-50/10 dark:hover:text-cream-50"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
