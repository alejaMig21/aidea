import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { createFileSecretStore } from "../src/core/plugins/settings.ts";

// The secrets of plugins survive a restart, encrypted on disk with a key that Electron keeps sealed with the operating system (safeStorage); the core only ever holds the key in memory.
const dir = mkdtempSync(join(tmpdir(), "aidea-secrets-"));
after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
const KEY = "a".repeat(64); // 32 bytes as hex
const OTHER = "b".repeat(64);

test("a secret set in one run is there in the next", () => {
  const file = join(dir, "one.enc");
  const first = createFileSecretStore(file, KEY);
  first.set("fixture.p", "token", "s3cret-value");
  first.set("fixture.p", "other", "second");
  const next = createFileSecretStore(file, KEY);
  assert.equal(next.get("fixture.p", "token"), "s3cret-value");
  assert.equal(next.get("fixture.p", "other"), "second");
  assert.equal(next.get("fixture.q", "token"), undefined, "a plugin never sees another's secret");
});

test("deleting a secret is remembered too", () => {
  const file = join(dir, "two.enc");
  const first = createFileSecretStore(file, KEY);
  first.set("p", "a", "1");
  first.delete("p", "a");
  assert.equal(createFileSecretStore(file, KEY).get("p", "a"), undefined);
});

test("the file holds no secret in the clear, and changes each time (a new nonce)", () => {
  const file = join(dir, "three.enc");
  const store = createFileSecretStore(file, KEY);
  store.set("fixture.p", "token", "plain-needle-123");
  const one = readFileSync(file, "utf8");
  assert.ok(!one.includes("plain-needle-123") && !one.includes("fixture.p") && !one.includes("token"), "neither the value nor the names are readable");
  store.set("fixture.p", "token", "plain-needle-123");
  assert.notEqual(readFileSync(file, "utf8"), one);
});

test("the wrong key reads nothing and throws nothing; the unreadable file is kept aside, not overwritten", () => {
  const file = join(dir, "four.enc");
  createFileSecretStore(file, KEY).set("p", "a", "kept");
  const wrong = createFileSecretStore(file, OTHER);
  assert.equal(wrong.get("p", "a"), undefined);
  wrong.set("p", "b", "new");
  assert.equal(createFileSecretStore(file, OTHER).get("p", "b"), "new");
  assert.ok(readdirSync(dir).some((f) => f.startsWith("four.enc.unreadable")), "the old file is still there, renamed");
});

test("a damaged file reads as empty instead of crashing the core", () => {
  const file = join(dir, "five.enc");
  createFileSecretStore(file, KEY).set("p", "a", "x");
  writeFileSync(file, "{not json");
  assert.equal(createFileSecretStore(file, KEY).get("p", "a"), undefined);
});

test("a key that is not 32 bytes of hex is refused", () => {
  assert.throws(() => createFileSecretStore(join(dir, "six.enc"), "short"), /32 bytes/);
  assert.equal(existsSync(join(dir, "six.enc")), false);
});
