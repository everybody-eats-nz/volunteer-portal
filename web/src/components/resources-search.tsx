"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ResourcesSearchProps {
  availableTags: string[];
}

/* Pill-shaped filter controls share one height so the toolbar reads as a
   single row — matches the marketing site's newsletter input pattern. */
const pillField =
  "h-12 rounded-full border-forest-500/15 bg-cream-100 px-5 text-sm text-forest-700 shadow-none transition-colors hover:border-forest-500/30 dark:border-cream-50/10 dark:bg-forest-800/60 dark:text-cream-50 dark:hover:bg-forest-800/80";

export function ResourcesSearch({ availableTags }: ResourcesSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [type, setType] = useState(searchParams.get("type") || "all");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get("tags")?.split(",").filter(Boolean) || []
  );

  const handleSearch = () => {
    const params = new URLSearchParams();

    if (search) params.set("search", search);
    if (category && category !== "all") params.set("category", category);
    if (type && type !== "all") params.set("type", type);
    if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));

    router.push(`/resources?${params.toString()}`);
  };

  const handleReset = () => {
    setSearch("");
    setCategory("all");
    setType("all");
    setSelectedTags([]);
    router.push("/resources");
  };

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);

    // Auto-apply when tag is toggled
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category && category !== "all") params.set("category", category);
    if (type && type !== "all") params.set("type", type);
    if (newTags.length > 0) params.set("tags", newTags.join(","));
    router.push(`/resources?${params.toString()}`);
  };

  // Auto-apply filters when category or type changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category && category !== "all") params.set("category", category);
    if (type && type !== "all") params.set("type", type);
    if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));

    // Only navigate if there's an actual filter change (not on initial mount)
    const currentParams = searchParams.toString();
    const newParams = params.toString();
    if (currentParams !== newParams && (category !== "all" || type !== "all")) {
      router.push(`/resources?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, type]);

  const hasFilters = search || (category && category !== "all") || (type && type !== "all") || selectedTags.length > 0;

  return (
    <div className="rounded-[2rem] border border-forest-500/10 bg-card p-4 shadow-[0_24px_70px_-30px_rgb(14_42_28/0.45)] sm:p-6 dark:border-cream-50/10">
      <div className="flex flex-col gap-3 lg:flex-row">
        {/* Search pill — transparent input inside a coloured wrapper */}
        <div className="flex h-12 flex-1 items-center gap-2 rounded-full border border-forest-500/15 bg-cream-100 p-1.5 pl-4 transition-colors focus-within:border-forest-500/40 dark:border-cream-50/10 dark:bg-forest-800/60 dark:focus-within:border-cream-50/30">
          <Search
            className="h-4 w-4 shrink-0 text-forest-500/70 dark:text-cream-50/60"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-9 w-full min-w-0 flex-1 bg-transparent text-sm text-forest-700 placeholder:text-forest-700/45 focus:outline-none dark:text-cream-50 dark:placeholder:text-cream-50/45 [&::-webkit-search-cancel-button]:hidden"
          />
          <Button
            onClick={handleSearch}
            className="h-9 shrink-0 rounded-full bg-forest-500 px-5 text-cream-50 hover:-translate-y-0.5 hover:bg-forest-600 hover:shadow-lg active:translate-y-0 dark:bg-forest-500 dark:hover:bg-forest-400"
          >
            Search
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Category Filter */}
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger
              className={`${pillField} w-full sm:w-44`}
              aria-label="Filter by category"
            >
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="TRAINING">Training</SelectItem>
              <SelectItem value="POLICIES">Policies</SelectItem>
              <SelectItem value="FORMS">Forms</SelectItem>
              <SelectItem value="GUIDES">Guides</SelectItem>
              <SelectItem value="RECIPES">Recipes</SelectItem>
              <SelectItem value="SAFETY">Safety</SelectItem>
              <SelectItem value="GENERAL">General</SelectItem>
            </SelectContent>
          </Select>

          {/* Type Filter */}
          <Select value={type} onValueChange={setType}>
            <SelectTrigger
              className={`${pillField} w-full sm:w-40`}
              aria-label="Filter by type"
            >
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="PDF">PDF</SelectItem>
              <SelectItem value="IMAGE">Image</SelectItem>
              <SelectItem value="DOCUMENT">Document</SelectItem>
              <SelectItem value="LINK">Link</SelectItem>
              <SelectItem value="VIDEO">Video</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              onClick={handleReset}
              variant="ghost"
              className="h-12 shrink-0 rounded-full border border-forest-500/20 px-5 text-forest-700 hover:border-forest-500/40 hover:bg-forest-500/5 dark:border-cream-50/20 dark:text-cream-50 dark:hover:bg-cream-50/10"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Tags */}
      {availableTags.length > 0 && (
        <div className="mt-4 border-t border-forest-500/10 pt-4 dark:border-cream-50/10">
          <p className="eyebrow text-forest-500/80 dark:text-cream-50/60">
            Filter by tags:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={isSelected}
                  className={`tag-badge cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? "border border-forest-500 bg-forest-500 text-cream-50 shadow-sm hover:bg-forest-600"
                      : "border border-forest-500/20 text-forest-700/85 hover:border-forest-500/40 hover:bg-forest-500/5 dark:border-cream-50/20 dark:text-cream-50/80 dark:hover:bg-cream-50/10"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
