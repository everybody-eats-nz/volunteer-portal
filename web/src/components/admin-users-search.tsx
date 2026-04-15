"use client";

import { useState, useMemo } from "react";
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
import Link from "next/link";

interface AdminUsersSearchProps {
  initialSearch?: string;
  roleFilter?: string;
  locationFilter?: string;
  locations?: string[];
}

export function AdminUsersSearch({
  initialSearch,
  roleFilter,
  locationFilter,
  locations = [],
}: AdminUsersSearchProps) {
  const [searchValue, setSearchValue] = useState(initialSearch || "");
  const [prevInitialSearch, setPrevInitialSearch] = useState(initialSearch);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sync search input with URL params when they change (e.g., clicking "Clear filters")
  // Using the getDerivedStateFromProps pattern (in hooks form) to update state during render
  if (initialSearch !== prevInitialSearch) {
    setSearchValue(initialSearch || "");
    setPrevInitialSearch(initialSearch);
  }

  // Helper to build URLs that preserve sorting parameters
  const buildFilterUrl = useMemo(
    () => (role?: string, location?: string) => {
      const params = new URLSearchParams();

      // Preserve sorting if exists
      const currentSortBy = searchParams.get("sortBy");
      const currentSortOrder = searchParams.get("sortOrder");
      if (currentSortBy) params.set("sortBy", currentSortBy);
      if (currentSortOrder) params.set("sortOrder", currentSortOrder);

      // Add search if exists
      if (searchValue) params.set("search", searchValue);

      // Add role if specified
      if (role) params.set("role", role);

      // Add location if specified
      if (location) params.set("location", location);

      const queryString = params.toString();
      return queryString ? `/admin/users?${queryString}` : "/admin/users";
    },
    [searchParams, searchValue]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams(window.location.search);

    // Update or remove search parameter
    if (searchValue.trim()) {
      params.set("search", searchValue.trim());
    } else {
      params.delete("search");
    }

    // Preserve role filter if it exists
    if (roleFilter) {
      params.set("role", roleFilter);
    }

    // Preserve location filter if it exists
    if (locationFilter) {
      params.set("location", locationFilter);
    }

    // Reset to page 1 when searching
    params.set("page", "1");

    const queryString = params.toString();
    const url = queryString ? `/admin/users?${queryString}` : "/admin/users";
    router.push(url);
  };

  const handleLocationChange = (value: string) => {
    const location = value === "all" ? undefined : value;
    const url = buildFilterUrl(roleFilter, location);
    router.push(url);
  };

  return (
    <section data-testid="filters-section" className="mb-6">
      <form
        onSubmit={handleSubmit}
        data-testid="search-form"
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by name, email..."
              className="pl-10"
              data-testid="search-input"
            />
          </div>
        </div>
        {locations.length > 0 && (
          <Select
            value={locationFilter ?? "all"}
            onValueChange={handleLocationChange}
          >
            <SelectTrigger
              className="w-[180px] h-9"
              data-testid="location-filter-select"
            >
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          type="submit"
          variant="outline"
          data-testid="search-button"
        >
          Search
        </Button>
      </form>

      {/* Role Filter Buttons */}
      <div className="flex flex-wrap gap-2 mt-4" data-testid="main-role-filter-buttons">
        <Link href={buildFilterUrl(undefined, locationFilter)}>
          <Button
            variant={!roleFilter ? "default" : "outline"}
            size="sm"
            className={
              !roleFilter ? "btn-primary shadow-sm" : "hover:bg-slate-50"
            }
            data-testid="filter-all-roles"
          >
            All Roles
          </Button>
        </Link>
        <Link href={buildFilterUrl("VOLUNTEER", locationFilter)}>
          <Button
            variant={roleFilter === "VOLUNTEER" ? "default" : "outline"}
            size="sm"
            className={
              roleFilter === "VOLUNTEER"
                ? "btn-primary shadow-sm"
                : "hover:bg-slate-50"
            }
            data-testid="filter-volunteers"
          >
            Volunteers
          </Button>
        </Link>
        <Link href={buildFilterUrl("ADMIN", locationFilter)}>
          <Button
            variant={roleFilter === "ADMIN" ? "default" : "outline"}
            size="sm"
            className={
              roleFilter === "ADMIN"
                ? "btn-primary shadow-sm"
                : "hover:bg-slate-50"
            }
            data-testid="filter-admins"
          >
            Admins
          </Button>
        </Link>
        {(initialSearch || roleFilter || locationFilter) && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700 gap-1"
            data-testid="clear-filters-button"
          >
            <Link href="/admin/users">
              <X className="h-3 w-3" />
              Clear filters
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
