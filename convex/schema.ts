import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const projectStatus = v.union(
  v.literal("crawling"),
  v.literal("synthesizing"),
  v.literal("ready"),
  v.literal("failed"),
);
const candidateStatus = v.union(
  v.literal("ready"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("dismissed"),
  v.literal("send_failed"),
  v.literal("send_unknown"),
  v.literal("no_contact"),
);
const runStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);
const exclusions = v.object({
  keywords: v.array(v.string()),
  domains: v.array(v.string()),
  categories: v.array(v.string()),
  notes: v.string(),
  cooldownDays: v.number(),
});
const sourceHash = v.object({ url: v.string(), hash: v.string() });
const emailEvidence = v.object({
  email: v.string(),
  evidenceUrl: v.string(),
  source: v.union(v.literal("mailto"), v.literal("content")),
  confidence: v.number(),
});

export default defineSchema({
  projects: defineTable({
    ownerId: v.string(),
    name: v.string(),
    domain: v.string(),
    founderName: v.string(),
    agentName: v.string(),
    inboxId: v.string(),
    status: projectStatus,
    knowledgeVersion: v.number(),
    activeKnowledgeVersionId: v.optional(v.id("knowledgeVersions")),
    exclusions,
    onboardingWorkflowId: v.optional(v.string()),
    knowledgeGeneration: v.optional(v.number()),
    onboardingError: v.optional(v.string()),
    nextRefreshAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_and_domain", ["ownerId", "domain"])
    .index("by_next_refresh", ["nextRefreshAt"]),

  projectPages: defineTable({
    projectId: v.id("projects"),
    url: v.string(),
    title: v.optional(v.string()),
    content: v.string(),
    storageId: v.optional(v.id("_storage")),
    contentHash: v.string(),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    fetchedAt: v.number(),
    fetchStatus: v.union(
      v.literal("ok"),
      v.literal("failed"),
      v.literal("unchanged"),
    ),
    error: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_url", ["projectId", "url"]),

  knowledgeVersions: defineTable({
    projectId: v.id("projects"),
    ownerId: v.string(),
    version: v.number(),
    markdown: v.string(),
    storageId: v.id("_storage"),
    sourceHashes: v.array(sourceHash),
    model: v.string(),
    promptVersion: v.string(),
    changeReason: v.string(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_version", ["projectId", "version"]),

  dailyRuns: defineTable({
    day: v.string(),
    status: runStatus,
    workflowId: v.optional(v.string()),
    currentStep: v.string(),
    steps: v.array(
      v.object({
        name: v.string(),
        status: v.union(
          v.literal("pending"),
          v.literal("running"),
          v.literal("completed"),
          v.literal("failed"),
        ),
        startedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        error: v.optional(v.string()),
      }),
    ),
    counts: v.object({
      fetched: v.number(),
      eligible: v.number(),
      enriched: v.number(),
      drafted: v.number(),
      failed: v.number(),
    }),
    startedBy: v.union(v.literal("cron"), v.literal("manual")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_day", ["day"])
    .index("by_started_at", ["startedAt"]),

  launches: defineTable({
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
    universalStatus: v.union(
      v.literal("pending"),
      v.literal("eligible"),
      v.literal("excluded"),
    ),
    universalReason: v.optional(v.string()),
    universalConfidence: v.optional(v.number()),
    universalModel: v.optional(v.string()),
    universalPromptVersion: v.optional(v.string()),
    postedAt: v.string(),
    sourceHash: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_product_hunt_id", ["productHuntId"])
    .index("by_day", ["day"]),

  launchEnrichments: defineTable({
    launchId: v.id("launches"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    canonicalWebsite: v.optional(v.string()),
    companyContext: v.optional(v.string()),
    pages: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        contentHash: v.string(),
      }),
    ),
    emails: v.array(emailEvidence),
    selectedEmail: v.optional(v.string()),
    selectedEmailConfidence: v.optional(v.number()),
    selectedEmailEvidenceUrl: v.optional(v.string()),
    model: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    sourceHashes: v.array(sourceHash),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_launch", ["launchId"])
    .index("by_status", ["status"]),

  projectCandidates: defineTable({
    ownerId: v.string(),
    projectId: v.id("projects"),
    launchId: v.id("launches"),
    enrichmentId: v.optional(v.id("launchEnrichments")),
    status: candidateStatus,
    matchReason: v.string(),
    matchConfidence: v.number(),
    filterModel: v.string(),
    filterPromptVersion: v.string(),
    knowledgeVersionId: v.id("knowledgeVersions"),
    sourceHashes: v.array(v.string()),
    selectedEmail: v.optional(v.string()),
    selectedEmailConfidence: v.optional(v.number()),
    selectedEmailEvidenceUrl: v.optional(v.string()),
    alternativeEmails: v.array(v.string()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_launch", ["projectId", "launchId"])
    .index("by_owner_and_status", ["ownerId", "status"]),

  drafts: defineTable({
    ownerId: v.string(),
    projectId: v.id("projects"),
    candidateId: v.id("projectCandidates"),
    version: v.number(),
    status: v.union(
      v.literal("ready"),
      v.literal("superseded"),
      v.literal("approved"),
    ),
    subject: v.string(),
    body: v.string(),
    claims: v.array(v.object({ claim: v.string(), evidenceUrl: v.string() })),
    model: v.string(),
    promptVersion: v.string(),
    knowledgeVersionId: v.id("knowledgeVersions"),
    sourceHashes: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_candidate", ["candidateId"])
    .index("by_candidate_and_status", ["candidateId", "status"]),

  sends: defineTable({
    ownerId: v.string(),
    projectId: v.id("projects"),
    candidateId: v.id("projectCandidates"),
    draftId: v.id("drafts"),
    sendId: v.string(),
    status: v.union(
      v.literal("sending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("rejected"),
      v.literal("send_failed"),
      v.literal("send_unknown"),
      v.literal("received"),
    ),
    recipient: v.string(),
    recipientDomain: v.string(),
    inboxId: v.string(),
    subject: v.string(),
    bodyHash: v.string(),
    agentMailMessageId: v.optional(v.string()),
    agentMailThreadId: v.optional(v.string()),
    providerError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_send_id", ["sendId"])
    .index("by_candidate", ["candidateId"])
    .index("by_message_id", ["agentMailMessageId"])
    .index("by_thread_id", ["agentMailThreadId"])
    .index("by_recipient_and_created", ["recipient", "createdAt"])
    .index("by_domain_and_created", ["recipientDomain", "createdAt"]),

  suppressions: defineTable({
    scope: v.union(v.literal("recipient"), v.literal("domain")),
    key: v.string(),
    reason: v.union(
      v.literal("complaint"),
      v.literal("unsubscribe"),
      v.literal("hard_bounce"),
      v.literal("manual"),
    ),
    sourceEventId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_scope_and_key", ["scope", "key"]),

  webhookEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    payloadHash: v.string(),
    providerMessageId: v.optional(v.string()),
    processedAt: v.number(),
  }).index("by_event_id", ["eventId"]),
});
