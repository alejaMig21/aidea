import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// Ticket plugin-system/08: a new version of an installed plugin goes to the quarantine, is compared with the accepted version, and never applies without the person.
const scratch = mkdtempSync(join(tmpdir(), "aidea-update-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const manifest = (version: string, extra: object = {}) => ({ id: "fixture.up", version, title: "Updatable", description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra });
const QUIET = `export function activate() {}`;
let n = 0;
function source(files: Record<string, string>) {
  const dir = join(scratch, `src${n++}`);
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return dir;
}
async function start(store = join(scratch, `store${n++}`)) {
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  const post = async (path: string, body: unknown) => {
    const res = await fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as any };
  };
  const quarantine = async (files: Record<string, string>) => (await post("/plugins/quarantine", { source: source(files) })).body;
  const find = async () => (((await (await fetch(core.url + "/plugins")).json()) as any).plugins as any[]).find((p) => p.id === "fixture.up");
  const keys = (q: any) => q.report.findings.filter((f: any) => f.severity === "block").map((f: any) => f.key);
  return { core, store, post, quarantine, find, keys };
}
const v1 = { "aidea-plugin.json": JSON.stringify(manifest("1.0.0")), "main.js": QUIET, "keep.txt": "same", "gone.txt": "old" };

test("a quarantine entry for an installed plugin carries the difference with the accepted version", async () => {
  const t = await start();
  try {
    const first = await t.quarantine(v1);
    assert.equal(first.update, undefined, "a plugin that is not installed is not an update");
    await t.post("/plugins/install", { id: first.id });
    const next = await t.quarantine({
      "aidea-plugin.json": JSON.stringify(manifest("1.1.0", { capabilities: ["network"] })),
      "main.js": `export function activate() { fetch("http://127.0.0.1:1/").catch(() => {}); }`, "keep.txt": "same", "new.txt": "added",
    });
    assert.deepEqual([next.update.version.from, next.update.version.to], ["1.0.0", "1.1.0"]);
    assert.deepEqual(next.update.files, { added: ["new.txt"], removed: ["gone.txt"], changed: ["aidea-plugin.json", "main.js"] });
    assert.deepEqual(next.update.capabilities, { added: ["network"], removed: [] });
    assert.ok(next.update.newFindings.some((f: any) => f.id === "capability-used"), "the scan of the new version, as news");
  } finally { t.core.close(); }
});

test("an update applies only after the person confirms: files replaced, the old copy gone, and a restart asked for because the old code ran", async () => {
  const t = await start();
  try {
    await t.post("/plugins/install", { id: (await t.quarantine(v1)).id });
    const next = await t.quarantine({ ...v1, "aidea-plugin.json": JSON.stringify(manifest("1.0.1")), "new.txt": "added" });
    const res = await t.post("/plugins/update", { id: next.id });
    assert.deepEqual([res.status, res.body.status], [200, "restart-required"]);
    assert.equal(JSON.parse(readFileSync(join(t.store, "fixture.up", "aidea-plugin.json"), "utf8")).version, "1.0.1");
    assert.ok(existsSync(join(t.store, "fixture.up", "new.txt")));
    assert.deepEqual(readdirSync(t.store).filter((f) => !f.startsWith(".")), ["fixture.up"], "no backup is left behind");
    assert.match((await t.find()).reason, /restart/i);
    assert.equal((await fetch(t.core.url + `/plugins/quarantine/${next.id}`)).status, 404, "the entry left the quarantine");
  } finally { t.core.close(); }
});

test("after a restart the new version is the one that runs", async () => {
  const store = join(scratch, `store${n++}`);
  const t = await start(store);
  await t.post("/plugins/install", { id: (await t.quarantine(v1)).id });
  await t.post("/plugins/update", { id: (await t.quarantine({ ...v1, "aidea-plugin.json": JSON.stringify(manifest("1.0.1")) })).id });
  t.core.close();
  const again = await start(store);
  try {
    const p = await again.find();
    assert.deepEqual([p.version, p.state], ["1.0.1", "active"]);
  } finally { again.core.close(); }
});

test("an update that is not newer is refused, and so is one for a plugin that is not installed", async () => {
  const t = await start();
  try {
    await t.post("/plugins/install", { id: (await t.quarantine(v1)).id });
    const same = await t.quarantine(v1);
    const res = await t.post("/plugins/update", { id: same.id });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /newer/);
    const other = await t.quarantine({ ...v1, "aidea-plugin.json": JSON.stringify({ ...manifest("2.0.0"), id: "fixture.other" }) });
    assert.equal((await t.post("/plugins/update", { id: other.id })).status, 409);
    assert.match((await t.post("/plugins/update", { id: other.id })).body.error, /not installed/);
  } finally { t.core.close(); }
});

test("an earlier confirmation is not inherited: a blocking finding of the new version is confirmed again, by name", async () => {
  const loud = (version: string) => ({ "aidea-plugin.json": JSON.stringify(manifest(version)), "main.js": `fetch("http://127.0.0.1:1/").catch(() => {}); export function activate() {}` });
  const t = await start();
  try {
    const first = await t.quarantine(loud("1.0.0"));
    assert.equal((await t.post("/plugins/install", { id: first.id, confirm: t.keys(first) })).status, 200);
    const next = await t.quarantine(loud("1.0.1"));
    const refused = await t.post("/plugins/update", { id: next.id });
    assert.equal(refused.status, 409);
    assert.deepEqual(refused.body.missing, t.keys(next));
    assert.deepEqual((await t.post("/plugins/update", { id: next.id, confirm: t.keys(next) })).body.status, "restart-required");
  } finally { t.core.close(); }
});

test("a plugin that never ran in this session is updated live; the one the person switched off stays off", async () => {
  const store = join(scratch, `store${n++}`);
  const first = await start(store);
  await first.post("/plugins/install", { id: (await first.quarantine(v1)).id });
  await first.post("/plugins/disable", { id: "fixture.up" });
  first.core.close();
  const t = await start(store);
  try {
    const res = await t.post("/plugins/update", { id: (await t.quarantine({ ...v1, "aidea-plugin.json": JSON.stringify(manifest("1.0.1")) })).id });
    assert.deepEqual([res.status, res.body.status], [200, "applied"]);
    const p = await t.find();
    assert.deepEqual([p.version, p.state], ["1.0.1", "inactive"]);
    assert.match(p.reason, /switched off/);
  } finally { t.core.close(); }
});
