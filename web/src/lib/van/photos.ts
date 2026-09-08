import {
  uploadFile,
  ALLOWED_FILE_TYPES,
  MAX_ODOMETER_PHOTO_SIZE,
  MAX_VEHICLE_PHOTO_SIZE,
  STORAGE_BUCKET,
  VAN_ODOMETER_BUCKET,
  VAN_PHOTO_FOLDER,
} from "@/lib/storage";

/**
 * Store one odometer photo and hand back its URL.
 *
 * Deliberately separate from starting or ending the trip: the photo goes up
 * while the driver is still confirming the number, so the tap that commits the
 * trip has nothing to wait for. Shared by the browser flow and the app so
 * there is one answer to what an odometer photo is allowed to be.
 *
 * Every failure here is soft by contract with the caller: a driver stopped in
 * a loading bay by an upload error is a driver who goes back to the paper
 * book, so a photo that will not store is reported and the trip records
 * without one — landing on the office's missing-photo exception, which is
 * exactly where it belongs.
 */
export async function storeOdometerPhoto(
  formData: FormData
): Promise<{ url: string; error?: never } | { url?: never; error: string; status: number }> {
  const file = formData.get("photo") as File | null;

  if (!file) return { error: "No photo provided", status: 400 };
  if (file.size > MAX_ODOMETER_PHOTO_SIZE) {
    return { error: "That photo is too large. Try again.", status: 400 };
  }
  if (!ALLOWED_FILE_TYPES.IMAGE.includes(file.type)) {
    return { error: "That file is not an image.", status: 400 };
  }

  const { url } = await uploadFile(file, "odometer", VAN_ODOMETER_BUCKET);
  return { url };
}

/**
 * Store one photo of a van and hand back its URL.
 *
 * Separate from the odometer path above: this is a reference image an admin
 * picks once, not evidence attached to a trip, so it goes in the shared public
 * bucket and its failures are hard — an admin who is told nothing and gets no
 * photo would simply try again forever.
 *
 * The browser crops to 16:9 and re-encodes before sending, so what arrives here
 * is already small; the size check is a backstop against a caller that skips
 * that step, not the normal path.
 */
export async function storeVehiclePhoto(
  formData: FormData
): Promise<{ url: string; error?: never } | { url?: never; error: string; status: number }> {
  const file = formData.get("photo");

  if (!(file instanceof File)) return { error: "No photo provided", status: 400 };
  if (file.size > MAX_VEHICLE_PHOTO_SIZE) {
    return { error: "That photo is too large.", status: 400 };
  }
  if (!ALLOWED_FILE_TYPES.IMAGE.includes(file.type)) {
    return { error: "That file is not an image.", status: 400 };
  }

  const { url } = await uploadFile(file, VAN_PHOTO_FOLDER, STORAGE_BUCKET);
  return { url };
}
