import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import {
  getDriverProfile,
  isSelectableOrganisation,
  registerDriver,
} from "@/lib/van/drivers";

const registrationSchema = z.object({
  licenceClass: z.string().trim().min(1).max(20).nullable(),
  licenceExpiry: z.string().datetime().nullable(),
  organisationId: z.string().min(1).nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getDriverProfile(session.user.id);
  return NextResponse.json({ status: profile?.status ?? null });
}

/**
 * POST /api/van/driver-registration
 *
 * Self-registration. Always lands as PENDING — approval is a person's decision,
 * never a side effect of filling in a form. The client's requirement, in their
 * words: "I don't just want anybody drives a van."
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = registrationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the details and try again." },
      { status: 400 }
    );
  }

  if (
    parsed.data.organisationId &&
    !(await isSelectableOrganisation(parsed.data.organisationId))
  ) {
    return NextResponse.json(
      { error: "Pick an organisation from the list." },
      { status: 400 }
    );
  }

  const profile = await registerDriver({
    userId: session.user.id,
    licenceClass: parsed.data.licenceClass,
    licenceExpiry: parsed.data.licenceExpiry
      ? new Date(parsed.data.licenceExpiry)
      : null,
    organisationId: parsed.data.organisationId,
  });

  return NextResponse.json({ status: profile.status });
}
