import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/storage", () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  ALLOWED_FILE_TYPES: { IMAGE: ["image/jpeg"] },
  MAX_PROFILE_PHOTO_SIZE: 1024 * 1024,
  PROFILE_PHOTOS_BUCKET: "profile-photos",
}));

// storage-utils is not mocked: which stored URLs may be deleted is the point.
const SUPABASE_URL = "https://project.supabase.co";
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";
import { DELETE } from "./route";

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.user.update as ReturnType<typeof vi.fn>;
const mockDeleteFile = deleteFile as ReturnType<typeof vi.fn>;

describe("DELETE /api/profile/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ user: { email: "vol@example.com" } });
    mockUpdate.mockResolvedValue({});
  });

  it("deletes the caller's own object from the profile-photos bucket", async () => {
    mockFindUnique.mockResolvedValue({
      profilePhotoUrl: `${SUPABASE_URL}/storage/v1/object/public/profile-photos/uploads/me.jpg`,
    });

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(mockDeleteFile).toHaveBeenCalledWith(
      "uploads/me.jpg",
      "profile-photos",
    );
  });

  it.each([
    [
      "another host",
      "https://evil.example/storage/v1/object/public/x/uploads/handbook.pdf",
    ],
    [
      "another bucket",
      `${SUPABASE_URL}/storage/v1/object/public/resource-hub/uploads/handbook.pdf`,
    ],
  ])("clears the photo but deletes nothing for %s", async (_label, url) => {
    mockFindUnique.mockResolvedValue({ profilePhotoUrl: url });

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { email: "vol@example.com" },
      data: { profilePhotoUrl: null },
    });
  });
});
