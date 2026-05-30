import { createClient } from "@supabase/supabase-js";
import { supabaseAdminConfig } from "./env.js";

let client = null;

export function getSupabaseAdmin() {
  const { url, key, configured } = supabaseAdminConfig();
  if (!configured) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Similarity search against ingested assistant docs. Returns [] when unavailable. */
export async function retrieveAssistantDocs(question, matchCount = 5) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  const { embedText } = await import("./openai.js");
  const embedding = await embedText(question);
  if (!embedding) return [];

  const { data, error } = await admin.rpc("match_assistant_docs", {
    query_embedding: embedding,
    match_count: matchCount,
  });
  if (error) {
    console.warn("[assistant] retrieval:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}
