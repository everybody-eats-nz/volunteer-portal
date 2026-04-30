"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ComposeButtonProps {
  children: ReactNode;
  onCreated: (threadId: string) => void;
}

interface VolunteerHit {
  id: string;
  name: string;
  email: string;
}

export function ComposeButton({ children, onCreated }: ComposeButtonProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VolunteerHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/admin/users?q=${encodeURIComponent(trimmed)}&limit=20`, {
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as Array<{
          id: string;
          name?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          email: string;
          role: "VOLUNTEER" | "ADMIN";
        }>;
        setResults(
          data
            .filter((u) => u.role === "VOLUNTEER")
            .slice(0, 10)
            .map((u) => ({
              id: u.id,
              email: u.email,
              name:
                [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                u.name ||
                u.email,
            }))
        );
      })
      .catch(() => {
        // ignore aborted
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [query, open]);

  const start = useCallback(
    async (volunteerId: string) => {
      setCreating(true);
      try {
        const res = await fetch("/api/admin/messages/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ volunteerId }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          alert(err.error ?? "Failed to start conversation");
          return;
        }
        const data = (await res.json()) as { thread: { id: string } };
        onCreated(data.thread.id);
        setOpen(false);
        setQuery("");
      } finally {
        setCreating(false);
      }
    },
    [onCreated]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{children}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search volunteers by name or email…"
            className="pl-9"
          />
        </div>
        <div className="mt-3 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {query.trim().length < 2
                ? "Type at least 2 characters to search."
                : "No volunteers found."}
            </p>
          ) : (
            <ul className="divide-y">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => start(r.id)}
                    className="w-full text-left px-2 py-2.5 hover:bg-muted/60 transition-colors flex items-center justify-between gap-2 disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.email}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
