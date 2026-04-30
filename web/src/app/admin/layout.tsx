import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled, FeatureFlag } from "@/lib/posthog-server";
import { countUnreadForTeam } from "@/lib/services/messaging";

import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminLayoutHeader } from "@/components/admin-layout-header";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";

import { AdminHeaderProvider } from "@/contexts/admin-header-context";
import { ScrollToTop } from "@/components/scroll-to-top";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  const role = session?.user?.role;
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Fetch user profile data
  let userProfile = null;
  if (session?.user?.email) {
    userProfile = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        profilePhotoUrl: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  // Determine display name
  let displayName = "Admin";
  if (userProfile?.name) {
    displayName = userProfile.name;
  } else if (userProfile?.firstName || userProfile?.lastName) {
    displayName = [userProfile.firstName, userProfile.lastName]
      .filter(Boolean)
      .join(" ");
  } else if (session.user.email) {
    displayName = session.user.email.split("@")[0];
  }

  // Get pending parental consent count (volunteers requiring consent but not yet received)
  // Uses requiresParentalConsent flag for consistency with the table data
  const [pendingParentalConsentCount, pendingReportCount, chatGuidesEnabled, unreadMessagesCount] = await Promise.all([
    prisma.user.count({
      where: {
        role: "VOLUNTEER",
        requiresParentalConsent: true,
        parentalConsentReceived: false,
        archivedAt: null,
      },
    }),
    prisma.contentReport.count({ where: { status: "PENDING" } }),
    isFeatureEnabled(FeatureFlag.CHAT_GUIDES, session.user.id),
    countUnreadForTeam(),
  ]);

  // Build list of nav items to hide based on feature flags
  const hiddenNavItems: string[] = [];
  if (!chatGuidesEnabled) {
    hiddenNavItems.push("/admin/chat-guides");
  }

  return (
    <AdminHeaderProvider>
      <SidebarProvider defaultOpen={true}>
        <AdminSidebar
          session={session}
          userProfile={userProfile}
          displayName={displayName}
          pendingParentalConsentCount={pendingParentalConsentCount}
          pendingReportCount={pendingReportCount}
          unreadMessagesCount={unreadMessagesCount}
          hiddenNavItems={hiddenNavItems}
        />
        <SidebarInset>
          <ScrollToTop />
          <AdminLayoutHeader />
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AdminHeaderProvider>
  );
}
