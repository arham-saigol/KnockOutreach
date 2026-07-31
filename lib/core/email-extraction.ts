import { normalizeEmail } from "@/lib/core/normalization";

export interface EmailEvidence {
  email: string;
  evidenceUrl: string;
  source: "mailto" | "content";
  confidence: number;
}

const EMAIL_IN_TEXT =
  /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;
const MAILTO = /mailto:([^?"'\s<>]+)/gi;
const BLOCKED_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "privacy",
  "abuse",
  "legal",
  "security",
]);

function confidenceFor(email: string, source: EmailEvidence["source"]) {
  const local = email.split("@")[0];
  let score = source === "mailto" ? 0.82 : 0.68;
  if (["hello", "founders", "team", "contact", "hi"].includes(local))
    score += 0.12;
  if (["support", "sales", "info"].includes(local)) score += 0.04;
  return Math.min(0.98, score);
}

export function extractEmails(
  pages: Array<{ url: string; content: string }>,
): EmailEvidence[] {
  const found = new Map<string, EmailEvidence>();

  for (const page of pages) {
    for (const [pattern, source] of [
      [MAILTO, "mailto"],
      [EMAIL_IN_TEXT, "content"],
    ] as const) {
      pattern.lastIndex = 0;
      for (const match of page.content.matchAll(pattern)) {
        const email = normalizeEmail(match[1] ?? match[0]);
        if (!email) continue;
        const local = email.split("@")[0];
        if (BLOCKED_LOCAL_PARTS.has(local)) continue;
        const next: EmailEvidence = {
          email,
          evidenceUrl: page.url,
          source,
          confidence: confidenceFor(email, source),
        };
        const previous = found.get(email);
        if (!previous || next.confidence > previous.confidence)
          found.set(email, next);
      }
    }
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence);
}
