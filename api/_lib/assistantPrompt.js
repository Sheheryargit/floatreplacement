const ALLOWED_ACTION_IDS = [
  "navigate",
  "apply_schedule_filters",
  "clear_schedule_filters",
  "apply_people_filters",
  "apply_projects_filters",
  "open_command_palette",
  "highlight_control",
];

const SYSTEM_PROMPT = `You are Alloc8 Assistant — an embedded product expert inside a workforce scheduling platform.

Rules:
- Explain in plain business language. Never mention code, APIs, SQL, or technical internals.
- Ground answers in the provided knowledge snippets and the user's current screen context.
- If you are unsure, ask one short clarifying question.
- Keep answers concise (2–4 short paragraphs max unless the user asks for detail).

When the user asks to show, filter, navigate, or clear something, apply it immediately:
- Include ACTION_JSON on the same turn — do not ask "would you like me to proceed?" or wait for confirmation.
- Briefly confirm what you did in plain language (e.g. "Showing Fire Nation on the schedule now.").

When the user only asks a question (no action requested), answer without ACTION_JSON.

Append ACTION_JSON on its own line when executing an action:
ACTION_JSON: {"actionId":"...","params":{...}}

Allowed actionId values: ${ALLOWED_ACTION_IDS.join(", ")}.

Examples:
- Show Fire Nation department on schedule → {"actionId":"apply_schedule_filters","params":{"departments":["Fire Nation"]}}
- Show contractors on schedule → {"actionId":"apply_schedule_filters","params":{"personType":["Contractor"]}}
- Go to people → {"actionId":"navigate","params":{"page":"people"}}
- Clear filters → {"actionId":"clear_schedule_filters","params":{}}

Only include ACTION_JSON when an action is clearly requested. Do not include ACTION_JSON for pure questions.`;

export function buildMessages({ question, context, history, retrieved }) {
  const knowledge = (retrieved || [])
    .map((r, i) => `[${i + 1}] ${r.title || "Doc"} (${r.feature_area || "general"})\n${r.chunk}`)
    .join("\n\n");

  const contextBlock = JSON.stringify(context, null, 2);

  const userContent = [
    `Current UI context:\n${contextBlock}`,
    knowledge ? `Relevant product knowledge:\n${knowledge}` : "No knowledge base hits for this question.",
    `User question: ${question}`,
  ].join("\n\n");

  const msgs = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const h of history || []) {
    if (h?.role === "user" || h?.role === "assistant") {
      msgs.push({ role: h.role, content: String(h.content || "").slice(0, 4000) });
    }
  }
  msgs.push({ role: "user", content: userContent });
  return msgs;
}

/** Extract optional ACTION_JSON from model output. */
export function parseActionFromText(text) {
  const match = String(text || "").match(/ACTION_JSON:\s*(\{[\s\S]*?\})\s*$/m);
  if (!match) return { cleanText: text, action: null };
  try {
    const action = JSON.parse(match[1]);
    const cleanText = text.replace(match[0], "").trim();
    return { cleanText, action };
  } catch {
    return { cleanText: text, action: null };
  }
}

/** Local fallback when OpenAI is not configured — still useful for demos. */
export function localFallbackAnswer(question, context) {
  const q = String(question || "").toLowerCase();
  let text = "";
  let action = null;

  if (q.includes("tag")) {
    text =
      "Tags help you group and find people or projects quickly.\n\n" +
      "Person tags label individuals (for example “urgent” or “bench”). " +
      "Project tags label engagements. On the schedule, you can filter by person tag to focus the timeline.\n\n" +
      "Try opening Filters on the schedule and choosing Person tag.";
  } else if (
    q.includes("fire nation") ||
    q.includes("firenation") ||
    (q.includes("department") && q.includes("fire"))
  ) {
    text =
      "Showing Fire Nation on the schedule.";
    action = { actionId: "apply_schedule_filters", params: { departments: ["Fire Nation"] } };
  } else if (q.includes("contractor") || q.includes("show contractor")) {
    text =
      "I can filter the schedule to people marked as Contractor. " +
      "You'll still only see rows that have allocations in your current date range.";
    action = { actionId: "apply_schedule_filters", params: { personType: ["Contractor"] } };
  } else if (q.includes("why") && (q.includes("see") || q.includes("result") || q.includes("empty"))) {
    const filters = context?.schedule?.activeFilterCount || 0;
    const empty = context?.pageState?.emptyResults;
    if (filters > 0 && empty) {
      text =
        "It looks like active filters may be hiding everyone on screen. " +
        `You have ${filters} schedule filter rule(s) applied, and no people match right now.\n\n` +
        "Try clearing filters or widening the date range. I can clear schedule filters if you'd like.";
      action = { actionId: "highlight_control", params: { target: "schedule-filter", message: "Open Filters here" } };
    } else {
      text =
        "A few common reasons nothing shows up:\n\n" +
        "• Schedule filters are narrowing the list\n" +
        "• The date range doesn't include any allocations for those people\n" +
        "• People are archived or marked as placeholders\n\n" +
        "Tell me who you're looking for and I can help set the right filters.";
    }
  } else if (q.includes("people") && (q.includes("go") || q.includes("open") || q.includes("show"))) {
    text = "Opening the People directory for you.";
    action = { actionId: "navigate", params: { page: "people" } };
  } else {
    text =
      "I'm running in local demo mode (no OpenAI key configured). " +
      "I can still help with tags, schedule filters, contractors, and navigation.\n\n" +
      "Try: “What do tags do?”, “Show Fire Nation department”, or “Why can't I see results?”";
  }

  return { text, action };
}
