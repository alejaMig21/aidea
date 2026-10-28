// The Probe: POST /tutor/probes {project, layer, redo?, model?} starts one and streams its events (newline-delimited JSON, like a class);
// POST /tutor/probes/skip {project, layer} skips it (and stores the skip); GET /tutor/probes?project=&layer= returns the stored result.
// Closing the stream also ends the Probe, but stores nothing. A Probe never blocks a class.
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Core, Handler } from "../types.ts";
import { LAYER_CONCEPTS, PROBE_INSTRUCTIONS, countsOf, isLayer } from "../probe.ts";
import type { ProbeResult } from "../probe.ts";

const layersText = Object.keys(LAYER_CONCEPTS).join(", ");
const firstMessage = (layer: string) =>
  `The person is about to start the ${layer} layer of their project. The concepts this layer needs, as data:\n${JSON.stringify(LAYER_CONCEPTS[layer])}\nCheck what they already know. Begin.`;

const handler: Handler = async (req, res, core: Core) => {
  const url = new URL(req.url ?? "/", "http://core");
  const path = url.pathname;
  if (path !== "/tutor/probes" && path !== "/tutor/probes/skip") return false;
  const reject = (status: number, error: string) => {
    core.send(res, status, { error });
    return true;
  };
  const check = (project: unknown, layer: unknown) => {
    if (typeof project !== "string" || !core.projects.has(project)) return "project must be a Project that is already open";
    if (!isLayer(layer)) return `layer must be one of ${layersText}`;
  };

  if (req.method === "GET" && path === "/tutor/probes") {
    const project = url.searchParams.get("project"), layer = url.searchParams.get("layer");
    const bad = check(project, layer);
    if (bad) return reject(400, bad);
    core.send(res, 200, { result: core.probes.get(project!, layer!) ?? null });
    return true;
  }
  if (req.method !== "POST") return false;

  const body = (await core.readJson(req, res)) as Record<string, unknown> | null | undefined;
  if (body === undefined) return true; // readJson already answered
  const { project: projectId, layer, redo, model } = body ?? {};
  const bad = check(projectId, layer);
  if (bad) return reject(400, bad);
  const project = core.projects.get(projectId as string)!;
  const where = { project: project.id, layer: layer as string };
  const running = core.probes.running(where.project, where.layer);

  if (path === "/tutor/probes/skip") {
    if (running) {
      if (!running.closed) {
        running.closed = "skipped";
        core.probes.put({ ...where, status: "skipped", topics: [], questions: running.asked, time: new Date().toISOString() });
      }
      running.abort.abort();
    } else if (!core.probes.get(where.project, where.layer)) {
      core.probes.put({ ...where, status: "skipped", topics: [], questions: 0, time: new Date().toISOString() });
    }
    core.send(res, 200, { ok: true });
    return true;
  }

  if (redo !== undefined && typeof redo !== "boolean") return reject(400, "redo must be true or false");
  if (model !== undefined && (typeof model !== "string" || !core.adapter.options.models.some((m) => m.id === model))) {
    return reject(400, `model must be one the agent offers: ${core.adapter.options.models.map((m) => m.id).join(", ")}`);
  }
  if (running) return reject(409, "A Probe for this layer is already running");

  res.writeHead(200, { "content-type": "application/x-ndjson" });
  const send = (event: object) => {
    if (!res.writableEnded) res.write(JSON.stringify(event) + "\n");
  };
  const stored: ProbeResult | undefined = core.probes.get(where.project, where.layer);
  if (stored && redo !== true) { // measured once per person and Project: the stored result is the answer
    send(stored.status === "done" ? { type: "probe_done", already: true, layer: stored.layer, topics: stored.topics, counts: countsOf(stored.topics), questions: stored.questions } : { type: "probe_skipped", already: true, layer: stored.layer });
    res.end();
    return true;
  }

  const probeId = `p-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const abort = new AbortController();
  const run = { ...where, asked: 0, ideas: new Set<string>(), abort, closed: undefined as "done" | "skipped" | undefined };
  core.probes.runs.set(probeId, run);
  const conversation = core.permissions.open(send, project.id, "prober", probeId);
  const tools = {
    mcpConfig: JSON.stringify({ mcpServers: { tutor: { type: "http", url: `http://${req.headers.host}/mcp/${conversation.token}` } } }),
    allowedTools: ["mcp__tutor__*"],
  };
  res.on("close", () => {
    abort.abort();
    conversation.close();
  });
  try {
    const cwd = join(tmpdir(), "aidea-tutor");
    mkdirSync(cwd, { recursive: true });
    for await (const event of core.adapter.run({ role: "prober", cwd, message: firstMessage(where.layer), model: (model as string | undefined) ?? core.learner.model, signal: abort.signal, instructions: PROBE_INSTRUCTIONS, tools })) {
      send(event);
    }
  } catch (e) {
    console.error(e);
    send({ type: "error", code: "failed", message: "The Probe stopped unexpectedly" });
  } finally {
    conversation.close();
    core.probes.runs.delete(probeId);
  }
  if (run.closed === "skipped") send({ type: "probe_skipped", layer: where.layer });
  else if (!run.closed && !res.destroyed) send({ type: "error", code: "failed", message: "The Probe ended without a result. You can start the class anyway." });
  res.end();
  return true;
};

export default handler;
