import { z } from "zod";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { workflow } from "./workflow";
import { crawlWebsite } from "./adapters/tinyfish";
import { structuredCompletion } from "./adapters/deepseek";
import { PROMPT_VERSIONS } from "./prompts";
import { sha256 } from "../lib/core/hashing";

export const projectOnboarding = workflow
  .define({
    args: {
      projectId: v.id("projects"),
      expectedDomain: v.string(),
      expectedGeneration: v.number(),
      refresh: v.boolean(),
    },
  })
  .handler(async (step, args): Promise<void> => {
    if (!args.refresh)
      await step.runMutation(
        internal.onboarding.setProjectStage,
        {
          projectId: args.projectId,
          expectedDomain: args.expectedDomain,
          expectedGeneration: args.expectedGeneration,
          status: "crawling",
        },
        { name: "Mark website crawl started" },
      );
    try {
      await step.runAction(internal.onboarding.crawlAndSynthesize, args, {
        name: args.refresh
          ? "Refresh website knowledge"
          : "Crawl and synthesize website",
        retry: { maxAttempts: 3, initialBackoffMs: 1_000, base: 2 },
      });
    } catch (error) {
      await step.runMutation(
        internal.onboarding.failProject,
        {
          projectId: args.projectId,
          expectedDomain: args.expectedDomain,
          expectedGeneration: args.expectedGeneration,
          refresh: args.refresh,
          error:
            error instanceof Error
              ? error.message
              : "Knowledge workflow failed",
        },
        { name: "Record recoverable failure" },
      );
    }
  });

export const getProjectContext = internalQuery({
  args: {
    projectId: v.id("projects"),
    expectedDomain: v.string(),
    expectedGeneration: v.number(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (
      !project ||
      project.domain !== args.expectedDomain ||
      (project.knowledgeGeneration ?? 0) !== args.expectedGeneration
    )
      throw new Error("Project context changed during knowledge workflow");
    const pages = await ctx.db
      .query("projectPages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const knowledge = project.activeKnowledgeVersionId
      ? await ctx.db.get(project.activeKnowledgeVersionId)
      : null;
    return { project, pages, knowledge };
  },
});

const persistedPage = v.object({
  url: v.string(),
  title: v.optional(v.string()),
  content: v.string(),
  storageId: v.optional(v.id("_storage")),
  contentHash: v.string(),
  etag: v.optional(v.string()),
  lastModified: v.optional(v.string()),
});

export const setProjectStage = internalMutation({
  args: {
    projectId: v.id("projects"),
    expectedDomain: v.string(),
    expectedGeneration: v.number(),
    status: v.union(
      v.literal("crawling"),
      v.literal("synthesizing"),
      v.literal("ready"),
    ),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (
      !project ||
      project.domain !== args.expectedDomain ||
      (project.knowledgeGeneration ?? 0) !== args.expectedGeneration
    )
      return;
    await ctx.db.patch(args.projectId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const failProject = internalMutation({
  args: {
    projectId: v.id("projects"),
    expectedDomain: v.string(),
    expectedGeneration: v.number(),
    refresh: v.boolean(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (
      !project ||
      project.domain !== args.expectedDomain ||
      (project.knowledgeGeneration ?? 0) !== args.expectedGeneration
    )
      return;
    await ctx.db.patch(args.projectId, {
      status:
        args.refresh && project.activeKnowledgeVersionId ? "ready" : "failed",
      onboardingError: args.error.slice(0, 1_000),
      updatedAt: Date.now(),
    });
  },
});

export const persistKnowledge = internalMutation({
  args: {
    projectId: v.id("projects"),
    expectedDomain: v.string(),
    expectedGeneration: v.number(),
    pages: v.array(persistedPage),
    markdown: v.optional(v.string()),
    knowledgeStorageId: v.optional(v.id("_storage")),
    sourceHashes: v.array(v.object({ url: v.string(), hash: v.string() })),
    model: v.string(),
    promptVersion: v.string(),
    changeReason: v.string(),
    meaningful: v.boolean(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (
      !project ||
      project.domain !== args.expectedDomain ||
      (project.knowledgeGeneration ?? 0) !== args.expectedGeneration
    )
      throw new Error("Project context changed during knowledge workflow");
    const now = Date.now();
    for (const page of args.pages) {
      const existing = await ctx.db
        .query("projectPages")
        .withIndex("by_project_and_url", (q: any) =>
          q.eq("projectId", args.projectId).eq("url", page.url),
        )
        .unique();
      const value = {
        projectId: args.projectId,
        ...page,
        fetchedAt: now,
        fetchStatus:
          existing?.contentHash === page.contentHash
            ? ("unchanged" as const)
            : ("ok" as const),
      };
      if (existing) {
        if (existing.storageId && existing.storageId !== page.storageId)
          await ctx.storage.delete(existing.storageId);
        await ctx.db.patch(existing._id, value);
      } else await ctx.db.insert("projectPages", value);
    }
    const currentUrls = new Set(args.pages.map((page) => page.url));
    const stalePages = await ctx.db
      .query("projectPages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const page of stalePages)
      if (!currentUrls.has(page.url)) {
        if (page.storageId) await ctx.storage.delete(page.storageId);
        await ctx.db.delete(page._id);
      }
    if (args.meaningful && args.markdown) {
      if (!args.knowledgeStorageId)
        throw new Error("Knowledge storage artifact is missing");
      const version = project.knowledgeVersion + 1;
      const knowledgeVersionId = await ctx.db.insert("knowledgeVersions", {
        projectId: args.projectId,
        ownerId: project.ownerId,
        version,
        markdown: args.markdown,
        storageId: args.knowledgeStorageId,
        sourceHashes: args.sourceHashes,
        model: args.model,
        promptVersion: args.promptVersion,
        changeReason: args.changeReason,
        createdAt: now,
      });
      await ctx.db.patch(args.projectId, {
        activeKnowledgeVersionId: knowledgeVersionId,
        knowledgeVersion: version,
        status: "ready",
        onboardingError: undefined,
        updatedAt: now,
        nextRefreshAt: now + 7 * 24 * 60 * 60 * 1000,
      });
    } else {
      await ctx.db.patch(args.projectId, {
        status: "ready",
        onboardingError: undefined,
        updatedAt: now,
        nextRefreshAt: now + 7 * 24 * 60 * 60 * 1000,
      });
    }
  },
});

const knowledgeSchema = z.object({
  markdown: z.string().min(200),
  changeReason: z.string().min(1),
});
const changeSchema = z.discriminatedUnion("meaningful", [
  z.object({
    meaningful: z.literal(true),
    reason: z.string().min(1),
    markdown: z.string().min(200),
  }),
  z.object({
    meaningful: z.literal(false),
    reason: z.string().min(1),
    markdown: z.string().optional().default(""),
  }),
]);

export const crawlAndSynthesize = internalAction({
  args: {
    projectId: v.id("projects"),
    expectedDomain: v.string(),
    expectedGeneration: v.number(),
    refresh: v.boolean(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.onboarding.getProjectContext, {
      projectId: args.projectId,
      expectedDomain: args.expectedDomain,
      expectedGeneration: args.expectedGeneration,
    });
    const { canonicalUrl, pages } = await crawlWebsite(context.project.domain);
    const sourceHeaders = pages.map(
      (page) => `SOURCE: ${page.finalUrl}\nTITLE: ${page.title ?? ""}\n`,
    );
    const separatorLength = Math.max(0, pages.length - 1) * 7;
    const sourceContentLimit = Math.max(
      0,
      Math.min(
        60_000,
        Math.floor(
          (260_000 -
            separatorLength -
            sourceHeaders.reduce((total, header) => total + header.length, 0)) /
            Math.max(1, pages.length),
        ),
      ),
    );
    const prepared = await Promise.all(
      pages.map(async (page) => {
        const content = page.content.slice(0, sourceContentLimit);
        const contentHash = await sha256(content);
        const existing = context.pages.find(
          (saved: any) =>
            saved.url === page.finalUrl && saved.contentHash === contentHash,
        );
        const storageId =
          existing?.storageId ??
          (await ctx.storage.store(
            new Blob([content], { type: "text/markdown; charset=utf-8" }),
          ));
        return {
          url: page.finalUrl,
          title: page.title,
          content,
          storageId,
          contentHash,
          etag: page.etag,
          lastModified: page.lastModified,
        };
      }),
    );
    const sourceHashes = prepared.map((page) => ({
      url: page.url,
      hash: page.contentHash,
    }));
    const previousHashes = new Map(
      context.pages.map((page: any) => [page.url, page.contentHash]),
    );
    const hashesChanged =
      prepared.some(
        (page) => previousHashes.get(page.url) !== page.contentHash,
      ) || prepared.length !== context.pages.length;

    if (!args.refresh)
      await ctx.runMutation(internal.onboarding.setProjectStage, {
        projectId: args.projectId,
        expectedDomain: args.expectedDomain,
        expectedGeneration: args.expectedGeneration,
        status: "synthesizing",
      });
    const sourceDocument = prepared
      .map(
        (page) =>
          `SOURCE: ${page.url}\nTITLE: ${page.title ?? ""}\n${page.content}`,
      )
      .join("\n\n---\n\n");
    let markdown: string | undefined;
    let changeReason: string;
    let meaningful = true;
    let model: string;
    let promptVersion: string;

    if (args.refresh && context.knowledge && !hashesChanged) {
      meaningful = false;
      changeReason = "Source hashes are unchanged";
      model = "deterministic-hash-check";
      promptVersion = PROMPT_VERSIONS.knowledgeChange;
    } else if (args.refresh && context.knowledge) {
      const result = await structuredCompletion({
        system:
          "Compare a versioned project knowledge base with newly fetched first-party sources. A meaningful change affects product, audience, positioning, capabilities, proof, differentiators, or writing voice. Return JSON with meaningful, reason, and a complete replacement Markdown knowledge base when meaningful; markdown may be empty otherwise.",
        user: `CURRENT KNOWLEDGE:\n${context.knowledge.markdown}\n\nNEW SOURCES:\n${sourceDocument}`,
        schema: changeSchema,
        maxTokens: 7_000,
      });
      meaningful = result.value.meaningful;
      markdown = result.value.markdown || undefined;
      changeReason = result.value.reason;
      model = result.model;
      promptVersion = PROMPT_VERSIONS.knowledgeChange;
    } else {
      const result = await structuredCompletion({
        system:
          "Synthesize a comprehensive versioned Markdown knowledge base from first-party website sources. Cover product, target audience, positioning, capabilities, proof points, differentiators, constraints, terminology, and observed writing voice. Separate facts from inference and cite every factual section with source URLs. Do not invent missing facts. Return JSON with markdown and changeReason.",
        user: `PROJECT: ${context.project.name}\nCANONICAL DOMAIN: ${canonicalUrl}\nFOUNDER: ${context.project.founderName}\n\nSOURCES:\n${sourceDocument}`,
        schema: knowledgeSchema,
        maxTokens: 8_000,
      });
      markdown = result.value.markdown;
      changeReason = result.value.changeReason;
      model = result.model;
      promptVersion = PROMPT_VERSIONS.knowledge;
    }
    const knowledgeStorageId =
      meaningful && markdown
        ? await ctx.storage.store(
            new Blob([markdown], { type: "text/markdown; charset=utf-8" }),
          )
        : undefined;
    await ctx.runMutation(internal.onboarding.persistKnowledge, {
      projectId: args.projectId,
      expectedDomain: args.expectedDomain,
      expectedGeneration: args.expectedGeneration,
      pages: prepared,
      markdown,
      knowledgeStorageId,
      sourceHashes,
      model,
      promptVersion,
      changeReason,
      meaningful,
    });
  },
});
