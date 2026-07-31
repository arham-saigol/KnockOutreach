import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { isDuplicateWebhook } from "../lib/core/webhook-dedup";

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
      return { duplicate: true };
    await ctx.db.insert("webhookEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      payloadHash: args.payloadHash,
      providerMessageId: args.messageId,
      processedAt: Date.now(),
    });

    const send = args.messageId
      ? await ctx.db
          .query("sends")
          .withIndex("by_message_id", (q) =>
            q.eq("agentMailMessageId", args.messageId),
          )
          .unique()
      : args.threadId
        ? await ctx.db
            .query("sends")
            .withIndex("by_thread_id", (q) =>
              q.eq("agentMailThreadId", args.threadId),
            )
            .unique()
        : null;
    if (send && args.status) {
      const now = Date.now();
      await ctx.db.patch(send._id, {
        status: args.status,
        updatedAt: now,
        deliveredAt: args.status === "delivered" ? now : send.deliveredAt,
      });
    }

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
    return { duplicate: false };
  },
});
