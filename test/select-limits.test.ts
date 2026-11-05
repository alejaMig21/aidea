import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MAX_SELECTION, MAX_TERMINAL_SELECTION } from "../src/core/select.ts";

// housekeeping 03: the interface repeats the core's limits on a selection; this test fails when they differ.
test("the selection limits of the interface and of the core are the same numbers", () => {
  const ui = readFileSync(new URL("../src/ui/features/54-select.js", import.meta.url), "utf8");
  assert.equal(Number(/const MAX = (\d+);/.exec(ui)?.[1]), MAX_SELECTION);
  assert.equal(Number(/const MAX_TERMINAL = (\d+);/.exec(ui)?.[1]), MAX_TERMINAL_SELECTION);
});
