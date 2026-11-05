// Starts the real core and page on port 4890 with a small Python Project so the Contract panel can be looked at in a browser. Stop it with Ctrl+C.
import { startCore } from "file:///D:/Projects/aidea/src/core/server.ts";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "aidea-contract-panel-"));
const project = join(root, "shop");
mkdirSync(join(project, ".aidea"), { recursive: true });
writeFileSync(join(project, "shop.py"), "def quote():\n    return 1\n");
const why = { why: "Because.", rejected: [{ option: "Else", reason: "Worse." }] };
writeFileSync(join(project, ".aidea", "requirements.json"), JSON.stringify({ nodes: [{ id: "us-quote", title: "Request a quote", as: "owner", want: "a form", so: "I get a price", criteria: ["Given a form, When sent, Then a quote arrives"], built: true, rationale: why }] }));
writeFileSync(join(project, ".aidea", "architecture.json"), JSON.stringify({ nodes: [{ id: "web", title: "Web app", technology: "Node", kind: "container", rationale: why }] }));
const core = await startCore({ port: 4890, pluginsDir: join(root, "plugins"), recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner") });
console.log(`${core.url}  project: ${project}`);
