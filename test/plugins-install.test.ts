import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// Ticket plugin-system/06: a plugin in the quarantine is installed after a confirmation that names each blocking finding; a failed install restores what was there; two installs never run at once.
const scratch = mkdtempSync(join(tmpdir(), "aidea-install-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
const log = ((globalThis as any).__plugLog ??= [] as string[]) as string[];

const manifest = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra });
let n = 0;
function source(files: Record<string, string>) {
  const dir = join(scratch, `src${n++}`);
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return dir;
}
async function start() {
  const store = join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  const post = async (path: string, body: unknown) => {
    const res = await fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as any };
  };
  const quarantine = async (files: Record<string, string>) => (await post("/plugins/quarantine", { source: source(files) })).body;
  const list = async () => ((await (await fetch(core.url + "/plugins")).json()) as any).plugins as { id: string; state: string; reason?: string }[];
  return { core, store, post, quarantine, list };
}
const QUIET = `globalThis.__plugLog.push("installed plugin activated"); export function activate() {}`;

test("a clean plugin installs with no confirmation: it is copied into the store, active at once, and gone from the quarantine", async () => {
  const t = await start();
  try {
    const q = await t.quarantine({ "aidea-plugin.json": JSON.stringify(manifest("fixture.clean")), "main.js": QUIET });
    log.length = 0;
    const { status, body } = await t.post("/plugins/install", { id: q.id });
    assert.equal(status, 200);
    assert.equal(body.status, "applied");
    assert.ok(existsSync(join(t.store, "fixture.clean", "aidea-plugin.json")));
    assert.deepEqual(log, ["installed plugin activated"]);
    assert.equal((await t.list()).find((p) => p.id === "fixture.clean")?.state, "active");
    assert.equal((await fetch(t.core.url + `/plugins/quarantine/${q.id}`)).status, 404);
  } finally { t.core.close(); }
});

test("a plugin with blocking findings needs a confirmation that names each one; with it, it installs", async () => {
  const t = await start();
  try {
    const q = await t.quarantine({ "aidea-plugin.json": JSON.stringify(manifest("fixture.loud")), "main.js": `fetch("http://127.0.0.1:1/").catch(() => {}); import cp from "node:child_process"; export function activate() {}` });
    const blocking = q.report.findings.filter((f: any) => f.severity === "block");
    assert.equal(blocking.length, 2);
    assert.ok(blocking.every((f: any) => typeof f.key === "string" && f.key.length > 0), "each finding carries a key to confirm it by");

    const none = await t.post("/plugins/install", { id: q.id });
    assert.equal(none.status, 409);
    assert.deepEqual(none.body.missing.sort(), blocking.map((f: any) => f.key).sort());
    assert.ok(!existsSync(join(t.store, "fixture.loud")), "nothing was installed");

    const one = await t.post("/plugins/install", { id: q.id, confirm: [blocking[0].key] });
    assert.equal(one.status, 409, "confirming only one of two is not enough");
    assert.deepEqual(one.body.missing, [blocking[1].key]);

    const all = await t.post("/plugins/install", { id: q.id, confirm: blocking.map((f: any) => f.key) });
    assert.equal(all.status, 200);
    assert.equal(all.body.status, "applied");
  } finally { t.core.close(); }
});

test("a plugin whose manifest is invalid cannot be installed, whatever is confirmed", async () => {
  const t = await start();
  try {
    const q = await t.quarantine({ "aidea-plugin.json": JSON.stringify({ ...manifest("fixture.bad"), title: undefined }), "main.js": QUIET });
    const keys = q.report.findings.map((f: any) => f.key);
    const res = await t.post("/plugins/install", { id: q.id, confirm: keys });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /manifest/);
    assert.deepEqual(await t.list(), []);
  } finally { t.core.close(); }
});

test("a plugin id that is already installed is refused", async () => {
  const t = await start();
  try {
    const first = await t.quarantine({ "aidea-plugin.json": JSON.stringify(manifest("fixture.same")), "main.js": QUIET });
    assert.equal((await t.post("/plugins/install", { id: first.id })).status, 200);
    const again = await t.quarantine({ "aidea-plugin.json": JSON.stringify(manifest("fixture.same")), "main.js": QUIET });
    const res = await t.post("/plugins/install", { id: again.id });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already installed/);
    assert.equal((await fetch(t.core.url + `/plugins/quarantine/${again.id}`)).status, 200, "the entry stays in the quarantine");
  } finally { t.core.close(); }
});

test("an install whose plugin fails to activate is rolled back: nothing is left in the store, the entry stays in the quarantine", async () => {
  const t = await start();
  try {
    const q = await t.quarantine({ "aidea-plugin.json": JSON.stringify(manifest("fixture.boom")), "main.js": `export function activate() { throw new Error("it broke"); }` });
    const res = await t.post("/plugins/install", { id: q.id });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "failed");
    assert.match(res.body.reason, /it broke/);
    assert.ok(!existsSync(join(t.store, "fixture.boom")), "the store is as it was");
    assert.deepEqual(await t.list(), []);
    assert.equal((await fetch(t.core.url + `/plugins/quarantine/${q.id}`)).status, 200);
  } finally { t.core.close(); }
});

test("two installs at the same time: one runs, the other is refused as busy", async () => {
  const t = await start();
  try {
    const slow = `export async function activate() { await new Promise((r) => setTimeout(r, 300)); }`;
    const a = await t.quarantine({ "aidea-plugin.json": JSON.stringify(manifest("fixture.slow-a")), "main.js": slow });
    const b = await t.quarantine({ "aidea-plugin.json": JSON.stringify(manifest("fixture.slow-b")), "main.js": slow });
    const statuses = (await Promise.all([t.post("/plugins/install", { id: a.id }), t.post("/plugins/install", { id: b.id })])).map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal((await t.list()).length, 1);
    const left = ((await (await fetch(t.core.url + "/plugins/quarantine")).json()) as any).entries[0].id;
    const retry = await t.post("/plugins/install", { id: left });
    assert.equal(retry.status, 200, "once the first is done the other can be installed");
  } finally { t.core.close(); }
});

test("an unknown quarantine id is a 404 and a malformed one is a 400", async () => {
  const t = await start();
  try {
    assert.equal((await t.post("/plugins/install", { id: "deadbeef" })).status, 404);
    assert.equal((await t.post("/plugins/install", { id: "../../x" })).status, 400);
    assert.equal((await t.post("/plugins/install", {})).status, 400);
    assert.equal((await t.post("/plugins/install", { id: "deadbeef", confirm: "x" })).status, 400);
  } finally { t.core.close(); }
});

test("an installed plugin with an interface half serves it at once", async () => {
  const t = await start();
  try {
    const q = await t.quarantine({ "aidea-plugin.json": JSON.stringify(manifest("fixture.ui", { main: undefined, ui: "ui.js" })), "ui.js": "export function activate() {}" });
    assert.equal((await t.post("/plugins/install", { id: q.id })).status, 200);
    assert.equal((await fetch(t.core.url + "/plugins/fixture.ui/ui")).status, 200);
  } finally { t.core.close(); }
});
