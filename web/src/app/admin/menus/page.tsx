import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { MenusContent } from "./menus-content";

export default async function MenusPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin/menus");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [locations, recentMenus] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.dailyMenu.findMany({
      orderBy: [{ date: "desc" }, { location: "asc" }],
      take: 30,
      select: {
        id: true,
        date: true,
        location: true,
        chefName: true,
        updatedAt: true,
      },
    }),
  ]);

  return (
    <AdminPageWrapper
      title="Daily Menus"
      description="Set the menu for each restaurant location each day. Published to the website automatically."
    >
      <MenusContent locations={locations} initialRecentMenus={recentMenus} />
    </AdminPageWrapper>
  );
}
