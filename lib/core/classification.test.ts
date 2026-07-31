import { describe, expect, it } from "vitest";
import {
  assertCompleteClassification,
  classificationBatches,
} from "./classification";

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

  it("splits large requests into bounded resumable batches", () => {
    const batches = classificationBatches(
      Array.from({ length: 45 }, (_, index) => index),
    );
    expect(batches.map((batch) => batch.length)).toEqual([20, 20, 5]);
    expect(batches.flat()).toEqual(
      Array.from({ length: 45 }, (_, index) => index),
    );
  });
});
