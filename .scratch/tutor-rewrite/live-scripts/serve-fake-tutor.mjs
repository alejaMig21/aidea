// Serves aidea's real core and interface on http://127.0.0.1:4817 with a stand-in Tutor, so a real browser window can show the measurement and the Plan card without spending the person's Claude quota.
// The stand-in Tutor measures one topic, hands over, sets a Plan, asks for the go-ahead, and begins a step once the person agrees.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-fake-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const project = join(root, "shop");
mkdirSync(project, { recursive: true });
writeFileSync(join(project, "app.py"), "class Shop:\n    def total(self):\n        return 1\n");
const adapter = { options: { modes: [], models: [] }, run: async function* ({ role, tools }) {
  if (role !== "tutor") return;
  const url = JSON.parse(tools.mcpConfig).mcpServers.tutor.url;
  const call = async (name, args) => (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result.content[0].text;
  yield { type: "text", text: "Let me see what you already know." };
  await call("measure", { topic: "class", kind: "choice", prompt: "What is a class?", options: ["A blueprint for objects", "A kind of loop", "A file"], correct: "A blueprint for objects" });
  await call("measure_done", { topics: [{ name: "class", floor: "Knows what a class is.", ceiling: null, note: "Solid." }] });
  await call("set_plan", { concepts: [{ name: "Shop class", dependsOn: [] }, { name: "total method", dependsOn: ["Shop class"] }], decisions: [] });
  const go = JSON.parse(await call("plan_ahead", { summary: "We will start with the Shop class, then look at what total does and why." }));
  yield { type: "text", text: go.approved ? "Great, we begin." : "Tell me what to change." };
  if (go.approved) await call("begin_step", { stepId: "s1", title: "The Shop class", item: "Shop class" });
} };
const core = await startCore({ port: 4817, adapter, learnerDir: join(root, "learner"), recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json") });
console.log("ready", core.url, project);
