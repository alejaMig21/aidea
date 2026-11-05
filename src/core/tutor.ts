// The Tutor: its instructions, its tool set (separate from the builder's) and the shape of a question and its answer.
// A question fixes its correct answer before it is shown; that answer stays in the core until the person has answered.

export const TUTOR_INSTRUCTIONS = [
  "You are the Tutor of aidea, a tool where a person designs software and learns why each decision was made. You teach one class, in plain English and short turns.",
  "A class is a series of steps. Each step teaches ONE fact and always follows this loop, in this order; the tools refuse any other order:",
  "0. Measure, then the Plan. Call get_plan. If the Plan and the measurement are both null, measure first, in this conversation (their first message is their goal): ask with measure {topic, kind, prompt, ...}, one question per prerequisite topic, starting near the hardest thing the goal needs; they may answer \"I already know this\". When each topic is bracketed (12 questions at most) call measure_done {topics: [{name, floor, ceiling, note}]} once: floor = the hardest thing they reliably got right, ceiling = the easiest thing they got wrong or did not know (or null). Never teach while measuring. Then set_plan {concepts: [{name, dependsOn}], decisions: [{layer, question}]} from it, in dependency order, no cycles, without what they know. Explain it in a few sentences with plan_ahead: no step begins before they say go ahead. For a change, send the whole revised Plan and ask again.",
  "1. begin_step {stepId, title, item}: name the step. Once a Plan exists, `item` is required and must be one of its concepts; anything else is refused. Give `idea` too, the short name of what the step teaches; call held_ideas first and do not teach those ideas again (begin_step refuses them). You cannot begin another step while this one is open.",
  "2. predict {stepId, prompt}: ask the person to guess, in their own words, about the fact you are about to teach. Open question, no hints. A wrong guess is fine.",
  "3. explain {stepId, text}: teach the fact. Start by resolving the guess (what they said, what is true, why), then give the fact in a few sentences. The text is what the person reads and aidea remembers: make every claim clear and self-contained.",
  "4. ask {stepId, kind, prompt, ...}: check the fact. Choice: give 2 to 6 options and `correct`, the exact text of the right one. Text: give `expected`, the answer you have in mind. Options: plain claims of similar length, each wrong one a believable mistake. Ask about applying the fact.",
  "The result of ask tells you if it was right. If it was wrong, or they did not know, the step stays open: work out what they believe, explain again from a new angle, and check again. If the result says sureAndWrong, they were confident in a mistaken idea: name that idea and repair it before anything else. If it was right, say so briefly and go on.",
  "Choose the steps yourself from the topic given. Use the read tools to look at the person's project when it makes the fact concrete. You cannot write files or run commands.",
  "If a tool returns an error, read it, fix the call and continue. If the person did not answer or the class ended, end your turn.",
  "In a layer class you build a layer WITH the person, and their words come first. For each element of the layer (who the business is for, what a feature must do): (a) ask {kind: \"text\", prompt, element}, where element is a short tag such as \"business:customer-segments\", and ask in plain words with no jargon; this question needs no stepId. (b) Let them answer. (c) Turn that answer into propose_node {layer, node, element} or propose_change {layer, id, changes, element}; quote their words in the Node's rationale.why. Both are refused until they answered a question with the same element, and only create a Proposal the person accepts or rejects. (d) Only then offer alternatives, as one more ask with the same element, starting \"Other ways to see this\". Never write the Node before you asked.",
  "Review: when your first message asks for a review question, ask it with review (same arguments as ask) before the first begin_step, with no hint; the person may say they do not know.",
  "When the person has learned the topic, call finish_class {summary} and end your turn.",
].join("\n");

import { AUTHORING_TOOLS } from "./tutor-authoring.ts";
import { PLAN_TOOLS } from "./plan.ts";

export const CONFIDENCE_STOPS = [0, 30, 50, 70, 90, 100];
export const DEFAULT_CONFIDENCE = 50;

const MAX_TEXT = 4000;

const stepId = { type: "string", description: "The step's id, chosen by you in begin_step" };
export const TUTOR_TOOLS = [
  {
    name: "begin_step",
    description: "Starts the next step of the class (one fact). Refused while the previous step is open: a step closes only when its check was answered correctly.",
    inputSchema: { type: "object", properties: { stepId: { type: "string", description: "A short unique id, for example \"queue-purpose\"" }, title: { type: "string" }, item: { type: "string", description: "The Plan concept this step is about. Required once a Plan exists; it must be one of the Plan's concepts." }, idea: { type: "string", description: "The short name of the idea this step teaches. Refused if the person already understands it (see held_ideas)." } }, required: ["stepId", "title"] },
  },
  {
    name: "predict",
    description: "Asks the person to guess, in their own words, about the fact of the open step before you explain it. Waits for the answer and returns it.",
    inputSchema: {
      type: "object",
      properties: {
        stepId, prompt: { type: "string" },
        point: { type: "object", description: "Optional: where in the interface to look to answer. {layer: \"data\", step: the step of a Playback recording (from 0), variable: a variable's name}. The interface shows that step of the open recording and marks the variable. Only when a recording of the function exists (read_recording).", properties: { layer: { type: "string" }, step: { type: "number" }, variable: { type: "string" } }, required: ["layer"] },
      },
      required: ["stepId", "prompt"],
    },
  },
  {
    name: "explain",
    description: "Shows the person the explanation of the open step. Allowed only after they answered the prediction (or, after a missed check, to teach the step again). Open by resolving their guess.",
    inputSchema: { type: "object", properties: { stepId, text: { type: "string" } }, required: ["stepId", "text"] },
  },
  {
    name: "ask",
    description:
      "Checks the open step after you explained it, and waits for the answer. kind \"choice\": give `prompt`, `options` (2 to 6 texts) and `correct` (the exact text of the right option); " +
      "the person picks one and says how sure they are. kind \"text\": give `prompt` and `expected`, the answer you have in mind; the person writes in their own words and a grader compares it with `expected`. " +
      "`stepId` is required. Set `allowDontKnow` to false only if \"I don't know\" makes no sense (default true). Returns the verdict, the person's answer, confidence and what they thought.",
    inputSchema: {
      type: "object",
      properties: {
        stepId,
        kind: { type: "string", enum: ["choice", "text"] },
        prompt: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        correct: { type: "string" },
        expected: { type: "string" },
        allowDontKnow: { type: "boolean" },
        element: { type: "string", description: "Layer classes: a short tag for the layer element this question is about, for example \"business:customer-segments\". Then kind is \"text\", the person answers in their own words, stepId and the step loop do not apply, and propose_node / propose_change for that element are allowed afterwards." },
      },
      required: ["kind", "prompt"],
    },
  },
  {
    name: "review",
    description:
      "Asks the ONE review question your first message asked for, about an idea from an earlier class. Same arguments as ask (kind, prompt, options and correct, or expected), without stepId. Refused if no review question is due, or after it was asked. Returns whether the person got it right. Do not teach the answer; go on to begin_step.",
    inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["choice", "text"] }, prompt: { type: "string" }, options: { type: "array", items: { type: "string" } }, correct: { type: "string" }, expected: { type: "string" }, allowDontKnow: { type: "boolean" } }, required: ["kind", "prompt"] },
  },
  {
    name: "measure",
    description:
      "Measures one topic before you plan, and waits for the answer. `topic` is the short name of the prerequisite it measures (required). kind \"choice\": give `prompt`, `options` (2 to 6 texts) and `correct`, the exact text of the right one; the person picks one and says how sure they are. kind \"text\": give `prompt`; the person writes in their own words. At most 12 questions; refused for a topic the person already holds or you already asked. The person may answer \"I already know this\". Never teach here.",
    inputSchema: {
      type: "object",
      properties: { topic: { type: "string" }, kind: { type: "string", enum: ["choice", "text"] }, prompt: { type: "string" }, options: { type: "array", items: { type: "string" } }, correct: { type: "string" }, allowDontKnow: { type: "boolean" } },
      required: ["topic", "kind", "prompt"],
    },
  },
  {
    name: "measure_done",
    description: "Hands over the measurement. Call it once. topics: one {name, floor, ceiling, note} per topic you looked at: floor is the hardest thing the person reliably got right (text, or null), ceiling the easiest thing they got wrong or did not know (text, or null), note one sentence on where their understanding ends.",
    inputSchema: {
      type: "object",
      properties: { topics: { type: "array", items: { type: "object", properties: { name: { type: "string" }, floor: { type: ["string", "null"] }, ceiling: { type: ["string", "null"] }, note: { type: "string" } }, required: ["name", "floor", "ceiling", "note"] } } },
      required: ["topics"],
    },
  },
  {
    name: "held_ideas",
    description: "Returns the ideas this person already understands in this Project (name and statement only): do not teach them again. begin_step refuses a step about one of them.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "finish_class",
    description: "Ends the class once every step is closed. `summary` is one or two sentences on what was covered.",
    inputSchema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  },
  ...AUTHORING_TOOLS,
  ...PLAN_TOOLS,
];

// Where a question sits in the class: the step, whether it is the prediction or the check, and the attempt number (set by the core).
// A measuring question has no step: it names the idea it measures, can be skipped, and knows its place in the measurement.
// `point`: where in the interface to look to answer (layout-and-data 17). Today only the Data layer: a step of the Playback recording and a variable in it.
export type Point = { layer: "data"; step?: number; variable?: string };
type Where = { stepId?: string; item?: string; phase?: "predict" | "check" | "review" | "plan"; attempt?: number; idea?: string; skippable?: true; probe?: { n: number; of: number }; point?: Point };

// Checks the pointer the Tutor sent with a prediction; an error text is written for the model.
export function parsePoint(raw: unknown): { point: Point } | { error: string } {
  const bad = (why: string) => ({ error: `point ${why}. Send {layer: "data", step: <whole number from 0>, variable: <name>}, with step and variable optional, or leave point out.` });
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return bad("must be an object");
  const { layer, step, variable, ...rest } = raw as Record<string, unknown>;
  if (Object.keys(rest).length) return bad(`has fields that do not exist (${Object.keys(rest).join(", ")})`);
  if (layer !== "data") return bad('can only point at the layer "data"');
  if (step !== undefined && !(Number.isInteger(step) && (step as number) >= 0 && (step as number) < 100000)) return bad("step must be a whole number of 0 or more");
  if (variable !== undefined && !(typeof variable === "string" && variable.trim().length > 0 && variable.length <= 100)) return bad("variable must be a name of at most 100 characters");
  return { point: { layer, ...(step !== undefined ? { step: step as number } : {}), ...(variable !== undefined ? { variable: variable as string } : {}) } };
}
// What stays in the core. `correct` is the committed answer (choice: the index of the right option).
export type Question =
  | ({ kind: "choice"; prompt: string; options: string[]; correct: number; allowDontKnow: boolean } & Where)
  | ({ kind: "text"; prompt: string; expected?: string; allowDontKnow: boolean } & Where);

export type Answer = { option?: number; text?: string; confidence?: number; thought?: string; dontKnow?: boolean; skip?: boolean };

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

// Checks what the Tutor sent. The error text is written for the model: it says what to change.
export function parseQuestion(args: Record<string, unknown>): { question: Question } | { error: string } {
  const { kind, prompt, options, correct, expected, allowDontKnow } = args;
  if (kind !== "choice" && kind !== "text") return { error: 'kind must be "choice" or "text"' };
  if (!nonEmpty(prompt) || prompt.length > MAX_TEXT) return { error: `prompt must be the question, as text of at most ${MAX_TEXT} characters` };
  if (allowDontKnow !== undefined && typeof allowDontKnow !== "boolean") return { error: "allowDontKnow must be true or false" };
  const dk = allowDontKnow ?? true;
  if (kind === "text") {
    if (expected !== undefined && typeof expected !== "string") return { error: "expected must be text" };
    return { question: { kind, prompt, expected, allowDontKnow: dk } };
  }
  if (!Array.isArray(options) || options.length === 0) return { error: "A choice question needs `options`: an array of 2 to 6 option texts" };
  if (options.length < 2 || options.length > 6 || !options.every((o) => nonEmpty(o) && o.length <= 500)) {
    return { error: "options must be at least 2 and at most 6 non-empty texts" };
  }
  if (!nonEmpty(correct)) return { error: "A choice question needs `correct`: the exact text of the right option, fixed before the question is shown" };
  const index = options.indexOf(correct);
  if (index < 0) return { error: `correct must be exactly one of the options. Options: ${options.map((o) => JSON.stringify(o)).join(", ")}` };
  return { question: { kind, prompt, options, correct: index, allowDontKnow: dk } };
}

// What the interface is told about a question: never the committed answer.
export const publicQuestion = (q: Question) => {
  const where = { ...(q.stepId ? { stepId: q.stepId, phase: q.phase } : q.phase === "review" || q.phase === "plan" ? { phase: q.phase } : {}), ...(q.skippable ? { skippable: true, probe: q.probe } : {}), ...(q.point ? { point: q.point } : {}) };
  return q.kind === "choice" ? { kind: q.kind, prompt: q.prompt, options: q.options, allowDontKnow: q.allowDontKnow, ...where } : { kind: q.kind, prompt: q.prompt, allowDontKnow: q.allowDontKnow, ...where };
};

// Checks the person's answer against the question it belongs to (the interface sends it, so it is checked, not trusted).
export function parseAnswer(q: Question, raw: Record<string, unknown>): { answer: Answer } | { error: string } {
  const { option, text, confidence, thought, dontKnow, skip } = raw;
  if (thought !== undefined && (typeof thought !== "string" || thought.length > MAX_TEXT)) return { error: `thought must be text of at most ${MAX_TEXT} characters` };
  const t = typeof thought === "string" && thought.trim() ? { thought: thought.trim() } : {};
  if (skip === true && q.skippable) return { answer: { skip: true, ...t } };
  if (dontKnow === true) {
    if (!q.allowDontKnow) return { error: "This question does not offer \"I don't know\"" };
    return { answer: { dontKnow: true, ...t } };
  }
  if (q.kind === "text") {
    if (!nonEmpty(text) || text.length > MAX_TEXT) return { error: `Send text of at most ${MAX_TEXT} characters, or dontKnow` };
    return { answer: { text: text.trim(), ...t } };
  }
  if (!Number.isInteger(option) || (option as number) < 0 || (option as number) >= q.options.length) return { error: `Send option as a number from 0 to ${q.options.length - 1}, or dontKnow` };
  const c = confidence ?? DEFAULT_CONFIDENCE;
  if (typeof c !== "number" || !CONFIDENCE_STOPS.includes(c)) return { error: `confidence must be one of ${CONFIDENCE_STOPS.join(", ")}` };
  return { answer: { option: option as number, confidence: c, ...t } };
}

// What the waiting `ask` call returns to the Tutor.
export function answerForTutor(q: Question, a: Answer) {
  const thought = a.thought ? { thought: a.thought } : {};
  if (a.skip) return { skipped: true, known: true, note: "The person says they already know this. Count it as known in measure_done.", ...thought };
  if (q.kind === "text") return a.dontKnow ? { kind: "text", dontKnow: true, ...(q.expected ? { expected: q.expected } : {}), ...thought } : { kind: "text", answer: a.text, ...(q.expected ? { expected: q.expected } : {}), ...thought };
  const correctAnswer = q.options[q.correct];
  return a.dontKnow
    ? { kind: "choice", dontKnow: true, correct: false, correctAnswer, ...thought }
    : { kind: "choice", answer: q.options[a.option!], correct: a.option === q.correct, correctAnswer, confidence: a.confidence, ...thought };
}
