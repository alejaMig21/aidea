// Components layer as a UML-style diagram: each module is a package (a box with a tab) standing in its own column;
// inside it, class boxes with three compartments (name; attributes; methods) and small function boxes are stacked.
// Rectangles depend only on the Nodes, never on the relationships, so they stay put when relationships change.
// Relationships get orthogonal routes through the gaps between the columns; the ones with no Project target
// (an outside base class, an unresolved call) are short stubs out of their source. Pure and deterministic.
import type { CoreNode, Relationship, Resolution } from "./types.ts";
import type { Rect } from "./layout.ts";
import type { Point } from "./layered.ts";

const PAD = 14; // package border to the boxes inside
const HEAD = 34; // package header, the tab sits in it
const NAME_H = 30, ROW = 22, SECTION_PAD = 8, EMPTY = 14, FUNCTION_H = 30, BOX_GAP = 16;
const GAP = 220; // between two packages: stubs and their labels first, then the channels of the routes
const STUB = 30, CHANNELS_FROM = 120, CHANNELS_WIDTH = 80, LANE_TOP = -30;
const MIN_W = 220, MAX_W = 380, CHAR = 7.4;

export type ComponentsRoute = {
  kind: Relationship["kind"];
  resolution: Resolution;
  from: string; // box id (package, class or function) the route leaves
  to: string | null; // box id it ends at; null for a stub
  name: string;
  count: number; // relationships merged into this route (several methods of one class calling the same class)
  ends: string[]; // every Node id involved, for lighting the route when any of them is hovered
  external?: true;
  points: Point[];
  label?: { text: string; x: number; y: number };
};
export type ComponentsLayout = {
  rects: Rect[];
  compartments: Record<string, { attributes: number; methods: number }>; // y of the top of each compartment of a class box
  routes: ComponentsRoute[];
};

const short = (name: string) => name.split(".").pop() ?? name;

export function layoutComponentsDiagram(nodes: CoreNode[], relationships: Relationship[] = []): ComponentsLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rects: Rect[] = [];
  const compartments: ComponentsLayout["compartments"] = {};
  const at = new Map<string, Rect>();
  const put = (r: Rect) => { if (!at.has(r.id)) { at.set(r.id, r); rects.push(r); } };
  const moduleOf = (n: CoreNode): string | undefined => {
    for (let at: CoreNode | undefined = n, i = 0; at && i < 64; at = at.parent ? byId.get(at.parent) : undefined, i++) if (at.kind === "module") return at.id;
    return undefined;
  };
  const columns: { id: string; x: number; width: number }[] = [];
  const boxOfNode = new Map<string, string>(); // Node id -> the box that draws it

  let x = 0;
  for (const module of nodes.filter((n) => n.kind === "module")) {
    // Boxes in source order: every class (nested ones too) and every function directly in the module.
    const boxes = nodes.filter((n) => moduleOf(n) === module.id && (n.kind === "class" || (n.kind === "function" && n.parent === module.id)));
    const membersOf = (c: CoreNode) => nodes.filter((n) => n.parent === c.id && n.kind === "function");
    const textWidth = (c: CoreNode) => Math.max(
      short(c.name).length * CHAR + 24,
      ...(c.attributes ?? []).map((a) => (a.name.length + 3) * CHAR + 20),
      ...membersOf(c).map((m) => (short(m.name).length + 5) * CHAR + 20),
    );
    const inner = Math.min(MAX_W, Math.max(MIN_W, short(module.name).length * CHAR + 56, ...boxes.map((b) => (b.kind === "class" ? textWidth(b) : (short(b.name).length + 3) * CHAR + 24))));
    const width = inner + 2 * PAD;
    let y = HEAD + PAD;
    for (const box of boxes) {
      boxOfNode.set(box.id, box.id);
      if (box.kind === "function") {
        put({ id: box.id, x: x + PAD, y, width: inner, height: FUNCTION_H });
        y += FUNCTION_H + BOX_GAP;
        continue;
      }
      const attributes = box.attributes ?? [], methods = membersOf(box);
      const attributesH = attributes.length ? attributes.length * ROW + SECTION_PAD : EMPTY;
      const methodsH = methods.length ? methods.length * ROW + SECTION_PAD : EMPTY;
      const height = NAME_H + attributesH + methodsH;
      put({ id: box.id, x: x + PAD, y, width: inner, height });
      compartments[box.id] = { attributes: y + NAME_H, methods: y + NAME_H + attributesH };
      attributes.forEach((a, i) => put({ id: `${box.id}#${a.name}`, x: x + PAD, y: y + NAME_H + SECTION_PAD / 2 + i * ROW, width: inner, height: ROW }));
      methods.forEach((m, i) => {
        boxOfNode.set(m.id, box.id);
        put({ id: m.id, x: x + PAD, y: y + NAME_H + attributesH + SECTION_PAD / 2 + i * ROW, width: inner, height: ROW });
      });
      y += height + BOX_GAP;
    }
    const height = Math.max(HEAD + 2 * PAD, y - BOX_GAP + PAD);
    boxOfNode.set(module.id, module.id);
    rects.push({ id: module.id, x, y: 0, width, height });
    at.set(module.id, rects.at(-1)!);
    columns.push({ id: module.id, x, width });
    x += width + GAP;
  }
  // Packages come first in the list, so a viewer drawing in order paints them under their boxes.
  rects.sort((a, b) => Number(!columns.some((c) => c.id === a.id)) - Number(!columns.some((c) => c.id === b.id)));

  return { rects, compartments, routes: routesFor(relationships, byId, at, boxOfNode, columns, moduleOf) };
}

// The weakest resolution wins when several relationships merge: a route never claims more than its least certain part.
const WEAKEST: Resolution[] = ["resolved", "inferred", "unresolved"];

function routesFor(
  relationships: Relationship[], byId: Map<string, CoreNode>, at: Map<string, Rect>, boxOfNode: Map<string, string>,
  columns: { id: string; x: number; width: number }[], moduleOf: (n: CoreNode) => string | undefined,
): ComponentsRoute[] {
  const column = new Map(columns.map((c, i) => [c.id, i]));
  const columnOf = (box: string) => column.get(moduleOf(byId.get(box)!)!)!;
  const routes: ComponentsRoute[] = [];

  // Merge relationships that join the same two boxes in the same way.
  const merged = new Map<string, ComponentsRoute>();
  const stubs = new Map<string, ComponentsRoute>();
  for (const rel of relationships) {
    const from = boxOfNode.get(rel.from);
    if (!from) continue;
    if (rel.to === null) {
      const key = `${rel.kind}|${rel.from}|${rel.name}|${rel.resolution}`;
      const mine = stubs.get(key);
      if (mine) mine.count++;
      else stubs.set(key, { kind: rel.kind, resolution: rel.resolution, from, to: null, name: rel.name, count: 1, ends: [from, rel.from], ...(rel.external ? { external: true as const } : {}), points: [] });
      continue;
    }
    const to = boxOfNode.get(rel.to);
    if (!to || to === from) continue;
    const target = byId.get(to)!, source = byId.get(from)!;
    if (source.kind === "module" && moduleOf(target) === from) continue; // top-level code calling into its own module
    const key = `${rel.kind}|${from}|${to}`;
    const mine = merged.get(key);
    if (mine) {
      mine.count++;
      mine.ends = [...new Set([...mine.ends, rel.from, rel.to])];
      if (WEAKEST.indexOf(rel.resolution) > WEAKEST.indexOf(mine.resolution)) mine.resolution = rel.resolution;
    } else merged.set(key, { kind: rel.kind, resolution: rel.resolution, from, to, name: rel.name, count: 1, ends: [...new Set([from, to, rel.from, rel.to])], points: [] });
  }

  // Each route leaves a side of its source and enters a side of its target; several on one side spread along it.
  type Plan = { route: ComponentsRoute; leave: "left" | "right"; enter: "left" | "right"; gapA: number; gapB: number };
  const plans: Plan[] = [...merged.values()].map((route) => {
    const a = columnOf(route.from), b = columnOf(route.to!);
    // Same column: both sides on the right, in the gap after it. Otherwise face each other across the gaps between.
    if (a === b) return { route, leave: "right", enter: "right", gapA: a, gapB: a };
    return a < b ? { route, leave: "right", enter: "left", gapA: a, gapB: b - 1 } : { route, leave: "left", enter: "right", gapA: a - 1, gapB: b };
  });
  const sides = new Map<string, number>();
  const sideCount = (box: string, side: string) => sides.get(`${box}|${side}`) ?? 0;
  for (const p of plans) {
    sides.set(`${p.route.from}|${p.leave}`, sideCount(p.route.from, p.leave) + 1);
    sides.set(`${p.route.to}|${p.enter}`, sideCount(p.route.to!, p.enter) + 1);
  }
  const used = new Map<string, number>();
  const spot = (box: string, side: string) => {
    const r = at.get(box)!, n = sideCount(box, side), k = used.get(`${box}|${side}`) ?? 0;
    used.set(`${box}|${side}`, k + 1);
    return { x: side === "right" ? r.x + r.width : r.x, y: r.y + ((k + 1) * r.height) / (n + 1) };
  };
  // Channels: vertical runs in the room of a gap right of its stubs; lanes above every package for long hops.
  const channels = new Map<number, number>();
  for (const p of plans) {
    channels.set(p.gapA, (channels.get(p.gapA) ?? 0) + 1);
    if (p.gapB !== p.gapA) channels.set(p.gapB, (channels.get(p.gapB) ?? 0) + 1);
  }
  const taken = new Map<number, number>();
  const channel = (gap: number) => {
    const n = channels.get(gap)!, k = taken.get(gap) ?? 0;
    taken.set(gap, k + 1);
    const c = columns[gap];
    return c.x + c.width + CHANNELS_FROM + (n > 1 ? Math.min(10, CHANNELS_WIDTH / (n - 1)) * k : 0);
  };
  let lanes = 0;
  for (const p of plans) {
    const start = spot(p.route.from, p.leave), end = spot(p.route.to!, p.enter);
    const cA = channel(p.gapA);
    if (p.gapA === p.gapB) p.route.points = [start, { x: cA, y: start.y }, { x: cA, y: end.y }, end];
    else {
      const cB = channel(p.gapB), lane = LANE_TOP - 10 * lanes++;
      p.route.points = [start, { x: cA, y: start.y }, { x: cA, y: lane }, { x: cB, y: lane }, { x: cB, y: end.y }, end];
    }
    if (p.route.kind === "imports") {
      // The word sits on the longest horizontal run.
      const runs = p.route.points.slice(1).map((b, i) => [p.route.points[i], b] as const).filter(([a, b]) => a.y === b.y);
      const [a, b] = runs.reduce((best, run) => (Math.abs(run[1].x - run[0].x) > Math.abs(best[1].x - best[0].x) ? run : best));
      p.route.label = { text: "import", x: (a.x + b.x) / 2 - 18, y: a.y - 5 };
    }
    routes.push(p.route);
  }

  // Stubs leave the right side of their box, stacked from the top, and end past the package border.
  const stacked = new Map<string, number>();
  for (const stub of stubs.values()) {
    const r = at.get(stub.from)!, k = stacked.get(stub.from) ?? 0;
    stacked.set(stub.from, k + 1);
    const y = Math.min(r.y + r.height - 6, r.y + 10 + 14 * k);
    const pkg = at.get(moduleOf(byId.get(stub.from)!)!)!;
    stub.points = [{ x: r.x + r.width, y }, { x: pkg.x + pkg.width + STUB, y }];
    stub.label = { text: stub.name, x: pkg.x + pkg.width + STUB + 6, y: y + 4 };
    routes.push(stub);
  }
  return routes;
}
