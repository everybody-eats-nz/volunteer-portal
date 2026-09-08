import { NextResponse } from "next/server";
import { requireVanAdmin } from "@/lib/van/admin-guard";
import { storeVehiclePhoto } from "@/lib/van/photos";

/**
 * POST /api/admin/van/vehicles/photo
 *
 * Store a photo of a van and hand back its URL. The URL is then saved onto the
 * vehicle by the normal create/update call, so an admin who abandons the form
 * leaves an orphaned object rather than a half-written van — the cheaper of the
 * two failures, and the reason this is its own request rather than a multipart
 * body on the vehicle route.
 */
export async function POST(request: Request) {
  const guard = await requireVanAdmin();
  if (guard.denied) return guard.denied;

  try {
    const result = await storeVehiclePhoto(await request.formData());
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Van photo upload error:", error);
    return NextResponse.json(
      { error: "Could not save that photo. Try again in a moment." },
      { status: 500 }
    );
  }
}
