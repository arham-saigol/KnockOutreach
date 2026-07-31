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

export function isAmbiguousAgentMailStatus(status: number) {
  return status >= 500 && status <= 599;
}

export async function recoverAgentMailSendId(input: {
  inboxId: string;
  messageId: string;
}) {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(input.inboxId)}/messages/${encodeURIComponent(input.messageId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      },
    );
    if (!response.ok) return undefined;
    const value = await response.json();
    if (!value || typeof value !== "object") return undefined;
    const headers = (value as { headers?: unknown }).headers;
    if (!headers || typeof headers !== "object" || Array.isArray(headers))
      return undefined;
    const entry = Object.entries(headers).find(
      ([name, headerValue]) =>
        name.toLowerCase() === "x-knock-send-id" &&
        typeof headerValue === "string",
    );
    return entry?.[1] as string | undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
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
      const SendError = isAmbiguousAgentMailStatus(response.status)
        ? AmbiguousSendError
        : DefinitiveSendError;
      throw new SendError(
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
