import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { EditRegularVolunteerForm } from "./edit-regular-volunteer-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditRegularVolunteerPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) redirect("/login?callbackUrl=/admin/regulars");
  if (role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;

  // Fetch the regular volunteer data
  const regular = await prisma.regularVolunteer.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      shiftType: true,
    },
  });

  if (!regular) {
    notFound();
  }

  // Get shift types for the form
  const shiftTypes = await prisma.shiftType.findMany({
    orderBy: { name: "asc" },
  });

  const volunteerDisplayName =
    regular.user.firstName && regular.user.lastName
      ? `${regular.user.firstName} ${regular.user.lastName}`
      : regular.user.name || regular.user.email;

  return (
    <AdminPageWrapper
      title={`Edit Regular Volunteer`}
      description={`Editing regular volunteer assignment for ${volunteerDisplayName}`}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/regulars">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Regulars
          </Link>
        </Button>
      }
    >
      <div className="max-w-2xl">
        <EditRegularVolunteerForm regular={regular} shiftTypes={shiftTypes} />
      </div>
    </AdminPageWrapper>
  );
}