"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { UserCheck, UsersRound } from "lucide-react";
import { formatInNZT } from "@/lib/timezone";
import { ChartCard, ChartEmpty } from "../_components/primitives";
import { num } from "../_lib/chart-theme";
import { CreateNotificationGroupDialog } from "./create-notification-group-dialog";
import type { ShortageConvertersResult } from "@/lib/shortage-analytics";

interface Props {
  data: ShortageConvertersResult;
  months: string;
  location: string;
  windowLabel: string;
}

function getInitials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function ShortageConvertersTable({
  data,
  months,
  location,
  windowLabel,
}: Props) {
  const { converters, total, cap } = data;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const allSelected =
    converters.length > 0 && selected.size === converters.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(converters.map((c) => c.userId))
    );
  };

  const toggleOne = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const memberIds = useMemo(() => [...selected], [selected]);

  const defaultName =
    location === "all"
      ? "Shortage responders"
      : `Shortage responders — ${location}`;

  return (
    <ChartCard
      title="Volunteers Who Convert"
      icon={UserCheck}
      accent="text-emerald-600 dark:text-emerald-400"
      bodyClassName="px-2"
      info={{
        title: "Volunteers Who Convert",
        description: "Who signs up after a shortage alert",
        body: (
          <>
            <p>
              Volunteers who signed up for a shift within {windowLabel} of a
              delivered alert, ranked by how many alerts they converted.
            </p>
            <p>
              Tick volunteers (or the header to select all) and{" "}
              <span className="font-medium">Create group</span> to save them as a
              notification group you can target when sending shortage alerts.
            </p>
          </>
        ),
      }}
      action={
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={selected.size === 0}
        >
          <UsersRound className="mr-1.5 h-4 w-4" />
          Create group
          {selected.size > 0 && ` (${selected.size})`}
        </Button>
      }
    >
      {converters.length === 0 ? (
        <ChartEmpty
          message="No volunteers signed up from an alert in this period"
          height={200}
        />
      ) : (
        <>
          <div className="max-h-[440px] overflow-auto px-2 pb-1">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={
                        allSelected ? true : someSelected ? "indeterminate" : false
                      }
                      onCheckedChange={toggleAll}
                      aria-label="Select all volunteers"
                    />
                  </TableHead>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Home site</TableHead>
                  <TableHead className="text-right">Alerts</TableHead>
                  <TableHead className="text-right">Signups</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Last signup</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {converters.map((c) => {
                  const checked = selected.has(c.userId);
                  return (
                    <TableRow
                      key={c.userId}
                      data-state={checked ? "selected" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(c.userId)}
                          aria-label={`Select ${c.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/volunteers/${c.userId}`}
                          className="group flex items-center gap-3"
                        >
                          <Avatar className="h-8 w-8 shadow-sm">
                            <AvatarImage
                              src={c.profilePhotoUrl ?? ""}
                              alt={c.name}
                            />
                            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
                              {getInitials(c.name, c.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium group-hover:underline">
                              {c.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.email}
                            </p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.defaultLocation ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.alertsReceived}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                        {c.signups}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {c.conversionRate}%
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {c.lastSignupAt
                          ? formatInNZT(c.lastSignupAt, "d MMM yyyy")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="px-3 pt-2 text-xs text-muted-foreground">
            {num(total)} volunteer{total === 1 ? "" : "s"} converted
            {total > cap && <span> · showing first {num(cap)}</span>}
            {selected.size > 0 && <span> · {selected.size} selected</span>}
          </p>
        </>
      )}

      <CreateNotificationGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        memberIds={memberIds}
        defaultName={defaultName}
        filters={{ source: "shortage-converters", months, location }}
        onCreated={() => setSelected(new Set())}
      />
    </ChartCard>
  );
}
