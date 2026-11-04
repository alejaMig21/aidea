import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// Run-and-terminal 13: before any button of the selection control sends text, aidea warns when it looks like a secret. The text is never changed.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

// Things that look like secrets (the key and token values are made up).
const SECRETS = [
  "DB_PASSWORD=hunter2hunter2",
  "Authorization: Bearer abcdef0123456789abcdef0123",
  "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Z3VS5JJcds3xfn\n-----END RSA PRIVATE KEY-----",
  "OPENAI_KEY sk-proj-1234567890abcdefghijklmnop",
  "connecting to postgres://admin:s3cretPass@db.local:5432/app",
  "token: ghp_abcdefghijklmnopqrstuvwxyz0123456789",
  "aws key AKIAIOSFODNN7EXAMPLE in the config",
  '{"password": "correct-horse-battery-9"}',
  "the value is Zk3nQ9vT1bXw7LpR5sYc2HdF8gJm4NaE6uVo",
];
// Ordinary text a person selects while reading errors: none of it may trigger the warning.
const ORDINARY = [
  'Traceback (most recent call last):\n  File "C:\\Users\\aleja\\projects\\shop\\app.py", line 42, in <module>\n    total = apply_discount(cart, 0.1)\n  File "C:\\Users\\aleja\\projects\\shop\\cart.py", line 17, in apply_discount\n    return cart.total * (1 - rate)\nAttributeError: \'NoneType\' object has no attribute \'total\'',
  "Error: Cannot read properties of undefined (reading 'token')\n    at Object.<anonymous> (/home/dev/projects/shop-api/node_modules/express/lib/router/index.js:284:15)\n    at next (/home/dev/projects/shop-api/node_modules/express/lib/router/route.js:137:13)",
  "java.lang.NullPointerException: Cannot invoke \"String.length()\" because \"name\" is null\n\tat com.shop.Cart.price(Cart.java:88)\n\tat com.shop.Main.main(Main.java:12)",
  "src/cart.ts(14,7): error TS2322: Type 'string' is not assignable to type 'number'.",
  "FAILED tests/test_cart.py::test_discount - AssertionError: assert 90.0 == 91.0",
  "npm ERR! code ELIFECYCLE\nnpm ERR! errno 1\nnpm ERR! shop@1.0.0 start: `node server.js`",
  "commit 3f786850e387550fdab836ed7e6dc881de23001b\nAuthor: Dev <dev@shop.test>",
  "request id 123e4567-e89b-12d3-a456-426614174000 failed with status 500",
  "SyntaxError: Unexpected token: } in JSON at position 41",
  "KeyError: 'password'",
  "Invalid token: expected string but got number",
  "author: Alejandro Martinez",
  "listening on http://127.0.0.1:3000/health",
];

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)}; window.SW_SECRETS = ${JSON.stringify(SECRETS)}; window.SW_ORDINARY = ${JSON.stringify(ORDINARY)};</script>`;
  const drive = `<script>${readFileSync(new URL("./secret-warning-page.js", import.meta.url), "utf8")}</script>`;
  return new Promise<Server>((resolve) => {
    const server = createServer((req, res) => {
      const { origin: _origin, ...headers } = req.headers;
      const up = request({ host: target.hostname, port: target.port, method: req.method, path: req.url, headers: { ...headers, host: target.host } }, (answer) => {
        if (req.url !== "/") { res.writeHead(answer.statusCode ?? 502, answer.headers); answer.pipe(res); return; }
        let html = "";
        answer.setEncoding("utf8").on("data", (c) => (html += c)).on("end", () => {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(html.replace("<head>", () => `<head>${seed}`).replace("</body>", () => `${drive}</body>`));
        });
      });
      req.pipe(up);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

before(async () => {
  if (skip) return;
  scratch = mkdtempSync(join(tmpdir(), "aidea-secret-warning-"));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store"), builtinPluginsDir: false });
  const proxy = await startProxy(core.url, fixture("shop"));
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000", "--virtual-time-budget=40000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 90_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="sw-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(() => { core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

test("the page loads without errors", { skip }, () => assert.deepEqual(page.errors, []));
test("ordinary error text (tracebacks, stack traces, hashes, ids) is sent at once with no warning", { skip }, () => {
  assert.equal(page.ordinary.length, ORDINARY.length);
  assert.deepEqual(page.ordinary.filter((o: any) => o.warned || !o.sent).map((o: any) => o.text), []);
});
test("text that looks like a secret asks before anything is sent, says it is a warning and not a guarantee, and Cancel sends nothing", { skip }, () => {
  assert.equal(page.secrets.length, SECRETS.length);
  assert.deepEqual(page.secrets.filter((s: any) => !s.warned).map((s: any) => s.text), []);
  assert.deepEqual(page.secrets.filter((s: any) => s.sentBeforeAnswer || !s.warnGoneAfterCancel).map((s: any) => s.text), []);
  assert.match(page.secrets[0].wording, /looks like a secret/i);
  assert.match(page.secrets[0].wording, /not a guarantee/i);
});
test("confirming sends the text exactly as selected, once", { skip }, () => assert.deepEqual(page.confirmed, { count: 1, exact: true }));
test("Enter the Tutor asks too: Cancel starts no class, confirming starts one with the exact text", { skip }, () => {
  assert.equal(page.enterWarned, true);
  assert.equal(page.classAfterCancel, 0);
  assert.equal(page.classAfterConfirm, 1);
  assert.equal(page.classTextExact, true);
});
