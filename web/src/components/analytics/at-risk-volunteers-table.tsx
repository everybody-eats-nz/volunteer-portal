"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";

interface AtRiskVolunteer {
  userId: string;
  name: string;
  lastShiftDate: string | null;
  daysSinceLastShift: number;
  totalShifts: number;
  riskScore: number;
}

interface AtRiskVolunteersTableProps {
  data: AtRiskVolunteer[];
}

export function AtRiskVolunteersTable({ data }: AtRiskVolunteersTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No at-risk volunteers found. Great retention!
      </div>
    );
  }

  const getRiskBadge = (score: number) => {
    if (score >= 75)
      return (
        <Badge variant="destructive" className="w-20 justify-center">
          High
        </Badge>
      );
    if (score >= 50)
      return (
        <Badge variant="default" className="w-20 justify-center bg-yellow-500">
          Medium
        </Badge>
      );
    return (
      <Badge variant="secondary" className="w-20 justify-center">
        Low
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Last Shift</TableHead>
              <TableHead>Days Since</TableHead>
              <TableHead>Total Shifts</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((volunteer) => (
              <TableRow key={volunteer.userId}>
                <TableCell className="font-medium">{volunteer.name}</TableCell>
                <TableCell>
                  {volunteer.lastShiftDate
                    ? format(new Date(volunteer.lastShiftDate), "MMM d, yyyy")
                    : "N/A"}
                </TableCell>
                <TableCell>{volunteer.daysSinceLastShift} days</TableCell>
                <TableCell>{volunteer.totalShifts}</TableCell>
                <TableCell>{getRiskBadge(volunteer.riskScore)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/volunteers/${volunteer.userId}`}>
                      View Profile
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {data.length} volunteer{data.length !== 1 ? "s" : ""} who
        haven&apos;t signed up in 30+ days but had 3+ previous shifts
      </p>
    </div>
  );
}
