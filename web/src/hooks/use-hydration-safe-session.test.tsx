import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useHydrationSafeSession } from "./use-hydration-safe-session";

vi.mock("next-auth/react", () => ({
  // The client has already fetched the session by the time a late Suspense
  // boundary hydrates - the case that used to mismatch the server HTML.
  useSession: () => ({
    data: { user: { id: "u1", email: "v@example.com" }, expires: "" },
    status: "authenticated",
    update: vi.fn(),
  }),
}));

function SessionStatus() {
  const { data, status } = useHydrationSafeSession();
  return (
    <span>
      {status}:{data?.user ? "user" : "none"}
    </span>
  );
}

describe("useHydrationSafeSession", () => {
  it("renders the loading state on the server/hydration pass even when the session is known", () => {
    expect(renderToString(<SessionStatus />)).toBe(
      "<span>loading<!-- -->:<!-- -->none</span>"
    );
  });
});
