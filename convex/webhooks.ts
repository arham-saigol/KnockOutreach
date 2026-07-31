import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { isDuplicateWebhook } from "../lib/core/webhook-dedup";
import { advanceDeliveryStatus } from "../lib/core/delivery-state";
import { recoverAgentMailSendId } from "./adapters/agentmail";

const deliveryStatus = v.union(
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("bounced"),
  v.literal("complained"),
  v.literal("rejected"),
  v.literal("received"),
);

export const processAgentMailEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    payloadHash: v.string(),
    status: v.optional(deliveryStatus),
    sendId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    recipient: v.optional(v.string()),
    suppressionReason: v.optional(
      v.union(
        v.literal("complaint"),
        v.literal("unsubscribe"),
        v.literal("hard_bounce"),
      ),
    ),
    suppressDomain: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (isDuplicateWebhook(existing?.eventId, args.eventId))
      return { duplicate: true, deferred: false };
    let send = args.messageId
      ? await ctx.db
          .query("sends")
          .withIndex("by_message_id", (q) =>
            q.eq("agentMailMessageId", args.messageId),
          )
          .unique()
      : null;
    if (!send && args.threadId)
      send = await ctx.db
        .query("sends")
        .withIndex("by_thread_id", (q) =>
          q.eq("agentMailThreadId", args.threadId),
        )
        .unique();
    if (!send && args.sendId)
      send = await ctx.db
        .query("sends")
        .withIndex("by_send_id", (q) => q.eq("sendId", args.sendId))
        .unique();

    if (args.recipient && args.suppressionReason) {
      const email = args.recipient.toLowerCase();
      const domain = email.includes("@") ? email.split("@")[1] : email;
      for (const item of [
        { scope: "recipient" as const, key: email },
        ...(args.suppressDomain
          ? [{ scope: "domain" as const, key: domain }]
          : []),
      ]) {
        const suppression = await ctx.db
          .query("suppressions")
          .withIndex("by_scope_and_key", (q: any) =>
            q.eq("scope", item.scope).eq("key", item.key),
          )
          .unique();
        if (!suppression)
          await ctx.db.insert("suppressions", {
            ...item,
            reason: args.suppressionReason,
            sourceEventId: args.eventId,
            createdAt: Date.now(),
          });
      }
    }

    if (args.status && !send) return { duplicate: false, deferred: true };

    await ctx.db.insert("webhookEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      payloadHash: args.payloadHash,
      providerMessageId: args.messageId,
      processedAt: Date.now(),
    });

    if (send && args.status) {
      const now = Date.now();
      const status = advanceDeliveryStatus(send.status, args.status);
      await ctx.db.patch(send._id, {
        status,
        updatedAt: now,
        deliveredAt:
          status === "delivered" && !send.deliveredAt ? now : send.deliveredAt,
      });
    }

    return { duplicate: false, deferred: false };
  },
});

const recoveryDelays = [1_000, 5_000, 30_000, 120_000, 600_000, 1_800_000];

export const recoverDeferredAgentMailEvent = internalAction({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    payloadHash: v.string(),
    status: v.optional(deliveryStatus),
    messageId: v.string(),
    threadId: v.optional(v.string()),
    inboxId: v.string(),
    recipient: v.optional(v.string()),
    suppressionReason: v.optional(
      v.union(
        v.literal("complaint"),
        v.literal("unsubscribe"),
        v.literal("hard_bounce"),
      ),
    ),
    suppressDomain: v.boolean(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const sendId = await recoverAgentMailSendId({
      inboxId: args.inboxId,
      messageId: args.messageId,
    });
    const result = sendId
      ? await ctx.runMutation(internal.webhooks.processAgentMailEvent, {
          eventId: args.eventId,
          eventType: args.eventType,
          payloadHash: args.payloadHash,
          status: args.status,
          sendId,
          messageId: args.messageId,
          threadId: args.threadId,
          recipient: args.recipient,
          suppressionReason: args.suppressionReason,
          suppressDomain: args.suppressDomain,
        })
      : { deferred: true };
    if (result.deferred && args.attempt < recoveryDelays.length)
      await ctx.scheduler.runAfter(
        recoveryDelays[args.attempt],
        internal.webhooks.recoverDeferredAgentMailEvent,
        { ...args, attempt: args.attempt + 1 },
      );
  },
});
