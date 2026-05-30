/** Server-side env (never import from src/ — keeps secrets out of the browser bundle). */

export function readEnv(name, fallback = "") {
  const v = process.env[name];
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export function hasOpenAiKey() {
  return Boolean(readEnv("OPENAI_API_KEY"));
}

export function isAssistantDevBypass() {
  return readEnv("ASSISTANT_DEV_BYPASS", "true") === "true";
}

export function supabaseAdminConfig() {
  const url = readEnv("SUPABASE_URL") || readEnv("VITE_SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { url, key, configured: Boolean(url && key) };
}
