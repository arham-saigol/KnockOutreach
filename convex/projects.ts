import { start } from "@convex-dev/workflow";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireIdentity, requireProject } from "./lib/auth";
import { normalizeUrl } from "../lib/core/normalization";

const exclusionsValidator = v.object({
  keywords: v.array(v.string()),
  domains: v.array(v.string()),
  categories: v.array(v.string()),
  notes: v.string(),
  cooldownDays: v.number(),
});

function projectView(project: any) {
  return {
    id: project._id,
    name: project.name,
    domain: project.domain,
    founderName: project.founderName,
    agentName: project.agentName,
    inboxId: project.inboxId,
    status: project.status,
    knowledgeVersion: project.knowledgeVersion,
    exclusions: project.exclusions,
    onboardingError: project.onboardingError,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect();
    return projects.map(projectView);
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) =>
    projectView((await requireProject(ctx, args.projectId)).project),
});

export const create = mutation({
  args: {
    name: v.string(),
    domain: v.string(),
    founderName: v.string(),
    agentName: v.string(),
    inboxId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const domain = normalizeUrl(args.domain);
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_owner_and_domain", (q: any) =>
        q.eq("ownerId", identity.subject).eq("domain", domain),
      )
      .unique();
    if (existing) throw new Error("A project for this domain already exists.");
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      ownerId: identity.subject,
      name: args.name.trim(),
      domain,
      founderName: args.founderName.trim(),
      agentName: args.agentName.trim(),
      inboxId: args.inboxId.trim(),
      status: "crawling",
      knowledgeVersion: 0,
      exclusions: {
        keywords: [],
        domains: [],
        categories: [],
        notes: "",
        cooldownDays: Number(process.env.CONTACT_COOLDOWN_DAYS ?? 90),
      },
      nextRefreshAt: now + 7 * 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    });
    const workflowId = await start(ctx, internal.onboarding.projectOnboarding, {
      projectId,
      expectedDomain: domain,
      refresh: false,
    });
    await ctx.db.patch(projectId, { onboardingWorkflowId: workflowId });
    return projectId;
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    domain: v.string(),
    founderName: v.string(),
    agentName: v.string(),
    inboxId: v.string(),
    exclusions: exclusionsValidator,
  },
  handler: async (ctx, args) => {
    const { identity, project } = await requireProject(ctx, args.projectId);
    const domain = normalizeUrl(args.domain);
    const domainChanged = domain !== project.domain;
    if (domainChanged) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_owner_and_domain", (q: any) =>
          q.eq("ownerId", identity.subject).eq("domain", domain),
        )
        .unique();
      if (existing && existing._id !== args.projectId)
        throw new Error("A project for this domain already exists.");
    }
    await ctx.db.patch(args.projectId, {
      name: args.name.trim(),
      domain,
      founderName: args.founderName.trim(),
      agentName: args.agentName.trim(),
      inboxId: args.inboxId.trim(),
      exclusions: {
        ...args.exclusions,
        cooldownDays: Math.max(1, Math.min(730, args.exclusions.cooldownDays)),
      },
      ...(domainChanged
        ? { status: "crawling" as const, onboardingError: undefined }
        : {}),
      updatedAt: Date.now(),
    });
    if (domainChanged) {
      const workflowId = await start(
        ctx,
        internal.onboarding.projectOnboarding,
        { projectId: args.projectId, expectedDomain: domain, refresh: false },
      );
      await ctx.db.patch(args.projectId, { onboardingWorkflowId: workflowId });
    }
  },
});

export const retryOnboarding = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { project } = await requireProject(ctx, args.projectId);
    await ctx.db.patch(args.projectId, {
      status: "crawling",
      onboardingError: undefined,
      updatedAt: Date.now(),
    });
    const workflowId = await start(ctx, internal.onboarding.projectOnboarding, {
      projectId: args.projectId,
      expectedDomain: project.domain,
      refresh: false,
    });
    await ctx.db.patch(args.projectId, { onboardingWorkflowId: workflowId });
  },
});

export const startDueRefreshes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("projects")
      .withIndex("by_next_refresh", (q) => q.lte("nextRefreshAt", now))
      .take(20);
    for (const project of due) {
      const workflowId = await start(
        ctx,
        internal.onboarding.projectOnboarding,
        {
          projectId: project._id,
          expectedDomain: project.domain,
          refresh: true,
        },
      );
      await ctx.db.patch(project._id, {
        onboardingWorkflowId: workflowId,
        nextRefreshAt: now + 7 * 24 * 60 * 60 * 1000,
      });
    }
  },
});

export const refreshKnowledge = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { project } = await requireProject(ctx, args.projectId);
    const workflowId = await start(ctx, internal.onboarding.projectOnboarding, {
      projectId: args.projectId,
      expectedDomain: project.domain,
      refresh: true,
    });
    await ctx.db.patch(args.projectId, {
      onboardingWorkflowId: workflowId,
      nextRefreshAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    return workflowId;
  },
});
