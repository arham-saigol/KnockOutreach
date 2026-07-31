import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { sendAgentMail, AmbiguousSendError } from "./adapters/agentmail";
import { normalizeEmail } from "../lib/core/normalization";
import { sha256 } from "../lib/core/hashing";
import { assertCandidateTransition } from "../lib/core/state-machine";
import { hasConflictingSend } from "../lib/core/send-policy";
import { assertInboxOwnership } from "../lib/core/inbox-ownership";
import { advanceDeliveryStatus } from "../lib/core/delivery-state";
import { draftMatchesSenderIdentity } from "../lib/core/draft-freshness";

const bannedPhrases = [
  "i hope this finds you well",
  "game-changer",
  "revolutionary",
  "unlock",
  "leverage",
  "seamless",
  "delve",
  "excited to",
];

function validateApprovedDraft(subject: string, body: string) {
  const words = body.trim().split(/\s+/).length;
  if (!subject.trim() || /[\r\n]/.test(subject))
    throw new Error("Add a valid single-line subject.");
  if (words < 60 || words > 110)
    throw new Error(`Email body must be 60–110 words (currently ${words}).`);
  const banned = bannedPhrases.find((phrase) =>
    body.toLowerCase().includes(phrase),
  );
  if (banned || /—|^\s*[-*•]\s/m.test(body))
    throw new Error(
      "The edited email contains disallowed wording or formatting.",
    );
}

export const prepareSend = internalMutation({
  args: {
    candidateId: v.id("projectCandidates"),
    ownerId: v.string(),
    subject: v.string(),
    body: v.string(),
    bodyHash: v.string(),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate || candidate.ownerId !== args.ownerId)
      throw new Error("Candidate not found");
    assertCandidateTransition(candidate.status, "sending");
    validateApprovedDraft(args.subject, args.body);
    const project = await ctx.db.get(candidate.projectId);
    if (!project) throw new Error("Project not found");
    if (
      project.status !== "ready" ||
      candidate.knowledgeVersionId !== project.activeKnowledgeVersionId
    )
      throw new Error("This candidate uses an inactive knowledge version.");
    assertInboxOwnership(candidate.ownerId, project.inboxId);
    const recipient = candidate.selectedEmail
      ? normalizeEmail(candidate.selectedEmail)
      : null;
    if (!recipient)
      throw new Error("No evidence-backed recipient is available.");
    const recipientDomain = recipient.split("@")[1];
    const recipientSuppression = await ctx.db
      .query("suppressions")
      .withIndex("by_scope_and_key", (q: any) =>
        q.eq("scope", "recipient").eq("key", recipient),
      )
      .unique();
    const domainSuppression = await ctx.db
      .query("suppressions")
      .withIndex("by_scope_and_key", (q: any) =>
        q.eq("scope", "domain").eq("key", recipientDomain),
      )
      .unique();
    if (recipientSuppression || domainSuppression)
      throw new Error("This recipient or domain is globally suppressed.");

    const cooldownStart =
      Date.now() - project.exclusions.cooldownDays * 24 * 60 * 60 * 1000;
    const recipientContacts = await ctx.db
      .query("sends")
      .withIndex("by_recipient_and_created", (q: any) =>
        q.eq("recipient", recipient).gte("createdAt", cooldownStart),
      )
      .collect();
    const domainContacts = await ctx.db
      .query("sends")
      .withIndex("by_domain_and_created", (q: any) =>
        q
          .eq("recipientDomain", recipientDomain)
          .gte("createdAt", cooldownStart),
      )
      .collect();
    if (hasConflictingSend([...recipientContacts, ...domainContacts]))
      throw new Error(
        `A Knock project contacted this recipient or domain within the ${project.exclusions.cooldownDays}-day cooldown.`,
      );

    const prior = await ctx.db
      .query("sends")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .collect();
    if (hasConflictingSend(prior))
      throw new Error(
        "This candidate already has an active or completed send.",
      );
    const draft = await ctx.db
      .query("drafts")
      .withIndex("by_candidate_and_status", (q: any) =>
        q.eq("candidateId", args.candidateId).eq("status", "ready"),
      )
      .unique();
    if (!draft)
      throw new Error("The current draft is no longer ready to send.");
    if (!draftMatchesSenderIdentity(draft, project))
      throw new Error(
        "The sender identity changed after this draft was generated. Regenerate it before sending.",
      );

    const now = Date.now();
    const sendId = `knock_${String(args.candidateId)}_${now}`;
    await ctx.db.patch(draft._id, {
      subject: args.subject.trim(),
      body: args.body.trim(),
      status: "approved",
      updatedAt: now,
    });
    const sendRecordId = await ctx.db.insert("sends", {
      ownerId: candidate.ownerId,
      projectId: candidate.projectId,
      candidateId: candidate._id,
      draftId: draft._id,
      sendId,
      status: "sending",
      recipient,
      recipientDomain,
      inboxId: project.inboxId,
      subject: args.subject.trim(),
      bodyHash: args.bodyHash,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(candidate._id, {
      status: "sending",
      error: undefined,
      updatedAt: now,
    });
    return {
      sendRecordId,
      sendId,
      inboxId: project.inboxId,
      recipient,
      subject: args.subject.trim(),
      body: args.body.trim(),
    };
  },
});

export const completeSend = internalMutation({
  args: {
    sendRecordId: v.id("sends"),
    messageId: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const send = await ctx.db.get(args.sendRecordId);
    if (!send) return;
    const now = Date.now();
    const status = advanceDeliveryStatus(send.status, "sent");
    await ctx.db.patch(send._id, {
      status,
      agentMailMessageId: args.messageId,
      agentMailThreadId: args.threadId,
      sentAt: send.sentAt ?? now,
      updatedAt: now,
    });
    const candidate = await ctx.db.get(send.candidateId);
    if (candidate?.status === "sending")
      await ctx.db.patch(send.candidateId, {
        status: "sent",
        completedAt: now,
        updatedAt: now,
        error: undefined,
      });
  },
});

export const failSend = internalMutation({
  args: {
    sendRecordId: v.id("sends"),
    ambiguous: v.boolean(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const send = await ctx.db.get(args.sendRecordId);
    if (!send || send.status !== "sending") return;
    const status = args.ambiguous
      ? ("send_unknown" as const)
      : ("send_failed" as const);
    const now = Date.now();
    await ctx.db.patch(send._id, {
      status,
      providerError: args.error.slice(0, 1_000),
      updatedAt: now,
    });
    await ctx.db.patch(send.candidateId, {
      status,
      error: args.error.slice(0, 1_000),
      completedAt: args.ambiguous ? now : undefined,
      updatedAt: now,
    });
    if (!args.ambiguous)
      await ctx.db.patch(send.draftId, { status: "ready", updatedAt: now });
  },
});

export const sendApproved = action({
  args: {
    candidateId: v.id("projectCandidates"),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const bodyHash = await sha256(args.body);
    const prepared = await ctx.runMutation(internal.sending.prepareSend, {
      ...args,
      ownerId: identity.subject,
      bodyHash,
    });
    try {
      const response = await sendAgentMail({
        inboxId: prepared.inboxId,
        to: prepared.recipient,
        subject: prepared.subject,
        text: prepared.body,
        sendId: prepared.sendId,
      });
      await ctx.runMutation(internal.sending.completeSend, {
        sendRecordId: prepared.sendRecordId,
        messageId: response.message_id,
        threadId: response.thread_id,
      });
      return response;
    } catch (error) {
      const ambiguous = error instanceof AmbiguousSendError;
      await ctx.runMutation(internal.sending.failSend, {
        sendRecordId: prepared.sendRecordId,
        ambiguous,
        error: error instanceof Error ? error.message : "AgentMail send failed",
      });
      if (ambiguous)
        throw new Error(
          "AgentMail did not return a definitive result. This send is marked unknown and will not be retried automatically.",
        );
      throw error;
    }
  },
});
