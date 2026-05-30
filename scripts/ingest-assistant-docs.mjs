#!/usr/bin/env node
/**
 * Ingest docs/assistant/*.md into Supabase assistant_docs + embeddings.
 *
 * Requires:
 *   OPENAI_API_KEY
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: npm run assistant:ingest
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs", "assistant");

function env(name) {
  return (process.env[name] || "").trim();
}

function chunkText(text, size = 700, overlap = 80) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(" "));
    if (i + size >= words.length) break;
  }
  return chunks.filter(Boolean);
}

async function embed(text) {
  const key = env("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is required");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json?.data?.[0]?.embedding;
}

async function main() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!existsSync(docsDir)) {
    console.error("No docs/assistant/ folder found");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const files = readdirSync(docsDir).filter((f) => f.endsWith(".md"));
  console.log(`Ingesting ${files.length} doc(s)…`);

  for (const file of files) {
    const full = readFileSync(path.join(docsDir, file), "utf8");
    const title = full.split("\n").find((l) => l.startsWith("# "))?.slice(2) || file;
    const featureArea = file.replace(/\.md$/, "");

    const { data: docRow, error: docErr } = await supabase
      .from("assistant_docs")
      .upsert({ title, content: full, feature_area: featureArea }, { onConflict: "title" })
      .select("id")
      .single();

    if (docErr) {
      // title may not be unique constraint — insert fresh
      const { data: inserted, error: insErr } = await supabase
        .from("assistant_docs")
        .insert({ title, content: full, feature_area: featureArea })
        .select("id")
        .single();
      if (insErr) {
        console.error(`Failed ${file}:`, insErr.message);
        continue;
      }
      var docId = inserted.id;
    } else {
      var docId = docRow.id;
    }

    await supabase.from("assistant_doc_embeddings").delete().eq("doc_id", docId);

    const chunks = chunkText(full);
    for (const chunk of chunks) {
      const embedding = await embed(chunk);
      const { error } = await supabase.from("assistant_doc_embeddings").insert({
        doc_id: docId,
        chunk,
        embedding,
      });
      if (error) console.error(`  chunk error:`, error.message);
    }
    console.log(`  ✓ ${file} (${chunks.length} chunks)`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
