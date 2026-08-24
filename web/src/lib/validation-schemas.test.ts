import { describe, it, expect } from "vitest";
import { moveVolunteerSchema } from "@/lib/validation-schemas";

describe("moveVolunteerSchema", () => {
  it("accepts a cuid signup id (portal signups)", () => {
    const parsed = moveVolunteerSchema.safeParse({
      signupId: "cmrx3sohp015o9ts0zicvxvjn",
      targetShiftId: "cmszdrnxo000nn0s00i8qeiug",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts a UUID signup id (regular volunteers' auto-created signups)", () => {
    // Regular volunteers' signups were created with crypto.randomUUID(), so a
    // cuid format check made every one of them unmovable.
    const parsed = moveVolunteerSchema.safeParse({
      signupId: "9f0a1b2c-3d4e-4f50-9a1b-2c3d4e5f6071",
      targetShiftId: "cmszdrnxo000nn0s00i8qeiug",
      movementNotes: "Needed in the kitchen tonight",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a missing signup id with a message an admin can act on", () => {
    const parsed = moveVolunteerSchema.safeParse({
      targetShiftId: "cmszdrnxo000nn0s00i8qeiug",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("No volunteer selected to move");
  });

  it("rejects an empty target shift id", () => {
    const parsed = moveVolunteerSchema.safeParse({
      signupId: "cmrx3sohp015o9ts0zicvxvjn",
      targetShiftId: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Choose a shift to move them to"
    );
  });
});
