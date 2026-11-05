import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { scanPlugin } from "../src/core/plugins/scan.ts";
import { runPluginTeachTool } from "../src/core/plugins/teach.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// plugin-teaching 05: the Run plugin (the one that starts the programs of a Project with Play) declares a real surface: a view of its recipe and programs, and checks the Tutor can run before and after the person acts.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "aidea-run-surface-"));
const cores: { close(): void }[] = [];
after(() => { for (const c of cores) c.close(); rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  const project = join(scratch, "project");
  cpSync(fixture("shop"), project, { recursive: true });
  mkdirSync(join(project, ".aidea"), { recursive: true });
  writeFileSync(join(project, ".aidea", "run.json"), JSON.stringify({ parts: [{ name: "waiter", command: `node -e "setInterval(() => {}, 1000)"` }] }));
  const store = join(scratch, "store");
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, pluginsDir: store });
  cores.push(core);
  const id = ((await (await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) })).json()) as any).id;
  const call = async (name: string, body: object = {}) => (await (await fetch(`${core.url}/plugins/run/call/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id, ...body }) })).json()) as any;
  const view = async () => JSON.parse((await runPluginTeachTool("read_plugin_view", { id: "run" }, core as any, {}, { project: id }))!.text).view;
  const check = async (name: string, args: object = {}) => JSON.parse((await runPluginTeachTool("check_plugin", { id: "run", name, args }, core as any, {}, { project: id }))!.text).result;
  return { core, id, call, view, check };
}

test("the Run plugin declares a surface and the scan shows no surface warning for it", () => {
  const report = scanPlugin(join(root, "src", "plugins", "run"));
  assert.equal(report.blocking, 0);
  assert.deepEqual(report.findings.filter((f) => f.id === "no-surface" || f.id === "surface-stale"), []);
  assert.deepEqual(report.manifest!.teach!.checks.map((c) => c.name).sort(), ["all-running", "part-running", "recipe-accepted"]);
});

test("the view and the checks answer correctly before the person accepts the recipe, after they accept it, while Play runs and after Stop", async () => {
  const t = await boot();
  const before = await t.view();
  assert.equal(before.recipe, "needs-accept");
  assert.deepEqual(before.programs, []);
  assert.equal((await t.check("recipe-accepted")).ok, false);
  assert.equal((await t.check("all-running")).ok, false);

  await t.call("accept");
  assert.equal((await t.view()).recipe, "accepted");
  assert.equal((await t.check("recipe-accepted")).ok, true);
  assert.equal((await t.check("part-running", { program: "waiter" })).ok, false, "accepted is not started");

  assert.equal((await t.call("play")).started, true);
  for (let i = 0; i < 100 && !(await t.check("all-running")).ok; i++) await wait(50);
  assert.equal((await t.check("part-running", { program: "waiter" })).ok, true);
  assert.equal((await t.check("all-running")).ok, true);
  assert.deepEqual((await t.view()).programs, [{ name: "waiter", running: true, exitCode: null }]);
  assert.match((await t.check("part-running", { program: "ghost" })).reason, /no program/i);

  await t.call("stopAll");
  for (let i = 0; i < 100 && (await t.check("all-running")).ok; i++) await wait(50);
  assert.equal((await t.check("all-running")).ok, false);
});
