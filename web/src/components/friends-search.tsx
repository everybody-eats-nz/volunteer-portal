"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface FriendsSearchProps {
  onSearchChange: (search: string) => void;
}

export function FriendsSearch({ onSearchChange }: FriendsSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    onSearchChange(value);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
      <Input
        placeholder="Search friends..."
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="pl-10 w-64"
        data-testid="friends-search-input"
      />
    </div>
  );
}