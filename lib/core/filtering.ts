import type { ExclusionRules } from "@/lib/types";
import { hostname } from "@/lib/core/normalization";

const MASSIVE_COMPANY_DOMAINS = new Set([
  "adobe.com",
  "amazon.com",
  "apple.com",
  "atlassian.com",
  "canva.com",
  "google.com",
  "hubspot.com",
  "meta.com",
  "microsoft.com",
  "notion.so",
  "salesforce.com",
  "slack.com",
  "stripe.com",
  "zoom.us",
]);

const MASSIVE_COMPANY_NAMES = new Set([
  "adobe",
  "amazon",
  "apple",
  "atlassian",
  "canva",
  "google",
  "hubspot",
  "meta",
  "microsoft",
  "notion",
  "salesforce",
  "slack",
  "stripe",
  "zoom",
]);

export function deterministicMassiveCompanyFilter(input: {
  name: string;
  websiteUrl?: string;
}): { excluded: boolean; reason?: string; ambiguous: boolean } {
  const normalizedName = input.name.trim().toLowerCase();
  if (MASSIVE_COMPANY_NAMES.has(normalizedName)) {
    return {
      excluded: true,
      reason: "Known massive company",
      ambiguous: false,
    };
  }
  if (input.websiteUrl) {
    try {
      const domain = hostname(input.websiteUrl);
      if (MASSIVE_COMPANY_DOMAINS.has(domain)) {
        return {
          excluded: true,
          reason: "Known massive-company domain",
          ambiguous: false,
        };
      }
    } catch {
      return { excluded: false, ambiguous: true };
    }
  }
  return { excluded: false, ambiguous: true };
}

export function coarseProjectFilter(
  launch: {
    name: string;
    tagline: string;
    websiteUrl?: string;
    topics?: string[];
  },
  rules: ExclusionRules,
): { eligible: boolean; reason?: string } {
  const searchable =
    `${launch.name} ${launch.tagline} ${(launch.topics ?? []).join(" ")}`.toLowerCase();
  const keyword = rules.keywords.find((item) =>
    searchable.includes(item.toLowerCase()),
  );
  if (keyword)
    return { eligible: false, reason: `Excluded keyword: ${keyword}` };

  const category = rules.categories.find((item) =>
    (launch.topics ?? []).some(
      (topic) => topic.toLowerCase() === item.toLowerCase(),
    ),
  );
  if (category)
    return { eligible: false, reason: `Excluded category: ${category}` };

  if (launch.websiteUrl) {
    try {
      const domain = hostname(launch.websiteUrl);
      const blocked = rules.domains.find((item) => hostname(item) === domain);
      if (blocked)
        return { eligible: false, reason: `Excluded domain: ${domain}` };
    } catch {
      // An invalid URL remains potentially eligible so enrichment can resolve it.
    }
  }
  return { eligible: true };
}
