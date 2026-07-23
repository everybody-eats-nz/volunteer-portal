import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { RestaurantManagersContent } from "./restaurant-managers-content";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { prisma } from "@/lib/prisma";
import { getActiveLocationNames } from "@/lib/locations";

export default async function RestaurantManagersPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/restaurant-managers");
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Fetch active admin users
  const adminUsers = await prisma.user.findMany({
    where: { role: "ADMIN", archivedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      role: true,
    },
    orderBy: [
      { firstName: "asc" },
      { lastName: "asc" },
      { name: "asc" },
    ],
  });

  // Get available locations
  const locations = (await getActiveLocationNames()).map(location => ({
    value: location,
    label: location,
  }));

  return (
    <AdminPageWrapper
      title="Restaurant Manager Assignments"
      description="Make sure every venue has someone alerted to cancellations and signups awaiting approval."
    >
      <RestaurantManagersContent
        adminUsers={adminUsers}
        locations={locations}
      />
    </AdminPageWrapper>
  );
}
