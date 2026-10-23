"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { YearInReviewPlayerFrame } from "@/components/year-in-review/year-in-review-player-frame";
import { YearInReviewSharePanel } from "@/components/year-in-review/year-in-review-share-panel";
import type { YearInReviewSettings } from "@/lib/year-in-review-settings";
import type { YearInReviewProps } from "@/remotion/year-in-review/schema";

type UserSearchHit = {
  id: string;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: "VOLUNTEER" | "ADMIN";
};

const displayName = (u: UserSearchHit) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || u.email;

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-NZ")} ${n === 1 ? one : many}`;

export function YearInReviewAdmin({
  initialSettings,
  initialPeople,
  years,
}: {
  readonly initialSettings: YearInReviewSettings;
  readonly initialPeople: number;
  readonly years: number[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [people, setPeople] = useState(initialPeople);
  const [saving, setSaving] = useState(false);

  // Changes save as they're made; roll back if the save fails.
  const save = async (next: YearInReviewSettings) => {
    const previous = settings;
    setSettings(next);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/year-in-review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { people: number };
      setPeople(body.people);
      toast.success(
        next.enabled === previous.enabled
          ? `Showing ${next.year}`
          : next.enabled
            ? "Year in mahi is on for everyone"
            : "Year in mahi is off"
      );
    } catch {
      setSettings(previous);
      toast.error("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card data-testid="year-in-review-settings">
        <CardHeader>
          <CardTitle>Who can see it</CardTitle>
          <CardDescription>
            When it&apos;s on, everyone with a completed shift that year sees
            their video on their dashboard and in the app, volunteers and
            admins alike. Admins can always see theirs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-6">
            <div className="space-y-1">
              <Label htmlFor="year-in-review-enabled">
                Show everyone their video
              </Label>
              <p className="text-sm text-muted-foreground">
                {plural(people, "person has", "people have")} a{" "}
                {settings.year} video.
              </p>
            </div>
            <Switch
              id="year-in-review-enabled"
              data-testid="year-in-review-enabled-switch"
              checked={settings.enabled}
              disabled={saving}
              onCheckedChange={(enabled) => save({ ...settings, enabled })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year-in-review-year">Year</Label>
            <Select
              value={String(settings.year)}
              disabled={saving}
              onValueChange={(value) =>
                save({ ...settings, year: Number(value) })
              }
            >
              <SelectTrigger
                id="year-in-review-year"
                className="w-40"
                data-testid="year-in-review-year-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              A year still in progress covers the year so far.
            </p>
          </div>
        </CardContent>
      </Card>

      <PersonPreview year={settings.year} />
    </div>
  );
}

/** Find anyone, then watch and download their video for `year`. */
function PersonPreview({ year }: { readonly year: number }) {
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<UserSearchHit | null>(null);

  const trimmed = query.trim();
  const { data: hits, isLoading: searching } = useSWR<UserSearchHit[]>(
    trimmed.length >= 2 && !person
      ? `/api/admin/users?q=${encodeURIComponent(trimmed)}&limit=8`
      : null
  );
  const { data: preview, isLoading: loadingPreview } = useSWR<{
    data: YearInReviewProps | null;
  }>(person ? `/api/admin/year-in-review/${person.id}?year=${year}` : null);

  return (
    <Card data-testid="year-in-review-preview">
      <CardHeader>
        <CardTitle>Watch someone&apos;s video</CardTitle>
        <CardDescription>
          Check anyone&apos;s {year} video, or download it to send to them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative max-w-md">
          <Label htmlFor="year-in-review-person" className="sr-only">
            Search by name or email
          </Label>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="year-in-review-person"
            data-testid="year-in-review-person-search"
            placeholder="Search by name or email"
            className="pl-9"
            value={person ? displayName(person) : query}
            onChange={(e) => {
              setPerson(null);
              setQuery(e.target.value);
            }}
            autoComplete="off"
          />
          {!person && trimmed.length >= 2 && (
            <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
              {searching ? (
                <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Searching
                </p>
              ) : hits && hits.length > 0 ? (
                <ul role="listbox" aria-label="People">
                  {hits.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                        onClick={() => setPerson(hit)}
                      >
                        <span className="text-sm font-medium">
                          {displayName(hit)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {hit.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No one matches &ldquo;{trimmed}&rdquo;.
                </p>
              )}
            </div>
          )}
        </div>

        {person &&
          (loadingPreview ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading {displayName(person)}&apos;s year
            </p>
          ) : preview?.data ? (
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
              <YearInReviewPlayerFrame
                data={preview.data}
                className="mx-auto max-w-[340px] lg:mx-0"
              />
              <YearInReviewSharePanel
                key={person.id}
                year={year}
                userId={person.id}
                heading={`${displayName(person)}'s ${year}`}
              />
            </div>
          ) : (
            <p
              className="text-sm text-muted-foreground"
              data-testid="year-in-review-preview-empty"
            >
              {displayName(person)} has no completed shifts in {year}, so
              there&apos;s no video.
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
