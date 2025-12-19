import React from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ChefHat,
  Star,
  Plus,
  Upload,
  CheckCircle,
  Mail,
  Bell,
  Settings,
  FileText,
  Tags,
  MapPin,
  Trophy,
} from "lucide-react";

export interface AdminNavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  description?: string;
  opensInNewTab?: boolean;
  commandKey?: string;
}

export interface AdminNavCategory {
  label: string;
  items: AdminNavItem[];
}

export const adminNavCategories: AdminNavCategory[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        exact: true,
        description: "Overview and statistics",
        commandKey: "dashboard",
      },
    ],
  },
  {
    label: "Volunteer Management",
    items: [
      {
        title: "All Users",
        href: "/admin/users",
        icon: Users,
        description: "Manage volunteers and admins",
        commandKey: "users",
      },
      {
        title: "Regular Volunteers",
        href: "/admin/regulars",
        icon: Star,
        description: "Manage recurring assignments",
        commandKey: "regulars",
      },
      {
        title: "Parental Consent",
        href: "/admin/parental-consent",
        icon: FileText,
        description: "Manage consent forms",
        commandKey: "parental-consent",
      },
      {
        title: "Custom Labels",
        href: "/admin/custom-labels",
        icon: Tags,
        description: "Manage volunteer labels",
        commandKey: "custom-labels",
      },
      {
        title: "Achievements",
        href: "/admin/achievements",
        icon: Trophy,
        description: "Manage volunteer achievements",
        commandKey: "achievements",
      },
    ],
  },
  {
    label: "Shift Management",
    items: [
      {
        title: "Create Shift",
        href: "/admin/shifts/new",
        icon: Plus,
        description: "Add new volunteer shifts",
        commandKey: "create-shift",
      },
      {
        title: "Manage Shifts",
        href: "/admin/shifts",
        icon: Calendar,
        description: "View and edit existing shifts",
        commandKey: "shifts",
      },
      {
        title: "Shortage Notifications",
        href: "/admin/notifications",
        icon: Bell,
        description: "Send shift shortage alerts",
        commandKey: "notifications",
      },
      {
        title: "Auto-Accept Rules",
        href: "/admin/auto-accept-rules",
        icon: Settings,
        description: "Configure automatic approvals",
        commandKey: "auto-accept",
      },
    ],
  },
  {
    label: "Restaraunt Management",
    items: [
      {
        title: "Restaurant Locations",
        href: "/admin/locations",
        icon: MapPin,
        description: "Configure location settings",
        commandKey: "locations",
      },
      {
        title: "Restaurant Managers",
        href: "/admin/restaurant-managers",
        icon: ChefHat,
        description: "Manage restaurant staff",
        commandKey: "restaurant-managers",
      },
    ],
  },
  {
    label: "Resources",
    items: [
      {
        title: "Resource Hub",
        href: "/admin/resources",
        icon: FileText,
        description: "Manage volunteer resources",
        commandKey: "resources",
      },
      {
        title: "Newsletter Lists",
        href: "/admin/newsletter-lists",
        icon: Mail,
        description: "Manage Campaign Monitor lists",
        commandKey: "newsletter-lists",
      },
    ],
  },
  {
    label: "User Migration",
    items: [
      {
        title: "Bulk Migration",
        href: "/admin/migration#migration",
        icon: Upload,
        description: "Import users in bulk",
        commandKey: "bulk-migration",
      },
      {
        title: "Migration Status",
        href: "/admin/migration#status",
        icon: CheckCircle,
        description: "Track migration progress",
        commandKey: "migration-status",
      },
      {
        title: "User Invitations",
        href: "/admin/migration#invitations",
        icon: Mail,
        description: "Send account invitations",
        commandKey: "user-invitations",
      },
      {
        title: "Migrated Users",
        href: "/admin/migration#users",
        icon: Users,
        description: "View imported users",
        commandKey: "migrated-users",
      },
    ],
  },
];

export const publicNavItems: AdminNavItem[] = [
  {
    title: "View Public Shifts",
    href: "/shifts",
    icon: Calendar,
    description: "Opens in new tab",
    opensInNewTab: true,
    commandKey: "public-shifts",
  },
  {
    title: "Resource Hub",
    href: "/resources",
    icon: FileText,
    description: "Opens in new tab",
    opensInNewTab: true,
    commandKey: "public-resources",
  },
];

// Helper function to get icon color for command palette
export const getIconColor = (
  categoryLabel: string,
  itemTitle: string
): string => {
  const colorMap: Record<string, string> = {
    // Overview
    Dashboard: "text-blue-600",

    // Volunteer Management
    "All Users": "text-purple-600",
    "Regular Volunteers": "text-yellow-600",
    "Restaurant Managers": "text-orange-600",
    "Parental Consent": "text-blue-600",
    "Custom Labels": "text-indigo-600",
    Achievements: "text-amber-600",
    "Newsletter Lists": "text-cyan-600",

    // Shift Management
    "Create Shift": "text-green-600",
    "Manage Shifts": "text-green-600",
    "Restaurant Locations": "text-blue-600",
    "Shortage Notifications": "text-amber-600",
    "Auto-Accept Rules": "text-gray-600",

    // Resources
    "Resource Hub": "text-blue-500",

    // User Migration
    "Bulk Migration": "text-blue-600",
    "Migration Status": "text-green-600",
    "User Invitations": "text-purple-600",
    "Migrated Users": "text-slate-600",

    // Public
    "View Public Shifts": "text-emerald-600",
  };

  return colorMap[itemTitle] || "text-gray-600";
};
