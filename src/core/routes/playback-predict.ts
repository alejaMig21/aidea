// Guess first: ask what the next step of a recording will do, record the guess as Evidence about the run.
// The right option never leaves the core before the guess; the answer is checked here, not trusted.
import { runQuestion } from "../predict.ts";
import { CONFIDENCE_STOPS, DEFAULT_CONFIDENCE } from "../tutor.ts";
import type { Evidence } from "../learner.ts";
import type { Handler } from "../types.ts";

type Recording = { id: string; project: string; visits: { step: string; locals: Record<string, string> }[] };

const verdicts = new Map<string, { correct: boolean; name: string; answer: string }>(); // the first answer per recording and step

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (url.pathname !== "/playback/predict") return false;
  const isGet = req.method === "GET";
  if (!isGet && req.method !== "POST") return false;

  let body: Record<string, unknown> = {};
  if (!isGet) {
    const read = (await core.readJson(req, res)) as Record<string, unknown> | null | undefined;
    if (read === undefined) return true; // readJson already answered
    body = read ?? {};
  }
  const id = isGet ? url.searchParams.get("id") : body.id;
  const rec = typeof id === "string" ? (core.recordings.get(id) as Recording | undefined) : undefined;
  if (!rec) return core.send(res, 404, { error: "Unknown recording" }), true;
  const rawStep = isGet ? url.searchParams.get("step") : body.step;
  if (rawStep === undefined || rawStep === null || rawStep === "") return core.send(res, 400, { error: "Send step as the number of a step of the recording" }), true;
  const step = Number(rawStep);
  const q = Number.isInteger(step) ? runQuestion(rec.visits, step) : undefined;

  if (isGet) {
    if (!q) core.send(res, 422, { error: "Nothing to guess at this step" });
    else core.send(res, 200, { step, name: q.name, prompt: q.prompt, options: q.options });
    return true;
  }
  const { option, confidence = DEFAULT_CONFIDENCE, thought } = body;
  if (!Number.isInteger(option) || (option as number) < 0 || (option as number) >= (q?.options.length ?? 0)) {
    // A bad option is the person's mistake (400) even before we know whether this step has a question.
    if (!q) core.send(res, 422, { error: "Nothing to guess at this step" });
    else core.send(res, 400, { error: `Send option as a number from 0 to ${q.options.length - 1}` });
    return true;
  }
  if (typeof confidence !== "number" || !CONFIDENCE_STOPS.includes(confidence)) {
    core.send(res, 400, { error: `confidence must be one of ${CONFIDENCE_STOPS.join(", ")}` });
    return true;
  }
  if (thought !== undefined && (typeof thought !== "string" || thought.length > 2000)) {
    core.send(res, 400, { error: "thought must be text of at most 2000 characters" });
    return true;
  }
  const first = verdicts.get(`${rec.id}:${step}`);
  if (first) return core.send(res, 200, first), true; // a repeat adds no Evidence
  const correct = option === q!.correct;
  const e: Evidence = {
    classId: `run:${rec.id}`, questionId: `${rec.id}:${step}`, project: rec.project, kind: "run-prediction",
    correct, confidence, answer: q!.options[option as number], thought: typeof thought === "string" && thought.trim() ? thought.trim() : null,
    dontKnow: false, time: new Date().toISOString(), run: { recording: rec.id, step, name: q!.name },
    ...(!correct && confidence >= 70 ? { sureAndWrong: true as const } : {}),
  };
  core.learner.recordEvidence(e);
  const verdict = { correct, name: q!.name, answer: q!.options[q!.correct] };
  verdicts.set(`${rec.id}:${step}`, verdict);
  core.send(res, 200, verdict);
  return true;
};

export default handler;
