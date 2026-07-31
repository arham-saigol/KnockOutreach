import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCandidate, requireProject } from "./lib/auth";
import { assertCandidateTransition } from "../lib/core/state-machine";
import { crawlWebsite } from "./adapters/tinyfish";
import { extractEmails } from "../lib/core/email-extraction";
import { sha256 } from "../lib/core/hashing";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    const candidates = await ctx.db
      .query("projectCandidates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    return Promise.all(
      candidates.map(async (candidate) => {
        const launch = await ctx.db.get(candidate.launchId);
        const enrichment = candidate.enrichmentId
          ? await ctx.db.get(candidate.enrichmentId)
          : null;
        const drafts = await ctx.db
          .query("drafts")
          .withIndex("by_candidate", (q) => q.eq("candidateId", candidate._id))
          .order("desc")
          .collect();
        const draft =
          drafts.find(
            (item) => item.status === "ready" || item.status === "approved",
          ) ?? drafts[0];
        if (!launch || !draft) return null;
        return {
          id: candidate._id,
          projectId: candidate.projectId,
          name: launch.name,
          tagline: launch.tagline,
          thumbnailUrl: launch.thumbnailUrl,
          productHuntUrl: launch.productHuntUrl,
          websiteUrl:
            enrichment?.canonicalWebsite ??
            launch.websiteUrl ??
            launch.productHuntUrl,
          companyContext:
            enrichment?.companyContext ?? launch.description ?? launch.tagline,
          recipientEmail: candidate.selectedEmail,
          emailConfidence: candidate.selectedEmailConfidence,
          emailEvidenceUrl: candidate.selectedEmailEvidenceUrl,
          alternativeEmails: candidate.alternativeEmails,
          matchReason: candidate.matchReason,
          subject: draft.subject,
          body: draft.body,
          status: candidate.status,
          completedAt: candidate.completedAt,
          error: candidate.error,
        };
      }),
    ).then((items) => items.filter(Boolean));
  },
});

export const dismiss = mutation({
  args: { candidateId: v.id("projectCandidates") },
  handler: async (ctx, args) => {
    const { candidate } = await requireCandidate(ctx, args.candidateId);
    assertCandidateTransition(candidate.status, "dismissed");
    await ctx.db.patch(args.candidateId, {
      status: "dismissed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
      error: undefined,
    });
  },
});

export const getRetryContext = internalQuery({
  args: { candidateId: v.id("projectCandidates"), ownerId: v.string() },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate || candidate.ownerId !== args.ownerId)
      throw new Error("Candidate not found");
    const launch = await ctx.db.get(candidate.launchId);
    const enrichment = candidate.enrichmentId
      ? await ctx.db.get(candidate.enrichmentId)
      : null;
    if (!launch || !enrichment)
      throw new Error("Candidate enrichment is unavailable");
    return { candidate, launch, enrichment };
  },
});

export const applyContactRetry = internalMutation({
  args: {
    candidateId: v.id("projectCandidates"),
    enrichmentId: v.id("launchEnrichments"),
    emails: v.array(
      v.object({
        email: v.string(),
        evidenceUrl: v.string(),
        source: v.union(v.literal("mailto"), v.literal("content")),
        confidence: v.number(),
      }),
    ),
    sourceHashes: v.array(v.object({ url: v.string(), hash: v.string() })),
  },
  handler: async (ctx, args) => {
    const selected = args.emails[0];
    await ctx.db.patch(args.enrichmentId, {
      emails: args.emails,
      selectedEmail: selected?.email,
      selectedEmailConfidence: selected?.confidence,
      selectedEmailEvidenceUrl: selected?.evidenceUrl,
      sourceHashes: args.sourceHashes,
      completedAt: Date.now(),
    });
    if (selected)
      await ctx.db.patch(args.candidateId, {
        status: "ready",
        selectedEmail: selected.email,
        selectedEmailConfidence: selected.confidence,
        selectedEmailEvidenceUrl: selected.evidenceUrl,
        alternativeEmails: args.emails.slice(1).map((email) => email.email),
        error: undefined,
        updatedAt: Date.now(),
      });
  },
});

export const retryContact = action({
  args: { candidateId: v.id("projectCandidates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const context = await ctx.runQuery(internal.candidates.getRetryContext, {
      candidateId: args.candidateId,
      ownerId: identity.subject,
    });
    const website =
      context.enrichment.canonicalWebsite ?? context.launch.websiteUrl;
    if (!website) throw new Error("No website is available to retry.");
    const crawled = await crawlWebsite(website);
    const emails = extractEmails(
      crawled.pages.map((page) => ({
        url: page.finalUrl,
        content: page.content,
      })),
    );
    if (!emails.length)
      throw new Error(
        "No published email address was found. Knock will never invent one.",
      );
    const sourceHashes = await Promise.all(
      crawled.pages.map(async (page) => ({
        url: page.finalUrl,
        hash: await sha256(page.content),
      })),
    );
    await ctx.runMutation(internal.candidates.applyContactRetry, {
      candidateId: args.candidateId,
      enrichmentId: context.enrichment._id,
      emails,
      sourceHashes,
    });
  },
});
