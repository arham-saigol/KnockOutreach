import { describe, expect, it } from "vitest";
import { draftMatchesSenderIdentity } from "./draft-freshness";

describe("draft sender identity", () => {
  const project = { founderName: "Maya", agentName: "Kit" };

  it("accepts only the identity snapshot used to generate the draft", () => {
    expect(
      draftMatchesSenderIdentity(
        { senderFounderName: "Maya", senderAgentName: "Kit" },
        project,
      ),
    ).toBe(true);
    expect(
      draftMatchesSenderIdentity(
        { senderFounderName: "Maya", senderAgentName: "Milo" },
        project,
      ),
    ).toBe(false);
    expect(draftMatchesSenderIdentity({}, project)).toBe(false);
  });
});
