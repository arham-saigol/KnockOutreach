import { describe, expect, it } from "vitest";
import { extractEmails } from "./email-extraction";

describe("email extraction", () => {
  it("retains only addresses present in fetched evidence and ranks mailto links", () => {
    const results = extractEmails(
      [
        {
          url: "https://acme.test/contact",
          content:
            "Write to info@acme.test or [say hi](mailto:hello@acme.test?subject=Hello).",
        },
      ],
      "https://acme.test",
    );
    expect(results.map((item) => item.email)).toEqual([
      "hello@acme.test",
      "info@acme.test",
    ]);
    expect(results[0]).toMatchObject({
      evidenceUrl: "https://acme.test/contact",
      source: "mailto",
    });
  });

  it("rejects malformed and non-contact system addresses", () => {
    expect(
      extractEmails(
        [
          {
            url: "https://acme.test",
            content: "noreply@acme.test and not-an-email",
          },
        ],
        "https://acme.test",
      ),
    ).toEqual([]);
  });

  it("rejects third-party addresses mentioned on first-party pages", () => {
    expect(
      extractEmails(
        [
          {
            url: "https://acme.test/partners",
            content: "Contact hello@acme.test, not vendor@example.com.",
          },
        ],
        "https://www.acme.test",
      ).map((item) => item.email),
    ).toEqual(["hello@acme.test"]);
  });
});
