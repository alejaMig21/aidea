import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const scratch: string[] = [];
before(async () => {
  t = await startTestCore();
});
after(() => {
  t.core.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const why = { why: "Because.", rejected: [{ option: "Else", reason: "Worse." }] };
const nodes: Record<string, any[]> = {
  business: [
    { id: "cs-owners", title: "Shop owners", block: "customer segments", rationale: why },
    { id: "vp-fast", title: "Quotes in a minute", block: "value propositions", rationale: why },
  ],
  requirements: [
    { id: "us-quote", title: "Request a quote", as: "owner", want: "a form", so: "I get a price", traces: ["cs-owners"], rationale: why },
  ],
  architecture: [
    { id: "db", title: "Database", technology: "SQLite", kind: "container", parent: "web", rationale: why },
    { id: "web", title: "Web app", technology: "Node", kind: "container", relations: [{ to: "db", label: "reads" }], traces: ["us-quote"], rationale: why },
  ],
};
const group = { id: "hex", name: "Hexagon", kind: "hexagonal", roles: [{ node: "web", role: "adapter" }, { node: "db", role: "infrastructure" }] };

const put = (dir: string, rel: string, body: unknown) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), typeof body === "string" ? body : JSON.stringify(body));
};
async function open(write: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-pernode-"));
  scratch.push(dir);
  put(dir, "a.py", "def a():\n    return 1\n");
  write(dir);
  await t.post("/projects", { path: dir });
  return dir;
}
const oneFilePerLayer = (dir: string) => {
  for (const [layer, list] of Object.entries(nodes)) put(dir, `.aidea/${layer}.json`, layer === "architecture" ? { nodes: list, patterns: [group] } : { nodes: list });
};
const onePerNode = (dir: string) => {
  for (const [layer, list] of Object.entries(nodes)) for (const n of list) put(dir, `.aidea/${layer}/${n.id}.json`, n);
  put(dir, `.aidea/architecture/patterns/${group.id}.json`, group);
};
const q = (dir: string) => `project=${encodeURIComponent(dir)}`;
const json = async (path: string) => (await t.get(path)).json() as Promise<any>;

test("a project stored per Node reads the same as one file per layer", async () => {
  const a = await open(oneFilePerLayer);
  const b = await open(onePerNode);
  for (const path of [
    (d: string) => `/layout?${q(d)}&layer=business`,
    (d: string) => `/layout?${q(d)}&layer=requirements`,
    (d: string) => `/layout?${q(d)}&layer=architecture`,
    (d: string) => `/contract?${q(d)}`,
    (d: string) => `/patterns?${q(d)}`,
    (d: string) => `/drift?${q(d)}`,
    (d: string) => `/traces?${q(d)}`,
  ]) assert.deepEqual(await json(path(b)), await json(path(a)), path(a).split("?")[0]);

  const per = await json(`/authored?${q(b)}`);
  const one = await json(`/authored?${q(a)}`);
  assert.deepEqual(per.problems, []);
  for (const layer of Object.keys(nodes)) assert.deepEqual(per.layers[layer].nodes.map((n: any) => n.id), one.layers[layer].nodes.map((n: any) => n.id));
  assert.deepEqual(per.layers.architecture.patterns, [group]);
  assert.deepEqual(per.layers.architecture.errors, []);
});

test("both forms can be mixed in one layer", async () => {
  const dir = await open((d) => {
    put(d, ".aidea/business.json", { nodes: [nodes.business[0]] });
    put(d, ".aidea/business/vp-fast.json", nodes.business[1]);
  });
  const body = await json(`/authored?${q(dir)}`);
  assert.deepEqual(body.layers.business.nodes.map((n: any) => n.id), ["cs-owners", "vp-fast"]);
  assert.deepEqual(body.problems, []);
});

test("an id in both forms is a problem naming both files, and the per-Node file wins", async () => {
  const dir = await open((d) => {
    put(d, ".aidea/business.json", { nodes: [{ ...nodes.business[0], title: "Old title" }] });
    put(d, ".aidea/business/cs-owners.json", nodes.business[0]);
  });
  const body = await json(`/authored?${q(dir)}`);
  assert.deepEqual(body.layers.business.nodes.map((n: any) => n.title), ["Shop owners"]);
  const errors = body.layers.business.errors;
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /cs-owners/);
  assert.match(errors[0].message, /\.aidea\/business\.json/);
  assert.match(errors[0].message, /\.aidea\/business\/cs-owners\.json/);
  assert.equal(body.problems.length, 1);
  assert.equal(body.problems[0].layer, "business");
});

test("a malformed Node file is dropped alone with its error", async () => {
  const dir = await open((d) => {
    put(d, ".aidea/business/good.json", nodes.business[0]);
    put(d, ".aidea/business/broken.json", "{ not json");
    put(d, ".aidea/business/no-title.json", { ...nodes.business[1], title: "" });
    put(d, ".aidea/business/list.json", [1]);
  });
  const body = await json(`/authored?${q(dir)}`);
  assert.deepEqual(body.layers.business.nodes.map((n: any) => n.id), ["cs-owners"]);
  assert.deepEqual(body.layers.business.errors.map((e: any) => e.file).sort(), [".aidea/business/broken.json", ".aidea/business/list.json", ".aidea/business/no-title.json"]);
  assert.match(body.layers.business.errors.find((e: any) => e.file.endsWith("broken.json")).message, /not valid JSON/);
  assert.equal(body.problems.length, 3);
  assert.ok(body.problems.every((p: any) => p.layer === "business" && p.file.startsWith(".aidea/business/")));
});

test("a Pattern group file that names a missing Node loses that role; a bad group file is dropped", async () => {
  const dir = await open((d) => {
    put(d, ".aidea/architecture/web.json", nodes.architecture[0]);
    put(d, ".aidea/architecture/db.json", nodes.architecture[1]);
    put(d, ".aidea/architecture/patterns/hex.json", { ...group, roles: [...group.roles, { node: "ghost", role: "port" }] });
    put(d, ".aidea/architecture/patterns/bad.json", { id: "bad", name: "Bad", kind: "nope", roles: [] });
  });
  const arch = (await json(`/authored?${q(dir)}`)).layers.architecture;
  assert.deepEqual(arch.patterns, [group]);
  assert.equal(arch.errors.length, 2);
  assert.ok(arch.errors.some((e: any) => e.file === ".aidea/architecture/patterns/hex.json" && /ghost/.test(e.message)));
  assert.ok(arch.errors.some((e: any) => e.file === ".aidea/architecture/patterns/bad.json"));
});

test("a Node file whose parent or relation points at a Node in another file resolves across files", async () => {
  const dir = await open(onePerNode);
  const web = (await json(`/authored?${q(dir)}`)).layers.architecture.nodes.find((n: any) => n.id === "web");
  assert.deepEqual(web.relations, [{ to: "db", label: "reads" }]);
});
