import { describe, expect, it } from "vitest";
import { assertNoDuplicateSend, hasConflictingSend } from "./send-policy";

describe("duplicate-send prevention", () => {
  it("blocks active, successful, and ambiguous sends", () => {
    for (const status of [
      "sending",
      "sent",
      "delivered",
      "received",
      "send_unknown",
    ]) {
      expect(hasConflictingSend([{ status }])).toBe(true);
    }
  });

  it("permits a new human-approved attempt after a definitive failure", () => {
    expect(() =>
      assertNoDuplicateSend([{ status: "send_failed" }]),
    ).not.toThrow();
  });
});
