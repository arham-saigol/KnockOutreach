import { z } from "zod";

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

const completionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().min(1) }) }))
    .min(1),
  model: z.string().optional(),
});

export async function structuredCompletion<T>(input: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<{ value: T; model: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY in Convex Cloud");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content: `${input.system}\nReturn one JSON object only. The response must be valid JSON.`,
          },
          { role: "user", content: input.user },
        ],
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature: 0.25,
        max_tokens: input.maxTokens ?? 3_000,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(
        `DeepSeek request failed (${response.status}): ${detail}`,
      );
    }
    const completion = completionSchema.parse(await response.json());
    let json: unknown;
    try {
      json = JSON.parse(completion.choices[0].message.content);
    } catch {
      throw new Error("DeepSeek returned malformed JSON");
    }
    return {
      value: input.schema.parse(json),
      model: completion.model ?? DEEPSEEK_MODEL,
    };
  } finally {
    clearTimeout(timeout);
  }
}
