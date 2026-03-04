import { classifyEngagement } from "./engagement";

describe("classifyEngagement", () => {
  it("returns 'never' when totalShifts is 0", () => {
    expect(classifyEngagement(0, 0, 3)).toBe("never");
    expect(classifyEngagement(0, 0, 1)).toBe("never");
    expect(classifyEngagement(0, 0, 12)).toBe("never");
  });

  it("returns 'inactive' when has shifts but none in period", () => {
    expect(classifyEngagement(10, 0, 3)).toBe("inactive");
    expect(classifyEngagement(1, 0, 6)).toBe("inactive");
  });

  it("returns 'active' when averaging less than 2 shifts/month", () => {
    expect(classifyEngagement(5, 1, 3)).toBe("active");
    expect(classifyEngagement(10, 3, 3)).toBe("active");
    expect(classifyEngagement(20, 5, 3)).toBe("active");
    expect(classifyEngagement(2, 1, 1)).toBe("active");
  });

  it("returns 'highly_active' when averaging 2+ shifts/month", () => {
    expect(classifyEngagement(10, 6, 3)).toBe("highly_active");
    expect(classifyEngagement(5, 2, 1)).toBe("highly_active");
    expect(classifyEngagement(30, 24, 12)).toBe("highly_active");
  });

  it("returns 'highly_active' at exactly 2 shifts/month boundary", () => {
    expect(classifyEngagement(6, 6, 3)).toBe("highly_active");
    expect(classifyEngagement(12, 12, 6)).toBe("highly_active");
  });

  it("returns 'active' just below 2 shifts/month boundary", () => {
    expect(classifyEngagement(10, 5, 3)).toBe("active");
    expect(classifyEngagement(20, 11, 6)).toBe("active");
  });
});
