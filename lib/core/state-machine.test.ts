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

  it("only permits contact retries from no_contact", () => {
    expect(canTransitionCandidate("no_contact", "ready")).toBe(true);
    expect(canTransitionCandidate("send_failed", "ready")).toBe(false);
    expect(canTransitionCandidate("send_unknown", "ready")).toBe(false);
    expect(canTransitionCandidate("sent", "ready")).toBe(false);
    expect(canTransitionCandidate("dismissed", "ready")).toBe(false);
  });
});
