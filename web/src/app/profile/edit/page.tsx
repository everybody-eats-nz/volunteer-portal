import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import ProfileEditClient from "./profile-edit-client";
import { prisma } from "@/lib/prisma";
import { getShiftLocationOptions } from "@/lib/locations";

async function getLocationOptions() {
  return getShiftLocationOptions();
}

async function getShiftTypes() {
  const shiftTypes = await prisma.shiftType.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return shiftTypes;
}

/**
 * Multi-section profile editing page
 * Uses shared form components to maintain consistency with registration
 */
export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile/edit");
  }

  const [locationOptions, shiftTypes] = await Promise.all([
    getLocationOptions(),
    getShiftTypes(),
  ]);

  return (
    <Suspense fallback={<div>Loading profile editor...</div>}>
      <ProfileEditClient 
        locationOptions={locationOptions}
        shiftTypes={shiftTypes}
      />
    </Suspense>
  );
}