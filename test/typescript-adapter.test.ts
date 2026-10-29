import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { adapterFor } from "../src/core/adapters.ts";
import type { Analysis } from "../src/core/adapters.ts";
import { startTestCore } from "./helpers.ts";

const roots: string[] = [];
function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "aidea-ts-"));
  roots.push(dir);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const ids = (a: Analysis) => a.nodes.map((n) => n.id).sort();
const rel = (a: Analysis, kind: string, from: string, name: string) =>
  a.relationships.filter((r) => r.kind === kind && r.from === from && r.name === name);

const typescript = () => project({
  "src/shapes.ts": [
    "export abstract class Shape { area(): number { return 0 } }",
    "export class Circle extends Shape {",
    "  constructor(public r: number) { super() }",
    "  area() { return helper(this.r) }",
    "}",
    "export function helper(r: number) { return r * r }",
    "export const double = (n: number) => n * 2",
  ].join("\n"),
  "src/main.ts": [
    'import { Circle, helper, double } from "./shapes.ts";',
    'import { readFileSync } from "node:fs";',
    "class Local extends Circle {}",
    "class Ext extends Map<string, number> {}",
    "export function run(handlers: Record<string, () => void>, key: string, f: () => void) {",
    "  const local = () => 1; local();", // a function nested in a function is not a Node, so a call to it is no relationship
    "  helper(2); double(3); new Circle(1).area(); handlers[key](); f(); readFileSync('x');",
    "}",
    "const lazy = (name: string) => import(name);",
  ].join("\n"),
  "node_modules/pkg/index.js": "export function dependency() {}",
  "build/out.js": "export function built() {}",
});

test("a TypeScript project gives modules, classes, functions and methods in the same shapes as Python", async () => {
  const dir = typescript();
  const a = await adapterFor(dir).analyze(dir);
  assert.deepEqual(ids(a), [
    "src/main", "src/main.Ext", "src/main.Local", "src/main.lazy", "src/main.run",
    "src/shapes", "src/shapes.Circle", "src/shapes.Circle.area", "src/shapes.Circle.constructor",
    "src/shapes.Shape", "src/shapes.Shape.area", "src/shapes.double", "src/shapes.helper",
  ]);
  const area = a.nodes.find((n) => n.id === "src/shapes.Circle.area")!;
  assert.deepEqual({ kind: area.kind, name: area.name, parent: area.parent, file: area.file, line: area.line, endLine: area.endLine },
    { kind: "function", name: "area", parent: "src/shapes.Circle", file: "src/shapes.ts", line: 4, endLine: 4 });
  assert.equal(a.nodes.find((n) => n.id === "src/shapes")!.parent, null);
  assert.equal(a.nodes.find((n) => n.id === "src/shapes.Shape")!.markers?.abstract, true);
  assert.deepEqual(a.nodes.find((n) => n.id === "src/shapes.helper")!.parameters, [{ name: "r", annotation: "number" }]);
  assert.deepEqual(a.errors, []);
});

test("imports and inheritance carry their Resolution; code outside the project is not a relationship", async () => {
  const dir = typescript();
  const a = await adapterFor(dir).analyze(dir);
  const imports = a.relationships.filter((r) => r.kind === "imports" && r.name === "./shapes.ts");
  assert.deepEqual(imports.map((r) => [r.from, r.to, r.resolution, r.names]), [["src/main", "src/shapes", "resolved", ["Circle", "helper", "double"]]]);
  assert.equal(a.relationships.some((r) => r.name === "node:fs"), false);
  assert.deepEqual(rel(a, "inherits", "src/shapes.Circle", "Shape").map((r) => [r.to, r.resolution]), [["src/shapes.Shape", "resolved"]]);
  assert.deepEqual(rel(a, "inherits", "src/main.Local", "Circle").map((r) => [r.to, r.resolution]), [["src/shapes.Circle", "resolved"]]);
  const ext = rel(a, "inherits", "src/main.Ext", "Map")[0];
  assert.deepEqual([ext.to, ext.resolution, ext.external], [null, "resolved", true]);
});

test("calls the compiler resolves are resolved; dynamic ones are unresolved and counted", async () => {
  const dir = typescript();
  const a = await adapterFor(dir).analyze(dir);
  const callsOf = (from: string) => a.relationships.filter((r) => r.kind === "calls" && r.from === from).map((r) => [r.name, r.to, r.resolution]);
  assert.deepEqual(callsOf("src/shapes.Circle.area"), [["helper", "src/shapes.helper", "resolved"]]);
  assert.deepEqual(callsOf("src/main.run").sort(), [
    ["Circle", "src/shapes.Circle.constructor", "resolved"],
    ["area", "src/shapes.Circle.area", "resolved"],
    ["double", "src/shapes.double", "resolved"],
    ["f", null, "unresolved"],
    ["handlers[]", null, "unresolved"],
    ["helper", "src/shapes.helper", "resolved"],
  ]);
  assert.equal(rel(a, "imports", "src/main.lazy", "import")[0].resolution, "unresolved");
  assert.equal(a.unresolved, a.relationships.filter((r) => r.resolution === "unresolved").length);
  assert.equal(a.unresolved, 3);
});

test("plain JavaScript is read the same way, with require and import", async () => {
  const dir = project({
    "lib.js": "class Base {}\nclass Child extends Base { go() { return util() } }\nfunction util() {}\nmodule.exports = { Child, util };\n",
    "index.js": 'const { util } = require("./lib.js");\nconst os = require("os");\nfunction main() { return util(); }\n',
    "app.mjs": 'import { util } from "./lib.js";\nexport default function start() { util(); }\n',
  });
  const a = await adapterFor(dir).analyze(dir);
  assert.deepEqual(ids(a), ["app", "app.start", "index", "index.main", "lib", "lib.Base", "lib.Child", "lib.Child.go", "lib.util"]);
  assert.deepEqual(rel(a, "inherits", "lib.Child", "Base").map((r) => [r.to, r.resolution]), [["lib.Base", "resolved"]]);
  assert.deepEqual(a.relationships.filter((r) => r.kind === "imports").map((r) => [r.from, r.to, r.resolution]).sort(),
    [["app", "lib", "resolved"], ["index", "lib", "resolved"]]);
  assert.deepEqual(rel(a, "calls", "lib.Child.go", "util").map((r) => [r.to, r.resolution]), [["lib.util", "resolved"]]);
  assert.deepEqual(rel(a, "calls", "index.main", "util").map((r) => [r.to, r.resolution]), [["lib.util", "resolved"]]);
  assert.deepEqual(rel(a, "calls", "app.start", "util").map((r) => [r.to, r.resolution]), [["lib.util", "resolved"]]);
});

test("a syntax error is a problem for that file and the other files are still analysed", async () => {
  const dir = project({ "good.ts": "export function fine() {}", "bad.ts": "export function (( {" });
  const a = await adapterFor(dir).analyze(dir);
  assert.deepEqual(a.errors.map((e) => e.file), ["bad.ts"]);
  assert.match(a.errors[0].message, /\S/);
  assert.deepEqual(ids(a), ["good", "good.fine"]);
});

test("opening a TypeScript project through the core says it is analysed", async () => {
  const t = await startTestCore();
  try {
    const dir = typescript();
    const res = await t.post("/projects", { path: dir });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.deepEqual(body.languages.map((l: { language: string; analysed: boolean }) => [l.language, l.analysed]), [["typescript", true]]);
    assert.ok(body.nodes.some((n: { id: string }) => n.id === "src/main.run"));
  } finally {
    t.core.close();
  }
});
