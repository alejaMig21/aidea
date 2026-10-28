// The Architecture layer drawn C4-style: a Node with children is a boundary around them, a leaf is a box sized to fit
// its name, `[kind: technology]` and wrapped description, and every relation is a one-way route with a label position.
// Positions come from the layered engine (pure, deterministic). `rects` has one entry per Node, in input order; a
// boundary's rect is its box. `texts` holds the strings the interface writes inside each box.
import { layered } from "./layered.ts";
import type { LayerEdge, Point, Route } from "./layered.ts";
import type { Rect } from "./layout.ts";

type Fields = Record<string, unknown>;
type Relation = { to: string; label: string; technology?: string };
export type ArchitectureText = { title: string; sub: string; lines: string[] };
export type ArchitectureDrawing = {
  rects: Rect[];
  groups: Rect[];
  routes: (Route & { technology?: string })[];
  texts: Record<string, ArchitectureText>;
};

const KIND_NAMES: Record<string, string> = { person: "Person", system: "Software System", container: "Container", component: "Component" };
const WRAP = 34; // characters per description line
const CHAR = 6.6; // monospace 11 px
const NAME_CHAR = 8.4; // 14 px semibold

function wrap(text: string): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= WRAP) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word.length > WRAP ? word.slice(0, WRAP - 1) + "…" : word);
  }
  return lines;
}

const sameStr = (v: unknown) => (typeof v === "string" ? v : "");

export function layoutArchitecture(all: Fields[]): ArchitectureDrawing {
  const taken = new Set<string>();
  const nodes = all.filter((n) => !taken.has(sameStr(n.id)) && taken.add(sameStr(n.id))); // a repeated id: the first Node wins
  const ids = new Set(nodes.map((n) => sameStr(n.id)));
  const parentOf = new Map(nodes.map((n) => [sameStr(n.id), ids.has(n.parent as string) ? (n.parent as string) : undefined]));
  const inLoop = (id: string) => {
    let at = parentOf.get(id);
    for (let i = 0; at !== undefined && i < nodes.length; i++, at = parentOf.get(at)) if (at === id) return true;
    return false;
  };
  for (const id of [...ids].filter(inLoop)) parentOf.set(id, undefined); // a loop of parents makes roots
  const hasKids = new Set([...parentOf.values()].filter((p): p is string => p !== undefined));
  const topId = new Map<string, string>();
  for (const id of ids) {
    let at = id;
    while (parentOf.get(at) !== undefined) at = parentOf.get(at)!; // loops were cut above, so this ends
    topId.set(id, at);
  }
  const top = (id: string) => topId.get(id) ?? id;
  // ponytail: one level of boundary. A Node nested deeper is drawn as a box inside its top-level ancestor's boundary.
  const isGroup = (id: string) => hasKids.has(id) && parentOf.get(id) === undefined;

  const texts: Record<string, ArchitectureText> = {};
  const sizes = new Map<string, { width: number; height: number }>();
  for (const n of nodes) {
    const id = sameStr(n.id), kind = sameStr(n.kind), tech = sameStr(n.technology);
    const group = isGroup(id);
    const external = n.external === true && !group;
    const kindName = external && kind === "system" ? "External System" : KIND_NAMES[kind];
    const title = sameStr(n.title);
    const sub = kind === "person" ? (external ? "[External Person]" : "[Person]") : kindName ? `[${kindName}: ${tech}]` : `[${tech}]`;
    const lines = wrap(sameStr(n.description));
    texts[id] = { title: group ? `${title} [${KIND_NAMES[kind] ?? "Boundary"}]` : title, sub: group ? "" : sub, lines: group ? [] : lines };
    if (group) continue;
    const width = Math.max(180, 40 + title.length * NAME_CHAR, 28 + sub.length * CHAR, 28 + Math.max(0, ...lines.map((l) => l.length)) * 6.2);
    sizes.set(id, { width: Math.ceil(width), height: 58 + lines.length * 15 + 12 + (kind === "person" ? 40 : 0) });
  }

  const leaves = nodes.map((n) => sameStr(n.id)).filter((id) => !isGroup(id));
  const groupIds = [...ids].filter(isGroup);
  const members = new Map<string, string[]>(); // boundary id -> its leaves, in input order
  for (const l of leaves) if (top(l) !== l) (members.get(top(l)) ?? members.set(top(l), []).get(top(l))!).push(l);
  const rep = (id: string) => (isGroup(id) ? members.get(id)?.[0] : id); // a boundary stands for its first member while routing
  const edges: (LayerEdge & { technology?: string; original: [string, string] })[] = [];
  for (const n of nodes) {
    for (const r of (n.relations as Relation[] | undefined) ?? []) {
      const from = rep(sameStr(n.id)), to = rep(r.to);
      if (from === undefined || to === undefined || from === to) continue;
      edges.push({ from, to, label: r.label, technology: r.technology, original: [sameStr(n.id), r.to] });
    }
  }
  const laid = layered(
    leaves.map((id) => ({ id, ...sizes.get(id)! })),
    edges,
    groupIds.map((g) => ({ id: g, children: members.get(g) ?? [] })),
  );

  const at = new Map<string, Rect>();
  for (const r of laid.rects) at.set(r.id, r);
  const boxes = laid.groups;
  for (const b of boxes) at.set(b.id, b);
  const rects = nodes.map((n) => at.get(sameStr(n.id))).filter((r): r is Rect => !!r);

  const routes = laid.routes.map((route, i) => {
    let points = route.points;
    const [from, to] = edges[i].original;
    if (isGroup(to)) points = clip(points, at.get(to)!, false);
    if (isGroup(from)) points = clip(points, at.get(from)!, true);
    return { from, to, points, ...(route.label ? { label: route.label } : {}), ...(edges[i].technology ? { technology: edges[i].technology } : {}) };
  });
  // Labels of edges that leave one box side by side start at nearly the same x: move each to the right of the ones placed before it.
  // ponytail: only slides sideways along the gap between rows; a very long row of siblings makes the labels spread wide.
  const placed: { x1: number; x2: number; y1: number; y2: number }[] = [];
  for (const r of routes) {
    if (!r.label) continue;
    const w = Math.max(r.label.text.length, r.technology ? r.technology.length + 2 : 0) * 6.2 + 4, y1 = r.label.y - 12, y2 = r.label.y + (r.technology ? 16 : 4);
    for (const p of placed) if (r.label.x < p.x2 + 6 && p.x1 < r.label.x + w && y1 < p.y2 && p.y1 < y2) r.label.x = p.x2 + 8;
    placed.push({ x1: r.label.x, x2: r.label.x + w, y1, y2 });
  }
  return { rects, groups: boxes, routes, texts };
}

// Cuts an orthogonal route where it enters (or, from the source side, leaves) a boundary box.
function clip(points: Point[], box: Rect, atStart: boolean): Point[] {
  const ordered = atStart ? [...points].reverse() : points;
  const inBox = (p: Point) => p.x > box.x && p.x < box.x + box.width && p.y > box.y && p.y < box.y + box.height;
  const out: Point[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const p = ordered[i];
    if (!inBox(p)) { out.push(p); continue; }
    const prev = ordered[i - 1];
    if (prev) {
      const edge: Point = prev.x === p.x
        ? { x: p.x, y: prev.y < p.y ? box.y : box.y + box.height }
        : { x: prev.x < p.x ? box.x : box.x + box.width, y: p.y };
      out.push(edge);
    }
    break;
  }
  return atStart ? out.reverse() : out;
}

// What a pending Proposal list does to the layer: updates replace their Node, adds append, removals drop.
export function architecturePreview(existing: Fields[], pending: { kind: string; nodeId: string; node?: Fields }[]) {
  const byId = new Map(pending.map((p) => [p.nodeId, p]));
  const kept = existing.filter((n) => byId.get(sameStr(n.id))?.kind !== "remove").map((n) => {
    const p = byId.get(sameStr(n.id));
    return p?.kind === "update" && p.node ? p.node : n;
  });
  return layoutArchitecture([...kept, ...pending.filter((p) => p.kind === "add" && p.node).map((p) => p.node!)]);
}
