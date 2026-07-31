import { z } from "zod";

const sendResponseSchema = z.object({
  message_id: z.string(),
  thread_id: z.string(),
});

export class AmbiguousSendError extends Error {
  override name = "AmbiguousSendError";
}

export class DefinitiveSendError extends Error {
  override name = "DefinitiveSendError";
}

export async function sendAgentMail(input: {
  inboxId: string;
  to: string;
  subject: string;
  text: string;
  sendId: string;
}) {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey)
    throw new DefinitiveSendError("Missing AGENTMAIL_API_KEY in Convex Cloud");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    let response: Response;
    try {
      response = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(input.inboxId)}/messages/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": input.sendId,
          },
          body: JSON.stringify({
            to: [input.to],
            subject: input.subject,
            text: input.text,
            headers: { "X-Knock-Send-Id": input.sendId },
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      throw new AmbiguousSendError(
        error instanceof Error
          ? error.message
          : "AgentMail connection ended without a response",
      );
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new DefinitiveSendError(
        `AgentMail rejected the send (${response.status}): ${detail}`,
      );
    }
    try {
      return sendResponseSchema.parse(await response.json());
    } catch {
      throw new AmbiguousSendError(
        "AgentMail accepted the request but returned an unreadable receipt",
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}
