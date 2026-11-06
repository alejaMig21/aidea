// Starts the real core and page on port 4891 with a small Project whose Nodes carry evidence (observed, inferred, unknown), to look at the marks, the Node's details and the legend. Stop it with Ctrl+C.
import { startCore } from "file:///D:/Projects/aidea/src/core/server.ts";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "aidea-evidence-"));
const project = join(root, "shop");
mkdirSync(join(project, ".aidea"), { recursive: true });
writeFileSync(join(project, "shop.py"), "def quote():\n    return 1\n\n\ndef pay():\n    return 2\n");
const why = { why: "Because.", rejected: [] };
writeFileSync(join(project, ".aidea", "architecture.json"), JSON.stringify({ nodes: [
  { id: "web", title: "Web app", technology: "Node", kind: "container", evidence: { status: "observed", cites: [{ file: "shop.py", from: 1, to: 2 }] }, rationale: why },
  { id: "db", title: "Database", technology: "SQLite", kind: "container", evidence: { status: "inferred", cites: [{ file: "shop.py", from: 5, to: 6 }] }, rationale: why },
  { id: "pay", title: "Payments", technology: "Stripe", kind: "container", evidence: { status: "unknown", why: "The code does not say who processes payments." }, rationale: why },
] }));
const core = await startCore({ port: 4891, pluginsDir: join(root, "plugins"), recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner") });
console.log(`${core.url}  project: ${project}`);
