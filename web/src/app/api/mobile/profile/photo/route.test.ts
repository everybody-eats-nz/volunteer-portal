import { vi, describe, it, expect, beforeEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret");

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  ALLOWED_FILE_TYPES: {
    IMAGE: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
  },
  MAX_PROFILE_PHOTO_SIZE: 1 * 1024 * 1024,
  PROFILE_PHOTOS_BUCKET: "profile-photos",
}));

// storage-utils is not mocked: which stored URLs may be deleted is the point.
const SUPABASE_URL = "https://project.supabase.co";
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
const ownPhotoUrl = (name: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/profile-photos/uploads/${name}`;

import { POST, DELETE } from "./route";
import { requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { uploadFile, deleteFile } from "@/lib/storage";

const mockRequireMobileUser = requireMobileUser as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};
const mockUploadFile = uploadFile as ReturnType<typeof vi.fn>;
const mockDeleteFile = deleteFile as ReturnType<typeof vi.fn>;

function makePhotoRequest() {
  const formData = new FormData();
  const file = new File(["fake-image-data"], "photo.jpg", {
    type: "image/jpeg",
  });
  formData.append("photo", file);

  return new Request("http://localhost/api/mobile/profile/photo", {
    method: "POST",
    headers: { Authorization: "Bearer valid-token" },
    body: formData,
  });
}

function makeDeleteRequest() {
  return new Request("http://localhost/api/mobile/profile/photo", {
    method: "DELETE",
    headers: { Authorization: "Bearer valid-token" },
  });
}

describe("POST /api/mobile/profile/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireMobileUser.mockResolvedValue(null);

    const response = await POST(makePhotoRequest());
    expect(response.status).toBe(401);
  });

  it("returns 400 when no photo is provided", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });

    const request = new Request("http://localhost/api/mobile/profile/photo", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
      body: new FormData(),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe("No photo provided");
  });

  it("returns 400 for invalid file type", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });

    const formData = new FormData();
    formData.append(
      "photo",
      new File(["data"], "doc.pdf", { type: "application/pdf" })
    );

    const request = new Request("http://localhost/api/mobile/profile/photo", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toContain("Invalid file type");
  });

  it("uploads photo and saves URL to database", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      profilePhotoUrl: null,
    });
    mockUploadFile.mockResolvedValue({
      url: "https://supabase.co/storage/photo.jpg",
      path: "uploads/photo.jpg",
    });
    mockPrisma.user.update.mockResolvedValue({});

    const response = await POST(makePhotoRequest());
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.image).toBe("https://supabase.co/storage/photo.jpg");

    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(File),
      "uploads",
      "profile-photos"
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { profilePhotoUrl: "https://supabase.co/storage/photo.jpg" },
    });
  });

  it("deletes old photo from storage when replacing", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      profilePhotoUrl: ownPhotoUrl("old-photo.jpg"),
    });
    mockUploadFile.mockResolvedValue({
      url: "https://supabase.co/storage/new-photo.jpg",
      path: "uploads/new-photo.jpg",
    });
    mockPrisma.user.update.mockResolvedValue({});

    await POST(makePhotoRequest());

    expect(mockDeleteFile).toHaveBeenCalledWith(
      "uploads/old-photo.jpg",
      "profile-photos"
    );
  });

  it.each([
    [
      "another host",
      "https://evil.example/storage/v1/object/public/profile-photos/uploads/victim.jpg",
    ],
    [
      "another bucket",
      `${SUPABASE_URL}/storage/v1/object/public/resource-hub/uploads/handbook.pdf`,
    ],
    [
      "a path that climbs out of the bucket",
      `${SUPABASE_URL}/storage/v1/object/public/profile-photos/../resource-hub/uploads/handbook.pdf`,
    ],
    ["an OAuth provider photo", "https://lh3.googleusercontent.com/a/photo"],
    ["a base64 data URI", "data:image/jpeg;base64,AAAA"],
  ])("does not delete anything for a stored URL on %s", async (_label, url) => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({ profilePhotoUrl: url });
    mockUploadFile.mockResolvedValue({
      url: ownPhotoUrl("new-photo.jpg"),
      path: "uploads/new-photo.jpg",
    });
    mockPrisma.user.update.mockResolvedValue({});

    const response = await POST(makePhotoRequest());
    expect(response.status).toBe(200);
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/mobile/profile/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireMobileUser.mockResolvedValue(null);

    const response = await DELETE(makeDeleteRequest());
    expect(response.status).toBe(401);
  });

  it("clears profilePhotoUrl and deletes from storage", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      profilePhotoUrl: ownPhotoUrl("photo.jpg"),
    });
    mockPrisma.user.update.mockResolvedValue({});

    const response = await DELETE(makeDeleteRequest());
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.image).toBeNull();

    expect(mockDeleteFile).toHaveBeenCalledWith(
      "uploads/photo.jpg",
      "profile-photos"
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { profilePhotoUrl: null },
    });
  });

  it("handles user with no existing photo", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      profilePhotoUrl: null,
    });
    mockPrisma.user.update.mockResolvedValue({});

    const response = await DELETE(makeDeleteRequest());
    expect(response.status).toBe(200);

    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  it("clears the photo without deleting an object it does not own", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      profilePhotoUrl:
        "https://evil.example/storage/v1/object/public/x/uploads/victim.jpg",
    });
    mockPrisma.user.update.mockResolvedValue({});

    const response = await DELETE(makeDeleteRequest());
    expect(response.status).toBe(200);

    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { profilePhotoUrl: null },
    });
  });
});
