// Serves aidea's real core and interface on http://127.0.0.1:4818 with a stand-in Tutor and a plugin ("canvas") that has a teaching surface, so a real browser window can show a task card.
// The stand-in Tutor asks for a relation that does not exist yet (the check fails and the step stays open), then for the one that does (the check passes and the step closes).
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-task-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const project = join(root, "shop");
mkdirSync(project, { recursive: true });
writeFileSync(join(project, "app.py"), "class Shop:\n    def total(self):\n        return 1\n");
const dir = join(root, "plugins", "canvas");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: "canvas", version: "1.0.0", title: "Canvas", description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", teach: { view: "state", module: "teach.mjs", checks: [{ name: "has-relation", says: "A relation between two Nodes exists.", args: { from: "string", to: "string" } }] } }));
writeFileSync(join(dir, "main.js"), "export function activate(ctx) { ctx.teach.state(() => ({ relations: [['shop', 'db']] })); }");
writeFileSync(join(dir, "teach.mjs"), 'export const view = (s) => s;\nexport const checks = { "has-relation": (s, a) => { const f = s.relations.some(([x, y]) => x === a.from && y === a.to); return { ok: f, reason: f ? "The relation exists." : "There is no such relation." }; } };');
const adapter = { options: { modes: [], models: [] }, run: async function* ({ role, tools }) {
  if (role !== "tutor") return;
  const url = JSON.parse(tools.mcpConfig).mcpServers.tutor.url;
  const call = async (name, args) => (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result.content[0].text;
  await call("set_plan", { concepts: [{ name: "relations", dependsOn: [] }], decisions: [] });
  await call("plan_ahead", { summary: "We will learn to link two boxes on the Canvas." });
  await call("begin_step", { stepId: "s1", title: "Relations", item: "relations" });
  await call("predict", { stepId: "s1", prompt: "How would you link two boxes?" });
  await call("explain", { stepId: "s1", text: "A relation links two Nodes: it goes from the one that asks to the one that answers." });
  const task = (from, to) => ({ stepId: "s1", kind: "task", prompt: `Draw a relation from ${from} to ${to}.`, plugin: "canvas", check: "has-relation", args: { from, to } });
  const first = JSON.parse(await call("ask", task("db", "shop")));
  yield { type: "text", text: first.correct ? "That one passed." : `Not yet: ${first.check.reason}` };
  await call("explain", { stepId: "s1", text: "Look at the direction: shop asks, db answers." });
  const second = JSON.parse(await call("ask", task("shop", "db")));
  yield { type: "text", text: second.stepClosed ? "Step closed: the relation exists." : "Still open." };
} };
const core = await startCore({ port: 4818, adapter, learnerDir: join(root, "learner"), pluginsDir: join(root, "plugins"), builtinPluginsDir: false, recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json") });
console.log("ready", core.url, project);
