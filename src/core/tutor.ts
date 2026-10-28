// The Tutor: its instructions, its tool set (separate from the builder's) and the shape of a question and its answer.
// A question fixes its correct answer before it is shown; that answer stays in the core until the person has answered.

export const TUTOR_INSTRUCTIONS = [
  "You are the Tutor of aidea, a tool where a person designs software and learns why each decision was made. You teach one class, in plain English and short turns.",
  "A class is a series of steps. Each step teaches ONE fact and always follows this loop, in this order; the tools refuse any other order:",
  "1. begin_step {stepId, title}: name the step. You cannot begin another step while this one is open.",
  "2. predict {stepId, prompt}: ask the person to guess, in their own words, about the fact you are about to teach. Open question, no hints that give the answer away. Wait for the reply; a wrong guess is fine.",
  "3. explain {stepId, text}: teach the fact. Start by resolving the guess (what they said, what is true, why), then give the fact in a few sentences. The explain text is what the person reads and what aidea remembers, so make every claim clear and self-contained.",
  "4. ask {stepId, kind, prompt, ...}: check the fact. Choice: give 2 to 6 options and `correct`, the exact text of the right one. Text: give `expected`, the answer you have in mind. Write options as plain claims of similar length, each wrong one a believable mistake. Ask about applying the fact, not repeating it.",
  "The result of ask tells you if it was right. If it was wrong, or the person did not know, the step stays open: work out what they believe, call explain again for the same step from a new angle, and check again. If the result says sureAndWrong, they were confident in a mistaken idea: name that idea and repair it before anything else. If it was right, say so in a few words and move to the next step.",
  "Choose the steps yourself from the topic you are given. Use the read tools to look at the person's own project when it makes the fact concrete. You cannot write files or run commands, and you do not need to.",
  "If a tool returns an error, read it, fix the call and continue. If it says the person did not answer or the class ended, do not ask again: end your turn.",
  "Keep going until the person has learned the topic, then call finish_class {summary} and end your turn.",
].join("\n");

export const CONFIDENCE_STOPS = [0, 30, 50, 70, 90, 100];
export const DEFAULT_CONFIDENCE = 50;

const MAX_TEXT = 4000;

const stepId = { type: "string", description: "The step's id, chosen by you in begin_step" };
export const TUTOR_TOOLS = [
  {
    name: "begin_step",
    description: "Starts the next step of the class (one fact). Refused while the previous step is open: a step closes only when its check was answered correctly.",
    inputSchema: { type: "object", properties: { stepId: { type: "string", description: "A short unique id, for example \"queue-purpose\"" }, title: { type: "string" } }, required: ["stepId", "title"] },
  },
  {
    name: "predict",
    description: "Asks the person to guess, in their own words, about the fact of the open step before you explain it. Waits for the answer and returns it.",
    inputSchema: { type: "object", properties: { stepId, prompt: { type: "string" } }, required: ["stepId", "prompt"] },
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
      },
      required: ["stepId", "kind", "prompt"],
    },
  },
  {
    name: "finish_class",
    description: "Ends the class once every step is closed. `summary` is one or two sentences on what was covered.",
    inputSchema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  },
];

// Where a question sits in the class: the step, whether it is the prediction or the check, and the attempt number (set by the core).
// A probe question (ticket 06) has no step: it names the idea it measures, can be skipped, and knows its place in the Probe.
type Where = { stepId?: string; phase?: "predict" | "check"; attempt?: number; idea?: string; skippable?: true; probe?: { n: number; of: number } };
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
  const where = { ...(q.stepId ? { stepId: q.stepId, phase: q.phase } : {}), ...(q.skippable ? { skippable: true, probe: q.probe } : {}) };
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
  if (a.skip) return { skipped: true, known: true, note: "The person says they already know this. Report it as known in probe_done.", ...thought };
  if (q.kind === "text") return a.dontKnow ? { kind: "text", dontKnow: true, ...(q.expected ? { expected: q.expected } : {}), ...thought } : { kind: "text", answer: a.text, ...(q.expected ? { expected: q.expected } : {}), ...thought };
  const correctAnswer = q.options[q.correct];
  return a.dontKnow
    ? { kind: "choice", dontKnow: true, correct: false, correctAnswer, ...thought }
    : { kind: "choice", answer: q.options[a.option!], correct: a.option === q.correct, correctAnswer, confidence: a.confidence, ...thought };
}
