import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { scanPlugin } from "../src/core/plugins/scan.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";
import "../src/core/adapters.ts";

// language-plugins 06: the template for a language plugin, the section of the skill (analyze first, declare honestly), and a Builder that writes an analyze-only plugin for a made-up language.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const template = join(root, "docs", "plugin-template-language");
const scratch = mkdtempSync(join(tmpdir(), "aidea-language-template-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));

test("the language template, copied unchanged, passes the scan with no blocking finding and no lesson warning", () => {
  const report = scanPlugin(template);
  assert.equal(report.blocking, 0);
  assert.deepEqual(report.findings.filter((f) => /lesson|surface/.test(f.id)), []);
  assert.equal(report.manifest?.language?.id, "my-language");
});

test("the skill has a section for language plugins: analyze first, flow and run only when asked, honest capabilities", () => {
  const skill = readFileSync(join(root, "docs", "plugin-skill.md"), "utf8");
  assert.match(skill, /## Language plugins/);
  assert.match(skill, /analyze.*first/is);
  assert.match(skill, /flow.*run.*only when/is);
  assert.match(skill, /plugin-template-language/);
  assert.match(skill, /"processes"/);
});

test("a Builder that copies the template for a made-up language writes a plugin that is proposed, installs, and makes the Components layer draw a Project in it", async () => {
  const project = join(scratch, "project");
  cpSync(fixture("shop"), project, { recursive: true });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "orders.zed"), "order");
  writeFileSync(join(project, "src", "carts.zed"), "cart");
  const folder = join(project, "zed-language");
  cpSync(template, folder, { recursive: true });
  const edit = (file: string, change: (t: string) => string) => writeFileSync(join(folder, file), change(readFileSync(join(folder, file), "utf8")));
  edit("aidea-plugin.json", (t) => t.replaceAll("my-language", "zed-language").replaceAll('"My language"', '"Zed language"').replace(".mylang", ".zed"));
  edit("main.js", (t) => t.replace('".mylang"', '".zed"'));
  edit("lesson.json", (t) => t.replaceAll("my-language", "zed-language"));
  const results: { isError: boolean; text: string }[] = [];
  const adapter: Adapter = {
    options: { modes: [], models: [] },
    run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
      const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
      const rpc = (method: string, params: unknown, id: number) => fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
      await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } }, 1);
      const r = (await (await rpc("tools/call", { name: "propose_plugin", arguments: { path: "zed-language" } }, 2)).json()).result;
      results.push({ isError: r.isError === true, text: r.content[0].text });
      yield { type: "text", text: "ok" };
    },
  };
  const dir = mkdtempSync(join(scratch, "c"));
  const core = await startCore({ port: 0, adapter, learnerDir: dir, pluginsDir: join(dir, "plugins"), builtinPluginsDir: false, preferencesFile: join(dir, "p.json"), recentsFile: join(dir, "r.json") });
  try {
    const post = (path: string, b: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    await post("/projects", { path: project });
    await (await post("/chat", { project, message: "Write me a plugin that reads Zed files." })).text();
    assert.equal(results[0].isError, false, results[0].text);
    const entry = core.quarantine.list()[0];
    assert.equal(entry.report.blocking, 0);
    const installed = (await (await post("/plugins/install", { id: entry.id })).json()) as any;
    assert.equal(installed.status, "applied", JSON.stringify(installed));
    const opened = (await (await post("/projects", { path: project })).json()) as any;
    assert.deepEqual(opened.languages.find((l: any) => l.language === "zed-language"), { language: "zed-language", label: "Zed language", files: 2, analysed: true });
    assert.deepEqual(opened.nodes.filter((n: any) => n.file.endsWith(".zed")).map((n: any) => n.name).sort(), ["carts.zed", "orders.zed"], "the Zed files are drawn next to the Project's Python and JavaScript");
  } finally { await core.plugins.deactivate("zed-language"); core.close(); }
});

test("the scan blocks a language plugin that starts a process it did not declare, and accepts it once declared", () => {
  const folder = join(scratch, "starts-a-program");
  cpSync(template, folder, { recursive: true });
  writeFileSync(join(folder, "main.js"), `import { execFile } from "node:child_process";\nimport { readdirSync } from "node:fs";\nexport function activate(ctx) { ctx.languages.provide({ async analyze() { execFile("echo", ["hi"]); readdirSync("."); return { nodes: [], errors: [], relationships: [], unresolved: 0 }; } }); }`);
  const blocked = scanPlugin(folder);
  assert.ok(blocked.findings.some((f) => f.id === "undeclared-capability" && /processes/.test(f.message)), JSON.stringify(blocked.findings));
  assert.ok(blocked.blocking > 0);
  const manifest = join(folder, "aidea-plugin.json");
  writeFileSync(manifest, readFileSync(manifest, "utf8").replace('["files"]', '["files", "processes"]'));
  assert.equal(scanPlugin(folder).blocking, 0, "declared honestly, the person sees it in the scan and decides");
});
