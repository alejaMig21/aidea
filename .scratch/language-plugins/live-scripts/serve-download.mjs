// Starts the real core and page on port 4892 with a plugin that asks to download a small file from a local server, to look at the dialog that asks the person. Stop it with Ctrl+C.
// After the page is open, call: POST /plugins/demo.download/call/download { "name": "tool" } and watch the dialog; the server prints how many times the file was asked for.
import { startCore } from "file:///D:/Projects/aidea/src/core/server.ts";
import { createHash } from "node:crypto"; import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "aidea-download-"));
const body = Buffer.from("pretend this is a program");
let hits = 0;
const files = createServer((_, res) => { hits++; console.log("the file was asked for:", hits); res.writeHead(200, { "content-length": body.length }); res.end(body); });
await new Promise((r) => files.listen(4893, "127.0.0.1", r));
const dir = join(root, "plugins", "demo.download");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: "demo.download", version: "1.0.0", title: "Demo download", description: "Asks to download one small file.", publisher: "demo", api: "0.1", main: "main.js", capabilities: ["network"], actions: ["uses-network"], downloads: [{ name: "tool", url: "http://127.0.0.1:4893/tool.bin", bytes: body.length, sha256: createHash("sha256").update(body).digest("hex"), file: "tool.bin" }] }));
writeFileSync(join(dir, "main.js"), `export function activate(ctx) { ctx.api.handle("download", ({ name }) => ctx.programs.download(name)); }`);
const core = await startCore({ port: 4892, builtinPluginsDir: false, pluginsDir: join(root, "plugins"), recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner") });
console.log(core.url);
