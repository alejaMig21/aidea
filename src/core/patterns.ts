// Pattern groups against the code: the groups declared in the Architecture file are compared with the Components analysis.
//
// Mapping: an Architecture Node stands for the Python modules named by its `traces` (a trace to a class or a function
// stands for the module that holds it). A Node without traces to code has no modules, so nothing is reported for it.
// Evidence: the `imports` and `calls` relationships of the analysis, each taken to the modules at both ends.
// A relationship with no target (unresolved) cannot be placed on a Node, so it is never reported.
import { loadAuthored, PATTERN_ROLES } from "./authored.ts";
import type { CoreNode, Project, Resolution } from "./types.ts";

type Role = { node: string; role: string };
export type PatternViolation = {
  type: "pattern";
  group: string;
  kind: string;
  from: Role;
  to: Role;
  rule: string;
  certainty: "certain" | "possible"; // certain only when some evidence is resolved; an edge matched by name is possible
  evidence: { kind: "imports" | "calls"; from: string; to: string; name: string; resolution: Resolution; line: number }[];
};

// May a module playing `from` depend on one playing `to`? Hexagonal: the domain depends on neither adapters nor infrastructure.
// Layered: only downwards (roles are listed top to bottom), so a lower layer may not depend on an upper one.
const broken: Record<string, (from: string, to: string) => string | null> = {
  hexagonal: (from, to) => (from === "domain" && (to === "adapter" || to === "infrastructure") ? `A domain Node may not depend on ${to === "adapter" ? "an adapter" : "an infrastructure"} Node` : null),
  layered: (from, to) => (PATTERN_ROLES.layered.indexOf(from) > PATTERN_ROLES.layered.indexOf(to) ? `A ${from} Node may not depend on a ${to} Node (a lower layer on an upper one)` : null),
};

export function patternViolations(project: Project): PatternViolation[] {
  const architecture = loadAuthored(project.path).layers.architecture;
  if (!architecture.patterns?.length) return [];
  const byId = new Map<string, CoreNode>(project.nodes.map((n) => [n.id, n]));
  const moduleOf = (id: string | null) => {
    let at = id === null ? undefined : byId.get(id);
    while (at && at.kind !== "module") at = at.parent === null ? undefined : byId.get(at.parent);
    return at?.id;
  };
  const nodesOfModule = new Map<string, string[]>();
  for (const n of architecture.nodes) {
    for (const t of (n.traces as string[] | undefined) ?? []) {
      const m = moduleOf(t);
      if (m !== undefined && !nodesOfModule.get(m)?.includes(n.id)) nodesOfModule.set(m, [...(nodesOfModule.get(m) ?? []), n.id]);
    }
  }

  const out: PatternViolation[] = [];
  for (const group of architecture.patterns) {
    const kind = group.kind as string;
    const roleOf = new Map<string, string>();
    for (const r of group.roles as Role[]) if (!roleOf.has(r.node)) roleOf.set(r.node, r.role);
    const found = new Map<string, PatternViolation>();
    for (const rel of project.relationships) {
      if (rel.kind === "inherits") continue;
      const [fromModule, toModule] = [moduleOf(rel.from), moduleOf(rel.to)];
      if (fromModule === undefined || toModule === undefined || fromModule === toModule) continue;
      for (const a of nodesOfModule.get(fromModule) ?? []) {
        for (const b of nodesOfModule.get(toModule) ?? []) {
          const [ra, rb] = [roleOf.get(a), roleOf.get(b)];
          const rule = a !== b && ra && rb ? broken[kind](ra, rb) : null;
          if (!rule) continue;
          const key = `${a}>${b}`;
          const v = found.get(key) ?? { type: "pattern" as const, group: group.id as string, kind, from: { node: a, role: ra! }, to: { node: b, role: rb! }, rule, certainty: "possible" as const, evidence: [] };
          v.evidence.push({ kind: rel.kind, from: rel.from, to: rel.to!, name: rel.name, resolution: rel.resolution, line: rel.line });
          if (rel.resolution === "resolved") v.certainty = "certain";
          found.set(key, v);
        }
      }
    }
    out.push(...found.values());
  }
  return out;
}
