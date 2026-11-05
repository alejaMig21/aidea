// Serves aidea's real core and interface on http://127.0.0.1:4819 with a stand-in Tutor and one taught idea ("Worker") that is not yet recalled, so a real browser window can show a practice session.
// Start it from the page with: tutorUi.startClass({ payload: { project, practice: true } }). The stand-in Tutor poses one problem, gives the hint the person asks for, and reveals the solution after the answer.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-practice-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const project = join(root, "shop");
mkdirSync(project, { recursive: true });
writeFileSync(join(project, "app.py"), "class Shop:\n    def total(self):\n        return 1\n");
const learner = join(root, "learner");
mkdirSync(learner, { recursive: true });
writeFileSync(join(learner, "propositions.jsonl"), JSON.stringify({ op: "put", proposition: { id: "worker", name: "Worker", statement: "A worker takes a job from the queue and runs it.", aliases: [], provenance: [{ classId: "c1", message: 0, project }] } }) + "\n");
const adapter = { options: { modes: [], models: [] }, run: async function* ({ role, tools }) {
  if (role !== "tutor") return;
  const url = JSON.parse(tools.mcpConfig).mcpServers.tutor.url;
  const call = async (name, args) => JSON.parse((await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result.content[0].text);
  const targets = await call("practice_targets", {});
  yield { type: "text", text: `Let us practise: ${targets.ideas.map((i) => i.name).join(", ")}.` };
  let r = await call("problem", { problemId: "p1", idea: "Worker", form: "recall", kind: "choice", prompt: "What does a worker do?", options: ["Takes jobs from the queue", "Draws the screen", "Stores passwords"], correct: "Takes jobs from the queue", solution: "A worker takes a job from the queue and runs it.", rubric: "Mentions taking jobs." });
  while (r.hintRequested) r = await call("hint", { problemId: "p1", text: `Think about where jobs wait (level ${r.level}).` });
  yield { type: "text", text: `${r.correct ? "Right." : "Not quite."} Solution: ${r.solution}` };
  await call("finish_class", { summary: "Practised the worker." });
} };
const core = await startCore({ port: 4819, adapter, learnerDir: learner, recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json") });
console.log("ready", core.url, project);
