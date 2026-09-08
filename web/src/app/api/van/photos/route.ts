import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  uploadFile,
  ALLOWED_FILE_TYPES,
  MAX_ODOMETER_PHOTO_SIZE,
  VAN_ODOMETER_BUCKET,
} from "@/lib/storage";
import { isApprovedDriver } from "@/lib/van/drivers";

/**
 * POST /api/van/photos
 *
 * Store one odometer photo and hand back its URL. Deliberately separate from
 * starting or ending the trip: the photo goes up while the driver is still
 * confirming the number, so the tap that commits the trip has nothing to wait
 * for.
 *
 * Every failure here is soft. A driver stopped in a loading bay by an upload
 * error is a driver who goes back to the paper book, so a photo that will not
 * store is reported as "no photo" and the trip records without one — landing on
 * the office's missing-photo exception, which is exactly where it belongs.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isApprovedDriver(session.user.id))) {
    return NextResponse.json({ error: "Not an approved driver" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }
    if (file.size > MAX_ODOMETER_PHOTO_SIZE) {
      return NextResponse.json(
        { error: "That photo is too large. Try again." },
        { status: 400 }
      );
    }
    if (!ALLOWED_FILE_TYPES.IMAGE.includes(file.type)) {
      return NextResponse.json(
        { error: "That file is not an image." },
        { status: 400 }
      );
    }

    const { url } = await uploadFile(file, "odometer", VAN_ODOMETER_BUCKET);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Odometer photo upload error:", error);
    return NextResponse.json(
      { error: "Could not save the photo." },
      { status: 500 }
    );
  }
}
