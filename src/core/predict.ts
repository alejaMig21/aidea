// "Guess first": a question about the next step of a recording, made only from the recording's own values. Nothing is invented:
// the true value is the one on arrival at the next step, the other options are values the run already showed.
type Visit = { step: string; locals: Record<string, string> };

export type RunQuestion = { name: string; prompt: string; options: string[]; correct: number };

const MAX_OPTIONS = 4;

// The first value that changes (or first appears) at the next step; none changed, or no next step, means nothing to ask.
export function runQuestion(visits: Visit[], step: number): RunQuestion | undefined {
  const now = visits[step], next = visits[step + 1];
  if (!now || !next) return undefined;
  const name = Object.keys(next.locals).find((n) => now.locals[n] !== next.locals[n]);
  if (name === undefined) return undefined;
  const truth = next.locals[name];
  // Values already seen up to this step, the same name first, latest first; a repeat or the truth is left out.
  const seen = visits.slice(0, step + 1).reverse().flatMap((v) => Object.entries(v.locals));
  const others = [...seen.filter(([n]) => n === name), ...seen.filter(([n]) => n !== name)].map(([, v]) => v);
  const wrong = [...new Set(others)].filter((v) => v !== truth).slice(0, MAX_OPTIONS - 1);
  if (!wrong.length) return undefined;
  const at = step % (wrong.length + 1); // the place of the true value changes from step to step but is the same every time
  const options = [...wrong.slice(0, at), truth, ...wrong.slice(at)];
  return { name, prompt: `After this step, what will \`${name}\` be?`, options, correct: at };
}
