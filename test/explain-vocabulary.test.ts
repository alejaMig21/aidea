import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Ticket run-and-terminal/02: the control that appears next to selected text says "Explain" (a brief explanation) and "Enter the Tutor"; "Just define" is gone everywhere.
const root = join(import.meta.dirname, "..");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (f === "vendor" ? [] : statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

test("the selection control offers Explain and Enter the Tutor", () => {
  const select = readFileSync(join(root, "src", "ui", "features", "54-select.js"), "utf8");
  assert.match(select, /textContent: "Explain"/);
  assert.match(select, /textContent: "Enter the Tutor"/);
});

test("nothing the person reads, and no source, still says Just define", () => {
  const found = [...walk(join(root, "src")), join(root, "GLOSSARY.md")].filter((f) => /just define/i.test(readFileSync(f, "utf8"))).map((f) => f.slice(root.length + 1));
  assert.deepEqual(found, []);
});

test("the guide names the Explain button, and the Tutor part of the guide mentions it", () => {
  const guide = readFileSync(join(root, "src", "core", "guide.ts"), "utf8");
  assert.match(guide, /"Explain"/);
});
