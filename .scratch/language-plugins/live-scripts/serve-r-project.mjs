// Serves aidea's real core and interface on http://127.0.0.1:4824 with a Project in R (no plugin reads it) and a stand-in Tutor that shows how its class opened.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-r-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const project = join(root, "stats");
mkdirSync(project, { recursive: true });
writeFileSync(join(project, "analysis.r"), "x <- c(1, 2, 3)\nmean(x)\n");
const adapter = { options: { modes: [], models: [] }, run: async function* ({ role, message }) {
  if (role !== "tutor") return;
  yield { type: "text", text: `The class opened with: ${message.slice(0, 120).replace(/\n/g, " ")}` };
} };
const core = await startCore({ port: 4824, adapter, builtinPluginsDir: false, pluginsDir: join(root, "store"), recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner") });
console.log("ready", core.url, project);
