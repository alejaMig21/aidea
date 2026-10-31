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

test("Run and the Tutor are separate cards with their own top-bar button and separator, never one inside the other", () => {
  const html = readFileSync(join(root, "src", "ui", "index.html"), "utf8").replaceAll("\r\n", "\n");
  const at = (id: string) => { const i = html.indexOf(`id="${id}"`); assert.ok(i >= 0, `#${id} exists`); return i; };
  for (const id of ["fold-run", "fold-files", "pane-run", "pane-files", "pane-tutor"]) at(id);
  // The cards stand side by side in this order, so Run is neither inside the Tutor's card nor the other way round.
  const order = ["sepc", "files", "sepf", "canvas", "sepx", "run", "sepr", "right", "scrim"].map(at);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "Builder | Files | Canvas | Run | Tutor, each separator between two cards");
  assert.ok(at("pane-run") > at("run") && at("pane-run") < at("sepr"), "Run's body is inside Run's card");
  assert.ok(at("pane-tutor") > at("right") && at("pane-tutor") < at("scrim"), "the Tutor's body is inside the Tutor's card");
});

test("the glossary defines Panel, Layout, Preset and Run, and no longer defines Column, Algorithm column or Tutor column", () => {
  const glossary = readFileSync(join(root, "GLOSSARY.md"), "utf8");
  for (const term of ["Panel", "Layout", "Preset", "Run"]) assert.match(glossary, new RegExp(`^\\*\\*${term}\\*\\*:`, "m"), `${term} is defined`);
  for (const term of ["Column", "Algorithm column", "Tutor column"]) assert.doesNotMatch(glossary, new RegExp(`^\\*\\*${term}\\*\\*:`, "m"), `${term} is retired`);
});
