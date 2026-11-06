import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";
import { propose } from "../src/core/proposals.ts";

type Reply = { content: { text: string }[]; isError?: boolean };
type RunOptions = Parameters<Adapter["run"]>[0];

// A stand-in for the Tutor's Claude Code (and for the builder): the test scripts what it does over MCP.
let script: (call: (name: string, args?: unknown) => Promise<Reply>, rpc: (method: string) => Promise<any>) => Promise<void> = async () => {};
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "sonnet", label: "Sonnet" }] },
  run: async function* (opts: RunOptions): AsyncGenerator<AgentEvent> {
    const config = opts.role === "tutor" ? opts.tools!.mcpConfig : opts.permission!.mcpConfig;
    const url = Object.values(JSON.parse(config).mcpServers as Record<string, { url: string }>)[0].url;
    const rpc = (method: string, params: unknown = {}) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).then((r) => r.json());
    try {
      await script(async (name, args = {}) => (await rpc("tools/call", { name, arguments: args })).result, (m) => rpc(m));
    } catch (e) {
      scriptFailure = e; // thrown inside the core's request, so the test rethrows it
    }
    yield { type: "text", text: "done" };
  },
};

let scriptFailure: unknown;
let core: Awaited<ReturnType<typeof startCore>>;
const scratch: string[] = [];
const temp = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
};
const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const drain = async (res: Response) => {
  await res.text();
  if (scriptFailure) {
    const e = scriptFailure;
    scriptFailure = undefined;
    throw e;
  }
};

// The open Project: the studio fixture (authored layers) plus plain files, a big file, a binary, and ignored folders.
let project: string;
let outside: string;
before(async () => {
  core = await startCore({ port: 0, adapter: fakeAgent });
  project = temp("aidea-reads-");
  outside = temp("aidea-reads-outside-");
  cpSync(fixture("studio"), project, { recursive: true });
  cpSync(fixture("playback"), project, { recursive: true });
  writeFileSync(join(project, "notes.txt"), "line1\nline2\nline3\nline4\n");
  writeFileSync(join(project, "big.txt"), "x".repeat(50_000));
  writeFileSync(join(project, "image.bin"), Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02, 0xff]));
  mkdirSync(join(project, "sub"));
  writeFileSync(join(project, "sub", "inner.txt"), "inner");
  for (const ignored of [".git", "node_modules", "__pycache__", ".venv"]) {
    mkdirSync(join(project, ignored));
    writeFileSync(join(project, ignored, "hidden.txt"), "hidden");
  }
  writeFileSync(join(outside, "secret.txt"), "TOP-SECRET");
  await post("/projects", { path: project });
});
after(() => {
  core.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

// Runs `fn` as the Tutor of a class on the open Project.
async function asTutor(fn: (call: (name: string, args?: unknown) => Promise<Reply>, rpc: (method: string) => Promise<any>) => Promise<void>) {
  script = fn;
  await drain(await post("/tutor/classes", { project }));
}
const json = (r: Reply) => JSON.parse(r.content[0].text);

test("the Tutor's tool list is exactly these, and none of them can write, delete, move or run anything", async () => {
  let names: string[] = [];
  await asTutor(async (_c, rpc) => { names = (await rpc("tools/list")).result.tools.map((t: any) => t.name); });
  assert.deepEqual(names, ["begin_step", "predict", "explain", "ask", "review", "measure", "measure_done", "offer_practice", "practice_targets", "problem", "hint", "held_ideas", "finish_class", "propose_node", "propose_change", "get_plan", "plan_ahead", "set_plan", "read_layers", "read_node", "list_files", "read_file", "read_recording", "read_quarantined_plugin", "list_plugin_lessons", "read_plugin_lesson", "read_plugin_view", "check_plugin"]);
  // The only tools that touch the project at all are the two that make a pending Proposal (ticket 08); the person decides.
  assert.ok(names.filter((n) => !/^propose_(node|change)$/.test(n)).every((n) => !/write|delete|remove|move|rename|exec|run|edit|create|propose|save|shell|bash/i.test(n)));
});

test("the builder does not have the Tutor's read tools and cannot call them", async () => {
  let listed: string[] = [];
  let reply: any;
  // The builder's session is the chat.
  script = async (call, rpc) => {
    listed = (await rpc("tools/list")).result.tools.map((t: any) => t.name);
    try { reply = await call("read_file", { path: "notes.txt" }); } catch (e) { reply = String(e); }
  };
  await drain(await post("/chat", { project, message: "hi" }));
  assert.ok(!listed.some((n) => ["read_layers", "read_node", "list_files", "read_file", "read_recording", "read_quarantined_plugin", "list_plugin_lessons", "read_plugin_lesson", "read_plugin_view", "check_plugin"].includes(n)), listed.join());
  assert.ok(reply === undefined || reply.isError || typeof reply === "string", "the call must not return file content");
});

test("read_layers returns the accepted layers and marks pending Proposals as pending", async () => {
  await asTutor(async (call) => {
    const before = json(await call("read_layers"));
    assert.equal(before.layers.business["value propositions"][0].id, "vp-fast-quotes");
    assert.equal(before.layers.requirements[0].id, "us-request-quote");
    assert.deepEqual(before.pending, []);
  });
  // A Proposal is pending, and shows up marked so, outside the accepted layers.
  const made = propose(core.proposals, core.projects.get(project)!, "test-secret", "add", { layer: "business", node: { id: "vp-new", title: "New", block: "value propositions", rationale: { why: "w", rejected: [] } } }) as any;
  const proposalId = made.proposal?.id;
  assert.ok(proposalId, made.error);
  await asTutor(async (call) => {
    const after = json(await call("read_layers"));
    assert.ok(!JSON.stringify(after.layers).includes("vp-new"), "pending is not accepted");
    assert.equal(after.pending.length, 1);
    assert.equal(after.pending[0].status, "pending");
    assert.equal(after.pending[0].nodeId, "vp-new");
    assert.ok(!JSON.stringify(after).includes("secret"));
  });
});

test("read_node returns one Node of any layer with its Rationale and trace links", async () => {
  await asTutor(async (call) => {
    const node = json(await call("read_node", { id: "vp-fast-quotes" }));
    assert.equal(node.layer, "business");
    assert.equal(node.node.rationale.rejected[0].option, "Phone-only quotes");
    assert.ok(Array.isArray(node.traces));
    const code = json(await call("read_node", { id: "app.run" }));
    assert.equal(code.layer, "components");
    assert.equal(code.node.file, "app.py");
    const missing = await call("read_node", { id: "no-such-node" });
    assert.equal(missing.isError, true);
    assert.match(missing.content[0].text, /no node/i);
  });
});

test("list_files lists relative paths and skips .git, node_modules, __pycache__ and virtualenvs; the list is capped", async () => {
  await asTutor(async (call) => {
    const { files } = json(await call("list_files"));
    assert.ok(files.includes("notes.txt") && files.includes("sub/inner.txt") && files.includes("app.py"));
    assert.ok(!files.some((f: string) => /^(\.git|node_modules|__pycache__|\.venv)\//.test(f)), files.join());
    assert.ok(files.every((f: string) => !f.startsWith("/") && !f.includes("\\") && !/^[a-z]:/i.test(f)));
    assert.ok(!files.some((f: string) => f.startsWith(".aidea")), "the authored layers are read with read_layers");
    const sub = json(await call("list_files", { path: "sub" }));
    assert.deepEqual(sub.files, ["sub/inner.txt"]);
  });
  const many = temp("aidea-many-");
  for (let i = 0; i < 600; i++) writeFileSync(join(many, `f${i}.txt`), "");
  await post("/projects", { path: many });
  script = async (call) => {
    const r = json(await call("list_files"));
    assert.equal(r.files.length, 500);
    assert.equal(r.truncated, true);
    assert.match(r.note, /500/);
  };
  await drain(await post("/tutor/classes", { project: many }));
});

test("read_file returns the text, a line range, and cuts big files with a note", async () => {
  await asTutor(async (call) => {
    const all = json(await call("read_file", { path: "notes.txt" }));
    assert.equal(all.path, "notes.txt");
    assert.equal(all.text, "line1\nline2\nline3\nline4\n");
    const range = json(await call("read_file", { path: "notes.txt", startLine: 2, endLine: 3 }));
    assert.equal(range.text, "line2\nline3\n");
    assert.equal(range.startLine, 2);
    const big = json(await call("read_file", { path: "big.txt" }));
    assert.ok(big.text.length <= 20_480);
    assert.equal(big.truncated, true);
    assert.match(big.note, /50000|first 20/i);
    const bin = await call("read_file", { path: "image.bin" });
    assert.equal(bin.isError, true);
    assert.match(bin.content[0].text, /binary/i);
    const gone = await call("read_file", { path: "nope.txt" });
    assert.equal(gone.isError, true);
  });
});

test("read_recording returns the steps and values of a recording already made, only for this Project", async () => {
  const rec = await (await post("/playback", { project, node: "ops.drain", args: [130] })).json();
  assert.match(rec.id, /^pb-/);
  await asTutor(async (call) => {
    const byId = json(await call("read_recording", { id: rec.id }));
    assert.equal(byId.node, "ops.drain");
    assert.ok(byId.visits.length > 3);
    assert.ok(byId.visits[0].step);
    const byNode = json(await call("read_recording", { node: "ops.drain" }));
    assert.equal(byNode.id, rec.id);
    const none = await call("read_recording", { id: "pb-99999" });
    assert.equal(none.isError, true);
    assert.match(none.content[0].text, /no recording/i);
  });
});

// A path that leads outside the Project, or into something the Tutor must not read, is refused and nothing is read.
const refused = async (paths: string[]) => {
  const got: { path: string; reply: Reply }[] = [];
  await asTutor(async (call) => {
    for (const path of paths) got.push({ path, reply: await call("read_file", { path }) });
  });
  for (const { path, reply } of got) {
    assert.equal(reply.isError, true, `${path} must be refused`);
    assert.ok(!reply.content[0].text.includes("TOP-SECRET"), `${path} leaked the file`);
    assert.match(reply.content[0].text, /outside|inside the Project|not allowed|cannot read|only/i, path);
  }
};

test("read_file refuses parent traversal, absolute paths elsewhere, and drive-relative and UNC forms", async () => {
  const secret = join(outside, "secret.txt");
  const up = ["..", "..", ".."].join("/");
  await refused([
    "../" + outside.split(/[\\/]/).pop() + "/secret.txt",
    "sub/../../" + outside.split(/[\\/]/).pop() + "/secret.txt",
    up + "/Windows/win.ini",
    secret,
    secret.replace(/\\/g, "/"),
    "C:secret.txt",
    "C:..\\secret.txt",
    "\\\\localhost\\c$\\Windows\\win.ini",
    "//localhost/c$/Windows/win.ini",
    "\\\\?\\" + secret,
    "/etc/passwd",
    "..\\" + outside.split(/[\\/]/).pop() + "\\secret.txt",
  ]);
});

test("read_file refuses the project's own folder, a directory, .git and .aidea", async () => {
  await asTutor(async (call) => {
    for (const path of [".", "", "sub", ".git/hidden.txt", ".git/config", ".GIT/hidden.txt", ".aidea/business.json", ".aidea\\business.json", "sub/../.aidea/business.json"]) {
      const r = await call("read_file", { path });
      assert.equal(r.isError, true, `${JSON.stringify(path)} must be refused`);
      assert.ok(!r.content[0].text.includes("vp-fast-quotes") && !r.content[0].text.includes("hidden"), path);
    }
    const bad = await call("read_file", { path: 42 });
    assert.equal(bad.isError, true);
    const nul = await call("read_file", { path: "notes.txt\0.png" });
    assert.equal(nul.isError, true);
  });
});

test("read_file accepts a path spelled with a different case or with backslashes when it stays inside", async (t) => {
  const mixed = process.platform === "win32" ? "NOTES.TXT" : "notes.txt";
  await asTutor(async (call) => {
    assert.equal(json(await call("read_file", { path: mixed })).text, "line1\nline2\nline3\nline4\n");
    assert.equal(json(await call("read_file", { path: "sub\\inner.txt" })).text, process.platform === "win32" ? "inner" : json(await call("read_file", { path: "sub/inner.txt" })).text);
    assert.equal(json(await call("read_file", { path: "./sub/./inner.txt" })).text, "inner");
  });
  void t;
});

test("a link or junction inside the Project that points outside is refused, for read_file and list_files", async (t) => {
  const link = join(project, "linked");
  try {
    symlinkSync(outside, link, "junction");
  } catch (e) {
    t.skip(`cannot create a link here: ${(e as Error).message}`);
    return;
  }
  const fileLink = join(project, "linked-file.txt");
  let fileLinked = true;
  try {
    symlinkSync(join(outside, "secret.txt"), fileLink, "file");
  } catch {
    fileLinked = false; // file symlinks need a privilege on Windows; the junction case above still runs
  }
  await refused(["linked/secret.txt", "linked\\secret.txt", "LINKED/secret.txt", ...(fileLinked ? ["linked-file.txt"] : [])]);
  await asTutor(async (call) => {
    const dir = await call("list_files", { path: "linked" });
    assert.equal(dir.isError, true);
    assert.ok(!dir.content[0].text.includes("secret"));
    const { files } = json(await call("list_files"));
    assert.ok(!files.some((f: string) => f.startsWith("linked")), "a link out of the Project is not listed");
  });
  if (!fileLinked) t.diagnostic("file symlink not created (needs privilege): only the junction case was tested");
  rmSync(link, { force: true, recursive: true });
  rmSync(fileLink, { force: true });
});

test("a link that stays inside the Project is allowed", async (t) => {
  const link = join(project, "inner-link");
  try {
    symlinkSync(join(project, "sub"), link, "junction");
  } catch (e) {
    t.skip(`cannot create a link here: ${(e as Error).message}`);
    return;
  }
  await asTutor(async (call) => {
    assert.equal(json(await call("read_file", { path: "inner-link/inner.txt" })).text, "inner");
  });
  rmSync(link, { force: true, recursive: true });
  void realpathSync;
});

test("list_files refuses a folder outside the Project", async () => {
  await asTutor(async (call) => {
    for (const path of ["..", outside, "..\\x", "C:", "//localhost/c$", ".git", ".aidea"]) {
      const r = await call("list_files", { path });
      assert.equal(r.isError, true, `${path} must be refused`);
    }
  });
});

test("the read tools write nothing into the Project", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const snapshot = () => JSON.stringify(readdirSync(project, { recursive: true }).sort()) + readFileSync(join(project, "notes.txt"), "utf8");
  const before = snapshot();
  await asTutor(async (call) => {
    await call("read_layers");
    await call("read_node", { id: "vp-fast-quotes" });
    await call("list_files");
    await call("read_file", { path: "notes.txt" });
    await call("read_recording", { node: "ops.drain" });
  });
  assert.equal(snapshot(), before);
});
