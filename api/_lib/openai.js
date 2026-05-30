import { readEnv, hasOpenAiKey } from "./env.js";

const OPENAI_BASE = "https://api.openai.com/v1";

export async function embedText(text) {
  if (!hasOpenAiKey()) return null;
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${readEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: String(text).slice(0, 8000),
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings failed (${res.status}): ${err.slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.data?.[0]?.embedding || null;
}

/**
 * Stream chat completion tokens. Calls `onToken(text)` for each delta.
 * Returns the full collected assistant text.
 */
export async function streamChatCompletion(messages, onToken) {
  if (!hasOpenAiKey()) return null;

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${readEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: readEnv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
      messages,
      stream: true,
      temperature: 0.35,
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI chat failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length) {
          full += delta;
          onToken(delta);
        }
      } catch {
        /* ignore */
      }
    }
  }

  return full;
}
