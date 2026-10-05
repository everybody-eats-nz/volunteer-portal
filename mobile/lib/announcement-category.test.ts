import { describe, expect, it } from "vitest";
import { announcementCategoryPill } from "./announcement-category";

describe("announcementCategoryPill", () => {
  it.each([
    ["SHIFT_RELATED", "Your shift"],
    ["URGENT", "Urgent"],
    ["SHIFT_SHORTAGE", "Help needed"],
    ["PROMOTIONAL", "Promo"],
  ])("labels %s as %s", (category, label) => {
    expect(announcementCategoryPill(category)?.label).toBe(label);
  });

  it("shows nothing for announcements from an older API", () => {
    expect(announcementCategoryPill(undefined)).toBeNull();
  });

  it("shows nothing for a category this build doesn't know", () => {
    expect(announcementCategoryPill("SOMETHING_NEW")).toBeNull();
  });
});
