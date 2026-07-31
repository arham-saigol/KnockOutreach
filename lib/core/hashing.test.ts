import { describe, expect, it } from "vitest";
import { hashSources, sha256 } from "./hashing";

describe("source hashing", () => {
  it("normalizes line endings and surrounding whitespace", async () => {
    expect(await sha256(" hello\r\nworld ")).toBe(await sha256("hello\nworld"));
  });

  it("orders page hashes by URL for reproducibility", async () => {
    const left = await hashSources([
      { url: "https://b.test", content: "b" },
      { url: "https://a.test", content: "a" },
    ]);
    const right = await hashSources([
      { url: "https://a.test", content: "a" },
      { url: "https://b.test", content: "b" },
    ]);
    expect(left).toEqual(right);
  });
});
