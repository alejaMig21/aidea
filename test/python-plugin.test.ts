import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// language-plugins 02: Python is a plugin that ships with aidea, on by default; switching it off makes Python files show as not analysed.
const scratch = mkdtempSync(join(tmpdir(), "aidea-python-plugin-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

let n = 0;
const post = async (core: any, path: string, body: unknown) => (await fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json() as Promise<any>;
function project() {
  const dir = join(scratch, `proj${n++}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "app.py"), "def hello():\n    return 1\n");
  return dir;
}

test("Python ships as a plugin that is on by default, with the capabilities it declares and a lesson", async () => {
  const core = await startCore({ port: 0, pluginsDir: join(scratch, `s${n++}`) });
  try {
    const { plugins } = (await (await fetch(core.url + "/plugins")).json()) as any;
    const py = plugins.find((p: any) => p.id === "python");
    assert.ok(py, "the plugin is listed");
    assert.deepEqual([py.state, py.builtin, py.required], ["active", true, false]);
    assert.deepEqual(py.capabilities.sort(), ["files", "processes"]);
    const opened = await post(core, "/projects", { path: project() });
    assert.deepEqual(opened.languages, [{ language: "python", label: "Python", files: 1, analysed: true }]);
    assert.ok(opened.nodes.some((x: any) => x.name === "hello"));
  } finally { core.close(); }
});

test("switching it off makes Python files show as not analysed; switching it on brings the analysis back", async () => {
  const core = await startCore({ port: 0, pluginsDir: join(scratch, `s${n++}`) });
  try {
    const path = project();
    assert.equal((await post(core, "/plugins/disable", { id: "python" })).status, "applied");
    const off = await post(core, "/projects", { path });
    assert.deepEqual(off.languages, [{ language: "python", label: "Python", files: 1, analysed: false }]);
    assert.deepEqual(off.nodes, []);
    assert.equal((await post(core, "/plugins/enable", { id: "python" })).status, "applied");
    const on = await post(core, "/projects", { path });
    assert.deepEqual(on.languages, [{ language: "python", label: "Python", files: 1, analysed: true }]);
  } finally { core.close(); }
});

test("with no folder of shipped plugins the core keeps Python built in, owned by aidea", async () => {
  const core = await startCore({ port: 0, pluginsDir: join(scratch, `s${n++}`), builtinPluginsDir: false });
  try {
    const opened = await post(core, "/projects", { path: project() });
    assert.deepEqual(opened.languages, [{ language: "python", label: "Python", files: 1, analysed: true }]);
  } finally { core.close(); }
});
