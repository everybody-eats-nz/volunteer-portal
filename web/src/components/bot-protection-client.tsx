"use client";

import { useEffect } from "react";
import { initBotId } from "botid/client/core";

export function BotProtectionClient() {
  useEffect(() => {
    initBotId({
      protect: [
        // Authentication endpoints
        {
          path: "/api/auth/register",
          method: "POST",
        },
        {
          path: "/api/auth/resend-verification",
          method: "POST",
        },
        {
          path: "/api/auth/verify-email",
          method: "POST",
        },
        {
          path: "/api/auth/complete-migration",
          method: "POST",
        },
        {
          path: "/api/auth/save-migration-data",
          method: "POST",
        },

        // Profile management
        {
          path: "/api/profile",
          method: "PUT",
        },
        {
          path: "/api/profile/regular-schedule",
          method: "POST",
        },
        {
          path: "/api/profile/regular-schedule",
          method: "PUT",
        },
        {
          path: "/api/profile/regular-schedule/pause",
          method: "POST",
        },

        // Shift operations
        {
          path: "/api/shifts/*/signup",
          method: "POST",
        },
        {
          path: "/api/shifts/*/group-booking",
          method: "POST",
        },

        // Group bookings
        {
          path: "/api/group-bookings/*/invite",
          method: "POST",
        },
        {
          path: "/api/group-invitations/*/accept",
          method: "POST",
        },
        {
          path: "/api/group-invitations/*/decline",
          method: "POST",
        },

        // Friend system
        {
          path: "/api/friends",
          method: "POST",
        },
        {
          path: "/api/friends/requests/*/accept",
          method: "POST",
        },
        {
          path: "/api/friends/requests/*/decline",
          method: "POST",
        },

        // Admin operations (high-risk)
        {
          path: "/api/admin/users/invite",
          method: "POST",
        },
        {
          path: "/api/admin/migration/send-invitations",
          method: "POST",
        },
        {
          path: "/api/admin/migration/bulk-nova-migration",
          method: "POST",
        },
        {
          path: "/api/admin/migration/scrape-user-history",
          method: "POST",
        },
        {
          path: "/api/admin/notifications/send-shortage",
          method: "POST",
        },
        {
          path: "/api/migration/send-invite",
          method: "POST",
        },
      ],
    });
  }, []);

  return null;
}