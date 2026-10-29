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
      id: `broken-trace:${l.layer}:${l.from}>${l.to}`, type: "broken-trace", layer: l.layer, nodes: [l.from, l.to],
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
  const deps = new Map<string, { a: string; b: string; evidence: NonNullable<Drift["evidence"]>; certain: boolean }>();
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
        const k = JSON.stringify([a, b]);
        const dep = deps.get(k) ?? { a, b, evidence: [], certain: false };
        dep.evidence.push({ kind: rel.kind, from: rel.from, to: rel.to, name: rel.name, line: rel.line });
        if (rel.resolution === "resolved") dep.certain = true;
        deps.set(k, dep);
      }
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  // A Node and the Nodes it is inside, nearest first (a cycle in `parent` stops at the first repeat).
  const chain = (id: string) => {
    const seen: string[] = [];
    for (let at = byId.get(id); at && !seen.includes(at.id); at = byId.get(at.parent as string)) seen.push(at.id);
    return seen;
  };
  const relationsOf = (id: string) => {
    const r = byId.get(id)?.relations;
    return Array.isArray(r) ? (r.filter((x) => x && typeof x === "object" && typeof x.to === "string") as { to: string; label?: string }[]) : [];
  };
  // What a Node may depend on: what it and every Node it is inside declare, and anything inside or around it.
  const said = (a: string) => chain(a).some((x) => relationsOf(x).length);
  const allowed = (a: string, b: string) => {
    const [ca, cb] = [chain(a), chain(b)];
    return ca.includes(b) || cb.includes(a) || ca.some((x) => relationsOf(x).some((r) => cb.includes(r.to)));
  };
  const modulesOf = (id: string) => [...nodesOfModule].filter(([, ids]) => ids.includes(id)).map(([m]) => m);
  
  for (const a of nodes) {
    for (const rel of relationsOf(a.id)) { // a Node that declares no relations has said nothing about what it may depend on
      const b = rel.to;
      const [ma, mb] = [modulesOf(a.id), modulesOf(b)];
      // Nodes that stand for the same module cannot be told apart, so nothing can be said about a relation between them.
      if (!byId.has(b) || b === a.id || !ma.length || !mb.length || ma.some((m) => mb.includes(m)) || deps.has(JSON.stringify([a.id, b]))) continue;
      const possible = unresolvedFrom.has(a.id);
      out.push({
        id: `missing-relationship:${a.id}>${b}`, type: "missing-relationship", layer: "architecture", nodes: [a.id, b], certainty: possible ? "possible" : "certain",
        explanation: `The Architecture says "${a.id}" uses "${b}"${rel.label ? ` (${rel.label})` : ""}, but no code of "${a.id}" depends on code of "${b}".${possible ? " Some calls in this code could not be traced, so this may be a gap in the analysis." : ""}`,
      });
    }
  }
  for (const { a, b, evidence: found, certain } of deps.values()) {
    if (!said(a) || allowed(a, b)) continue;
    const evidence = found.sort((x, y) => (x.from < y.from ? -1 : x.from > y.from ? 1 : x.line - y.line));
    out.push({
      id: `undeclared-dependency:${a}>${b}`, type: "undeclared-dependency", layer: "architecture", nodes: [a, b], certainty: certain ? "certain" : "possible", evidence: evidence.slice(0, MAX_EVIDENCE),
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
