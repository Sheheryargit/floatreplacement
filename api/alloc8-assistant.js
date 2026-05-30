import { hasOpenAiKey } from "./_lib/env.js";
import { authorizeAssistantRequest } from "./_lib/authorizeAssistant.js";
import { streamChatCompletion } from "./_lib/openai.js";
import { retrieveAssistantDocs } from "./_lib/supabaseAdmin.js";
import {
  buildMessages,
  parseActionFromText,
  localFallbackAnswer,
} from "./_lib/assistantPrompt.js";

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

/** Minimal auth: SSO workspace admin, or dev bypass with admin role in context. */
async function authorize(req, context) {
  return authorizeAssistantRequest(req, context);
}

/**
 * Core assistant handler — used by Vercel serverless and the Vite dev middleware.
 * @param {import('http').IncomingMessage & { body?: object }} req
 * @param {import('http').ServerResponse} res
 */
export async function handleAlloc8Assistant(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const auth = await authorize(req, body.context || {});
  if (!auth.ok) {
    res.statusCode = auth.status || 401;
    res.end(JSON.stringify({ error: auth.error || "Unauthorized" }));
    return;
  }

  const question = String(body.question || "").trim();
  const context = body.context || {};
  const history = Array.isArray(body.history) ? body.history : [];

  if (!question) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Missing question" }));
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  let retrieved = [];
  try {
    retrieved = await retrieveAssistantDocs(question);
  } catch {
    /* retrieval is optional */
  }

  const emit = (payload) => writeSse(res, payload);

  try {
    if (hasOpenAiKey()) {
      const messages = buildMessages({ question, context, history, retrieved });
      let raw = "";
      raw = await streamChatCompletion(messages, (token) => {
        emit({ type: "token", text: token });
      });

      const { cleanText, action } = parseActionFromText(raw || "");
      if (cleanText && cleanText !== raw) {
        // If we stripped ACTION_JSON from streamed text, the client already got tokens — fine.
      }
      if (action?.actionId) {
        emit({ type: "action_proposal", ...action });
      }
    } else {
      const { text, action } = localFallbackAnswer(question, context);
      // Simulate streaming for nicer UX in demo mode.
      for (let i = 0; i < text.length; i += 8) {
        emit({ type: "token", text: text.slice(i, i + 8) });
      }
      if (action?.actionId) {
        emit({ type: "action_proposal", ...action });
      }
    }
    emit({ type: "done" });
  } catch (err) {
    emit({ type: "error", message: err?.message || "Assistant error" });
    emit({ type: "done" });
  }

  res.end();
}

export default handleAlloc8Assistant;
