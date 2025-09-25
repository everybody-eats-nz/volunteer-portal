import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminLayoutHeader } from "@/components/admin-layout-header";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";

import { AdminHeaderProvider } from "@/contexts/admin-header-context";

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

  return (
    <AdminHeaderProvider>
      <SidebarProvider defaultOpen={true}>
        <AdminSidebar
          session={session}
          userProfile={userProfile}
          displayName={displayName}
        />
        <SidebarInset>
          <AdminLayoutHeader />
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AdminHeaderProvider>
  );
}
