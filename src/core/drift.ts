// Drift: where the built code differs from the Contract. Computed fresh on every call from the authored layers and the derived
// analysis; nothing is stored. A difference is information, never a block. What the person has not said is never contradicted:
// a requirement with no link is "not built yet" (not drift) unless it is marked `built: true`, and a Node that declares no
// `relations` has stated nothing about what it may depend on.
import { loadAuthored } from "./authored.ts";
import { architectureModules, patternViolations } from "./patterns.ts";
import { traceLinks } from "./traces.ts";
import type { Project } from "./types.ts";

export type Drift = {
  id: string;
  type: "broken-trace" | "built-without-code" | "missing-relationship" | "undeclared-dependency" | "pattern";
  layer: "requirements" | "architecture" | "business";
  nodes: string[];
  explanation: string;
  certainty?: "certain" | "possible";
  evidence?: { kind: string; from: string; to: string; name: string; line: number }[];
};

const ORDER: Drift["type"][] = ["broken-trace", "built-without-code", "missing-relationship", "undeclared-dependency", "pattern"];
const MAX_EVIDENCE = 5;

export function driftOf(project: Project): Drift[] {
  const authored = loadAuthored(project.path);
  const out: Drift[] = [];

  for (const l of traceLinks(project, authored).filter((l) => l.broken)) {
    out.push({
      id: `broken-trace:${l.from}>${l.to}`, type: "broken-trace", layer: l.layer, nodes: [l.from, l.to],
      explanation: `"${l.from}" on the ${l.layer} layer says it is realised by "${l.to}", but "${l.to}" is not there any more. The code may have moved or been removed, or the link is out of date.`,
    });
  }
  for (const r of authored.layers.requirements.nodes) {
    if (r.built === true && !((r.traces as unknown[] | undefined)?.length)) {
      out.push({ id: `built-without-code:${r.id}`, type: "built-without-code", layer: "requirements", nodes: [r.id], explanation: `Requirement "${r.id}" is marked as built, but it is not linked to any Architecture element or code.` });
    }
  }

  // Dependencies the code has between Architecture Nodes: a relationship between two modules is taken to every pair of Nodes that stand for them.
  const nodes = authored.layers.architecture.nodes;
  const { moduleOf, nodesOfModule } = architectureModules(project, nodes);
  const deps = new Map<string, NonNullable<Drift["evidence"]>>();
  const certain = new Set<string>();
  const unresolvedFrom = new Set<string>(); // Nodes with code relationships that could not be placed
  for (const rel of project.relationships) {
    const fromModule = moduleOf(rel.from);
    if (fromModule === undefined) continue;
    if (rel.to === null) {
      for (const a of nodesOfModule.get(fromModule) ?? []) unresolvedFrom.add(a);
      continue;
    }
    const toModule = moduleOf(rel.to);
    if (toModule === undefined || toModule === fromModule) continue;
    for (const a of nodesOfModule.get(fromModule) ?? []) {
      for (const b of nodesOfModule.get(toModule) ?? []) {
        if (a === b) continue;
        const k = `${a}>${b}`;
        const list = deps.get(k) ?? [];
        list.push({ kind: rel.kind, from: rel.from, to: rel.to, name: rel.name, line: rel.line });
        deps.set(k, list);
        if (rel.resolution === "resolved") certain.add(k);
      }
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const inside = (a: string, b: string) => { // is `a` inside `b`, however deep
    for (let at = byId.get(a), guard = 0; at && guard < 50; at = byId.get(at.parent as string), guard++) if (at.parent === b) return true;
    return false;
  };
  const relationsOf = (id: string) => ((byId.get(id)?.relations as { to: string; label?: string }[] | undefined) ?? []);
  const hasCode = (id: string) => [...nodesOfModule.values()].some((ids) => ids.includes(id));

  for (const a of nodes) {
    const declared = relationsOf(a.id);
    if (!declared.length) continue; // it has said nothing about what it may depend on
    for (const rel of declared) {
      const b = rel.to;
      if (!byId.has(b) || b === a.id || !hasCode(a.id) || !hasCode(b) || deps.has(`${a.id}>${b}`)) continue;
      const possible = unresolvedFrom.has(a.id);
      out.push({
        id: `missing-relationship:${a.id}>${b}`, type: "missing-relationship", layer: "architecture", nodes: [a.id, b], certainty: possible ? "possible" : "certain",
        explanation: `The Architecture says "${a.id}" uses "${b}"${rel.label ? ` (${rel.label})` : ""}, but no code of "${a.id}" depends on code of "${b}".${possible ? " Some calls in this code could not be traced, so this may be a gap in the analysis." : ""}`,
      });
    }
  }
  for (const [k, evidence] of deps) {
    const [a, b] = k.split(">");
    if (!relationsOf(a).length) continue;
    if (relationsOf(a).some((r) => r.to === b) || inside(a, b) || inside(b, a)) continue;
    out.push({
      id: `undeclared-dependency:${a}>${b}`, type: "undeclared-dependency", layer: "architecture", nodes: [a, b], certainty: certain.has(k) ? "certain" : "possible", evidence: evidence.slice(0, MAX_EVIDENCE),
      explanation: `Code of "${a}" depends on code of "${b}" (${evidence[0].kind} at line ${evidence[0].line}), but the Architecture does not say that "${a}" uses "${b}".`,
    });
  }

  for (const v of patternViolations(project)) {
    out.push({
      id: `pattern:${v.group}:${v.from.node}>${v.to.node}`, ...v, layer: "architecture", nodes: [v.from.node, v.to.node],
      explanation: `${v.rule}. In the "${v.group}" group, "${v.from.node}" (${v.from.role}) depends on "${v.to.node}" (${v.to.role}).`,
    } as Drift);
  }

  return out.sort((x, y) => ORDER.indexOf(x.type) - ORDER.indexOf(y.type) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

// The first message of a class about one difference: the difference is the topic, and it is information, not a verdict.
export function driftClassMessage(d: Drift): string {
  return `The person wants a class about a difference between their Contract and their code (${d.type}, on the ${d.layer} layer; Nodes: ${d.nodes.join(", ")}):
${d.explanation}
` +
    "This is information, never a block, and the code may be right while the Contract is out of date, or the other way round. Look at the Nodes and the code with the read tools, then teach it as a class: ask the person to predict why it happened before you explain, and let them decide what to do about it. Begin the first step.";
}
