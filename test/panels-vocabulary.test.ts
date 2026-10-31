import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { startTestCore } from "./helpers.ts";

const t = await startTestCore();
after(() => t.core.close());

const root = join(import.meta.dirname, "..");
const lines = (file: string) => readFileSync(file, "utf8").split("\n").map((text, i) => ({ text: text.replace(/\s\/\/.*$/, ""), n: i + 1 })).filter((l) => !l.text.trim().startsWith("//"));
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
      if (/\b(Algorithm|Tutor|Builder|left|middle|right|side) columns?\b/i.test(l.text) || /"Algorithms"/.test(l.text)) found.push(`${file.slice(root.length + 1)}:${l.n}: ${l.text.trim().slice(0, 110)}`);
    }
  }
  assert.deepEqual(found, [], `old window vocabulary:\n${found.join("\n")}`);
});

test("Run and the Tutor are separate cards with their own top-bar button and separator, never one inside the other", () => {
  const html = readFileSync(join(root, "src", "ui", "index.html"), "utf8");
  const card = (id: string) => html.slice(html.indexOf(`id="${id}"`));
  for (const id of ["run", "sepx", "fold-run", "pane-run", "right", "sepr", "fold-right", "pane-tutor"]) assert.ok(html.includes(`id="${id}"`), `#${id} exists`);
  const tutorCard = card("right").slice(0, card("right").indexOf("</div>\n<div id=\"scrim\""));
  assert.ok(!tutorCard.includes('id="pane-run"') && !tutorCard.includes('id="run"'), "Run is not inside the Tutor's card");
  const runCard = card("run").slice(0, card("run").indexOf('id="sepr"'));
  assert.ok(!runCard.includes('id="pane-tutor"'), "the Tutor is not inside Run's card");
  assert.ok(html.indexOf('id="run"') < html.indexOf('id="right"'), "Run sits between the Canvas and the Tutor");
});

test("the glossary defines Panel, Layout, Preset and Run, and no longer defines Column, Algorithm column or Tutor column", () => {
  const glossary = readFileSync(join(root, "GLOSSARY.md"), "utf8");
  for (const term of ["Panel", "Layout", "Preset", "Run"]) assert.match(glossary, new RegExp(`^\\*\\*${term}\\*\\*:`, "m"), `${term} is defined`);
  for (const term of ["Column", "Algorithm column", "Tutor column"]) assert.doesNotMatch(glossary, new RegExp(`^\\*\\*${term}\\*\\*:`, "m"), `${term} is retired`);
});
