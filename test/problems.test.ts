import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const scratch: string[] = [];
before(async () => {
  t = await startTestCore();
});
after(() => {
  t.core.close();
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

const authored = async (path: string) => (await t.get(`/authored?project=${encodeURIComponent(path)}`)).json() as Promise<any>;
const copyOf = (name: string) => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-problems-"));
  scratch.push(dir);
  cpSync(fixture(name), dir, { recursive: true });
  return dir;
};

test("a project without problems has an empty problems list", async () => {
  await t.post("/projects", { path: fixture("studio") });
  assert.deepEqual((await authored(fixture("studio"))).problems, []);
});

test("each bad requirement becomes a problem with its layer, file, id, field and a message that says it was ignored", async () => {
  await t.post("/projects", { path: fixture("studio-requirements") });
  const body = await authored(fixture("studio-requirements"));
  assert.equal(body.problems.length, 6);
  assert.equal(body.problems.length, body.layers.requirements.errors.length); // the old text stays alongside
  for (const p of body.problems) {
    assert.equal(p.layer, "requirements");
    assert.equal(p.file, ".aidea/requirements.json");
    assert.match(p.message, /ignored\.$/);
  }
  assert.deepEqual(body.problems.map((p: any) => [p.id, p.index, p.field]), [
    ["bad-no-statement", 3, "statement"],
    ["bad-quality", 4, "quality"],
    ["bad-measure", 5, "measure"],
    ["bad-kind", 6, "kind"],
    ["bad-criteria", 7, "criteria"],
    ["bad-functional", 8, "as"],
  ]);
  assert.equal(body.problems[0].message, 'It needs a non-empty "statement". The item was ignored.');
});

test("an item without an id is named by its position; a bad file has no item", async () => {
  const dir = copyOf("studio");
  writeFileSync(join(dir, ".aidea", "business.json"), JSON.stringify({ nodes: [{ title: "no id" }] }));
  writeFileSync(join(dir, ".aidea", "architecture.json"), "{ nope");
  await t.post("/projects", { path: dir });
  const { problems } = await authored(dir);
  const biz = problems.find((p: any) => p.layer === "business");
  assert.equal(biz.id, undefined);
  assert.equal(biz.index, 0);
  assert.equal(biz.field, "id");
  const arch = problems.find((p: any) => p.layer === "architecture");
  assert.equal(arch.index, undefined);
  assert.match(arch.message, /not valid JSON/);
});

test("a relation to a missing Node is a problem of the Node that owns it, with the relation named", async () => {
  const dir = copyOf("studio-c4");
  const file = join(dir, ".aidea", "architecture.json");
  const doc = JSON.parse(readFileSync(file, "utf8"));
  doc.nodes[0].relations = [...(doc.nodes[0].relations ?? []), { to: "ghost", label: "uses" }];
  writeFileSync(file, JSON.stringify(doc));
  await t.post("/projects", { path: dir });
  const { problems } = await authored(dir);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].layer, "architecture");
  assert.equal(problems[0].id, doc.nodes[0].id);
  assert.match(problems[0].field, /^relations\[\d+\]\.to$/);
  assert.equal(problems[0].message, 'It points to "ghost", which does not exist. The relation was ignored.');
});
