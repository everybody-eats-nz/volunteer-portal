import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileAdmin: vi.fn(),
}));

vi.mock("@/lib/services/signup-actions", () => {
  class SignupActionError extends Error {
    constructor(
      public status: number,
      message: string,
      public extra?: Record<string, unknown>
    ) {
      super(message);
    }
  }
  return { applySignupAction: vi.fn(), SignupActionError };
});

import { POST } from "./route";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { applySignupAction } from "@/lib/services/signup-actions";

const mockRequireMobileAdmin = requireMobileAdmin as ReturnType<typeof vi.fn>;
const mockApplySignupAction = applySignupAction as ReturnType<typeof vi.fn>;

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/mobile/admin/signups/signup_1", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "signup_1" }) }
  );
}

describe("POST /api/mobile/admin/signups/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMobileAdmin.mockResolvedValue({ userId: "admin_1" });
    mockApplySignupAction.mockResolvedValue({
      signup: { id: "signup_1", status: "CANCELED" },
      message: "Signup rejected and volunteer notified",
    });
  });

  it("returns 403 to a non-admin", async () => {
    mockRequireMobileAdmin.mockResolvedValue(null);

    const response = await post({ action: "reject" });

    expect(response.status).toBe(403);
    expect(mockApplySignupAction).not.toHaveBeenCalled();
  });

  // The app's decline sends only the action. Without a default the volunteer
  // heard nothing at all: no email, no notification, no push.
  it("tells the volunteer when the app declines without saying whether to", async () => {
    const response = await post({ action: "reject" });

    expect(response.status).toBe(200);
    expect(mockApplySignupAction).toHaveBeenCalledWith({
      signupId: "signup_1",
      action: "reject",
      sendEmail: true,
      skipNotification: undefined,
      actorId: "admin_1",
    });
  });

  it("still declines quietly when the caller asks for that", async () => {
    await post({ action: "reject", sendEmail: false });

    expect(mockApplySignupAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "reject", sendEmail: false })
    );
  });
});
