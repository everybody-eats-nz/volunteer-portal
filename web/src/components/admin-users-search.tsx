"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface AdminUsersSearchProps {
  initialSearch?: string;
  roleFilter?: string;
}

export function AdminUsersSearch({
  initialSearch,
  roleFilter,
}: AdminUsersSearchProps) {
  const [searchValue, setSearchValue] = useState(initialSearch || "");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();
    if (searchValue.trim()) {
      params.set("search", searchValue.trim());
    }
    if (roleFilter) {
      params.set("role", roleFilter);
    }

    const queryString = params.toString();
    const url = queryString ? `/admin/users?${queryString}` : "/admin/users";
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
        <Button 
          type="submit"
          variant="outline"
          size="sm"
          data-testid="search-button"
        >
          Search
        </Button>
      </form>

      {/* Role Filter Buttons */}
      <div className="flex flex-wrap gap-2 mt-4" data-testid="main-role-filter-buttons">
        <Link
          href={{
            pathname: "/admin/users",
            query: searchValue ? { search: searchValue } : {},
          }}
        >
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
        <Link
          href={{
            pathname: "/admin/users",
            query: {
              role: "VOLUNTEER",
              ...(searchValue ? { search: searchValue } : {}),
            },
          }}
        >
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
        <Link
          href={{
            pathname: "/admin/users",
            query: {
              role: "ADMIN",
              ...(searchValue ? { search: searchValue } : {}),
            },
          }}
        >
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
        {(initialSearch || roleFilter) && (
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
