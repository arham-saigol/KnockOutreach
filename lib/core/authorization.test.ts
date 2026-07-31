import { describe, expect, it } from "vitest";
import { assertOwnedRecord } from "./authorization";

describe("owner authorization", () => {
  it("accepts the authenticated Clerk subject", () => {
    expect(() =>
      assertOwnedRecord({ ownerId: "user_1" }, "user_1", "Project"),
    ).not.toThrow();
  });

  it("returns the same not-found behavior for missing and cross-owner data", () => {
    expect(() =>
      assertOwnedRecord({ ownerId: "user_2" }, "user_1", "Project"),
    ).toThrow("Project not found");
    expect(() => assertOwnedRecord(null, "user_1", "Project")).toThrow(
      "Project not found",
    );
  });
});
