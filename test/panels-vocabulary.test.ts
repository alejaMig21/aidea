import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { startTestCore } from "./helpers.ts";

const t = await startTestCore();
after(() => t.core.close());

const root = join(import.meta.dirname, "..");
const lines = (file: string) => readFileSync(file, "utf8").split(/\r?\n/).map((text, i) => ({ text: text.replace(/\s\/\/.*$/, ""), n: i + 1 })).filter((l) => !l.text.trim().startsWith("//"));
const uiFiles = [join(root, "src", "ui", "index.html"), ...readdirSync(join(root, "src", "ui", "features")).map((f) => join(root, "src", "ui", "features", f))];

test("the guide to aidea calls the areas of the window Panels, never columns, and names the Run panel", async () => {
  const text = JSON.stringify(await (await t.get("/guide")).json());
  assert.doesNotMatch(text, /\bcolumns?\b/i);
  assert.doesNotMatch(text, /(Algorithms|Tutor)\\?" tab/, "the right slot has no tabs any more");
  assert.match(text, /Run/);
  assert.match(text, /panels?/i);
});

test("no text a person reads names an area of the window a column or the Run panel the Algorithm column", () => {
  const found: string[] = [];
  for (const file of [...uiFiles, join(root, "src", "core", "layer-help.ts"), join(root, "src", "core", "guide.ts")]) {
    for (const l of lines(file)) {
      if (/\b(Algorithm|Tutor|Builder|left|middle|right|side) columns?\b|\bright (panel|slot)\b/i.test(l.text) || /"Algorithms"/.test(l.text)) found.push(`${file.slice(root.length + 1)}:${l.n}: ${l.text.trim().slice(0, 110)}`);
    }
  }
  assert.deepEqual(found, [], `old window vocabulary:\n${found.join("\n")}`);
});

test("the Panels are declared once in the registry: the page keeps only the Canvas and one Panels control, and Run and the Tutor keep bodies of their own", () => {
  const html = readFileSync(join(root, "src", "ui", "index.html"), "utf8").replaceAll("\r\n", "\n");
  const layout = readFileSync(join(root, "src", "ui", "features", "07-layout.js"), "utf8").replaceAll("\r\n", "\n");
  const declared = [...layout.matchAll(/layoutRegister\(\{\s*id: "(\w+)"[^}]*?(?:pane: "([\w-]+)")?[^}]*\}\);/g)].map((m) => ({ id: m[1], text: m[0] }));
  assert.ok(declared.length >= 5, "the registry declares the Panels");
  assert.equal(new Set(declared.map((d) => d.id)).size, declared.length, "each Panel is declared once");
  // The page: no card, separator or button of a Panel is written by hand (the real page is checked by panel-registry.test.ts in a browser).
  assert.equal((html.match(/id="panels-button"/g) ?? []).length, 1, "one control for Panels");
  assert.doesNotMatch(html, /id="fold-|id="sep[cfkxr]"|id="sep-/, "no per-Panel button or separator is written in the page");
  for (const { id } of declared) assert.ok(!html.includes(`id="${id}"`), `#${id} is created from the registry, not written in the page`);
  assert.ok(html.includes("<main>"), "the Canvas stays in the page");
  // Two Panels never share a body: every body id (pane: "...") is used once.
  const bodies = declared.flatMap((d) => [...d.text.matchAll(/pane: "([\w-]+)"/g)].map((m) => m[1]));
  assert.equal(new Set(bodies).size, bodies.length, "each Panel has a body of its own");
  for (const body of bodies) assert.ok(!html.includes(`id="${body}"`), `#${body} is created with its card`);
});

// Code is a Panel, not a layer: the Layer bar lists only what the Canvas draws.
test("there is no Code layer: no tab, no layer id, no legend, and no layer help for it", async () => {
  const found: string[] = [];
  for (const file of uiFiles) {
    for (const l of lines(file)) if (/dataset\.layer\s*=\s*"code"|data-layer="code"|showLayer\(\s*"code"|authoredShown\s*===\s*"code"|notationRegisterLegend\(\s*"code"|\bcodeTab\b/.test(l.text)) found.push(`${file.slice(root.length + 1)}:${l.n}: ${l.text.trim().slice(0, 100)}`);
  }
  assert.deepEqual(found, [], `a Code layer is back:\n${found.join("\n")}`);
  const { layers } = (await (await t.get("/layers/help")).json()) as { layers: Record<string, unknown> };
  assert.equal(layers.code, undefined);
  assert.equal((await t.post("/tutor/classes", { project: "x", layer: "code" })).status, 400);
});

test("the glossary defines Panel, Layout, Preset and Run, and no longer defines Column, Algorithm column or Tutor column", () => {
  const glossary = readFileSync(join(root, "GLOSSARY.md"), "utf8");
  for (const term of ["Panel", "Layout", "Preset", "Run"]) assert.match(glossary, new RegExp(`^\\*\\*${term}\\*\\*:`, "m"), `${term} is defined`);
  for (const term of ["Column", "Algorithm column", "Tutor column"]) assert.doesNotMatch(glossary, new RegExp(`^\\*\\*${term}\\*\\*:`, "m"), `${term} is retired`);
});
