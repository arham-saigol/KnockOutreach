import { z } from "zod";
import { normalizeUrl, sameDomain } from "../../lib/core/normalization";

const pageSchema = z.object({
  url: z.string().url(),
  final_url: z.string().url(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  text: z.union([z.string(), z.record(z.string(), z.unknown())]),
  links: z.array(z.string()).optional(),
});
const responseSchema = z.object({
  results: z.array(pageSchema),
  errors: z.array(z.object({ url: z.string(), error: z.string() })).default([]),
});

export type FetchedPage = {
  url: string;
  finalUrl: string;
  title?: string;
  description?: string;
  content: string;
  links: string[];
  etag?: string;
  lastModified?: string;
};

async function tinyFishFetch(
  urls: string[],
  links: boolean,
): Promise<FetchedPage[]> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) throw new Error("Missing TINYFISH_API_KEY in Convex Cloud");
  const response = await fetch("https://api.fetch.tinyfish.ai", {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      urls,
      format: "markdown",
      links,
      image_links: false,
      ttl: 0,
      per_url_timeout_ms: 45_000,
      purpose:
        "Build an evidence-grounded company knowledge base and identify public contact details for human-reviewed outreach.",
    }),
  });
  if (!response.ok)
    throw new Error(
      `TinyFish request failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
    );
  const parsed = responseSchema.parse(await response.json());
  if (!parsed.results.length && parsed.errors.length)
    throw new Error(
      `TinyFish could not fetch the site: ${parsed.errors.map((error) => error.error).join(", ")}`,
    );
  return parsed.results.map((page) => ({
    url: page.url,
    finalUrl: page.final_url,
    title: page.title ?? undefined,
    description: page.description ?? undefined,
    content:
      typeof page.text === "string" ? page.text : JSON.stringify(page.text),
    links: page.links ?? [],
  }));
}

function selectUsefulLinks(homeUrl: string, links: string[]) {
  const priority = [
    /\/about\b/i,
    /\/contact\b/i,
    /\/team\b/i,
    /\/pricing\b/i,
    /\/customers?\b/i,
    /\/case-stud/i,
    /\/features?\b/i,
  ];
  const candidates = links
    .filter((link) => {
      try {
        return (
          sameDomain(homeUrl, link) &&
          !/\.(png|jpe?g|gif|svg|pdf|zip)(\?|$)/i.test(link)
        );
      } catch {
        return false;
      }
    })
    .map((link) => normalizeUrl(link));
  return [...new Set(candidates)]
    .sort((a, b) => {
      const aScore = priority.findIndex((pattern) => pattern.test(a));
      const bScore = priority.findIndex((pattern) => pattern.test(b));
      return (aScore < 0 ? 99 : aScore) - (bScore < 0 ? 99 : bScore);
    })
    .slice(0, 6);
}

async function headMetadata(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    return {
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function crawlWebsite(
  input: string,
): Promise<{ canonicalUrl: string; pages: FetchedPage[] }> {
  const homepage = normalizeUrl(input);
  const homeResults = await tinyFishFetch([homepage], true);
  const home = homeResults[0];
  if (!home) throw new Error("TinyFish returned no homepage content");
  const canonicalUrl = normalizeUrl(home.finalUrl);
  const useful = selectUsefulLinks(canonicalUrl, home.links)
    .filter((url) => url !== canonicalUrl)
    .slice(0, 5);
  const additional = useful.length ? await tinyFishFetch(useful, false) : [];
  const pages = [home, ...additional];
  const metadata = await Promise.all(
    pages.map((page) => headMetadata(page.finalUrl)),
  );
  return {
    canonicalUrl,
    pages: pages.map((page, index) => ({ ...page, ...metadata[index] })),
  };
}
