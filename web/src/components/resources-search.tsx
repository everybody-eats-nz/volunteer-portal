"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ResourcesSearchProps {
  availableTags: string[];
}

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
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Search Input */}
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>

        {/* Category Filter */}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
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
          <SelectTrigger>
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="PDF">PDF</SelectItem>
            <SelectItem value="IMAGE">Image</SelectItem>
            <SelectItem value="DOCUMENT">Document</SelectItem>
            <SelectItem value="LINK">Link</SelectItem>
            <SelectItem value="VIDEO">Video</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      {availableTags.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Filter by tags:</div>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleSearch} className="flex-1">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
        {hasFilters && (
          <Button onClick={handleReset} variant="outline">
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
