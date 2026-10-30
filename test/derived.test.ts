import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { CoreNode } from "../src/core/types.ts";
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
before(async () => {
  t = await startTestCore();
});
after(() => t.core.close());

const open = async (path: string) => (await t.post("/projects", { path })).json();

test("a class Node lists its attributes: class-level assignments, then assignments in __init__", async () => {
  const project = await open(fixture("members"));
  const account = project.nodes.find((n: CoreNode) => n.id === "models.Account");
  assert.deepEqual(account.attributes.map((a: { name: string }) => a.name), ["kind", "limit", "owner", "balance"]);
  assert.deepEqual(account.attributes[2], { name: "owner", line: 6 });
  // Methods stay function Nodes whose parent is the class.
  const methods = project.nodes.filter((n: CoreNode) => n.parent === "models.Account").map((n: CoreNode) => n.name);
  assert.deepEqual(methods, ["__init__", "summary"]);
});

const source = (project: string, node: string) =>
  t.get(`/source?project=${encodeURIComponent(project)}&node=${encodeURIComponent(node)}`);

test("the Code layer returns the exact source text of a method, with its file and lines", async () => {
  await open(fixture("shop"));
  const res = await source(fixture("shop"), "cart.Cart.add");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    file: "cart.py",
    line: 5,
    endLine: 6,
    text: "    def add(self, price):\n        self.items.append(price)",
  });
});

test("the source of a decorated method starts at its decorator", async () => {
  await open(fixture("members"));
  const body = await (await source(fixture("members"), "models.Account.summary")).json();
  assert.equal(body.line, 9);
  assert.equal(body.endLine, 11);
  assert.match(body.text, /^    @property\n/);
});

test("the source of a class covers the whole class", async () => {
  await open(fixture("shop"));
  const body = await (await source(fixture("shop"), "cart.Cart")).json();
  assert.equal(body.line, 1);
  assert.equal(body.endLine, 9);
});

test("asking for source with bad input gives clear 4xx errors", async () => {
  await open(fixture("shop"));
  assert.equal((await t.get("/source")).status, 400);
  assert.equal((await source(fixture("members") + "-never-opened", "x")).status, 404);
  assert.equal((await source(fixture("shop"), "cart.Nope")).status, 404);
});

const post = (path: string, body: unknown) => t.post(path, body);

async function withFakeEditor<T>(run: (readArgs: () => Promise<string[]>) => Promise<T>) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-editor-"));
  const out = join(dir, "args.json");
  const saved = { ...process.env };
  process.env.AIDEA_EDITOR = process.execPath;
  process.env.AIDEA_EDITOR_ARGS = JSON.stringify([fixture("fake-editor/editor.js")]);
  process.env.FAKE_EDITOR_OUT = out;
  const readArgs = async () => {
    for (let i = 0; i < 100 && !existsSync(out); i++) await new Promise((r) => setTimeout(r, 50));
    return JSON.parse(readFileSync(out, "utf-8"));
  };
  try {
    return await run(readArgs);
  } finally {
    process.env = saved;
    rmSync(dir, { recursive: true, force: true });
  }
}

test("open in my editor starts the configured editor on the Node's file and line, without a shell", async () => {
  await open(fixture("shop"));
  await withFakeEditor(async (readArgs) => {
    const res = await post("/open-in-editor", { project: fixture("shop"), node: "cart.Cart.add" });
    assert.equal(res.status, 200);
    assert.deepEqual(await readArgs(), ["--goto", `${realpathSync(fixture("shop"))}${sep}cart.py:5`]);
  });
});

test("the chosen editor is saved per Project, listed with its choices, and used by open in my editor", async () => {
  const project = fixture("shop");
  await open(project);
  const q = `/editor-setting?project=${encodeURIComponent(project)}`;
  const first = await (await t.get(q)).json();
  assert.equal(first.editor, "vscode");
  assert.ok(first.editors.some((e: { id: string }) => e.id === "idea"));
  assert.equal((await post("/editor-setting", { project, editor: "emacs" })).status, 400);
  assert.equal((await post("/editor-setting", { project, editor: "custom", template: "ed --line {line}" })).status, 400);
  assert.equal((await post("/editor-setting", { project, editor: "custom", template: `"${process.execPath}" "${fixture("fake-editor/editor.js")}" at={line} {file}` })).status, 200);
  const saved = await (await t.get(q)).json();
  assert.equal(saved.editor, "custom");
  const saved2 = process.env.FAKE_EDITOR_OUT;
  const dir = mkdtempSync(join(tmpdir(), "aidea-editor-"));
  process.env.FAKE_EDITOR_OUT = join(dir, "args.json");
  try {
    assert.equal((await post("/open-in-editor", { project, node: "cart.Cart.add" })).status, 200);
    for (let i = 0; i < 100 && !existsSync(join(dir, "args.json")); i++) await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "args.json"), "utf-8")), ["at=5", `${realpathSync(project)}${sep}cart.py`]);
  } finally {
    if (saved2 === undefined) delete process.env.FAKE_EDITOR_OUT; else process.env.FAKE_EDITOR_OUT = saved2;
    rmSync(dir, { recursive: true, force: true });
    await post("/editor-setting", { project, editor: "vscode" });
  }
});

test("open in my editor says in words when the chosen editor cannot start", async () => {
  const project = fixture("shop");
  await open(project);
  await post("/editor-setting", { project, editor: "custom", template: "aidea-no-such-editor-xyz {file}" });
  try {
    const res = await post("/open-in-editor", { project, node: "cart.Cart.add" });
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /Could not start the editor/);
  } finally {
    await post("/editor-setting", { project, editor: "vscode" });
  }
});

test("open in my editor rejects unknown Projects and Nodes and bad input", async () => {
  await open(fixture("shop"));
  assert.equal((await post("/open-in-editor", { project: fixture("shop") })).status, 400);
  assert.equal((await post("/open-in-editor", "not json")).status, 400);
  assert.equal((await post("/open-in-editor", { project: fixture("shop") + "-never-opened", node: "x" })).status, 404);
  assert.equal((await post("/open-in-editor", { project: fixture("shop"), node: "cart.Nope" })).status, 404);
});

const refresh = (project: string) => t.post("/projects/refresh", { project });

test("refreshing an open Project re-reads the code, keeps its id and does not reorder the recents", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-refresh-"));
  const other = mkdtempSync(join(tmpdir(), "aidea-refresh-other-"));
  cpSync(fixture("shop"), dir, { recursive: true });
  try {
    const before = await open(dir);
    await open(other); // now the most recent
    appendFileSync(join(dir, "cart.py"), "\n\nclass Wishlist:\n    pass\n");
    const res = await refresh(before.id);
    assert.equal(res.status, 200);
    const after = await res.json();
    assert.equal(after.id, before.id);
    assert.ok(after.nodes.some((n: CoreNode) => n.id === "cart.Wishlist"));
    assert.ok(!before.nodes.some((n: CoreNode) => n.id === "cart.Wishlist"));
    // the layout (Components layer) is built from the refreshed Nodes
    const layout = await (await t.get(`/layout?project=${encodeURIComponent(before.id)}&layer=components`)).json();
    assert.ok(layout.rects.some((r: { id: string }) => r.id === "cart.Wishlist"));
    const recents = await (await t.get("/recents")).json();
    assert.equal(recents[0].path.toLowerCase(), other.toLowerCase());
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});

test("refreshing a Project that is not open, or whose folder is gone, says so and keeps what was drawn", async () => {
  assert.equal((await refresh(join(tmpdir(), "aidea-never-opened"))).status, 404);
  const dir = mkdtempSync(join(tmpdir(), "aidea-refresh-gone-"));
  cpSync(fixture("shop"), dir, { recursive: true });
  const opened = await open(dir);
  rmSync(dir, { recursive: true, force: true });
  const res = await refresh(opened.id);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /folder/i);
  assert.equal((await t.get(`/layout?project=${encodeURIComponent(opened.id)}&layer=components`)).status, 200);
});

test("a file that resolves outside the Project folder is never served or opened", async () => {
  const outside = mkdtempSync(join(tmpdir(), "aidea-outside-"));
  const project = mkdtempSync(join(tmpdir(), "aidea-project-"));
  writeFileSync(join(outside, "secret.py"), "def leak():\n    return 1\n");
  writeFileSync(join(project, "ok.py"), "def fine():\n    return 1\n");
  symlinkSync(outside, join(project, "linked"), "junction");
  try {
    const nodes = (await open(project)).nodes as CoreNode[];
    assert.ok(nodes.some((n) => n.id === "linked.secret.leak"), "analysis follows the link, so the check below is what protects the file");
    assert.equal((await source(project, "linked.secret.leak")).status, 403);
    assert.equal((await post("/open-in-editor", { project, node: "linked.secret.leak" })).status, 403);
    assert.equal((await source(project, "ok.fine")).status, 200);
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("editing a file by hand and reopening the Project changes the derived layers", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-refresh-"));
  cpSync(fixture("shop"), dir, { recursive: true });
  try {
    const before = await open(dir);
    assert.ok(!before.nodes.some((n: CoreNode) => n.id === "cart.Wishlist"));
    appendFileSync(join(dir, "cart.py"), "\n\nclass Wishlist:\n    def __init__(self):\n        self.titles = []\n");
    const after = await open(dir);
    const ids = after.nodes.map((n: CoreNode) => n.id);
    assert.ok(ids.includes("cart.Wishlist") && ids.includes("cart.Wishlist.__init__"));
    const wishlist = after.nodes.find((n: CoreNode) => n.id === "cart.Wishlist");
    assert.deepEqual(wishlist.attributes, [{ name: "titles", line: 20 }]);
    assert.match((await (await source(dir, "cart.Wishlist")).json()).text, /^class Wishlist:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const whole = (project: string, node: string, extra = "") =>
  t.get(`/source?project=${encodeURIComponent(project)}&node=${encodeURIComponent(node)}&whole=1${extra}`);

test("the Code layer can ask for the whole file of a Node, with the Node's lines to highlight", async () => {
  await open(fixture("shop"));
  const res = await whole(fixture("shop"), "cart.Cart.add");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.file, "cart.py");
  assert.equal(body.line, 5);
  assert.equal(body.endLine, 6);
  assert.equal(body.text, readFileSync(join(fixture("shop"), "cart.py"), "utf-8"));
});

test("the whole file can be asked with another range, as for a step of an Algorithm", async () => {
  await open(fixture("shop"));
  const body = await (await whole(fixture("shop"), "cart.apply_discount", "&from=13&to=14")).json();
  assert.equal(body.line, 13);
  assert.equal(body.endLine, 14);
  assert.match(body.text, /^class Cart:/);
  for (const bad of ["&from=0&to=2", "&from=5&to=4", "&from=2&to=9999", "&from=x&to=3", "&from=3"]) {
    assert.equal((await whole(fixture("shop"), "cart.apply_discount", bad)).status, 400, bad);
  }
});

test("a file that is too big, not text, or gone is refused with a plain sentence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-source-"));
  cpSync(fixture("shop"), dir, { recursive: true });
  try {
    await open(dir);
    writeFileSync(join(dir, "cart.py"), "x = 1\n".repeat(100_000)); // 600 KB
    const big = await whole(dir, "cart.Cart.add");
    assert.equal(big.status, 413);
    assert.match((await big.json()).error, /too big/i);
    assert.equal((await source(dir, "cart.Cart.add")).status, 413);
    writeFileSync(join(dir, "cart.py"), Buffer.from([0x63, 0x00, 0xff, 0x00, 0x0a]));
    const binary = await whole(dir, "cart.Cart.add");
    assert.equal(binary.status, 415);
    assert.match((await binary.json()).error, /not text/i);
    rmSync(join(dir, "cart.py"));
    const gone = await whole(dir, "cart.Cart.add");
    assert.equal(gone.status, 404);
    assert.match((await gone.json()).error, /moved|deleted|read/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the whole file is never served from outside the Project folder", async () => {
  const outside = mkdtempSync(join(tmpdir(), "aidea-outside-"));
  const project = mkdtempSync(join(tmpdir(), "aidea-project-"));
  writeFileSync(join(outside, "secret.py"), "def leak():\n    return 1\n");
  writeFileSync(join(project, "ok.py"), "def fine():\n    return 1\n");
  symlinkSync(outside, join(project, "linked"), "junction");
  try {
    await open(project);
    assert.equal((await whole(project, "linked.secret.leak")).status, 403);
    assert.equal((await whole(project, "ok.fine")).status, 200);
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
