import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { after, test } from "node:test";
import { fixture, startTestCore } from "./helpers.ts";

const t = await startTestCore();
after(() => t.core.close());

const project = fixture("shop");
const id = ((await (await t.post("/projects", { path: project })).json()) as { id: string }).id;

// Runs the request with a fake editor that records its arguments; returns the status and the arguments (null if it never started).
async function openWith(body: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-editor-file-"));
  const out = join(dir, "args.json");
  const saved = { ...process.env };
  process.env.AIDEA_EDITOR = process.execPath;
  process.env.AIDEA_EDITOR_ARGS = JSON.stringify([fixture("fake-editor/editor.js")]);
  process.env.FAKE_EDITOR_OUT = out;
  try {
    const res = await t.post("/open-in-editor", { project: id, ...body });
    if (res.status === 200) for (let i = 0; i < 100 && !existsSync(out); i++) await new Promise((r) => setTimeout(r, 50));
    return { status: res.status, error: res.status === 200 ? "" : ((await res.json()) as { error: string }).error, args: existsSync(out) ? (JSON.parse(readFileSync(out, "utf-8")) as string[]) : null };
  } finally {
    process.env = saved;
    rmSync(dir, { recursive: true, force: true });
  }
}

const real = (name: string) => `${realpathSync(project)}${sep}${name}`;

test("open in my editor accepts a file path in the Project, with a line", async () => {
  const r = await openWith({ file: "cart.py", line: 7 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.args, ["--goto", `${real("cart.py")}:7`]);
});

test("a file path without a line opens at line 1", async () => {
  assert.deepEqual((await openWith({ file: "cart.py" })).args, ["--goto", `${real("cart.py")}:1`]);
});

test("a line that is not a positive whole number is refused and no editor starts", async () => {
  for (const line of [0, -2, 1.5, "3", null]) {
    const r = await openWith({ file: "cart.py", line });
    assert.equal(r.status, 400, String(line));
    assert.equal(r.args, null);
  }
});

test("a file path outside the Project, a missing file and a folder never start the editor", async () => {
  for (const file of ["../helpers.ts", "..\\helpers.ts", "C:/Windows/win.ini", "/etc/passwd"]) {
    const r = await openWith({ file });
    assert.ok([400, 403, 404].includes(r.status), `${file} -> ${r.status}`);
    assert.equal(r.args, null, file);
  }
  const gone = await openWith({ file: "nope.py" });
  assert.equal(gone.status, 404);
  assert.match(gone.error, /moved|deleted/i);
  const dir = mkdtempSync(join(tmpdir(), "aidea-editor-dir-"));
  try {
    mkdirSync(join(dir, "folder"));
    writeFileSync(join(dir, "a.py"), "a = 1\n");
    const other = ((await (await t.post("/projects", { path: dir })).json()) as { id: string }).id;
    const r = await openWith({ project: other, file: "folder" });
    assert.equal(r.status, 400);
    assert.equal(r.args, null);
    assert.equal((await openWith({ project: other, file: "a.py" })).status, 200);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a file name full of shell characters stays one argument", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-editor-evil-"));
  const evil = "a; echo hi && $(x).py";
  try {
    writeFileSync(join(dir, evil), "x = 1\n");
    const other = ((await (await t.post("/projects", { path: dir })).json()) as { id: string }).id;
    const r = await openWith({ project: other, file: evil, line: 1 });
    assert.deepEqual(r.args, ["--goto", `${realpathSync(dir)}${sep}${evil}:1`]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the Node form still works, and a request with neither node nor file is refused", async () => {
  assert.deepEqual((await openWith({ node: "cart.Cart.add" })).args, ["--goto", `${real("cart.py")}:5`]);
  assert.equal((await openWith({})).status, 400);
});
