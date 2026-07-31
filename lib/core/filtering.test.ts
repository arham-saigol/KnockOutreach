import { describe, expect, it } from "vitest";
import {
  coarseProjectFilter,
  deterministicMassiveCompanyFilter,
} from "./filtering";

const rules = {
  keywords: ["crypto"],
  domains: ["blocked.example"],
  categories: ["Web3"],
  notes: "",
  cooldownDays: 90,
};

describe("launch filtering", () => {
  it("deterministically excludes known massive companies", () => {
    expect(
      deterministicMassiveCompanyFilter({
        name: "Google",
        websiteUrl: "https://google.com/new",
      }),
    ).toMatchObject({ excluded: true, ambiguous: false });
  });

  it("leaves an unknown company for structured classification", () => {
    expect(
      deterministicMassiveCompanyFilter({
        name: "Tiny New Co",
        websiteUrl: "https://tiny.example",
      }),
    ).toEqual({ excluded: false, ambiguous: true });
  });

  it("applies project exclusions coarsely", () => {
    expect(
      coarseProjectFilter(
        { name: "Wallet", tagline: "A crypto tool", topics: [] },
        rules,
      ).eligible,
    ).toBe(false);
    expect(
      coarseProjectFilter(
        {
          name: "Planner",
          tagline: "Calm roadmap rituals",
          topics: ["Productivity"],
        },
        rules,
      ).eligible,
    ).toBe(true);
  });
});
