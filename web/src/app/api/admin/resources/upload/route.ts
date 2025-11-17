import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { uploadFile, validateFileType, MAX_FILE_SIZE } from "@/lib/storage";

// POST /api/admin/resources/upload - Upload file to Supabase storage
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const resourceType = formData.get("resourceType") as
      | "PDF"
      | "IMAGE"
      | "DOCUMENT";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!resourceType) {
      return NextResponse.json(
        { error: "Resource type is required" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!validateFileType(file, resourceType)) {
      return NextResponse.json(
        { error: "Invalid file type for selected resource type" },
        { status: 400 }
      );
    }

    // Upload to Supabase
    const { url, path } = await uploadFile(file, "resources");

    return NextResponse.json({
      fileUrl: url,
      fileName: file.name,
      fileSize: file.size,
      filePath: path,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500 }
    );
  }
}
