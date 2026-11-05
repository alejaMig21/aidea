// The Tutor's class: POST /tutor/classes starts one and streams its events (newline-delimited JSON, like /chat);
// POST /tutor/answer is the person's answer to a question the Tutor is waiting on.
// A class is one Tutor process for as long as the stream stays open: closing the stream ends the class.
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Handler } from "../types.ts";
import { TUTOR_INSTRUCTIONS } from "../tutor.ts";
import { createLesson } from "../teach.ts";
import { currentChoice } from "./agent-options.ts";
import { pickReview, reviewMessage, reviewQuestionOn } from "../review.ts";
import { layerClassMessage } from "../layer-help.ts";
import { guideClassMessage } from "../guide.ts";
import { driftClassMessage, driftOf } from "../drift.ts";
import { limitOf, selectionMessage, sourceProblem, validSelection } from "../select.ts";
import { pluginClassMessage } from "../tutor-reads.ts";
import { LAYER_CONCEPTS, isLayer } from "../probe.ts";

const MAX_MESSAGE_CHARS = 20_000;
const MAX_TOPIC_CHARS = 500;
const FIRST_MESSAGE = "The person has opened a class but gave no topic. Look at their project with the read tools, pick the one idea worth teaching first, and begin the first step.";
const topicMessage = (topic: string) => `The person has opened a class. The topic is: ${topic}
Begin the first step.`;

const handler: Handler = async (req, res, core) => {
  const path = new URL(req.url ?? "/", "http://core").pathname;
  if (req.method !== "POST" || (path !== "/tutor/classes" && path !== "/tutor/answer")) return false;
  const reject = (status: number, error: string) => {
    core.send(res, status, { error });
    return true;
  };
  const body = (await core.readJson(req, res)) as Record<string, unknown> | null | undefined;
  if (body === undefined) return true; // readJson already answered

  if (path === "/tutor/answer") {
    const { id, secret } = body ?? {};
    if (typeof id !== "string" || typeof secret !== "string") return reject(400, "Send an id and the secret from the question");
    const result = core.permissions.answerQuestion(id, secret, body ?? {});
    if (result === "answered") core.send(res, 200, { ok: true });
    else if (result === "forbidden") return reject(403, "That secret does not belong to this question");
    else if (result === "expired") return reject(410, "The Tutor stopped waiting for this question. Nothing you answered before is lost: start a class on the same topic to go on.");
    else if (result === "unknown") return reject(404, "Unknown question, or it was already answered");
    else return reject(400, result.invalid);
    return true;
  }

  const project = typeof body?.project === "string" ? core.projects.get(body.project) : undefined;
  if (!project) return reject(400, "project must be a Project that is already open");
  const topic = body?.topic;
  if (topic !== undefined && (typeof topic !== "string" || topic.length > MAX_TOPIC_CHARS)) return reject(400, `topic must be text of at most ${MAX_TOPIC_CHARS} characters`);
  const layer = body?.layer;
  if (layer !== undefined && !isLayer(layer)) return reject(400, `layer must be one of ${Object.keys(LAYER_CONCEPTS).join(", ")}`);
  const guide = body?.guide;
  if (guide !== undefined && guide !== true) return reject(400, "guide must be true");
  const difference = body?.drift === undefined ? undefined : driftOf(project).find((d) => d.id === body.drift);
  if (body?.drift !== undefined && !difference) return reject(400, "drift must be the id of a difference on the project's drift list (GET /drift)");
  const selection = body?.selection;
  const badSource = sourceProblem(body?.source);
  if (badSource) return reject(400, badSource);
  if (selection !== undefined && !validSelection(selection, body?.source)) return reject(400, `selection must be the selected text, at most ${limitOf(body?.source)} characters`);
  const plugin = body?.plugin;
  if (plugin !== undefined && (typeof plugin !== "string" || !core.quarantine.get(plugin))) return reject(400, "plugin must be the id of a plugin waiting in the quarantine");
  const opening = guide ? guideClassMessage(core.plugins.lessons()) : layer ? layerClassMessage(layer) : difference ? driftClassMessage(difference) : selection ? selectionMessage(selection) : plugin ? pluginClassMessage(plugin) : body?.message ?? (typeof topic === "string" && topic.trim() ? topicMessage(topic.trim()) : FIRST_MESSAGE);
  // One review question about an earlier idea opens a FREE class (started with "Start a class"), unless the person turned it off. A class on a layer, on selected text,
  // on a difference, on a plugin or on how aidea works is something the person asked for on purpose: a review before it would only be in the way.
  const free = !layer && !difference && !selection && !guide && !plugin;
  const review = !free || !reviewQuestionOn(core, project.id) ? undefined : pickReview(core, project.id, typeof topic === "string" ? [topic] : []);
  const message = review && typeof opening === "string" ? opening + "\n" + reviewMessage(review) : opening;
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_CHARS) {
    return reject(400, `message must be a non-empty string of at most ${MAX_MESSAGE_CHARS} characters`);
  }

  res.writeHead(200, { "content-type": "application/x-ndjson" });
  const send = (event: object) => {
    if (!res.writableEnded) res.write(JSON.stringify(event) + "\n");
  };
  const classId = `c-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const node = typeof body?.node === "string" ? body.node : undefined; // the Project Node the class is about, if any
  const texts: string[] = []; // the Teacher's prose, for the Learner graph
  const lesson = createLesson();
  if (review) lesson.setReview(review.idea);
  if (guide) lesson.setAboutAidea(); // a class about the app is not part of the Project's Plan
  core.lessons.set(classId, lesson);
  const conversation = core.permissions.open(send, project.id, "tutor", classId);
  const tools = {
    mcpConfig: JSON.stringify({ mcpServers: { tutor: { type: "http", url: `http://${req.headers.host}/mcp/${conversation.token}` } } }),
    allowedTools: ["mcp__tutor__*"],
  };
  const abort = new AbortController();
  res.on("close", () => {
    abort.abort();
    conversation.close();
  });
  try {
    // The Tutor works in a neutral empty folder, never in the person's Project: it reads the Project through core tools.
    const cwd = join(tmpdir(), "aidea-tutor");
    mkdirSync(cwd, { recursive: true });
    const { tutorModel } = currentChoice(core, project.id);
    for await (const event of core.adapter.run({ role: "tutor", cwd, message, model: tutorModel, signal: abort.signal, instructions: TUTOR_INSTRUCTIONS, tools })) {
      if (event.type === "text" && !event.parent) texts.push(event.text);
      send(event);
    }
  } catch (e) {
    console.error(e);
    send({ type: "error", code: "failed", message: "The Tutor stopped unexpectedly" });
  } finally {
    conversation.close();
    core.lessons.delete(classId);
  }
  // What was taught is the explanations (also an open step's); a class that never used the loop falls back to the Teacher's plain text.
  if (lesson.texts.length) texts.splice(0, texts.length, ...lesson.texts);
  // The class is closed only when the pipeline has run; if it fails the prose is kept and POST /tutor/classes/<id>/close retries.
  if (texts.length) send({ type: "learner", classId, ...(await core.learner.closeClass({ classId, project: project.id, node, texts })) });
  res.end();
  return true;
};

export default handler;
