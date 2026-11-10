import { describe, expect, it } from "vitest";
import { extractOwnBucketPath } from "./storage-utils";

const SUPABASE = "https://project.supabase.co";
const BUCKET = "profile-photos";
const own = (path: string) =>
  `${SUPABASE}/storage/v1/object/public/${BUCKET}/${path}`;

describe("extractOwnBucketPath", () => {
  it("returns the object path for a URL in our bucket", () => {
    expect(
      extractOwnBucketPath(own("uploads/123-abc-photo.jpg"), BUCKET, SUPABASE),
    ).toBe("uploads/123-abc-photo.jpg");
  });

  it("ignores a query string", () => {
    expect(extractOwnBucketPath(`${own("uploads/a.jpg")}?v=2`, BUCKET, SUPABASE)).toBe(
      "uploads/a.jpg",
    );
  });

  it.each([
    [
      "another host with the same path",
      `https://evil.example/storage/v1/object/public/${BUCKET}/uploads/a.jpg`,
    ],
    [
      "a look-alike host",
      `https://project.supabase.co.evil.example/storage/v1/object/public/${BUCKET}/uploads/a.jpg`,
    ],
    [
      "our host in the userinfo",
      `https://project.supabase.co@evil.example/storage/v1/object/public/${BUCKET}/uploads/a.jpg`,
    ],
    ["another bucket", `${SUPABASE}/storage/v1/object/public/resource-hub/uploads/a.pdf`],
    [
      "a bucket that only starts with ours",
      `${SUPABASE}/storage/v1/object/public/${BUCKET}-private/uploads/a.jpg`,
    ],
    ["dot segments", own("../resource-hub/uploads/a.pdf")],
    ["encoded dot segments", own("%2e%2e/resource-hub/uploads/a.pdf")],
    ["mixed-case encoded dot segments", own("uploads/%2E%2e/a.jpg")],
    ["an encoded slash hiding dot segments", own("uploads%2F..%2F..%2Fa.pdf")],
    ["double-encoded dot segments", own("%252e%252e/resource-hub/a.pdf")],
    ["an encoded backslash hiding dot segments", own("uploads%5C..%5Ca.pdf")],
    ["malformed percent-encoding", own("uploads/%E0%A4%A.jpg")],
    ["the bucket root", own("")],
    ["a non-public object URL", `${SUPABASE}/storage/v1/object/${BUCKET}/uploads/a.jpg`],
    ["an OAuth provider photo", "https://lh3.googleusercontent.com/a/photo"],
    ["a data URI", "data:image/jpeg;base64,AAAA"],
    ["text that is not a URL", "uploads/a.jpg"],
    ["an empty string", ""],
  ])("returns null for %s", (_label, url) => {
    expect(extractOwnBucketPath(url, BUCKET, SUPABASE)).toBeNull();
  });

  it("returns null when the Supabase URL is not configured", () => {
    expect(extractOwnBucketPath(own("uploads/a.jpg"), BUCKET, "")).toBeNull();
    expect(extractOwnBucketPath(own("uploads/a.jpg"), BUCKET, undefined)).toBeNull();
  });

  it("decodes the path, because storage keys are not percent-encoded", () => {
    expect(
      extractOwnBucketPath(own("uploads/my%20photo%C3%A9.jpg"), BUCKET, SUPABASE),
    ).toBe("uploads/my photo\u00e9.jpg");
  });

  it("keeps file names that merely contain dots", () => {
    expect(extractOwnBucketPath(own("uploads/a..b.jpg"), BUCKET, SUPABASE)).toBe(
      "uploads/a..b.jpg",
    );
  });
});
