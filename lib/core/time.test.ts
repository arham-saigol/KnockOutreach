import { describe, expect, it } from "vitest";
import { productHuntDay } from "./time";

describe("productHuntDay", () => {
  it("uses independent offsets across the spring DST transition", () => {
    expect(productHuntDay(new Date("2026-03-08T18:00:00Z"))).toEqual({
      day: "2026-03-08",
      postedAfter: "2026-03-08T08:00:00.000Z",
      postedBefore: "2026-03-09T07:00:00.000Z",
    });
  });

  it("uses independent offsets across the fall DST transition", () => {
    expect(productHuntDay(new Date("2026-11-01T18:00:00Z"))).toEqual({
      day: "2026-11-01",
      postedAfter: "2026-11-01T07:00:00.000Z",
      postedBefore: "2026-11-02T08:00:00.000Z",
    });
  });
});
