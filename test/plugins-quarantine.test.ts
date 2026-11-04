import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// Ticket plugin-system/05: a plugin added from a folder or a Git link lands in the quarantine, where nothing runs; a scan with no model reports what blocks and what only warns.
const scratch = mkdtempSync(join(tmpdir(), "aidea-quarantine-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
const log = ((globalThis as any).__plugLog ??= [] as string[]) as string[];

const manifest = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra });
const QUIET = `export function activate() {}`;
let n = 0;
// Writes a plugin folder (outside the store) with the given files and returns its path.
function source(files: Record<string, string | Buffer>, name = `src${n++}`) {
  const dir = join(scratch, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(dir, file, ".."), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
  return dir;
}
async function start() {
  const store = join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const add = async (from: string) => {
    const res = await post("/plugins/quarantine", { source: from });
    return { status: res.status, body: (await res.json()) as any };
  };
  return { core, store, post, add };
}
type Finding = { id: string; severity: "block" | "warn"; message: string; file?: string };
const ids = (report: { findings: Finding[] }, severity: "block" | "warn") => report.findings.filter((f) => f.severity === severity).map((f) => f.id);

test("a folder added to the quarantine is copied there, scanned, and nothing of it runs or is listed as a plugin", async () => {
  const t = await start();
  try {
    const from = source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.quiet")), "main.js": `globalThis.__plugLog.push("quarantined plugin ran"); ${QUIET}` });
    const { status, body } = await t.add(from);
    assert.equal(status, 201);
    assert.equal(body.report.manifest.id, "fixture.quiet");
    assert.deepEqual(ids(body.report, "block"), []);
    assert.ok(existsSync(join(t.store, ".quarantine", body.id, "aidea-plugin.json")), "the copy is in the quarantine folder");
    assert.ok(!log.includes("quarantined plugin ran"), "the code of a quarantined plugin must not run");
    const { plugins } = (await (await fetch(t.core.url + "/plugins")).json()) as { plugins: unknown[] };
    assert.deepEqual(plugins, [], "a quarantined plugin is not an installed plugin");
  } finally { t.core.close(); }
});

test("capabilities the plugin declared and uses are warnings, not blocks", async () => {
  const t = await start();
  try {
    const from = source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.net", { capabilities: ["network", "files"] })), "main.js": `import fs from "node:fs"; export async function activate() { await fetch("http://127.0.0.1:1/"); fs.readFileSync("x"); }` });
    const { body } = await t.add(from);
    assert.deepEqual(ids(body.report, "block"), []);
    assert.ok(body.report.findings.some((f: Finding) => f.severity === "warn" && /network/.test(f.message)));
    assert.ok(body.report.findings.some((f: Finding) => f.severity === "warn" && /files/.test(f.message)));
  } finally { t.core.close(); }
});

for (const [capability, code] of [
  ["network", `export function activate() { fetch("http://127.0.0.1:1/"); }`],
  ["network", `import http from "node:http"; export function activate() { http.get("http://127.0.0.1:1/"); }`],
  ["files", `import fs from "node:fs"; export function activate() { fs.writeFileSync("x", "y"); }`],
  ["processes", `import cp from "node:child_process"; export function activate() { cp.execSync("echo hi"); }`],
] as const) {
  test(`using ${capability} without declaring it blocks (${code.slice(0, 40)}...)`, async () => {
    const t = await start();
    try {
      const { body } = await t.add(source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.undeclared")), "main.js": code }));
      const blocked = body.report.findings.filter((f: Finding) => f.severity === "block" && f.id === "undeclared-capability");
      assert.ok(blocked.some((f: Finding) => f.message.includes(capability)), JSON.stringify(body.report.findings));
    } finally { t.core.close(); }
  });
}

test("obfuscated code blocks", async () => {
  const t = await start();
  try {
    const code = `var _0x1a2b=['\\x61\\x62','\\x63'];(function(_0x3c4d,_0x5e6f){var _0x7a8b=function(_0x9c0d){while(--_0x9c0d){_0x3c4d['push'](_0x3c4d['shift']());}};_0x7a8b(++_0x5e6f);}(_0x1a2b,0x1f));export function activate(){}`;
    const { body } = await t.add(source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.obf")), "main.js": code }));
    assert.ok(ids(body.report, "block").includes("obfuscated"), JSON.stringify(body.report.findings));
  } finally { t.core.close(); }
});

test("code that decodes a hidden string and runs it blocks", async () => {
  const t = await start();
  try {
    const { body } = await t.add(source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.hidden")), "main.js": `export function activate() { eval(atob("Y29uc29sZS5sb2coMSk=")); }` }));
    assert.ok(ids(body.report, "block").includes("obfuscated"), JSON.stringify(body.report.findings));
  } finally { t.core.close(); }
});

test("an install script blocks", async () => {
  const t = await start();
  try {
    const { body } = await t.add(source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.script")), "main.js": QUIET, "package.json": JSON.stringify({ name: "x", scripts: { postinstall: "node evil.js" } }) }));
    assert.ok(ids(body.report, "block").includes("install-script"), JSON.stringify(body.report.findings));
  } finally { t.core.close(); }
});

test("a binary blocks, by its extension and by its first bytes", async () => {
  const t = await start();
  try {
    const exe = await t.add(source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.exe")), "main.js": QUIET, "tool.exe": Buffer.from("not really") }));
    assert.ok(ids(exe.body.report, "block").includes("binary"), "an .exe");
    const disguised = await t.add(source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.disguised")), "main.js": QUIET, "data.txt": Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]) }));
    assert.ok(ids(disguised.body.report, "block").includes("binary"), "a program disguised as text");
  } finally { t.core.close(); }
});

test("a link that leaves the folder blocks", async (ctx) => {
  const t = await start();
  try {
    const dir = source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.link")), "main.js": QUIET });
    try { symlinkSync(scratch, join(dir, "out"), "junction"); } catch { return ctx.skip("this system cannot create links here"); }
    const { body } = await t.add(dir);
    assert.ok(ids(body.report, "block").includes("link-leaves-folder"), JSON.stringify(body.report.findings));
  } finally { t.core.close(); }
});

test("literal colours and sizes in the interface half are warnings", async () => {
  const t = await start();
  try {
    const { body } = await t.add(source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.style", { main: undefined, ui: "ui.js" })), "ui.js": `export function activate(ui) { ui.slots.add("layout.panel", { id: "x", title: "X", render(c) { c.style.cssText = "color:#ff0000;padding:12px"; } }); }` }));
    assert.deepEqual(ids(body.report, "block"), []);
    assert.ok(ids(body.report, "warn").includes("literal-style"), JSON.stringify(body.report.findings));
  } finally { t.core.close(); }
});

test("an invalid manifest is a blocking finding that names the field, and there is no manifest in the report", async () => {
  const t = await start();
  try {
    const { status, body } = await t.add(source({ "aidea-plugin.json": JSON.stringify({ ...manifest("fixture.bad"), title: undefined }), "main.js": QUIET }));
    assert.equal(status, 201);
    assert.equal(body.report.manifest, null);
    const f = body.report.findings.find((x: Finding) => x.id === "invalid-manifest");
    assert.equal(f?.severity, "block");
    assert.match(f?.message ?? "", /title/);
  } finally { t.core.close(); }
});

test("a source that is not a folder, or is too large, is refused and nothing is left in the quarantine", async () => {
  const t = await start();
  try {
    assert.equal((await t.add(join(scratch, "does-not-exist"))).status, 400);
    const big = source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.big")), "main.js": QUIET, "blob.txt": Buffer.alloc(21 * 1024 * 1024) });
    assert.equal((await t.add(big)).status, 400);
    assert.deepEqual(readdirSync(join(t.store, ".quarantine")).filter((f) => !f.startsWith(".")), []);
  } finally { t.core.close(); }
});

test("sources that could be read as options or odd addresses are refused", async () => {
  const t = await start();
  try {
    for (const bad of ["", "--upload-pack=evil", "-oProxyCommand=evil", "ftp://example.com/x", "javascript:alert(1)", 5, null]) {
      const res = await t.post("/plugins/quarantine", { source: bad });
      assert.equal(res.status, 400, JSON.stringify(bad));
    }
  } finally { t.core.close(); }
});

test("a core with no plugin store refuses to add to the quarantine", async () => {
  const core = await startCore({ port: 0, builtinPluginsDir: false });
  try {
    const res = await fetch(core.url + "/plugins/quarantine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: scratch }) });
    assert.equal(res.status, 400);
  } finally { core.close(); }
});

test("a Git link is fetched without its history or any script, and lands in the quarantine", async (ctx) => {
  const repo = source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.git")), "main.js": QUIET }, "gitrepo");
  try {
    const git = (...args: string[]) => execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { stdio: "pipe" });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "plugin");
  } catch { return ctx.skip("git is not available"); }
  const t = await start();
  try {
    const { status, body } = await t.add("file:///" + repo.replaceAll("\\", "/").replace(/^\//, ""));
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.report.manifest.id, "fixture.git");
    assert.ok(!existsSync(join(t.store, ".quarantine", body.id, ".git")), "no history in the quarantine");
  } finally { t.core.close(); }
});

test("the quarantine can be listed, read by id and discarded", async () => {
  const t = await start();
  try {
    const a = await t.add(source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.one")), "main.js": QUIET }));
    const b = await t.add(source({ "aidea-plugin.json": JSON.stringify(manifest("fixture.two")), "main.js": QUIET }));
    const list = (await (await fetch(t.core.url + "/plugins/quarantine")).json()) as { entries: any[] };
    assert.deepEqual(list.entries.map((e) => e.report.manifest.id).sort(), ["fixture.one", "fixture.two"]);
    assert.equal((await fetch(t.core.url + `/plugins/quarantine/${a.body.id}`)).status, 200);
    assert.equal((await t.post("/plugins/quarantine/discard", { id: a.body.id })).status, 200);
    assert.ok(!existsSync(join(t.store, ".quarantine", a.body.id)));
    assert.equal((await fetch(t.core.url + `/plugins/quarantine/${a.body.id}`)).status, 404);
    assert.equal((await t.post("/plugins/quarantine/discard", { id: "../../etc" })).status, 400);
    assert.equal((await fetch(t.core.url + `/plugins/quarantine/${b.body.id}`)).status, 200);
  } finally { t.core.close(); }
});
