/**
 * Vite dev middleware — serves /api/alloc8-assistant during `npm run dev`
 * without requiring the Vercel CLI.
 */
import { loadServerEnv } from "../api/_lib/loadEnv.js";

loadServerEnv();

import { handleAlloc8Assistant } from "../api/alloc8-assistant.js";

export function assistantDevApiPlugin() {
  return {
    name: "alloc8-assistant-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] || "";
        if (url !== "/api/alloc8-assistant") return next();
        try {
          await handleAlloc8Assistant(req, res);
        } catch (err) {
          console.error("[assistant-dev-api]", err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Assistant handler failed" }));
        }
      });
    },
  };
}
