// Narration: one plain sentence per step of a recording, derived only from the graph's steps and edges and the recording's visits.
// It knows no language: a step is told by its `kind`, `construct`, `line` and `label`, a value by the text the adapter recorded.
import type { Flow } from "./adapters.ts";

type Visit = { step: string; locals: Record<string, string> };
type Recording = { visits: Visit[]; result?: string; error?: { type: string; message: string }; truncated?: boolean };

const MAX_VALUE = 24;
const MAX_CHANGES = 3;
const clip = (v: string) => (v.length > MAX_VALUE ? `${v.slice(0, MAX_VALUE - 1)}…` : v);

// What changed between two arrivals: a name that is new "was set to", one that differs "went from .. to ..".
function changes(before: Record<string, string>, after: Record<string, string>): string {
  const said = Object.entries(after)
    .filter(([name, v]) => before[name] !== v)
    .map(([name, v]) => (name in before ? `${name} went from ${clip(before[name])} to ${clip(v)}` : `${name} was set to ${clip(v)}`));
  const shown = said.slice(0, MAX_CHANGES);
  if (said.length > MAX_CHANGES) shown.push(`${said.length - MAX_CHANGES} more changed`);
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}` : (shown[0] ?? "");
}

const arguments_ = (locals: Record<string, string>) => {
  const given = Object.entries(locals).map(([name, v]) => `${name} = ${clip(v)}`);
  return given.length ? given.join(", ") : "no arguments";
};

export function narrate(flow: Pick<Flow, "steps" | "edges">, rec: Recording): string[] {
  const steps = new Map(flow.steps.map((s) => [s.id, s]));
  const last = rec.visits.length - 1;
  return rec.visits.map((cur, i) => {
    if (i === 0) return `The function is called with ${arguments_(cur.locals)}.` + ending(i);
    const before = rec.visits[i - 1];
    const s = steps.get(before.step);
    const line = s ? `Line ${s.line} ran: ` : "A step ran: ";
    const changed = changes(before.locals, cur.locals);
    const along = changed ? `, and ${changed}` : "";
    const edge = flow.edges.find((e) => e.from === before.step && e.to === cur.step && !e.back);
    const condition = String(s?.label ?? "").replace(/^(if|while|elif) /, "");
    let told: string;
    if (s?.kind === "start") told = `the function started with ${arguments_(before.locals)}.`;
    else if (s?.kind === "return") told = `the function returned${i === last && rec.result !== undefined ? ` ${clip(rec.result)}` : ""}.`;
    else if (s?.kind === "raise") told = "an error was raised.";
    else if (s?.construct === "for" && edge?.label) told = (edge.label === "true" ? `the loop took its next item${along}.` : "the loop had no items left, so it ended.");
    else if (s?.construct === "while" && edge?.label) told = `the condition ${condition} was ${edge.label}, so ${edge.label === "true" ? "the loop went round again" : "the loop ended"}.`;
    else if (s?.construct === "if" && edge?.label) told = `the condition ${condition} was ${edge.label}, so it took the ${edge.label === "true" ? "first" : "other"} way.`;
    else told = changed ? `${changed}.` : "nothing changed value.";
    return line[0].toUpperCase() + line.slice(1) + told + ending(i);
  });

  // The last step of a run that failed or was cut short says so: the failing step has no step after it to be told by.
  function ending(i: number): string {
    if (i !== last) return "";
    const s = steps.get(rec.visits[i].step);
    if (rec.error) return ` ${s ? `Line ${s.line}` : "A step"} then stopped the run with ${rec.error.type}: ${rec.error.message}.`;
    if (rec.truncated) return " The recording stops here because the run took too many steps.";
    return "";
  }
}
