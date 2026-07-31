import { describe, expect, it } from "vitest";
import { signSvixPayload, verifySvixSignature } from "./svix";

describe("Svix verification", () => {
  it("verifies the exact raw body and rejects a modified body", async () => {
    const secret = `whsec_${btoa("test-signing-secret-32-bytes-long")}`;
    const timestamp = "1700000000";
    const payload = '{"event_id":"evt_1"}';
    const signature = await signSvixPayload(
      secret,
      "msg_1",
      timestamp,
      payload,
    );
    const common = {
      secret,
      messageId: "msg_1",
      timestamp,
      signature: `v1,${signature}`,
      nowSeconds: 1700000000,
    };
    expect(await verifySvixSignature({ ...common, payload })).toBe(true);
    expect(
      await verifySvixSignature({ ...common, payload: `${payload} ` }),
    ).toBe(false);
  });
});
