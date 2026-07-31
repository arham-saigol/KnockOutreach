import { describe, expect, it } from "vitest";
import {
  assertCandidateTransition,
  canTransitionCandidate,
} from "./state-machine";

describe("candidate state machine", () => {
  it("allows explicit approval and terminal completion", () => {
    expect(canTransitionCandidate("ready", "sending")).toBe(true);
    expect(canTransitionCandidate("sending", "sent")).toBe(true);
  });

  it("prevents re-sending terminal or ambiguous candidates", () => {
    expect(() => assertCandidateTransition("sent", "sending")).toThrow(
      "Invalid candidate transition",
    );
    expect(() => assertCandidateTransition("send_unknown", "sending")).toThrow(
      "Invalid candidate transition",
    );
  });
});
