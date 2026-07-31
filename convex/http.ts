import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifySvixSignature } from "../lib/core/svix";
import { sha256 } from "../lib/core/hashing";
import { normalizeEmail } from "../lib/core/normalization";
import { recoverAgentMailSendId } from "./adapters/agentmail";

const http = httpRouter();

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object"
    ? (value as Record<string, any>)
    : {};
}

function firstString(...values: unknown[]) {
  return values.find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

http.route({
  path: "/agentmail/webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const messageIdHeader = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (!secret || !messageIdHeader || !timestamp || !signature)
      return new Response("Missing signature", { status: 400 });
    const valid = await verifySvixSignature({
      secret,
      payload: rawBody,
      messageId: messageIdHeader,
      timestamp,
      signature,
    });
    if (!valid) return new Response("Invalid signature", { status: 400 });

    let payload: Record<string, any>;
    try {
      payload = object(JSON.parse(rawBody));
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    const eventType =
      firstString(payload.event_type, payload.type) ?? "unknown";
    const eventId = firstString(payload.event_id, messageIdHeader)!;
    const eventObject = object(
      payload.message ??
        payload.send ??
        payload.delivery ??
        payload.bounce ??
        payload.complaint ??
        payload.reject ??
        payload.rejection,
    );
    const providerMessageId = firstString(
      eventObject.message_id,
      payload.message_id,
    );
    const inboxId = firstString(eventObject.inbox_id, payload.inbox_id);
    const threadId = firstString(eventObject.thread_id, payload.thread_id);
    const rawRecipient = firstString(
      eventObject.recipient,
      Array.isArray(eventObject.recipients)
        ? eventObject.recipients[0]
        : undefined,
      Array.isArray(eventObject.to) ? eventObject.to[0] : undefined,
      eventObject.to,
      eventObject.from,
    );
    const recipient = rawRecipient
      ? (normalizeEmail(rawRecipient) ?? undefined)
      : undefined;
    const eventStatus =
      eventType === "message.sent"
        ? "sent"
        : eventType === "message.delivered"
          ? "delivered"
          : eventType === "message.bounced"
            ? "bounced"
            : eventType === "message.complained"
              ? "complained"
              : eventType === "message.rejected"
                ? "rejected"
                : eventType === "message.received"
                  ? "received"
                  : undefined;
    const bounceKind = String(
      eventObject.type ?? eventObject.bounce_type ?? eventObject.category ?? "",
    ).toLowerCase();
    const suppressionReason =
      eventType === "message.complained"
        ? "complaint"
        : eventType === "message.unsubscribed"
          ? "unsubscribe"
          : eventType === "message.bounced" &&
              /hard|permanent|invalid/.test(bounceKind)
            ? "hard_bounce"
            : undefined;
    const suppressDomain =
      suppressionReason === "complaint" ||
      (suppressionReason === "hard_bounce" && /domain/.test(bounceKind));

    const eventArgs = {
      eventId,
      eventType,
      payloadHash: await sha256(rawBody),
      status: eventStatus,
      messageId: providerMessageId,
      threadId,
      recipient,
      suppressionReason,
      suppressDomain,
    };
    let result = await ctx.runMutation(
      internal.webhooks.processAgentMailEvent,
      eventArgs,
    );
    if (result.deferred && inboxId && providerMessageId) {
      const sendId = await recoverAgentMailSendId({
        inboxId,
        messageId: providerMessageId,
      });
      if (sendId)
        result = await ctx.runMutation(
          internal.webhooks.processAgentMailEvent,
          { ...eventArgs, sendId },
        );
    }
    if (result.deferred)
      return new Response("Send receipt not yet correlated", {
        status: 503,
        headers: { "Retry-After": "1" },
      });
    return new Response(null, { status: 204 });
  }),
});

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => new Response("ok", { status: 200 })),
});

export default http;
