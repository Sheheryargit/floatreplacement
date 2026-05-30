import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { assistantDevApiPlugin } from "./scripts/assistant-dev-api-plugin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), assistantDevApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    // Ensure browser never reuses stale JS/CSS while developing.
    headers: {
      "Cache-Control": "no-store",
    },
    // Prefer a stable port; fail loudly if taken so /api plugin isn't on a different port.
    port: 5173,
    strictPort: true,
  },
  build: {
    // Keep all CSS in a single stylesheet so lazy route/component updates
    // cannot reference a missing per-chunk CSS file after deployments.
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react-router")) return "router";
          if (id.includes("@radix-ui")) return "radix";
          return "vendor";
        },
      },
    },
  },
});
