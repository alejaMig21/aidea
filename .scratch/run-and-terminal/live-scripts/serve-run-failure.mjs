// Serves aidea's real core and interface on http://127.0.0.1:4826 with two Projects: one whose program exits before it is ready (Play fails) and one whose program keeps running (Stop and Restart).
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-run-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const make = (name, recipe) => {
  const dir = join(root, name);
  mkdirSync(join(dir, ".aidea"), { recursive: true });
  writeFileSync(join(dir, "app.py"), "def go():\n    return 1\n");
  writeFileSync(join(dir, ".aidea", "run.json"), JSON.stringify(recipe));
};
make("fail", { parts: [{ name: "broken", command: "node -e \"console.log('boom'); process.exit(3)\"", ready: { line: "never printed" } }] });
make("wait", { parts: [{ name: "waiter", command: "node -e \"console.log('up'); setInterval(() => {}, 1000)\"" }] });
const core = await startCore({ port: 4826, recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner"), pluginsDir: join(root, "store") });
console.log("ready", core.url);
