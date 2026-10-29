// Playback: run a function once with the given inputs, keep the recording, replay it from memory.
// A recording is the steps the run went through and the values on arrival at each. Replaying never runs the code again.
import { locate, moduleAndName } from "../locate.ts";
import { AdapterError, adapterFor } from "../adapters.ts";
import type { Handler } from "../types.ts";

const MAX_RECORDINGS = 200;
const MAX_ARGS = 50;
const MAX_VALUE_CHARS = 10_000;
const FAKE_NAME = /^[A-Za-z_][\w.]{0,100}$/;
const DEFAULT_RUN_TIMEOUT_MS = 20_000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isList = (v: unknown): v is unknown[] => Array.isArray(v) && v.length <= MAX_ARGS;

let counter = 0;

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (url.pathname !== "/playback") return false;

  if (req.method === "GET") {
    const recording = core.recordings.get(url.searchParams.get("id") ?? "");
    if (recording === undefined) core.send(res, 404, { error: "Unknown recording" });
    else core.send(res, 200, recording);
    return true;
  }
  if (req.method !== "POST") return false;

  const body = (await core.readJson(req, res)) as Record<string, unknown> | null | undefined;
  if (body === undefined) return true; // readJson already answered
  const found = locate(core, res, body?.project, body?.node);
  if (!found) return true;
  const { project, node, file } = found;
  if (node.kind !== "function") {
    core.send(res, 422, { error: "The Node is not a function: only functions can be played" });
    return true;
  }

  // The inputs are JSON values or Python literal texts, never code.
  // `values` are Python literal texts per parameter; the Python side parses them and never runs them.
  const { args = [], kwargs = {}, instance = null, fakes = {}, values = {}, instanceValues = {}, effects = {} } = body ?? {};
  for (const [what, texts] of Object.entries({ values, instanceValues, effects })) {
    if (!isObject(texts) || Object.keys(texts).length > MAX_ARGS || !Object.values(texts).every((v) => typeof v === "string" && v.length <= MAX_VALUE_CHARS)) {
      core.send(res, 400, { error: `${what} must be an object of Python literal texts (at most ${MAX_ARGS}, each at most ${MAX_VALUE_CHARS} characters)` });
      return true;
    }
  }
  if (!Object.keys(effects as object).every((name) => FAKE_NAME.test(name))) {
    core.send(res, 400, { error: "effects must be named by the call they replace, such as open or requests.get" });
    return true;
  }
  const instanceOk = instance === null || (isObject(instance) && (instance.args === undefined || isList(instance.args)) && (instance.kwargs === undefined || isObject(instance.kwargs)));
  if (!isList(args) || !isObject(kwargs) || !instanceOk) {
    core.send(res, 400, { error: `args must be a list (at most ${MAX_ARGS}), kwargs an object, and instance an object with optional args and kwargs` });
    return true;
  }
  if (!isObject(fakes) || !Object.keys(fakes).every((name) => FAKE_NAME.test(name))) {
    core.send(res, 400, { error: "fakes must be an object whose keys are names such as open or requests.get" });
    return true;
  }

  // Whether to run with the Project's own interpreter (for Python, its virtual environment) instead of the default one.
  const wantsProjectPython = body?.useProjectPython;
  if (wantsProjectPython !== undefined && typeof wantsProjectPython !== "boolean") {
    core.send(res, 400, { error: "useProjectPython must be true or false" });
    return true;
  }

  const adapter = adapterFor(project.path);
  if (!adapter.run) {
    core.send(res, 422, { error: "This project's language cannot run functions yet" });
    return true;
  }
  const { module, qualifiedName } = moduleAndName(project, node);
  const input = { args, kwargs, instance, fakes, values, instanceValues, effects };
  let outcome: Record<string, unknown>;
  let interpreter: string;
  try {
    ({ outcome, interpreter } = await adapter.run({
      projectPath: project.path,
      moduleId: module.id,
      qualifiedName,
      file,
      input,
      useProjectInterpreter: wantsProjectPython === true,
      timeoutMs: Number(process.env.AIDEA_PLAYBACK_TIMEOUT_MS) || DEFAULT_RUN_TIMEOUT_MS,
    }));
  } catch (e) {
    if (!(e instanceof AdapterError)) throw e;
    core.send(res, e.status, { error: e.message });
    return true;
  }

  if (typeof outcome.unsupported === "string") {
    core.send(res, 422, { error: outcome.unsupported });
    return true;
  }
  const invalid = outcome.invalid as Record<string, string> | undefined;
  if (invalid) {
    core.send(res, 422, { error: Object.values(invalid).join("; "), fields: invalid });
    return true;
  }
  const refused = outcome.refused as { name: string; line: number }[] | undefined;
  if (refused) {
    const list = refused.map((r) => `${r.name} (line ${r.line})`).join(", ");
    core.send(res, 422, {
      error: `This function has external effects: ${list}. Replace them with fake data to play it.`,
      effects: refused,
    });
    return true;
  }

  const id = `pb-${++counter}`;
  const recording = { id, project: project.id, node: node.id, input, interpreter, ...outcome };
  if (core.recordings.size >= MAX_RECORDINGS) core.recordings.delete(core.recordings.keys().next().value!);
  core.recordings.set(id, recording);
  core.send(res, 201, recording);
  return true;
};

export default handler;
