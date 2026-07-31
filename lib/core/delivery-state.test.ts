import { describe, expect, it } from "vitest";
import { advanceDeliveryStatus } from "./delivery-state";

describe("delivery state precedence", () => {
  it("advances normal delivery progress", () => {
    expect(advanceDeliveryStatus("sending", "sent")).toBe("sent");
    expect(advanceDeliveryStatus("sent", "delivered")).toBe("delivered");
    expect(advanceDeliveryStatus("send_unknown", "delivered")).toBe(
      "delivered",
    );
  });

  it("does not regress on late events", () => {
    expect(advanceDeliveryStatus("delivered", "sent")).toBe("delivered");
    expect(advanceDeliveryStatus("bounced", "delivered")).toBe("bounced");
    expect(advanceDeliveryStatus("complained", "bounced")).toBe("complained");
  });

  it("lets stronger terminal evidence win", () => {
    expect(advanceDeliveryStatus("delivered", "bounced")).toBe("bounced");
    expect(advanceDeliveryStatus("bounced", "complained")).toBe("complained");
  });
});
