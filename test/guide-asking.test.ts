import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { GUIDE, guideClassMessage } from "../src/core/guide.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// roles-and-contract 02: the Tutor teaches how to ask a Builder well: the person writes the request first, the Tutor reads it and names what is missing; it never writes or sends it.
const scratch = mkdtempSync(join(tmpdir(), "aidea-guide-asking-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));

test("the guide has a part on asking the Builder well, right after the Builder, with the four things, the reference menu and the Contract", () => {
  const order = GUIDE.order;
  assert.equal(order[order.indexOf("builder") + 1], "asking");
  const part = GUIDE.elements.asking;
  for (const word of [/goal/i, /rests on/i, /limits/i, /how you will know/i, /Add a reference to the message/, /Contract/, /nothing else starts it/i]) assert.match(part.what, word);
  assert.match(part.tryIt, /Send/);
});

test("the opening message of the guide class makes the person write first and forbids writing or sending the request for them", () => {
  const message = guideClassMessage();
  assert.match(message, /"asking"/);
  assert.match(message, /the person writes first/i);
  assert.match(message, /say which of the four things is missing/i);
  assert.match(message, /never write the request for them and never offer to send it/i);
});

test("in the guide class the Tutor receives the person's request as they wrote it, to read it and name what is missing", async () => {
  const seen: { answer?: any } = {};
  const adapter: Adapter = {
    options: { modes: [], models: [] },
    run: async function* (opts): AsyncGenerator<AgentEvent> {
      if (opts.role === "grader") { yield { type: "result", structured: { correct: false, feedback: "The limits are there; the goal and how to know it is done are not." } } as AgentEvent; return; }
      if (opts.role !== "tutor") return;
      const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
      const call = async (name: string, args: unknown) => JSON.parse((await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result.content[0].text);
      await call("begin_step", { stepId: "a1", title: "Asking the Builder well" });
      await call("predict", { stepId: "a1", prompt: "What makes a request good?" });
      await call("explain", { stepId: "a1", text: "A request has a goal, what it rests on, limits and how you will know." });
      seen.answer = await call("ask", { stepId: "a1", kind: "text", prompt: "Write the request you would send to the builder.", expected: "A request with the four things." });
      yield { type: "text", text: "ok" };
    },
  };
  const dir = mkdtempSync(join(scratch, "c"));
  const core = await startCore({ port: 0, adapter, learnerDir: dir, preferencesFile: join(dir, "p.json"), recentsFile: join(dir, "r.json") });
  try {
    const project = fixture("shop");
    const post = (path: string, b: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    await post("/projects", { path: project });
    const res = await post("/tutor/classes", { project, guide: true });
    let buf = "";
    for await (const chunk of res.body as any) {
      buf += Buffer.from(chunk).toString();
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        if (!line) continue;
        const e = JSON.parse(line);
        if (e.type === "tutor_question") await post("/tutor/answer", { id: e.id, secret: e.secret, ...(e.kind === "text" ? { text: "Add a cart. Only in the orders folder." } : { text: "a guess" }) });
      }
    }
    assert.match(seen.answer.answer, /Only in the orders folder/);
  } finally { core.close(); }
});
