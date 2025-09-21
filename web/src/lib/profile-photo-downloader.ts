import { join } from "path";
import sharp from "sharp";

export interface PhotoDownloadResult {
  success: boolean;
  base64Data?: string;
  error?: string;
}

export class ProfilePhotoDownloader {
  private uploadDir: string;
  private baseUrl: string;

  constructor() {
    // Store photos in the public/uploads/profiles directory
    this.uploadDir = join(process.cwd(), "public", "uploads", "profiles");
    this.baseUrl = "/uploads/profiles";
  }

  /**
   * Download and convert a profile photo to base64
   */
  async downloadAndConvertToBase64(
    photoUrl: string,
    userEmail: string,
    cookies?: string
  ): Promise<PhotoDownloadResult> {
    try {
      console.log(
        `[PHOTO] Downloading profile photo for ${userEmail}: ${photoUrl}`
      );

      // Create headers with cookies if provided (for authenticated Nova requests)
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (compatible; VolunteerPortal/1.0)",
      };

      if (cookies) {
        headers["Cookie"] = cookies;
      }

      // Download the image
      const response = await fetch(photoUrl, { headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.startsWith("image/")) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      // Get the image data as buffer
      const arrayBuffer = await response.arrayBuffer();
      const originalBuffer = Buffer.from(arrayBuffer);

      // Resize the image to a reasonable size (400x400) to reduce database storage
      const resizedBuffer = await sharp(originalBuffer)
        .resize(400, 400, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: 85 }) // Convert to JPEG for better compression
        .toBuffer();

      // Convert to base64 with data URL format
      const base64Data = `data:image/jpeg;base64,${resizedBuffer.toString(
        "base64"
      )}`;

      console.log(
        `[PHOTO] Successfully resized and converted profile photo to base64 (${originalBuffer.length} → ${resizedBuffer.length} bytes)`
      );

      return {
        success: true,
        base64Data,
      };
    } catch (error) {
      console.error(
        `[PHOTO] Failed to download profile photo for ${userEmail}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Download profile photo with Nova authentication and convert to base64
   */
  async downloadNovaPhoto(
    photoUrl: string,
    userEmail: string,
    novaCookies: string
  ): Promise<PhotoDownloadResult> {
    // If it's a relative URL, make it absolute with Nova base URL
    let fullUrl = photoUrl;
    if (photoUrl.startsWith("/")) {
      const baseUrl =
        process.env.NOVA_BASE_URL || "https://app.everybodyeats.nz";
      fullUrl = `${baseUrl}${photoUrl}`;
    }

    return this.downloadAndConvertToBase64(fullUrl, userEmail, novaCookies);
  }
}

// Singleton instance
export const profilePhotoDownloader = new ProfilePhotoDownloader();
