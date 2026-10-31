import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCore } from "../src/core/server.ts";

// The saved Layout lives in the core's preferences file, not in the page's localStorage: the desktop app's address changes at every launch (random port),
// and localStorage belongs to one address. The page is served with the saved Layout inside it.
const saved = (html: string) => {
  const raw = /<meta name="aidea-saved" content="([^"]*)">/.exec(html)?.[1];
  assert.ok(raw, "the page carries the saved state");
  return JSON.parse(decodeURIComponent(raw));
};
const put = (url: string, body: unknown, type = "application/json") => fetch(url + "/ui/layout", { method: "PUT", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("a Layout put to the core is served inside the page, and is still there after the core restarts on another port", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-ui-"));
  const preferencesFile = join(dir, "preferences.json");
  try {
    const first = await startCore({ port: 0, preferencesFile });
    assert.deepEqual(saved(await (await fetch(first.url + "/")).text()), {}, "nothing saved yet");
    const layout = { chatFolded: false, dock: { grid: { width: 10, text: "</script><b>" } } };
    assert.equal((await put(first.url, layout)).status, 200);
    assert.deepEqual(saved(await (await fetch(first.url + "/")).text()), { layout }, "text with a closing tag in it comes back whole");
    first.close();

    const second = await startCore({ port: 0, preferencesFile });
    assert.notEqual(second.url, first.url);
    assert.deepEqual(saved(await (await fetch(second.url + "/")).text()), { layout });
    second.close();
  } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
});

test("a Layout that is not a JSON object is refused and the saved one stays", async () => {
  const core = await startCore({ port: 0 });
  try {
    assert.equal((await put(core.url, { ok: 1 })).status, 200);
    for (const bad of [[1], "text", null, 5]) assert.equal((await put(core.url, JSON.stringify(bad))).status, 400, JSON.stringify(bad));
    assert.equal((await put(core.url, "{}", "text/plain")).status, 415);
    assert.deepEqual(saved(await (await fetch(core.url + "/")).text()), { layout: { ok: 1 } });
  } finally { core.close(); }
});
