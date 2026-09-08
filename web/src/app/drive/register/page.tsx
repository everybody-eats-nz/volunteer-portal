import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { listSelectableOrganisations } from "@/lib/van/drivers";
import { DriverRegisterForm } from "@/components/van/register-form";

export const metadata: Metadata = {
  title: "Register to drive",
  robots: { index: false, follow: false },
};

export default async function DriverRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ van?: string }>;
}) {
  const { van } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const callbackUrl = van ? `/drive/register?van=${van}` : "/drive/register";
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const [organisations, profile] = await Promise.all([
    listSelectableOrganisations(),
    prisma.driverProfile.findUnique({ where: { userId: session.user.id } }),
  ]);

  return (
    <DriverRegisterForm
      organisations={organisations.map((o) => ({
        id: o.id,
        name: o.name,
        isInternal: o.isInternal,
      }))}
      existingStatus={profile?.status ?? null}
      returnToVanId={van ?? null}
    />
  );
}
