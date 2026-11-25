import { describe, expect, it } from "vitest";
import { classifyAuthReadFailure } from "./read-failure";

describe("classifyAuthReadFailure", () => {
  it("asks for login only on a missing or unauthorized session", () => {
    expect(classifyAuthReadFailure({ name: "AuthSessionMissingError" })).toBe("UNAUTHENTICATED");
    expect(classifyAuthReadFailure({ status: 401 })).toBe("UNAUTHENTICATED");
  });

  it("keeps authorization denials as technical unavailability", () => {
    expect(classifyAuthReadFailure({ status: 403 })).toBe("UNAVAILABLE");
  });

  it("keeps transport failures as unavailability", () => {
    expect(classifyAuthReadFailure({ status: 503, name: "AuthRetryableFetchError" })).toBe("UNAVAILABLE");
    expect(classifyAuthReadFailure(null)).toBeNull();
  });
});
