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
  BarChart3,
  ClipboardList,
  Activity,
  MessageSquare,
  Megaphone,
  UtensilsCrossed,
  Shield,
  UserPlus,
  Award,
  Archive,
  ScrollText,
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
      {
        title: "Site Settings",
        href: "/admin/site-settings",
        icon: Settings,
        description: "Configure site-wide settings and URLs",
        commandKey: "site-settings",
      },
    ],
  },
  {
    label: "Analytics",
    items: [
      {
        title: "Restaurant Analytics",
        href: "/admin/analytics",
        icon: BarChart3,
        description: "Meals served and year-over-year comparisons",
        commandKey: "analytics",
      },
      {
        title: "Volunteer Engagement",
        href: "/admin/analytics/engagement",
        icon: Activity,
        description: "Activity levels, retention, and cohort analysis",
        commandKey: "engagement",
      },
      {
        title: "Volunteer Recruitment",
        href: "/admin/analytics/recruitment",
        icon: UserPlus,
        description: "New registrations, onboarding funnel, and conversion",
        commandKey: "recruitment",
      },
      {
        title: "Milestone Analytics",
        href: "/admin/analytics/milestones",
        icon: Award,
        description:
          "Shift milestones, volunteer recognition, and 12-month projections",
        commandKey: "milestones",
      },
    ],
  },
  {
    label: "Volunteers",
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
      {
        title: "Archiving",
        href: "/admin/archiving",
        icon: Archive,
        description: "Monitor inactivity and archive rules",
        commandKey: "archiving",
      },
    ],
  },
  {
    label: "Shifts",
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
        title: "Auto-Accept Rules",
        href: "/admin/auto-accept-rules",
        icon: Settings,
        description: "Configure automatic approvals",
        commandKey: "auto-accept",
      },
    ],
  },
  {
    label: "Restaurants",
    items: [
      {
        title: "Daily Menus",
        href: "/admin/menus",
        icon: UtensilsCrossed,
        description: "Set daily menus published to the website",
        commandKey: "menus",
      },
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
    label: "Communications",
    items: [
      {
        title: "Messages",
        href: "/admin/messages",
        icon: MessageSquare,
        description: "Direct messages with volunteers",
        commandKey: "messages",
      },
      {
        title: "Announcements",
        href: "/admin/announcements",
        icon: Megaphone,
        description: "Send targeted announcements to volunteers",
        commandKey: "announcements",
      },
      {
        title: "Shortage Notifications",
        href: "/admin/notifications",
        icon: Bell,
        description: "Send shift shortage alerts",
        commandKey: "notifications",
      },
      {
        title: "Newsletter Lists",
        href: "/admin/newsletter-lists",
        icon: Mail,
        description: "Manage Campaign Monitor lists",
        commandKey: "newsletter-lists",
      },
      {
        title: "Surveys",
        href: "/admin/surveys",
        icon: ClipboardList,
        description: "Create and manage feedback surveys",
        commandKey: "surveys",
      },
    ],
  },
  {
    label: "Content & AI",
    items: [
      {
        title: "Resource Hub",
        href: "/admin/resources",
        icon: FileText,
        description: "Manage volunteer resources",
        commandKey: "resources",
      },
      {
        title: "Chat Guides",
        href: "/admin/chat-guides",
        icon: MessageSquare,
        description: "Manage AI chat assistant context",
        commandKey: "chat-guides",
      },
      {
        title: "Chat Logs",
        href: "/admin/chat-guides/logs",
        icon: ScrollText,
        description: "View volunteer conversations with the AI assistant",
        commandKey: "chat-logs",
      },
      {
        title: "Content Moderation",
        href: "/admin/moderation",
        icon: Shield,
        description: "Review reports and user blocks",
        commandKey: "moderation",
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
    "Site Settings": "text-slate-600",

    // Analytics
    "Restaurant Analytics": "text-purple-600",
    "Volunteer Engagement": "text-emerald-600",
    "Volunteer Recruitment": "text-violet-600",
    "Milestone Analytics": "text-amber-600",

    // Volunteers
    "All Users": "text-purple-600",
    "Regular Volunteers": "text-yellow-600",
    "Parental Consent": "text-blue-600",
    "Custom Labels": "text-indigo-600",
    Achievements: "text-amber-600",
    Archiving: "text-rose-600",

    // Shifts
    "Create Shift": "text-green-600",
    "Manage Shifts": "text-green-600",
    "Auto-Accept Rules": "text-gray-600",

    // Restaurant
    "Daily Menus": "text-orange-600",
    "Restaurant Locations": "text-blue-600",
    "Restaurant Managers": "text-orange-600",

    // Communications
    Messages: "text-emerald-600",
    Announcements: "text-orange-500",
    "Shortage Notifications": "text-amber-600",
    "Newsletter Lists": "text-cyan-600",
    Surveys: "text-violet-600",

    // Content & AI
    "Resource Hub": "text-blue-500",
    "Chat Guides": "text-emerald-500",
    "Chat Logs": "text-emerald-600",
    "Content Moderation": "text-red-600",

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
