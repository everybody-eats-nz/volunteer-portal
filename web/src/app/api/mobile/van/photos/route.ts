import { NextResponse } from "next/server";
import { requireMobileDriver } from "@/lib/van/mobile-guard";
import { storeOdometerPhoto } from "@/lib/van/photos";

/**
 * POST /api/mobile/van/photos — store one odometer photo, hand back its URL.
 *
 * The app posts this while the driver is still typing the number, so the tap
 * that commits the trip has nothing to wait for. Every failure is soft: the
 * app records the reading regardless and the trip lands on the office's
 * missing-photo exception, because a driver stopped in a loading bay by an
 * upload error is a driver who goes back to the paper book.
 */
export async function POST(request: Request) {
  const auth = await requireMobileDriver(request);
  if (auth.denied) return auth.denied;

  try {
    const result = await storeOdometerPhoto(await request.formData());
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Mobile odometer photo upload error:", error);
    return NextResponse.json(
      { error: "Could not save the photo." },
      { status: 500 }
    );
  }
}
