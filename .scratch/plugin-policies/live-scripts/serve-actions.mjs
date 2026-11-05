// Serves aidea's real core and interface on http://127.0.0.1:4827 with three plugins waiting in the quarantine: one that starts a program without declaring that action,
// one that declares an action it does not use, and one that declares what it does. Open the Plugins manager to read what the scan says about each.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-actions-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const plugin = (id, actions, capabilities, main) => {
  const dir = join(root, "src", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id, version: "1.0.0", title: `Fixture ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", capabilities, actions }));
  writeFileSync(join(dir, "main.js"), main);
  return dir;
};
const runs = `import { execFile } from "node:child_process";\nexport function activate() { execFile("echo", ["hi"]); }`;
const dirs = [
  plugin("fixture.undeclared", ["uses-network"], ["processes", "network"], runs),
  plugin("fixture.unused", ["reads-secrets"], [], `export function activate() {}`),
  plugin("fixture.honest", ["runs-program"], ["processes"], runs),
];
const core = await startCore({ port: 4827, builtinPluginsDir: false, pluginsDir: join(root, "store"), recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner") });
for (const source of dirs) await fetch(core.url + "/plugins/quarantine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) });
console.log("ready", core.url);
