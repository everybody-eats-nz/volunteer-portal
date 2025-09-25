"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Bell, BellOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface RestaurantManager {
  id: string;
  userId: string;
  locations: string[];
  receiveNotifications: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    role: string;
  };
}

interface RestaurantManagersTableProps {
  refreshTrigger?: number;
  onManagerUpdate?: () => void;
}

export default function RestaurantManagersTable({ refreshTrigger, onManagerUpdate }: RestaurantManagersTableProps) {
  const [managers, setManagers] = useState<RestaurantManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchManagers = async () => {
    try {
      const response = await fetch("/api/admin/restaurant-managers");
      if (!response.ok) {
        throw new Error("Failed to fetch managers");
      }
      const data = await response.json();
      setManagers(data);
    } catch (error) {
      console.error("Error fetching managers:", error);
      toast.error("Failed to load restaurant managers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagers();
  }, [refreshTrigger]);

  useEffect(() => {
    // Listen for updates from the form (backward compatibility)
    const handleManagerUpdate = () => {
      fetchManagers();
    };

    window.addEventListener('restaurant-manager-updated', handleManagerUpdate);
    
    return () => {
      window.removeEventListener('restaurant-manager-updated', handleManagerUpdate);
    };
  }, []);

  const toggleNotifications = async (managerId: string, currentState: boolean) => {
    setEditingId(managerId);
    try {
      const manager = managers.find(m => m.id === managerId);
      if (!manager) return;

      const response = await fetch(`/api/admin/restaurant-managers/${managerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locations: manager.locations,
          receiveNotifications: !currentState,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update notifications");
      }

      const updatedManager = await response.json();
      setManagers(prev => 
        prev.map(m => m.id === managerId ? updatedManager : m)
      );

      toast.success(
        `Notifications ${!currentState ? 'enabled' : 'disabled'} for ${manager.user.email}`
      );

      // Notify parent component
      onManagerUpdate?.();
      
      // Emit event for backward compatibility
      window.dispatchEvent(new CustomEvent('restaurant-manager-updated'));
    } catch (error) {
      console.error("Error updating notifications:", error);
      toast.error("Failed to update notification settings");
    } finally {
      setEditingId(null);
    }
  };

  const deleteManager = async (managerId: string) => {
    try {
      const response = await fetch(`/api/admin/restaurant-managers/${managerId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete manager assignment");
      }

      setManagers(prev => prev.filter(m => m.id !== managerId));
      toast.success("Manager assignment removed successfully");

      // Notify parent component
      onManagerUpdate?.();
      
      // Emit event for backward compatibility
      window.dispatchEvent(new CustomEvent('restaurant-manager-updated'));
    } catch (error) {
      console.error("Error deleting manager:", error);
      toast.error("Failed to remove manager assignment");
    }
  };

  const getUserDisplayName = (user: RestaurantManager['user']) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.name || user.email;
  };

  if (loading) {
    return <div className="text-center py-4" data-testid="loading-managers">Loading assignments...</div>;
  }

  if (managers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground" data-testid="empty-managers-state">
        <p>No restaurant managers assigned yet.</p>
        <p className="text-sm mt-1">Use the form to assign your first manager.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table data-testid="managers-table">
        <TableHeader>
          <TableRow>
            <TableHead data-testid="manager-column-header">Manager</TableHead>
            <TableHead data-testid="locations-column-header">Locations</TableHead>
            <TableHead className="text-center" data-testid="notifications-column-header">Notifications</TableHead>
            <TableHead className="text-center" data-testid="actions-column-header">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {managers.map((manager) => (
            <TableRow key={manager.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{getUserDisplayName(manager.user)}</div>
                  <div className="text-sm text-muted-foreground">{manager.user.email}</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {manager.locations.length > 0 ? (
                    manager.locations.map((location) => (
                      <Badge key={location} variant="secondary" className="text-xs">
                        {location}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No locations</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleNotifications(manager.id, manager.receiveNotifications)}
                  disabled={editingId === manager.id}
                  className="h-8 w-8 p-0"
                  data-testid={`notification-toggle-${manager.id}`}
                >
                  {manager.receiveNotifications ? (
                    <Bell className="h-4 w-4 text-green-600" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex justify-center gap-1">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" data-testid={`delete-manager-${manager.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Manager Assignment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {getUserDisplayName(manager.user)} as a restaurant manager? 
                          They will no longer receive shift cancellation notifications for any locations.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="cancel-delete-button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteManager(manager.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove Assignment
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}