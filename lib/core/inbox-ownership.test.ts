import { describe, expect, it } from "vitest";
import { assertInboxOwnership } from "./inbox-ownership";

describe("AgentMail inbox ownership", () => {
  const bindings = JSON.stringify({
    user_a: ["inbox_a", "sender-a@example.com"],
    user_b: ["inbox_b"],
  });

  it("accepts only inboxes bound to the authenticated owner", () => {
    expect(() =>
      assertInboxOwnership("user_a", "inbox_a", bindings),
    ).not.toThrow();
    expect(() => assertInboxOwnership("user_a", "inbox_b", bindings)).toThrow(
      "not assigned",
    );
  });

  it("fails closed when bindings are missing or malformed", () => {
    expect(() => assertInboxOwnership("user_a", "inbox_a", "")).toThrow(
      "not configured",
    );
    expect(() => assertInboxOwnership("user_a", "inbox_a", "{")).toThrow(
      "valid JSON",
    );
  });
});
