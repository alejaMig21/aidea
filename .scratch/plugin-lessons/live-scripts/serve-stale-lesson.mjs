// Serves aidea's real core and interface on http://127.0.0.1:4820 with two plugins waiting in the quarantine: one whose lesson names a setting it no longer has, and one with no lesson at all.
// Open the Plugins manager in the page to read their warnings.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-stale-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const plugin = (id, lesson) => {
  const dir = join(root, "src", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id, version: "1.0.0", title: `Fixture ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", ui: "ui.js", ...(lesson ? { lesson: "lesson.json" } : {}) }));
  writeFileSync(join(dir, "ui.js"), "export function activate() {}");
  if (lesson) writeFileSync(join(dir, "lesson.json"), JSON.stringify({ parts: [{ name: "The part", hint: "h", what: "w", question: "q?", example: "e", narration: "n", tryIt: "t", refs: ["setting:volume", id] }] }));
  return dir;
};
const stale = plugin("fixture.stale", true), none = plugin("fixture.nolesson", false);
const core = await startCore({ port: 4820, pluginsDir: join(root, "store"), builtinPluginsDir: false, recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner") });
for (const source of [stale, none]) await fetch(core.url + "/plugins/quarantine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) });
console.log("ready", core.url);
