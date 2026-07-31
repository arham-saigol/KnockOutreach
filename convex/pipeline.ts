import { start } from "@convex-dev/workflow";
import { z } from "zod";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { workflow } from "./workflow";
import { requireIdentity } from "./lib/auth";
import { fetchProductHuntLaunches } from "./adapters/productHunt";
import { crawlWebsite } from "./adapters/tinyfish";
import { structuredCompletion } from "./adapters/deepseek";
import { PROMPT_VERSIONS, draftSystemPrompt } from "./prompts";
import { completedProductHuntDay, productHuntDay } from "../lib/core/time";
import {
  coarseProjectFilter,
  deterministicMassiveCompanyFilter,
} from "../lib/core/filtering";
import { extractEmails } from "../lib/core/email-extraction";
import { sha256 } from "../lib/core/hashing";
import {
  assertCompleteClassification,
  classificationBatches,
} from "../lib/core/classification";

const stepNames = [
  "Fetch Product Hunt",
  "Universal filtering",
  "Shared enrichment",
  "Project matching",
  "Drafting",
];

async function getOrCreateRun(
  ctx: any,
  startedBy: "cron" | "manual",
  requestedDay?: string,
) {
  const bounds =
    startedBy === "cron" ? completedProductHuntDay() : productHuntDay();
  const day = requestedDay ?? bounds.day;
  const existing = await ctx.db
    .query("dailyRuns")
    .withIndex("by_day", (q: any) => q.eq("day", day))
    .unique();
  if (
    existing &&
    (["queued", "running"].includes(existing.status) ||
      (existing.status === "completed" &&
        startedBy === "cron" &&
        existing.startedBy === "cron"))
  )
    return { runId: existing._id, shouldStart: false };
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "queued",
      currentStep: "Queued",
      error: undefined,
      completedAt: undefined,
      startedAt: now,
      startedBy,
      counts: { fetched: 0, eligible: 0, enriched: 0, drafted: 0, failed: 0 },
      steps: stepNames.map((name) => ({ name, status: "pending" })),
    });
    return { runId: existing._id, shouldStart: true };
  }
  const runId = await ctx.db.insert("dailyRuns", {
    day,
    status: "queued",
    currentStep: "Queued",
    startedBy,
    startedAt: now,
    steps: stepNames.map((name) => ({ name, status: "pending" as const })),
    counts: { fetched: 0, eligible: 0, enriched: 0, drafted: 0, failed: 0 },
  });
  return { runId, shouldStart: true };
}

export const runNow = mutation({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    const failedRun = await ctx.db
      .query("dailyRuns")
      .withIndex("by_status_and_started_at", (q: any) =>
        q.eq("status", "failed"),
      )
      .order("asc")
      .first();
    const retryDay = failedRun?.day;
    const { runId, shouldStart } = await getOrCreateRun(
      ctx,
      "manual",
      retryDay,
    );
    if (shouldStart) {
      const workflowId = await start(ctx, internal.pipeline.dailyPipeline, {
        runId,
      });
      await ctx.db.patch(runId, {
        workflowId,
        status: "running",
        currentStep: "Starting",
      });
    }
    return runId;
  },
});

export const startScheduled = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { runId, shouldStart } = await getOrCreateRun(ctx, "cron");
    if (shouldStart) {
      const workflowId = await start(ctx, internal.pipeline.dailyPipeline, {
        runId,
      });
      await ctx.db.patch(runId, {
        workflowId,
        status: "running",
        currentStep: "Starting",
      });
    }
  },
});

export const latestRun = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    const run = await ctx.db
      .query("dailyRuns")
      .withIndex("by_started_at")
      .order("desc")
      .first();
    if (!run) return undefined;
    return {
      id: run._id,
      day: run.day,
      status: run.status,
      currentStep: run.currentStep,
      counts: run.counts,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      error: run.error,
    };
  },
});

export const dailyPipeline = workflow
  .define({ args: { runId: v.id("dailyRuns") } })
  .handler(async (step, args): Promise<void> => {
    try {
      await step.runAction(internal.pipeline.fetchAndUpsert, args, {
        name: "Fetch and upsert Product Hunt launches",
        retry: true,
      });
      await step.runAction(internal.pipeline.filterEnrichAndDraft, args, {
        name: "Filter, enrich, match, and draft",
        retry: true,
      });
      await step.runMutation(
        internal.pipeline.finishRun,
        { runId: args.runId },
        { name: "Complete daily run" },
      );
    } catch (error) {
      await step.runMutation(
        internal.pipeline.failRun,
        {
          runId: args.runId,
          error:
            error instanceof Error ? error.message : "Daily workflow failed",
        },
        { name: "Record daily run failure" },
      );
    }
  });

export const updateStep = internalMutation({
  args: {
    runId: v.id("dailyRuns"),
    name: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    counts: v.optional(
      v.object({
        fetched: v.number(),
        eligible: v.number(),
        enriched: v.number(),
        drafted: v.number(),
        failed: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    const now = Date.now();
    const steps = run.steps.map((step: any) =>
      step.name === args.name
        ? {
            ...step,
            status: args.status,
            startedAt: step.startedAt ?? now,
            completedAt:
              args.status === "completed" || args.status === "failed"
                ? now
                : undefined,
            error: args.error,
          }
        : step,
    );
    await ctx.db.patch(args.runId, {
      status: "running",
      currentStep: args.name,
      steps,
      counts: args.counts ?? run.counts,
    });
  },
});

export const finishRun = internalMutation({
  args: { runId: v.id("dailyRuns") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "completed",
      currentStep: "Complete",
      completedAt: Date.now(),
    });
  },
});

export const failRun = internalMutation({
  args: { runId: v.id("dailyRuns"), error: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    await ctx.db.patch(args.runId, {
      status: "failed",
      currentStep: "Paused",
      error: args.error.slice(0, 1_000),
      completedAt: Date.now(),
      counts: { ...run.counts, failed: run.counts.failed + 1 },
    });
  },
});

const launchArg = v.object({
  productHuntId: v.string(),
  day: v.string(),
  name: v.string(),
  tagline: v.string(),
  description: v.optional(v.string()),
  productHuntUrl: v.string(),
  websiteUrl: v.optional(v.string()),
  thumbnailUrl: v.optional(v.string()),
  topics: v.array(v.string()),
  votesCount: v.optional(v.number()),
  postedAt: v.string(),
  sourceHash: v.string(),
  deterministicExcluded: v.boolean(),
  deterministicReason: v.optional(v.string()),
});

export const upsertLaunchBatch = internalMutation({
  args: { runId: v.id("dailyRuns"), launches: v.array(launchArg) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const launch of args.launches) {
      const existing = await ctx.db
        .query("launches")
        .withIndex("by_product_hunt_id", (q) =>
          q.eq("productHuntId", launch.productHuntId),
        )
        .unique();
      const { deterministicExcluded, deterministicReason, ...baseLaunch } =
        launch;
      const value = {
        ...baseLaunch,
        universalStatus: deterministicExcluded
          ? ("excluded" as const)
          : ("pending" as const),
        universalReason: deterministicReason,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const stored = value;
      if (existing) await ctx.db.patch(existing._id, stored);
      else await ctx.db.insert("launches", stored);
    }
    const run = await ctx.db.get(args.runId);
    if (run)
      await ctx.db.patch(args.runId, {
        counts: {
          ...run.counts,
          fetched: run.counts.fetched + args.launches.length,
        },
      });
  },
});

export const fetchAndUpsert = internalAction({
  args: { runId: v.id("dailyRuns") },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.pipeline.updateStep, {
      runId: args.runId,
      name: "Fetch Product Hunt",
      status: "running",
    });
    const run = await ctx.runQuery(internal.pipeline.getRun, {
      runId: args.runId,
    });
    const bounds = productHuntDay(new Date(`${run.day}T18:00:00Z`));
    const posts = await fetchProductHuntLaunches(
      bounds.postedAfter,
      bounds.postedBefore,
    );
    const launches = await Promise.all(
      posts.map(async (post) => {
        const deterministic = deterministicMassiveCompanyFilter({
          name: post.name,
          websiteUrl: post.website ?? undefined,
        });
        return {
          productHuntId: post.id,
          day: run.day,
          name: post.name,
          tagline: post.tagline,
          description: post.description ?? undefined,
          productHuntUrl: post.url,
          websiteUrl: post.website ?? undefined,
          thumbnailUrl: post.thumbnail?.url,
          topics: post.topics?.edges.map((edge) => edge.node.name) ?? [],
          votesCount: post.votesCount,
          postedAt: post.createdAt,
          sourceHash: await sha256(JSON.stringify(post)),
          deterministicExcluded: deterministic.excluded,
          deterministicReason: deterministic.reason,
        };
      }),
    );
    for (let index = 0; index < launches.length; index += 40)
      await ctx.runMutation(internal.pipeline.upsertLaunchBatch, {
        runId: args.runId,
        launches: launches.slice(index, index + 40),
      });
    await ctx.runMutation(internal.pipeline.updateStep, {
      runId: args.runId,
      name: "Fetch Product Hunt",
      status: "completed",
    });
  },
});

export const getRun = internalQuery({
  args: { runId: v.id("dailyRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Daily run not found");
    return run;
  },
});

export const getPipelineContext = internalQuery({
  args: { runId: v.id("dailyRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Daily run not found");
    const launches = await ctx.db
      .query("launches")
      .withIndex("by_day", (q) => q.eq("day", run.day))
      .collect();
    const projects = (await ctx.db.query("projects").collect()).filter(
      (project) =>
        project.status === "ready" && project.activeKnowledgeVersionId,
    );
    const knowledge = await Promise.all(
      projects.map((project) => ctx.db.get(project.activeKnowledgeVersionId!)),
    );
    return {
      run,
      launches,
      projects: projects.map((project, index) => ({
        ...project,
        knowledge: knowledge[index],
      })),
    };
  },
});

export const setUniversalResults = internalMutation({
  args: {
    results: v.array(
      v.object({
        launchId: v.id("launches"),
        eligible: v.boolean(),
        reason: v.string(),
        confidence: v.number(),
        model: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const result of args.results)
      await ctx.db.patch(result.launchId, {
        universalStatus: result.eligible ? "eligible" : "excluded",
        universalReason: result.reason,
        universalConfidence: result.confidence,
        universalModel: result.model,
        universalPromptVersion: PROMPT_VERSIONS.universalFilter,
        updatedAt: Date.now(),
      });
  },
});

export const getEnrichment = internalQuery({
  args: { launchId: v.id("launches") },
  handler: async (ctx, args) =>
    ctx.db
      .query("launchEnrichments")
      .withIndex("by_launch", (q) => q.eq("launchId", args.launchId))
      .unique(),
});

export const getExistingCandidate = internalQuery({
  args: {
    projectId: v.id("projects"),
    launchId: v.id("launches"),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("projectCandidates")
      .withIndex("by_project_and_launch", (q: any) =>
        q.eq("projectId", args.projectId).eq("launchId", args.launchId),
      )
      .unique(),
});

export const beginEnrichment = internalMutation({
  args: { launchId: v.id("launches") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("launchEnrichments")
      .withIndex("by_launch", (q) => q.eq("launchId", args.launchId))
      .unique();
    if (existing) {
      if (existing.status !== "completed")
        await ctx.db.patch(existing._id, {
          status: "running",
          error: undefined,
          startedAt: Date.now(),
        });
      return existing._id;
    }
    return ctx.db.insert("launchEnrichments", {
      launchId: args.launchId,
      status: "running",
      pages: [],
      emails: [],
      sourceHashes: [],
      startedAt: Date.now(),
    });
  },
});

const emailValidator = v.object({
  email: v.string(),
  evidenceUrl: v.string(),
  source: v.union(v.literal("mailto"), v.literal("content")),
  confidence: v.number(),
});
export const completeEnrichment = internalMutation({
  args: {
    enrichmentId: v.id("launchEnrichments"),
    canonicalWebsite: v.string(),
    companyContext: v.string(),
    pages: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        contentHash: v.string(),
      }),
    ),
    emails: v.array(emailValidator),
    sourceHashes: v.array(v.object({ url: v.string(), hash: v.string() })),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const selected = args.emails[0];
    await ctx.db.patch(args.enrichmentId, {
      status: "completed",
      canonicalWebsite: args.canonicalWebsite,
      companyContext: args.companyContext,
      pages: args.pages,
      emails: args.emails,
      selectedEmail: selected?.email,
      selectedEmailConfidence: selected?.confidence,
      selectedEmailEvidenceUrl: selected?.evidenceUrl,
      sourceHashes: args.sourceHashes,
      model: args.model,
      promptVersion: PROMPT_VERSIONS.enrichment,
      completedAt: Date.now(),
      error: undefined,
    });
  },
});

export const failEnrichment = internalMutation({
  args: { enrichmentId: v.id("launchEnrichments"), error: v.string() },
  handler: async (ctx, args) =>
    ctx.db.patch(args.enrichmentId, {
      status: "failed",
      error: args.error.slice(0, 1_000),
      completedAt: Date.now(),
    }),
});

const universalSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      massive: z.boolean(),
      reason: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});
const contextSchema = z.object({
  companyContext: z.string().min(60).max(1_500),
});
const matchSchema = z.object({
  eligible: z.boolean(),
  reason: z.string().min(1).max(600),
  confidence: z.number().min(0).max(1),
});
const draftSchema = z.object({
  subject: z.string().min(2).max(120),
  body: z.string().min(1),
  claims: z
    .array(
      z.object({ claim: z.string().min(1), evidenceUrl: z.string().url() }),
    )
    .min(1)
    .max(3),
});

function validateDraft(
  value: z.infer<typeof draftSchema>,
  evidenceUrls: Set<string>,
) {
  const words = value.body.trim().split(/\s+/).length;
  if (words < 60 || words > 110)
    throw new Error(`Draft body has ${words} words; expected 60–110`);
  if (/—|^\s*[-*•]\s/m.test(value.body))
    throw new Error("Draft contains banned formatting");
  const banned = [
    "i hope this finds you well",
    "game-changer",
    "revolutionary",
    "unlock",
    "leverage",
    "seamless",
    "delve",
    "excited to",
  ];
  const phrase = banned.find((item) => value.body.toLowerCase().includes(item));
  if (phrase) throw new Error(`Draft contains banned phrase: ${phrase}`);
  if (value.claims.some((claim) => !evidenceUrls.has(claim.evidenceUrl)))
    throw new Error("Draft cited a URL outside the fetched evidence set");
}

async function generateDraft(input: {
  project: any;
  launch: any;
  enrichment: any;
  matchReason: string;
}) {
  const evidenceUrls = new Set<string>(
    input.enrichment.pages.map((page: any) => page.url),
  );
  const base = `SENDER PROJECT KNOWLEDGE:\n${input.project.knowledge.markdown}\n\nSENDER: ${input.project.agentName}, ${input.project.founderName}'s AI agent\nRECIPIENT: ${input.launch.name} team\nRECIPIENT CONTEXT: ${input.enrichment.companyContext}\nMATCH REASON: ${input.matchReason}\nRECIPIENT EMAIL: ${input.enrichment.selectedEmail ?? "unknown"}\nALLOWED EVIDENCE URLS: ${[...evidenceUrls].join(", ")}`;
  let correction = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await structuredCompletion({
      system: draftSystemPrompt,
      user: `${base}${correction}`,
      schema: draftSchema,
      maxTokens: 1_500,
    });
    try {
      validateDraft(result.value, evidenceUrls);
      return { ...result.value, model: result.model };
    } catch (error) {
      if (attempt === 1) throw error;
      correction = `\n\nCORRECTION: The previous draft failed validation: ${error instanceof Error ? error.message : "invalid"}. Produce a compliant replacement.`;
    }
  }
  throw new Error("Draft generation failed validation");
}

export const upsertCandidateAndDraft = internalMutation({
  args: {
    projectId: v.id("projects"),
    knowledgeVersionId: v.id("knowledgeVersions"),
    launchId: v.id("launches"),
    enrichmentId: v.id("launchEnrichments"),
    reason: v.string(),
    confidence: v.number(),
    filterModel: v.string(),
    sourceHashes: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    claims: v.array(v.object({ claim: v.string(), evidenceUrl: v.string() })),
    draftModel: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    const enrichment = await ctx.db.get(args.enrichmentId);
    if (
      !project ||
      project.activeKnowledgeVersionId !== args.knowledgeVersionId ||
      !enrichment
    )
      throw new Error("Project context changed during pipeline");
    const existing = await ctx.db
      .query("projectCandidates")
      .withIndex("by_project_and_launch", (q: any) =>
        q.eq("projectId", args.projectId).eq("launchId", args.launchId),
      )
      .unique();
    const now = Date.now();
    let candidateId;
    if (existing) {
      candidateId = existing._id;
      if (
        ["sent", "dismissed", "sending", "send_unknown"].includes(
          existing.status,
        )
      )
        return { candidateId, inserted: false };
      await ctx.db.patch(candidateId, {
        matchReason: args.reason,
        matchConfidence: args.confidence,
        filterModel: args.filterModel,
        filterPromptVersion: PROMPT_VERSIONS.projectFilter,
        knowledgeVersionId: args.knowledgeVersionId,
        sourceHashes: args.sourceHashes,
        selectedEmail: enrichment.selectedEmail,
        selectedEmailConfidence: enrichment.selectedEmailConfidence,
        selectedEmailEvidenceUrl: enrichment.selectedEmailEvidenceUrl,
        alternativeEmails: enrichment.emails
          .slice(1)
          .map((email: any) => email.email),
        status: enrichment.selectedEmail ? "ready" : "no_contact",
        completedAt: undefined,
        error: undefined,
        updatedAt: now,
      });
    } else {
      candidateId = await ctx.db.insert("projectCandidates", {
        ownerId: project.ownerId,
        projectId: args.projectId,
        launchId: args.launchId,
        enrichmentId: args.enrichmentId,
        status: enrichment.selectedEmail ? "ready" : "no_contact",
        matchReason: args.reason,
        matchConfidence: args.confidence,
        filterModel: args.filterModel,
        filterPromptVersion: PROMPT_VERSIONS.projectFilter,
        knowledgeVersionId: args.knowledgeVersionId,
        sourceHashes: args.sourceHashes,
        selectedEmail: enrichment.selectedEmail,
        selectedEmailConfidence: enrichment.selectedEmailConfidence,
        selectedEmailEvidenceUrl: enrichment.selectedEmailEvidenceUrl,
        alternativeEmails: enrichment.emails
          .slice(1)
          .map((email: any) => email.email),
        createdAt: now,
        updatedAt: now,
      });
    }
    const currentDraft = await ctx.db
      .query("drafts")
      .withIndex("by_candidate_and_status", (q: any) =>
        q.eq("candidateId", candidateId).eq("status", "ready"),
      )
      .unique();
    if (currentDraft)
      await ctx.db.patch(currentDraft._id, {
        status: "superseded",
        updatedAt: now,
      });
    await ctx.db.insert("drafts", {
      ownerId: project.ownerId,
      projectId: args.projectId,
      candidateId,
      version: (currentDraft?.version ?? 0) + 1,
      status: "ready",
      subject: args.subject,
      body: args.body,
      claims: args.claims,
      model: args.draftModel,
      promptVersion: PROMPT_VERSIONS.draft,
      knowledgeVersionId: args.knowledgeVersionId,
      sourceHashes: args.sourceHashes,
      senderFounderName: project.founderName,
      senderAgentName: project.agentName,
      createdAt: now,
      updatedAt: now,
    });
    return { candidateId, inserted: !existing };
  },
});

export const filterEnrichAndDraft = internalAction({
  args: { runId: v.id("dailyRuns") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.pipeline.getPipelineContext,
      args,
    );
    const counts = { ...context.run.counts, failed: 0 };
    await ctx.runMutation(internal.pipeline.updateStep, {
      runId: args.runId,
      name: "Universal filtering",
      status: "running",
      counts,
    });
    const ambiguous = context.launches.filter(
      (launch: any) => launch.universalStatus === "pending",
    );
    for (const batch of classificationBatches(ambiguous)) {
      const classified = await structuredCompletion({
        system:
          "Classify whether each Product Hunt launch belongs to a massive, established company that should be excluded from founder-led cold outreach. Massive means a widely recognized large enterprise or a product clearly owned by one. Do not exclude an early startup merely because it sounds professional. Return JSON with results preserving each id.",
        user: JSON.stringify(
          batch.map((launch: any) => ({
            id: launch._id,
            name: launch.name,
            tagline: launch.tagline,
            website: launch.websiteUrl,
            topics: launch.topics,
          })),
        ),
        schema: universalSchema,
        maxTokens: 3_000,
      });
      const byId = new Map(
        classified.value.results.map((result) => [result.id, result]),
      );
      assertCompleteClassification(
        batch.map((launch: any) => launch._id),
        classified.value.results.map((result) => result.id),
      );
      await ctx.runMutation(internal.pipeline.setUniversalResults, {
        results: batch.map((launch: any) => {
          const result = byId.get(launch._id);
          if (!result)
            throw new Error("Universal classification is incomplete");
          return {
            launchId: launch._id,
            eligible: !result.massive,
            reason: result.reason,
            confidence: result.confidence,
            model: classified.model,
          };
        }),
      });
    }
    await ctx.runMutation(internal.pipeline.updateStep, {
      runId: args.runId,
      name: "Universal filtering",
      status: "completed",
      counts,
    });

    const refreshed = await ctx.runQuery(
      internal.pipeline.getPipelineContext,
      args,
    );
    const union: Array<{ launch: any; projects: any[] }> = [];
    for (const launch of refreshed.launches.filter(
      (item: any) => item.universalStatus === "eligible",
    )) {
      const projects = refreshed.projects.filter(
        (project: any) =>
          coarseProjectFilter(
            {
              name: launch.name,
              tagline: launch.tagline,
              websiteUrl: launch.websiteUrl,
              topics: launch.topics,
            },
            project.exclusions,
          ).eligible,
      );
      if (projects.length) union.push({ launch, projects });
    }
    counts.eligible = union.length;
    await ctx.runMutation(internal.pipeline.updateStep, {
      runId: args.runId,
      name: "Shared enrichment",
      status: "running",
      counts,
    });
    const enriched: Array<{ launch: any; projects: any[]; enrichment: any }> =
      [];
    for (const item of union) {
      let enrichment = await ctx.runQuery(internal.pipeline.getEnrichment, {
        launchId: item.launch._id,
      });
      if (enrichment?.status !== "completed") {
        const enrichmentId = await ctx.runMutation(
          internal.pipeline.beginEnrichment,
          { launchId: item.launch._id },
        );
        try {
          const website = item.launch.websiteUrl;
          if (!website)
            throw new Error("Product Hunt did not provide a website");
          const crawled = await crawlWebsite(website);
          const sourceHashes = await Promise.all(
            crawled.pages.map(async (page) => ({
              url: page.finalUrl,
              hash: await sha256(page.content),
            })),
          );
          const emails = extractEmails(
            crawled.pages.map((page) => ({
              url: page.finalUrl,
              content: page.content,
            })),
            crawled.canonicalUrl,
          );
          const synthesis = await structuredCompletion({
            system:
              "Summarize a launched company from first-party website evidence for an outreach reviewer. State what it does, who it serves, its positioning, and concrete differentiators or proof. Be concise, neutral, and do not invent facts. Return JSON with companyContext.",
            user: crawled.pages
              .map((page) => `SOURCE ${page.finalUrl}\n${page.content}`)
              .join("\n\n---\n\n")
              .slice(0, 180_000),
            schema: contextSchema,
            maxTokens: 1_500,
          });
          await ctx.runMutation(internal.pipeline.completeEnrichment, {
            enrichmentId,
            canonicalWebsite: crawled.canonicalUrl,
            companyContext: synthesis.value.companyContext,
            pages: crawled.pages.map((page, index) => ({
              url: page.finalUrl,
              title: page.title,
              contentHash: sourceHashes[index].hash,
            })),
            emails,
            sourceHashes,
            model: synthesis.model,
          });
          enrichment = await ctx.runQuery(internal.pipeline.getEnrichment, {
            launchId: item.launch._id,
          });
          counts.enriched += 1;
        } catch (error) {
          await ctx.runMutation(internal.pipeline.failEnrichment, {
            enrichmentId,
            error: error instanceof Error ? error.message : "Enrichment failed",
          });
          counts.failed += 1;
          continue;
        }
      }
      if (enrichment?.status === "completed")
        enriched.push({ ...item, enrichment });
      await ctx.runMutation(internal.pipeline.updateStep, {
        runId: args.runId,
        name: "Shared enrichment",
        status: "running",
        counts,
      });
    }
    counts.enriched = enriched.length;
    await ctx.runMutation(internal.pipeline.updateStep, {
      runId: args.runId,
      name: "Shared enrichment",
      status: "completed",
      counts,
    });

    await ctx.runMutation(internal.pipeline.updateStep, {
      runId: args.runId,
      name: "Project matching",
      status: "running",
      counts,
    });
    const matches: Array<{
      launch: any;
      project: any;
      enrichment: any;
      reason: string;
      confidence: number;
      model: string;
    }> = [];
    for (const item of enriched) {
      for (const project of item.projects) {
        const result = await structuredCompletion({
          system:
            "Decide whether a Product Hunt launch is genuinely relevant for one sender project after applying its exclusion rules. Require a concrete audience, workflow, integration, or partnership connection. Return JSON with eligible, reason, confidence. Do not stretch for a match.",
          user: `PROJECT KNOWLEDGE:\n${project.knowledge.markdown}\n\nEXCLUSIONS:\n${JSON.stringify(project.exclusions)}\n\nLAUNCH:\n${item.launch.name}: ${item.launch.tagline}\n${item.enrichment.companyContext}`,
          schema: matchSchema,
          maxTokens: 1_000,
        });
        if (result.value.eligible)
          matches.push({
            ...item,
            project,
            reason: result.value.reason,
            confidence: result.value.confidence,
            model: result.model,
          });
      }
    }
    await ctx.runMutation(internal.pipeline.updateStep, {
      runId: args.runId,
      name: "Project matching",
      status: "completed",
      counts,
    });

    await ctx.runMutation(internal.pipeline.updateStep, {
      runId: args.runId,
      name: "Drafting",
      status: "running",
      counts,
    });
    counts.drafted = 0;
    for (const match of matches) {
      try {
        const existingCandidate = await ctx.runQuery(
          internal.pipeline.getExistingCandidate,
          {
            projectId: match.project._id,
            launchId: match.launch._id,
          },
        );
        if (
          existingCandidate &&
          (existingCandidate.knowledgeVersionId ===
            match.project.knowledge._id ||
            ["sent", "dismissed", "sending", "send_unknown"].includes(
              existingCandidate.status,
            ))
        ) {
          counts.drafted += 1;
          continue;
        }
        const draft = await generateDraft({
          project: match.project,
          launch: match.launch,
          enrichment: match.enrichment,
          matchReason: match.reason,
        });
        await ctx.runMutation(internal.pipeline.upsertCandidateAndDraft, {
          projectId: match.project._id,
          knowledgeVersionId: match.project.knowledge._id,
          launchId: match.launch._id,
          enrichmentId: match.enrichment._id,
          reason: match.reason,
          confidence: match.confidence,
          filterModel: match.model,
          sourceHashes: match.enrichment.sourceHashes.map(
            (source: any) => source.hash,
          ),
          subject: draft.subject,
          body: draft.body,
          claims: draft.claims,
          draftModel: draft.model,
        });
        counts.drafted += 1;
      } catch {
        counts.failed += 1;
      }
      await ctx.runMutation(internal.pipeline.updateStep, {
        runId: args.runId,
        name: "Drafting",
        status: "running",
        counts,
      });
    }
    const failureMessage = counts.failed
      ? `${counts.failed} launch item${counts.failed === 1 ? "" : "s"} failed and will be retried`
      : undefined;
    await ctx.runMutation(internal.pipeline.updateStep, {
      runId: args.runId,
      name: "Drafting",
      status: counts.failed ? "failed" : "completed",
      error: failureMessage,
      counts,
    });
    if (failureMessage) throw new Error(failureMessage);
  },
});
