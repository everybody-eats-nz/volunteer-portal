import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { RestaurantManagersContent } from "./restaurant-managers-content";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { prisma } from "@/lib/prisma";
import { LOCATIONS } from "@/lib/locations";

export default async function RestaurantManagersPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/restaurant-managers");
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Fetch admin users
  const adminUsers = await prisma.user.findMany({
    where: { role: "ADMIN" },
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
  const locations = LOCATIONS.map(location => ({
    value: location,
    label: location,
  }));

  return (
    <AdminPageWrapper 
      title="Restaurant Manager Assignments" 
      description="Assign admins to restaurant locations to receive shift cancellation notifications."
    >
      <div className="space-y-6">
        <RestaurantManagersContent 
          adminUsers={adminUsers}
          locations={locations}
        />
      </div>
    </AdminPageWrapper>
  );
}
