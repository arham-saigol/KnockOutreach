import { describe, expect, it } from "vitest";
import { sourceArtifactIsVersioned } from "./knowledge-artifacts";

describe("knowledge source artifacts", () => {
  const page = {
    url: "https://acme.test/about",
    contentHash: "hash-v1",
    storageId: "storage-v1",
  };

  it("retains sources referenced by storage ID or legacy URL and hash", () => {
    expect(
      sourceArtifactIsVersioned(page, [
        [{ url: page.url, hash: "other", storageId: page.storageId }],
      ]),
    ).toBe(true);
    expect(
      sourceArtifactIsVersioned(page, [
        [{ url: page.url, hash: page.contentHash }],
      ]),
    ).toBe(true);
  });

  it("allows unreferenced current-page artifacts to be collected", () => {
    expect(
      sourceArtifactIsVersioned(page, [
        [{ url: page.url, hash: "hash-v0", storageId: "storage-v0" }],
      ]),
    ).toBe(false);
  });
});
