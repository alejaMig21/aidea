import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// The interface says "Python" only where the fact is about Python; everything else says project, code or function.
// Each exception names the file and a text that must appear on the line, with the reason.
const allowed = [
  { file: "47-components.js", text: "Python decides the target at run time (getattr", why: "getattr and variable-held functions are Python facts" },
];

const ui = join(import.meta.dirname, "..", "src", "ui");
const files = [join(ui, "index.html"), ...readdirSync(join(ui, "features")).map((f) => join(ui, "features", f))];

test("the interface text says Python only where the fact is about Python", () => {
  const found: string[] = [];
  for (const file of files) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (!/\bPython\b/.test(line) || line.trim().startsWith("//")) return;
      if (allowed.some((a) => file.endsWith(a.file) && line.includes(a.text))) return;
      found.push(`${file.slice(ui.length + 1)}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(found, [], `"Python" outside the allowlist:\n${found.join("\n")}`);
});
