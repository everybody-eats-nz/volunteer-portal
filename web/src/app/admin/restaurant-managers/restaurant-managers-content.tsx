"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import RestaurantManagerForm from "./restaurant-manager-form";
import RestaurantManagersTable from "./restaurant-managers-table";

export function RestaurantManagersContent() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleManagerUpdate = () => {
    // Increment to trigger re-render of table
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Assignment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Assign Restaurant Manager</CardTitle>
          <CardDescription>
            Select an admin user and assign them to restaurant locations for notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RestaurantManagerForm onManagerAssigned={handleManagerUpdate} />
        </CardContent>
      </Card>

      {/* Current Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Current Assignments</CardTitle>
          <CardDescription>
            View and manage existing restaurant manager assignments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RestaurantManagersTable refreshTrigger={refreshTrigger} onManagerUpdate={handleManagerUpdate} />
        </CardContent>
      </Card>
    </div>
  );
}