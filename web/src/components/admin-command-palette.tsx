"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Shield, UserCheck, ExternalLink } from "lucide-react";
import { adminNavCategories, publicNavItems, getIconColor } from "@/lib/admin-navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  role: "ADMIN" | "VOLUNTEER";
  profilePhotoUrl: string | null;
  profileCompleted: boolean;
}

interface AdminCommandPaletteProps {
  children: React.ReactNode;
}

// Helper function to determine if a query matches any navigation items
function isNavigationQuery(query: string): boolean {
  const queryLower = query.toLowerCase().trim();
  
  // Check if query matches any navigation item data
  const allNavItems = [
    ...adminNavCategories.flatMap(category => 
      category.items.map(item => ({
        title: item.title,
        description: item.description,
        category: category.label,
        commandKey: item.commandKey
      }))
    ),
    ...publicNavItems.map(item => ({
      title: item.title,
      description: item.description,
      category: 'Public',
      commandKey: item.commandKey
    }))
  ];
  
  return allNavItems.some(item => {
    const searchableText = [
      item.title,
      item.description,
      item.category,
      item.commandKey
    ].filter(Boolean).join(' ').toLowerCase();
    
    return searchableText.includes(queryLower);
  });
}

export function AdminCommandPalette({ children }: AdminCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const searchUsers = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/users?q=${encodeURIComponent(searchQuery)}&limit=10`,
        {
          credentials: 'include',
        }
      );
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        console.error("Error searching users:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(query);
    }, 150);

    return () => clearTimeout(timer);
  }, [query, searchUsers]);

  const handleUserSelect = (userId: string) => {
    router.push(`/admin/volunteers/${userId}`);
    setOpen(false);
    setQuery("");
    setUsers([]);
  };

  const handleQuickAction = (href: string, opensInNewTab?: boolean) => {
    if (opensInNewTab) {
      window.open(href, "_blank");
    } else {
      router.push(href);
    }
    setOpen(false);
    setQuery("");
    setUsers([]);
  };

  const getDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.name || user.email;
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.name) {
      const nameParts = user.name.split(" ");
      if (nameParts.length > 1) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
      }
      return user.name[0].toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Admin Command Palette"
        description="Search for users or navigate to admin pages"
      >
        <CommandInput
          placeholder="Search users or type to navigate..."
          value={query}
          onValueChange={setQuery}
          data-testid="admin-command-input"
        />
        <CommandList className="max-h-80 min-h-80">
          {!loading && (
            <CommandEmpty>
              {query.trim() ? "No results found." : "Type to search users or pages..."}
            </CommandEmpty>
          )}
          
          {/* Navigation Items - Show when no query or when query is relevant to navigation */}
          {(!query.trim() || isNavigationQuery(query)) && (
            <>
              {adminNavCategories.map((category) => (
                <CommandGroup key={category.label} heading={category.label}>
                  {category.items.map((item) => (
                    <CommandItem
                      key={item.href}
                      value={`${item.title} ${item.description || ''} ${category.label} navigate admin ${item.commandKey || ''}`}
                      onSelect={() => handleQuickAction(item.href, item.opensInNewTab)}
                      className="flex items-center gap-3"
                    >
                      <item.icon className={`h-4 w-4 ${getIconColor(category.label, item.title)}`} />
                      <div className="flex flex-col">
                        <span>{item.title}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        )}
                      </div>
                      {item.opensInNewTab && (
                        <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}

              <CommandGroup heading="Public">
                {publicNavItems.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${item.title} ${item.description || ''} public navigate ${item.commandKey || ''}`}
                    onSelect={() => handleQuickAction(item.href, item.opensInNewTab)}
                    className="flex items-center gap-3"
                  >
                    <item.icon className={`h-4 w-4 ${getIconColor("Public", item.title)}`} />
                    <div className="flex flex-col">
                      <span>{item.title}</span>
                      {item.description && (
                        <span className="text-xs text-muted-foreground">{item.description}</span>
                      )}
                    </div>
                    {item.opensInNewTab && (
                      <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          
          {query.trim() && (
            <CommandGroup heading="Users">
              {loading ? (
                // Loading skeleton as CommandItems so they aren't filtered out
                <>
                  {[...Array(3)].map((_, i) => (
                    <CommandItem 
                      key={`loading-${i}`} 
                      value={query} // Use the current query so it matches
                      disabled 
                      className="flex items-center gap-3 p-3 animate-pulse cursor-default"
                    >
                      <div className="h-8 w-8 rounded-full bg-gray-200" />
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="h-4 bg-gray-200 rounded w-32" />
                        <div className="h-3 bg-gray-200 rounded w-48" />
                      </div>
                      <div className="h-3 bg-gray-200 rounded w-16" />
                    </CommandItem>
                  ))}
                </>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={`${getDisplayName(user)} ${user.email} ${user.role}`}
                    onSelect={() => handleUserSelect(user.id)}
                    data-testid={`user-search-result-${user.id}`}
                    className="flex items-center gap-3 p-3"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {user.profilePhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.profilePhotoUrl}
                          alt={getDisplayName(user)}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {getInitials(user)}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getDisplayName(user)}</span>
                          {user.role === "ADMIN" && (
                            <Shield className="h-3 w-3 text-purple-600" />
                          )}
                          {!user.profileCompleted && (
                            <UserCheck className="h-3 w-3 text-orange-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{user.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.role === "ADMIN" ? "Admin" : "Volunteer"}
                    </div>
                  </CommandItem>
                ))
              ) : null}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}