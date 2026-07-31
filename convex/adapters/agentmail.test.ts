import { describe, expect, it } from "vitest";
import { isAmbiguousAgentMailStatus } from "./agentmail";

describe("AgentMail response classification", () => {
  it("treats server errors as ambiguous send outcomes", () => {
    expect(isAmbiguousAgentMailStatus(500)).toBe(true);
    expect(isAmbiguousAgentMailStatus(503)).toBe(true);
    expect(isAmbiguousAgentMailStatus(599)).toBe(true);
  });

  it("treats client rejections as definitive", () => {
    expect(isAmbiguousAgentMailStatus(400)).toBe(false);
    expect(isAmbiguousAgentMailStatus(401)).toBe(false);
    expect(isAmbiguousAgentMailStatus(422)).toBe(false);
  });
});
