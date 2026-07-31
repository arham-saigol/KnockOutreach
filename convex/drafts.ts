import { z } from "zod";
import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCandidate } from "./lib/auth";
import { structuredCompletion } from "./adapters/deepseek";
import { draftSystemPrompt, PROMPT_VERSIONS } from "./prompts";

const editableCandidateStatuses = ["ready", "send_failed", "no_contact"];

function assertDraftEditable(status: string) {
  if (!editableCandidateStatuses.includes(status))
    throw new Error("This draft is no longer editable.");
}

export const update = mutation({
  args: {
    candidateId: v.id("projectCandidates"),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { candidate } = await requireCandidate(ctx, args.candidateId);
    assertDraftEditable(candidate.status);
    const draft = await ctx.db
      .query("drafts")
      .withIndex("by_candidate_and_status", (q: any) =>
        q.eq("candidateId", args.candidateId).eq("status", "ready"),
      )
      .unique();
    if (!draft) throw new Error("Draft not found");
    await ctx.db.patch(draft._id, {
      subject: args.subject.trim(),
      body: args.body.trim(),
      updatedAt: Date.now(),
    });
  },
});

export const regenerationContext = internalQuery({
  args: { candidateId: v.id("projectCandidates"), ownerId: v.string() },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate || candidate.ownerId !== args.ownerId)
      throw new Error("Candidate not found");
    assertDraftEditable(candidate.status);
    const project = await ctx.db.get(candidate.projectId);
    const launch = await ctx.db.get(candidate.launchId);
    const enrichment = candidate.enrichmentId
      ? await ctx.db.get(candidate.enrichmentId)
      : null;
    const knowledge = await ctx.db.get(candidate.knowledgeVersionId);
    if (!project || !launch || !enrichment || !knowledge)
      throw new Error("Draft context is incomplete");
    return { candidate, project, launch, enrichment, knowledge };
  },
});

export const storeRegenerated = internalMutation({
  args: {
    candidateId: v.id("projectCandidates"),
    subject: v.string(),
    body: v.string(),
    claims: v.array(v.object({ claim: v.string(), evidenceUrl: v.string() })),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error("Candidate not found");
    assertDraftEditable(candidate.status);
    const project = await ctx.db.get(candidate.projectId);
    if (!project) throw new Error("Project not found");
    const current = await ctx.db
      .query("drafts")
      .withIndex("by_candidate_and_status", (q: any) =>
        q.eq("candidateId", args.candidateId).eq("status", "ready"),
      )
      .unique();
    const now = Date.now();
    if (current)
      await ctx.db.patch(current._id, { status: "superseded", updatedAt: now });
    await ctx.db.insert("drafts", {
      ownerId: candidate.ownerId,
      projectId: candidate.projectId,
      candidateId: candidate._id,
      version: (current?.version ?? 0) + 1,
      status: "ready",
      subject: args.subject,
      body: args.body,
      claims: args.claims,
      model: args.model,
      promptVersion: PROMPT_VERSIONS.draft,
      knowledgeVersionId: candidate.knowledgeVersionId,
      sourceHashes: candidate.sourceHashes,
      senderFounderName: project.founderName,
      senderAgentName: project.agentName,
      createdAt: now,
      updatedAt: now,
    });
  },
});

const schema = z.object({
  subject: z.string().min(2).max(120),
  body: z.string(),
  claims: z
    .array(z.object({ claim: z.string(), evidenceUrl: z.string().url() }))
    .min(1)
    .max(3),
});

export const regenerate = action({
  args: { candidateId: v.id("projectCandidates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const data = await ctx.runQuery(internal.drafts.regenerationContext, {
      candidateId: args.candidateId,
      ownerId: identity.subject,
    });
    const evidence = new Set<string>(
      data.enrichment.pages.map((page: any) => page.url),
    );
    const result = await structuredCompletion({
      system: draftSystemPrompt,
      user: `PROJECT KNOWLEDGE:\n${data.knowledge.markdown}\n\nSENDER: ${data.project.agentName}, ${data.project.founderName}'s AI agent\nRECIPIENT: ${data.launch.name} team\nRECIPIENT CONTEXT: ${data.enrichment.companyContext}\nMATCH: ${data.candidate.matchReason}\nALLOWED EVIDENCE URLS: ${[...evidence].join(", ")}\nCreate a meaningfully different angle from the current draft.`,
      schema,
      maxTokens: 1_500,
    });
    const words = result.value.body.trim().split(/\s+/).length;
    if (
      words < 60 ||
      words > 110 ||
      result.value.claims.some((claim) => !evidence.has(claim.evidenceUrl))
    )
      throw new Error(
        "Regenerated draft failed evidence or length validation.",
      );
    await ctx.runMutation(internal.drafts.storeRegenerated, {
      candidateId: args.candidateId,
      ...result.value,
      model: result.model,
    });
  },
});
