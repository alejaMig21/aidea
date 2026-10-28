// The Tutor: its instructions, its tool set (separate from the builder's) and the shape of a question and its answer.
// A question fixes its correct answer before it is shown; that answer stays in the core until the person has answered.

export const TUTOR_INSTRUCTIONS = [
  "You are the Tutor of aidea, a tool where a person designs software and learns why each decision was made.",
  "Teach by asking. Pose one question at a time with the ask tool, then wait: the tool returns when the person has answered.",
  "Fix the correct answer inside the question itself (a choice question needs its options and which one is right; a text question may carry the answer you expect).",
  "Use the person's answer, their confidence and what they thought to decide what to explain next. Keep explanations short and in plain words.",
  "If the ask tool returns an error, read it and fix the call. If it says the person did not answer or the class ended, do not ask again: end your turn.",
  "You cannot edit files or run commands, and you do not need to.",
].join("\n");

export const CONFIDENCE_STOPS = [0, 30, 50, 70, 90, 100];
export const DEFAULT_CONFIDENCE = 50;

const MAX_TEXT = 4000;

export const TUTOR_TOOLS = [
  {
    name: "ask",
    description:
      "Asks the person one question and waits for the answer. kind \"choice\": give `prompt`, `options` (2 to 6 texts) and `correct` (the exact text of the right option); " +
      "the person picks one and says how sure they are. kind \"text\": give `prompt` and optionally `expected`, the answer you have in mind; the person writes in their own words. " +
      "Set `allowDontKnow` to false only if \"I don't know\" makes no sense (default true). Returns the person's answer, confidence and what they thought.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["choice", "text"] },
        prompt: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        correct: { type: "string" },
        expected: { type: "string" },
        allowDontKnow: { type: "boolean" },
      },
      required: ["kind", "prompt"],
    },
  },
];

// What stays in the core. `correct` is the committed answer (choice: the index of the right option).
export type Question =
  | { kind: "choice"; prompt: string; options: string[]; correct: number; allowDontKnow: boolean }
  | { kind: "text"; prompt: string; expected?: string; allowDontKnow: boolean };

export type Answer = { option?: number; text?: string; confidence?: number; thought?: string; dontKnow?: boolean };

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
export const publicQuestion = (q: Question) =>
  q.kind === "choice" ? { kind: q.kind, prompt: q.prompt, options: q.options, allowDontKnow: q.allowDontKnow } : { kind: q.kind, prompt: q.prompt, allowDontKnow: q.allowDontKnow };

// Checks the person's answer against the question it belongs to (the interface sends it, so it is checked, not trusted).
export function parseAnswer(q: Question, raw: Record<string, unknown>): { answer: Answer } | { error: string } {
  const { option, text, confidence, thought, dontKnow } = raw;
  if (thought !== undefined && (typeof thought !== "string" || thought.length > MAX_TEXT)) return { error: `thought must be text of at most ${MAX_TEXT} characters` };
  const t = typeof thought === "string" && thought.trim() ? { thought: thought.trim() } : {};
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
  if (q.kind === "text") return a.dontKnow ? { kind: "text", dontKnow: true, ...(q.expected ? { expected: q.expected } : {}), ...thought } : { kind: "text", answer: a.text, ...(q.expected ? { expected: q.expected } : {}), ...thought };
  const correctAnswer = q.options[q.correct];
  return a.dontKnow
    ? { kind: "choice", dontKnow: true, correct: false, correctAnswer, ...thought }
    : { kind: "choice", answer: q.options[a.option!], correct: a.option === q.correct, correctAnswer, confidence: a.confidence, ...thought };
}
