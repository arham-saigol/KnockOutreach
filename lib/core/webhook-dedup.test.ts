import { describe, expect, it } from "vitest";
import { isDuplicateWebhook } from "./webhook-dedup";

describe("webhook deduplication", () => {
  it("deduplicates an AgentMail event by stable event ID", () => {
    expect(isDuplicateWebhook("evt_123", "evt_123")).toBe(true);
    expect(isDuplicateWebhook(undefined, "evt_123")).toBe(false);
  });
});
