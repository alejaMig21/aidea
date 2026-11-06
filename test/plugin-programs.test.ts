import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { readManifest } from "../src/core/plugins/manifest.ts";
import { scanPlugin } from "../src/core/plugins/scan.ts";
import { startCore } from "../src/core/server.ts";

// language-plugins 07: a plugin may ship a variant per system, use a program that is already on the machine, or ask to download one (only after the person says yes).
const scratch = mkdtempSync(join(tmpdir(), "aidea-programs-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));

const here = { os: process.platform, cpu: process.arch };
const elsewhere = { os: process.platform === "win32" ? "linux" : "win32", cpu: "ia32" };
const MAIN = `export function activate(ctx) {
  ctx.api.handle("info", () => ({ variant: ctx.variant }));
  ctx.api.handle("run", ({ name, args }) => ctx.programs.run(name, args ?? []));
  ctx.api.handle("download", ({ name }) => ctx.programs.download(name));
}`;
let n = 0;
function plugin(id: string, extra: Record<string, unknown> = {}, main = MAIN) {
  const dir = join(scratch, `p${n++}`, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra }));
  writeFileSync(join(dir, "main.js"), main);
  return dir;
}
async function coreWith(...dirs: string[]) {
  const store = join(scratch, `s${n++}`);
  mkdirSync(store, { recursive: true });
  const { cpSync } = await import("node:fs");
  for (const d of dirs) cpSync(d, join(store, d.split(/[\\/]/).pop()!), { recursive: true });
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  const call = async (id: string, name: string, body: unknown = {}) => { const r = await fetch(`${core.url}/plugins/${id}/call/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, body: (await r.json()) as any }; };
  const find = async (id: string) => (((await (await fetch(core.url + "/plugins")).json()) as any).plugins as any[]).find((p) => p.id === id);
  return { core, store, call, find };
}

test("a plugin with a variant for this system loads it; the plugin sees the folder of that variant", async () => {
  const d = plugin("fixture.variant", { variants: [{ ...{ os: [elsewhere.os], cpu: [elsewhere.cpu] }, folder: "other" }, { os: [here.os], cpu: [here.cpu], folder: "mine" }] });
  mkdirSync(join(d, "mine"));
  mkdirSync(join(d, "other"));
  const t = await coreWith(d);
  try {
    assert.equal((await t.find("fixture.variant")).state, "active");
    const info = await t.call("fixture.variant", "info");
    assert.match(info.body.variant.dir.replace(/\\/g, "/"), /fixture\.variant\/mine$/);
  } finally { t.core.close(); }
});

test("with no variant for this system the plugin stays inactive and the manager says so in plain words", async () => {
  const d = plugin("fixture.novariant", { variants: [{ os: [elsewhere.os], cpu: [elsewhere.cpu], folder: "other" }] });
  mkdirSync(join(d, "other"));
  const t = await coreWith(d);
  try {
    const p = await t.find("fixture.novariant");
    assert.equal(p.state, "inactive");
    assert.match(p.reason, /not available for this system/);
    assert.match(p.reason, new RegExp(`${here.os} ${here.cpu}`));
  } finally { t.core.close(); }
});

test("a program that is on the machine is found, and the plugin runs it by its declared name only", async () => {
  const node = { name: "node", command: "node", args: ["--version"], min: "18", help: "Install Node.js 18 or later from nodejs.org." };
  const d = plugin("fixture.program", { capabilities: ["processes"], actions: ["runs-program"], programs: [node] });
  const t = await coreWith(d);
  try {
    assert.equal((await t.find("fixture.program")).state, "active");
    const ran = await t.call("fixture.program", "run", { name: "node", args: ["-e", "console.log(6*7)"] });
    assert.equal(ran.body.stdout.trim(), "42");
    assert.equal(ran.body.code, 0);
    const other = await t.call("fixture.program", "run", { name: "cmd", args: [] });
    assert.notEqual(other.status, 200);
    assert.match(other.body.error, /not declared/);
  } finally { t.core.close(); }
});

test("a program that is missing, or too old, keeps the plugin inactive and says what is missing and how to get it", async () => {
  const missing = plugin("fixture.missing", { capabilities: ["processes"], programs: [{ name: "gadget", command: "aidea-no-such-program-xyz", args: ["--version"], help: "Install the gadget from example.org." }] });
  const old = plugin("fixture.old", { capabilities: ["processes"], programs: [{ name: "node", command: "node", args: ["--version"], min: "999", help: "Install a newer Node.js." }] });
  const t = await coreWith(missing, old);
  try {
    const a = await t.find("fixture.missing");
    assert.equal(a.state, "inactive");
    assert.match(a.reason, /gadget/);
    assert.match(a.reason, /aidea-no-such-program-xyz/);
    assert.match(a.reason, /Install the gadget from example\.org/);
    const b = await t.find("fixture.old");
    assert.equal(b.state, "inactive");
    assert.match(b.reason, /999/);
    assert.match(b.reason, /Install a newer Node\.js/);
  } finally { t.core.close(); }
});

// A server for the downloads: it counts how many times it was asked.
async function fileServer(body: Buffer) {
  let hits = 0;
  const server = createServer((req, res) => { hits++; res.writeHead(200, { "content-length": body.length }); res.end(body); });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  return { url: `http://127.0.0.1:${port}/tool.bin`, hits: () => hits, close: () => server.close() };
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const body = Buffer.from("pretend this is a program");
const downloadPlugin = (id: string, url: string, over: Record<string, unknown> = {}) =>
  plugin(id, { capabilities: ["network"], actions: ["uses-network"], downloads: [{ name: "tool", url, bytes: body.length, sha256: sha(body), file: "tool.bin", ...over }] });
const pending = async (core: any) => ((await (await fetch(core.url + "/plugins/downloads")).json()) as any).downloads as any[];
const answer = (core: any, id: string, decision: string) => fetch(core.url + "/plugins/downloads/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, decision }) });
async function until<T>(f: () => Promise<T | undefined | false>, ms = 4000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) { const v = await f(); if (v) return v; if (Date.now() > end) throw new Error("timed out"); await new Promise((r) => setTimeout(r, 20)); }
}

test("a download asks first, shows what, from where and how big, and only downloads after a yes; the file is kept and checked", async () => {
  const server = await fileServer(body);
  const t = await coreWith(downloadPlugin("fixture.download", server.url));
  try {
    const asked = t.call("fixture.download", "download", { name: "tool" });
    const [card] = await until(async () => { const p = await pending(t.core); return p.length ? p : false; });
    assert.equal(server.hits(), 0, "nothing was downloaded before the answer");
    assert.deepEqual([card.plugin, card.name, card.url, card.bytes], ["fixture.download", "tool", server.url, body.length]);
    assert.equal((await answer(t.core, card.id, "accept")).status, 200);
    const done = await asked;
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(readFileSync(done.body).toString(), body.toString());
    assert.equal(server.hits(), 1);
    // asking again for a file that is there and whose hash holds does not ask the person again
    const again = await t.call("fixture.download", "download", { name: "tool" });
    assert.equal(again.body, done.body);
    assert.deepEqual(await pending(t.core), []);
  } finally { t.core.close(); server.close(); }
});

test("a declined download downloads nothing, and the plugin is told", async () => {
  const server = await fileServer(body);
  const t = await coreWith(downloadPlugin("fixture.decline", server.url));
  try {
    const asked = t.call("fixture.decline", "download", { name: "tool" });
    const [card] = await until(async () => { const p = await pending(t.core); return p.length ? p : false; });
    await answer(t.core, card.id, "decline");
    const res = await asked;
    assert.notEqual(res.status, 200);
    assert.match(res.body.error, /declined/i);
    assert.equal(server.hits(), 0);
  } finally { t.core.close(); server.close(); }
});

test("a file whose hash does not match, or that is bigger than declared, is refused and not kept", async () => {
  const server = await fileServer(Buffer.from("something else entirely!!"));
  const wrong = downloadPlugin("fixture.hash", server.url, { bytes: 25 }); // the right size, the wrong content
  const big = downloadPlugin("fixture.big", server.url, { bytes: 5 }); // bigger than declared
  const t = await coreWith(wrong, big);
  try {
    for (const [id, why] of [["fixture.hash", /hash/i], ["fixture.big", /bigger|size/i]] as const) {
      const asked = t.call(id, "download", { name: "tool" });
      const [card] = await until(async () => { const p = await pending(t.core); return p.length ? p : false; });
      await answer(t.core, card.id, "accept");
      const res = await asked;
      assert.notEqual(res.status, 200, id);
      assert.match(res.body.error, why, id);
    }
  } finally { t.core.close(); server.close(); }
});

test("a plugin cannot download what it did not declare, and a download that is not https (or loopback) is refused in the manifest", async () => {
  const server = await fileServer(body);
  const t = await coreWith(downloadPlugin("fixture.undeclared", server.url));
  try {
    const res = await t.call("fixture.undeclared", "download", { name: "other" });
    assert.notEqual(res.status, 200);
    assert.match(res.body.error, /no download called "other"/);
    assert.equal(server.hits(), 0);
  } finally { t.core.close(); server.close(); }
  const bad = readManifest(downloadPlugin("fixture.http", "http://example.com/tool.bin"));
  assert.ok("problems" in bad && /"downloads".*https/.test(bad.problems.join()));
});

test("a plugin in quarantine downloads nothing: its manifest is only read and scanned", async () => {
  const server = await fileServer(body);
  const dir = downloadPlugin("fixture.quarantined", server.url);
  try {
    const report = scanPlugin(dir);
    assert.equal(server.hits(), 0);
    assert.ok(report.findings.some((f) => /download/i.test(f.message) && /tool/.test(f.message)), "the scan lists the download it asks for");
  } finally { server.close(); }
});

test("the manifest of variants, programs and downloads is checked, each problem naming its field", () => {
  const problems = (extra: Record<string, unknown>) => { const r = readManifest(plugin("fixture.check", extra)); return "problems" in r ? r.problems.join("; ") : ""; };
  assert.match(problems({ variants: [{ os: ["win32"], cpu: ["x64"], folder: "../out" }] }), /"variants"/);
  assert.match(problems({ variants: [{ os: ["amiga"], cpu: ["x64"], folder: "a" }] }), /"variants"/);
  assert.match(problems({ capabilities: ["processes"], programs: [{ name: "x", command: "../evil", help: "h" }] }), /"programs"/);
  assert.match(problems({ programs: [{ name: "x", command: "x", help: "h" }] }), /"programs".*"processes"/);
  assert.match(problems({ downloads: [{ name: "x", url: "https://example.com/x", bytes: 1, sha256: "0".repeat(64), file: "x" }] }), /"downloads".*"network"/);
  assert.match(problems({ capabilities: ["network"], downloads: [{ name: "x", url: "https://example.com/x", bytes: 1, sha256: "nothex", file: "x" }] }), /"downloads".*sha256/);
});

test("the scan lists what a plugin declares, and blocks code that uses the programs door without declaring anything", () => {
  const withDecl = scanPlugin(plugin("fixture.scan", { capabilities: ["processes"], actions: ["runs-program"], programs: [{ name: "node", command: "node", help: "h" }], variants: [{ os: [here.os], cpu: [here.cpu], folder: "v" }] }));
  const text = withDecl.findings.map((f) => f.message).join("\n");
  assert.match(text, /program already on the machine: node/);
  assert.match(text, /variant/i);
  const undeclared = scanPlugin(plugin("fixture.sneaky", { capabilities: ["processes"], actions: ["runs-program"] }, `export function activate(ctx) { ctx.programs.run("anything", []); }`));
  assert.ok(undeclared.findings.some((f) => f.severity === "block" && /programs/.test(f.message)), "blocked");
});
