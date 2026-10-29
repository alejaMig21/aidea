import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoleAdapters, startCore } from "../src/core/server.ts";
import type { Adapter } from "../src/core/types.ts";
import { fixture } from "./helpers.ts";

const shop = fixture("shop");

// A fake agent product that records the roles it was asked to run.
function fake(name: string) {
  const roles: string[] = [];
  const adapter: Adapter = {
    options: { modes: [{ id: name, label: name, meaning: name, available: true }], models: [{ id: name, label: name }] },
    async *run({ role }) {
      roles.push(role ?? "builder");
      yield { type: "result", text: name, usage: {} };
    },
  };
  return { roles, adapter };
}

test("builder and Tutor are routed to different adapters by a setting", async () => {
  const a = fake("a");
  const b = fake("b");
  const core = await startCore({ port: 0, adapter: a.adapter, adapters: { b: b.adapter }, roleAdapters: { tutor: "b" } });
  try {
    const { adapter } = core;
    for await (const _ of adapter.run({ cwd: shop, message: "hi" })) void _;
    for await (const _ of adapter.run({ role: "tutor", cwd: shop, message: "hi" })) void _;
    for await (const _ of adapter.run({ role: "grader", cwd: shop, message: "hi" })) void _;
    assert.deepEqual(a.roles, ["builder", "grader"]);
    assert.deepEqual(b.roles, ["tutor"]);
    assert.equal(adapter.options.models[0].id, "a");
  } finally {
    core.close();
  }
});

test("an unknown adapter name is refused at start with a plain message", async () => {
  await assert.rejects(
    startCore({ port: 0, adapter: fake("a").adapter, roleAdapters: { tutor: "nope" } }),
    /Unknown agent "nope" for the tutor\. Available: default/,
  );
  await assert.rejects(
    startCore({ port: 0, adapter: fake("a").adapter, roleAdapters: { chef: "default" } }),
    /Unknown role "chef"/,
  );
});

test("AIDEA_ROLE_ADAPTERS is read as role=agent pairs and a malformed pair is named in words", () => {
  assert.deepEqual(parseRoleAdapters(" tutor = default , grader=b "), { tutor: "default", grader: "b" });
  assert.deepEqual(parseRoleAdapters(undefined), {});
  assert.throws(() => parseRoleAdapters("tutor"), /AIDEA_ROLE_ADAPTERS.*"tutor".*role=agent/);
  assert.throws(() => parseRoleAdapters("tutor=default,=b"), /"=b"/);
  assert.throws(() => parseRoleAdapters("tutor="), /"tutor="/);
  assert.throws(() => parseRoleAdapters("a=b=c"), /"a=b=c"/);
});
