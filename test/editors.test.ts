import { test } from "node:test";
import assert from "node:assert/strict";
import { EDITORS, editorCommand, parseTemplate } from "../src/core/editors.ts";

const file = "C:\\proj with space\\cart.py";

test("each listed editor builds its own go-to-line command line, as an argument array", () => {
  const args = (id: string) => editorCommand(id, undefined, file, 5);
  assert.deepEqual(args("cursor"), { command: "cursor", args: ["--goto", `${file}:5`] });
  assert.deepEqual(args("idea"), { command: "idea", args: ["--line", "5", file] });
  assert.deepEqual(args("pycharm"), { command: "pycharm", args: ["--line", "5", file] });
  assert.deepEqual(args("webstorm"), { command: "webstorm", args: ["--line", "5", file] });
  assert.deepEqual(args("sublime"), { command: "subl", args: [`${file}:5`] });
  assert.deepEqual(args("vim"), { command: "gvim", args: ["+5", file] });
  assert.deepEqual(args("notepadpp"), { command: "notepad++", args: ["-n5", file] });
  assert.deepEqual(args("vscode").args, ["--goto", `${file}:5`]);
  assert.ok(EDITORS.length >= 8);
});

test("a custom template keeps quoted words together and fills {file} and {line} inside arguments", () => {
  assert.deepEqual(editorCommand("custom", '"C:\\Program Files\\Ed\\ed.exe" --at={line} {file}', file, 7), {
    command: "C:\\Program Files\\Ed\\ed.exe",
    args: ["--at=7", file],
  });
});

test("a file name full of shell characters stays one argument", () => {
  const evil = "a; rm -rf ~ && $(x) `y`.py";
  assert.deepEqual(editorCommand("custom", "ed {file}", evil, 1).args, [evil]);
});

test("a template that is empty, lacks {file}, has an unknown placeholder or a placeholder in the command is refused", () => {
  assert.match(parseTemplate("")!, /empty/i);
  assert.match(parseTemplate("ed --line {line}")!, /\{file\}/);
  assert.match(parseTemplate("ed {path}")!, /\{path\}/);
  assert.match(parseTemplate("{file} x")!, /program/i);
  assert.match(parseTemplate('ed "unclosed {file}')!, /quote/i);
  assert.match(parseTemplate("ed {file}" + " x".repeat(300))!, /long/i);
  assert.equal(parseTemplate("ed +{line} {file}"), null);
});

test("an unknown editor id or a custom editor without a valid template is an error", () => {
  assert.throws(() => editorCommand("emacs", undefined, file, 1), /unknown editor/i);
  assert.throws(() => editorCommand("custom", undefined, file, 1), /template/i);
});
