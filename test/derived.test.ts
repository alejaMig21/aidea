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
