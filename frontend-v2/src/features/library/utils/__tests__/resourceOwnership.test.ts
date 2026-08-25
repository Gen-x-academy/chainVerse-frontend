import { describe, it, expect } from "vitest";
import { isValidResourceId, resolveResourceAccess } from "../resourceOwnership";

describe("isValidResourceId", () => {
  it("accepts well-formed ids", () => {
    expect(isValidResourceId("book-123456")).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(isValidResourceId("../../etc/passwd")).toBe(false);
    expect(isValidResourceId("short")).toBe(false);
  });
});

describe("resolveResourceAccess", () => {
  const base = { resourceId: "book-123456", resourceExists: true, currentUserId: "u1" };

  it("returns invalid for a malformed id before checking existence", () => {
    expect(
      resolveResourceAccess({ ...base, resourceId: "bad id", ownerId: "u1" })
    ).toBe("invalid");
  });

  it("returns not-found for a missing resource", () => {
    expect(
      resolveResourceAccess({ ...base, resourceExists: false, ownerId: null })
    ).toBe("not-found");
  });

  it("returns forbidden when the current user isn't the owner", () => {
    expect(resolveResourceAccess({ ...base, ownerId: "someone-else" })).toBe(
      "forbidden"
    );
  });

  it("returns allowed when the current user owns the resource", () => {
    expect(resolveResourceAccess({ ...base, ownerId: "u1" })).toBe("allowed");
  });
});
