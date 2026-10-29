import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCore } from "../src/core/server.ts";

const core = await startCore({ port: 0, adapter: { options: { modes: [], models: [] }, run: async function* () {} } });
after(() => core.close());

// Folders that hold copies of code, not the project's own code (builds, installers, virtual environments), must not be drawn as part of it.
test("build output and virtual environments are not analysed as part of the project", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-skip-"));
  const put = (path: string) => { mkdirSync(join(dir, path, ".."), { recursive: true }); writeFileSync(join(dir, path), "def f():\n    return 1\n"); };
  for (const own of ["app.py", "pkg/core.py", "tests/test_core.py"]) put(own);
  for (const copy of ["dist/app/app.py", "build/lib/app.py", "env/lib/site-packages/x.py", "venv/lib/y.py", ".venv/lib/z.py", "node_modules/m/m.py", "pkg/site-packages/w.py"]) put(copy);
  const res = await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: dir }) });
  const body = (await res.json()) as { nodes: { kind: string; file: string }[] };
  assert.deepEqual(body.nodes.filter((n) => n.kind === "module").map((n) => n.file).sort(), ["app.py", "pkg/core.py", "tests/test_core.py"]);
});
