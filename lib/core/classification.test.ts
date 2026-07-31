import { describe, expect, it } from "vitest";
import { assertCompleteClassification } from "./classification";

describe("universal classification completeness", () => {
  it("accepts exactly one result for every requested launch", () => {
    expect(() =>
      assertCompleteClassification(
        ["launch-a", "launch-b"],
        ["launch-b", "launch-a"],
      ),
    ).not.toThrow();
  });

  it("rejects missing, duplicate, and unknown results", () => {
    expect(() =>
      assertCompleteClassification(["launch-a", "launch-b"], ["launch-a"]),
    ).toThrow("omitted");
    expect(() =>
      assertCompleteClassification(
        ["launch-a", "launch-b"],
        ["launch-a", "launch-a"],
      ),
    ).toThrow("duplicated");
    expect(() =>
      assertCompleteClassification(["launch-a"], ["launch-other"]),
    ).toThrow("unknown");
  });
});
