import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-ignore: a plain JavaScript module of the Run plugin's interface half; it touches the page only when it is activated
import { askAbout } from "../src/plugins/run/ui.js";

// What Play offers to ask the Builder, by what Play just answered: a recipe when there is none or it is not valid, a review when a part failed (the recipe may be stale).
test("Play offers to ask the Builder for a recipe when there is none or it is not valid", () => {
  for (const reason of ["no-recipe", "invalid-recipe"]) {
    const ask = askAbout(reason);
    assert.equal(ask.label, "Ask the Builder for a recipe");
    assert.match(ask.message, /propose_run_recipe/);
  }
});

test("Play offers to ask the Builder to review the recipe when a part failed, and says it may leave the recipe as it is", () => {
  const ask = askAbout("failed");
  assert.equal(ask.label, "Ask the Builder to review the recipe");
  assert.match(ask.message, /propose_run_recipe/);
  assert.match(ask.message, /review/i);
  assert.match(ask.message, /do not propose anything|say so/i);
});

test("nothing is offered when Play started, or when the person still has to accept the recipe", () => {
  for (const reason of [undefined, "needs-accept", "already"]) assert.equal(askAbout(reason), null, String(reason));
});
