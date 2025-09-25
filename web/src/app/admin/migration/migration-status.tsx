"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Users,
  CheckCircle,
  Calendar,
  MapPin,
  Clock,
  Tag,
} from "lucide-react";

interface MigratedDataResponse {
  success: boolean;
  data: {
    users: {
      total: number;
      migrated: number;
      recent: Array<{
        id: string;
        email: string;
        name: string;
        isMigrated: boolean;
        createdAt: string;
        shiftsCount: number;
        signupsCount: number;
      }>;
    };
    shiftTypes: {
      total: number;
      recent: Array<{
        id: string;
        name: string;
        description: string;
        createdAt: string;
        shiftsCount: number;
      }>;
    };
    shifts: {
      total: number;
      migratedFromNova: number;
      recent: Array<{
        id: string;
        start: string;
        end: string;
        location: string;
        capacity: number;
        notes: string;
        shiftType: {
          name: string;
        };
        signupsCount: number;
        createdAt: string;
      }>;
    };
    signups: {
      total: number;
      migratedFromNova: number;
      recent: Array<{
        id: string;
        status: string;
        createdAt: string;
        user: {
          email: string;
          name: string;
        };
        shift: {
          start: string;
          end: string;
          shiftType: {
            name: string;
          };
        };
      }>;
    };
  };
  error?: string;
}

export function MigrationStatus() {
  const [data, setData] = useState<MigratedDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/migration/migrated-data");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch migrated data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Migrated Data</CardTitle>
          <CardDescription>Loading migrated data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="migrated-users-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Migrated Users</span>
            </div>
            <div className="text-2xl font-bold">{data.data.users.migrated}</div>
            <p className="text-xs text-muted-foreground">
              of {data.data.users.total} total
            </p>
          </CardContent>
        </Card>

        <Card data-testid="migrated-shifts-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Nova Shifts</span>
            </div>
            <div className="text-2xl font-bold">
              {data.data.shifts.migratedFromNova}
            </div>
            <p className="text-xs text-muted-foreground">
              of {data.data.shifts.total} total
            </p>
          </CardContent>
        </Card>

        <Card data-testid="migrated-signups-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Nova Signups</span>
            </div>
            <div className="text-2xl font-bold">
              {data.data.signups.migratedFromNova}
            </div>
            <p className="text-xs text-muted-foreground">
              of {data.data.signups.total} total
            </p>
          </CardContent>
        </Card>

        <Card data-testid="shift-types-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium">Shift Types</span>
            </div>
            <div className="text-2xl font-bold">
              {data.data.shiftTypes.total}
            </div>
            <p className="text-xs text-muted-foreground">categories</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">All Migrated Data</h2>
        <Button
          onClick={fetchData}
          disabled={isLoading}
          size="sm"
          variant="outline"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Detailed Data Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">
            Users ({data.data.users.recent.length})
          </TabsTrigger>
          <TabsTrigger value="shifts">
            Shifts ({data.data.shifts.recent.length})
          </TabsTrigger>
          <TabsTrigger value="signups">
            Signups ({data.data.signups.recent.length})
          </TabsTrigger>
          <TabsTrigger value="shift-types">
            Types ({data.data.shiftTypes.recent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Migrated Users</CardTitle>
              <CardDescription>
                Users that have been migrated from Nova (showing latest 10)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.data.users.recent.length > 0 ? (
                <div className="space-y-4">
                  {data.data.users.recent.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between py-3 border-b last:border-b-0"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{user.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.signupsCount} signups
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(user.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No migrated users found.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Nova Shifts</CardTitle>
              <CardDescription>
                Shifts imported from Nova (showing latest 10)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.data.shifts.recent.length > 0 ? (
                <div className="space-y-4">
                  {data.data.shifts.recent.map((shift) => (
                    <div
                      key={shift.id}
                      className="py-3 border-b last:border-b-0"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">
                            {shift.shiftType.name}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {shift.signupsCount} signups
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(shift.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              {new Date(shift.start).toLocaleDateString()}{" "}
                              {new Date(shift.start).toLocaleTimeString()} -{" "}
                              {new Date(shift.end).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-4 w-4" />
                            <span>{shift.location || "No location"}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Capacity: {shift.capacity} volunteers
                        </p>
                        {shift.notes && (
                          <p className="text-xs text-muted-foreground truncate">
                            {shift.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No migrated shifts found.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signups" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Nova Signups</CardTitle>
              <CardDescription>
                Signups imported from Nova (showing latest 10)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.data.signups.recent.length > 0 ? (
                <div className="space-y-4">
                  {data.data.signups.recent.map((signup) => (
                    <div
                      key={signup.id}
                      className="flex items-center justify-between py-3 border-b last:border-b-0"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">
                            {signup.user.name}
                          </span>
                          <Badge
                            variant={
                              signup.status === "CONFIRMED"
                                ? "default"
                                : signup.status === "CANCELED"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {signup.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {signup.user.email}
                        </p>
                        <div className="text-sm">
                          <Badge variant="outline" className="mr-2">
                            {signup.shift.shiftType.name}
                          </Badge>
                          <span className="text-muted-foreground">
                            {new Date(signup.shift.start).toLocaleDateString()}{" "}
                            {new Date(signup.shift.start).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {new Date(signup.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(signup.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No migrated signups found.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shift-types" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Shift Types</CardTitle>
              <CardDescription>
                All shift types in the system (showing latest 10)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.data.shiftTypes.recent.length > 0 ? (
                <div className="space-y-4">
                  {data.data.shiftTypes.recent.map((shiftType) => (
                    <div
                      key={shiftType.id}
                      className="flex items-center justify-between py-3 border-b last:border-b-0"
                    >
                      <div className="space-y-1">
                        <h4 className="font-medium">{shiftType.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {shiftType.description}
                        </p>
                        <p className="text-sm">
                          <Badge variant="outline">
                            {shiftType.shiftsCount} shifts
                          </Badge>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {new Date(shiftType.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(shiftType.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No shift types found.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
