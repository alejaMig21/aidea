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
// One row of the "Imports" box of a module's detail: an imported module (target is its id; opens it), a folder heading (group),
// or an import that cannot be followed (target null, with the reason in `why`). `id` is the rectangle of the row.
export type ImportRow = { id: string; label: string; target: string | null; group?: true; resolution: Resolution; why?: string };
export type ImportsBlock = { box: string; rows: ImportRow[] };
export type ComponentsLayout = {
  rects: Rect[];
  compartments: Record<string, { attributes: number; methods: number }>; // y of the top of each compartment of a class box
  routes: ComponentsRoute[];
  imports?: Record<string, ImportsBlock>; // per module id, only in the detail of one module of a big project
};

const short = (name: string) => name.split(".").pop() ?? name;
const IMPORT_GROUP_ABOVE = 8, IMPORTS_MAX_W = 560;

export type ImportLine = { label: string; target: string | null; folder: string; resolution: Resolution; why?: string };

export function layoutComponentsDiagram(nodes: CoreNode[], relationships: Relationship[] = [], importLines: Record<string, ImportLine[]> = {}): ComponentsLayout {
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
  const importsOf: Record<string, ImportsBlock> = {};

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
    // The "Imports" box comes first in the package: a heading and one row per imported module (a folder heading each when there are many).
    const lines = importLines[module.id] ?? [];
    const rows: { line?: ImportLine; label: string }[] = [];
    if (lines.length > IMPORT_GROUP_ABOVE) {
      for (const folder of [...new Set(lines.map((l) => l.folder))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
        rows.push({ label: folder || "cannot be followed" }, ...lines.filter((l) => l.folder === folder).map((line) => ({ line, label: line.label })));
      }
    } else rows.push(...lines.map((line) => ({ line, label: line.label })));
    const importsW = Math.min(IMPORTS_MAX_W, Math.max(0, ...rows.map((r) => r.label.length * CHAR + 44)));
    const innerW = Math.max(inner, importsW);
    const width = innerW + 2 * PAD;
    let y = HEAD + PAD;
    if (rows.length) {
      const id = `${module.id}#imports`, height = NAME_H + rows.length * ROW + SECTION_PAD;
      put({ id, x: x + PAD, y, width: innerW, height });
      const block: ImportsBlock = { box: id, rows: [] };
      rows.forEach((r, i) => {
        const rowId = `${module.id}#import:${i}`;
        put({ id: rowId, x: x + PAD, y: y + NAME_H + SECTION_PAD / 2 + i * ROW, width: innerW, height: ROW });
        block.rows.push(r.line ? { id: rowId, label: r.label, target: r.line.target, resolution: r.line.resolution, ...(r.line.why ? { why: r.line.why } : {}) } : { id: rowId, label: r.label, target: null, group: true, resolution: "resolved" });
      });
      importsOf[module.id] = block;
      y += height + BOX_GAP;
    }
    for (const box of boxes) {
      boxOfNode.set(box.id, box.id);
      if (box.kind === "function") {
        put({ id: box.id, x: x + PAD, y, width: innerW, height: FUNCTION_H });
        y += FUNCTION_H + BOX_GAP;
        continue;
      }
      const attributes = box.attributes ?? [], methods = membersOf(box);
      const attributesH = attributes.length ? attributes.length * ROW + SECTION_PAD : EMPTY;
      const methodsH = methods.length ? methods.length * ROW + SECTION_PAD : EMPTY;
      const height = NAME_H + attributesH + methodsH;
      put({ id: box.id, x: x + PAD, y, width: innerW, height });
      compartments[box.id] = { attributes: y + NAME_H, methods: y + NAME_H + attributesH };
      attributes.forEach((a, i) => put({ id: `${box.id}#${a.name}`, x: x + PAD, y: y + NAME_H + SECTION_PAD / 2 + i * ROW, width: innerW, height: ROW }));
      methods.forEach((m, i) => {
        boxOfNode.set(m.id, box.id);
        put({ id: m.id, x: x + PAD, y: y + NAME_H + attributesH + SECTION_PAD / 2 + i * ROW, width: innerW, height: ROW });
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

  return { rects, compartments, routes: routesFor(relationships, byId, at, boxOfNode, columns, moduleOf), ...(Object.keys(importsOf).length ? { imports: importsOf } : {}) };
}

// ---- Overview: a project with more than OVERVIEW_ABOVE modules is too big to draw box by box (Telegram: 6,000 boxes in a strip
// 40,000 px wide). Each module becomes one compact box, boxes are grouped in a block per folder, and blocks wrap into rows.
// Relationships are merged to one line per ordered pair of modules and only the strongest MAX_PAIRS are kept.
export const OVERVIEW_ABOVE = 40;
const MAX_PAIRS = 400;
const MOD_W = 200, MOD_H = 56, MOD_GAP = 12, BLOCK_PAD = 14, LABEL_H = 30, BLOCK_GAP = 24, LANE_COLS = 4, MIN_TARGET = 1800, ASPECT = 1.1;

export type ComponentsOverview = {
  rects: Rect[]; // a block per folder (id `folder:<path>`, "." for the project root) then a box per module
  counts: Record<string, { classes: number; functions: number }>; // per module id; functions include methods
  routes: ComponentsRoute[]; // module to module; points are [start, control, end] of a gentle quadratic curve
  pairs: { total: number; shown: number };
  // Only when the project has test or fixture folders: how many modules and folders they hold, how many pairs touch them, and whether they are drawn.
  // Closed (the default), they are one block `tests:folded` and have no boxes and no lines; open, they stand after the other folders.
  tests?: { modules: number; folders: number; pairs: number; open: boolean };
};

// The module each Node belongs to (a module is its own), for every Node at once.
export function moduleIndex(nodes: CoreNode[]): Map<string, string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const index = new Map<string, string>();
  for (const n of nodes) {
    let at: CoreNode | undefined = n;
    for (let i = 0; at && i < 64 && at.kind !== "module"; i++) at = at.parent ? byId.get(at.parent) : undefined;
    if (at?.kind === "module") index.set(n.id, at.id);
  }
  return index;
}

export const folderOf = (file: string) => file.split("/").slice(0, -1).join("/") || ".";
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0); // no locale: the same order on every machine
const TEST_NAMES = new Set(["test", "tests", "__tests__", "fixtures", "spec", "specs"]);
const isTestFolder = (dir: string) => dir.split("/").some((part) => TEST_NAMES.has(part.toLowerCase()));

export function layoutComponentsOverview(nodes: CoreNode[], relationships: Relationship[] = [], { openTests = false } = {}): ComponentsOverview {
  const moduleOf = moduleIndex(nodes);
  const modules = nodes.filter((n) => n.kind === "module");
  const counts: ComponentsOverview["counts"] = Object.fromEntries(modules.map((m) => [m.id, { classes: 0, functions: 0 }]));
  for (const n of nodes) {
    const c = counts[moduleOf.get(n.id) ?? ""];
    if (c && n.kind === "class") c.classes++;
    else if (c && n.kind === "function") c.functions++;
  }

  const groups = new Map<string, CoreNode[]>();
  for (const m of modules) groups.set(folderOf(m.file), [...(groups.get(folderOf(m.file)) ?? []), m]);
  // The blocks stand in lanes of LANE_COLS modules across, each block going to the shortest lane (in path order), so the whole
  // project is about as wide as a screen and fills it (a strip, or rows with holes, would shrink to nothing under Fit).
  // The lanes make the width: MIN_TARGET at least, more as the project grows so that it keeps a screen's shape.
  // Test and fixture folders are drawn last, or, closed (the default), as one block that says how many modules it holds.
  const testDirs = [...groups.keys()].filter(isTestFolder).sort(byText);
  const testIds = new Set(testDirs.flatMap((d) => groups.get(d)!.map((m) => m.id)));
  const hidden = openTests ? new Set<string>() : testIds;
  const drawn = [...[...groups.keys()].filter((d) => !isTestFolder(d)).sort(byText), ...(openTests ? testDirs : [])];
  const laneW = 2 * BLOCK_PAD + LANE_COLS * MOD_W + (LANE_COLS - 1) * MOD_GAP;
  const target = Math.max(MIN_TARGET, Math.sqrt((modules.length - hidden.size) * (MOD_W + MOD_GAP) * (MOD_H + MOD_GAP) * 1.7 * ASPECT)); // 1.7: blocks leave holes, measured on two real projects
  const lanes = Array.from({ length: Math.max(1, Math.round(target / (laneW + BLOCK_GAP))) }, () => 0); // height used so far in each lane

  const folders: Rect[] = [], boxes: Rect[] = [];
  for (const dir of drawn) {
    const members = groups.get(dir)!.sort((a, b) => byText(a.name, b.name));
    // A big folder is wider (up to the whole width) so that it does not stand taller than everything else; it takes `span` lanes side by side.
    const cols = Math.min(LANE_COLS * lanes.length, members.length, Math.ceil(Math.sqrt(members.length * 2)));
    const rows = Math.ceil(members.length / cols), span = Math.ceil(cols / LANE_COLS);
    const width = 2 * BLOCK_PAD + cols * MOD_W + (cols - 1) * MOD_GAP;
    const height = LABEL_H + BLOCK_PAD + rows * MOD_H + (rows - 1) * MOD_GAP;
    let lane = 0, y = Infinity;
    for (let i = 0; i + span <= lanes.length; i++) {
      const top = Math.max(...lanes.slice(i, i + span));
      if (top < y) { y = top; lane = i; }
    }
    const x = lane * (laneW + BLOCK_GAP);
    lanes.fill(y + height + BLOCK_GAP, lane, lane + span);
    folders.push({ id: `folder:${dir}`, x, y, width, height });
    members.forEach((m, i) => boxes.push({
      id: m.id, x: x + BLOCK_PAD + (i % cols) * (MOD_W + MOD_GAP), y: y + LABEL_H + Math.floor(i / cols) * (MOD_H + MOD_GAP), width: MOD_W, height: MOD_H,
    }));
  }
  if (testDirs.length && !openTests) { // the closed block: one lane wide, in the shortest lane
    const y = Math.min(...lanes), lane = lanes.indexOf(y);
    folders.push({ id: "tests:folded", x: lane * (laneW + BLOCK_GAP), y, width: laneW, height: LABEL_H + BLOCK_PAD + MOD_H });
  }
  const rects = [...folders, ...boxes];
  const at = new Map(boxes.map((r) => [r.id, r]));
  const nameOf = new Map(modules.map((m) => [m.id, short(m.name)]));

  // One entry per ordered pair of modules: the strongest kind, the number of relationships and the weakest resolution among them.
  const KINDS: Relationship["kind"][] = ["calls", "inherits", "imports"];
  const pairs = new Map<string, { from: string; to: string; kinds: Set<string>; count: number; resolution: Resolution }>();
  const touchingTests = new Set<string>(); // pairs with a test module at either end, drawn or not
  for (const rel of relationships) {
    const from = moduleOf.get(rel.from), to = rel.to ? moduleOf.get(rel.to) : undefined;
    if (!from || !to || from === to) continue;
    const key = `${from}\n${to}`;
    if (testIds.has(from) || testIds.has(to)) touchingTests.add(key);
    if (hidden.has(from) || hidden.has(to)) continue;
    if (!at.has(from) || !at.has(to)) continue;
    const mine = pairs.get(key);
    if (!mine) { pairs.set(key, { from, to, kinds: new Set([rel.kind]), count: 1, resolution: rel.resolution }); continue; }
    mine.kinds.add(rel.kind);
    mine.count++;
    if (WEAKEST.indexOf(rel.resolution) > WEAKEST.indexOf(mine.resolution)) mine.resolution = rel.resolution;
  }
  const strongest = [...pairs.values()].sort((a, b) => b.count - a.count || byText(a.from, b.from) || byText(a.to, b.to)).slice(0, MAX_PAIRS);
  const round = (n: number) => Math.round(n * 10) / 10;
  const routes: ComponentsRoute[] = strongest.map((p) => {
    const a = at.get(p.from)!, b = at.get(p.to)!;
    const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 }, bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const dx = bc.x - ac.x, dy = bc.y - ac.y, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(60, len * 0.12); // A to B and B to A bend to opposite sides, so a pair never hides behind its reverse
    const ctrl = { x: (ac.x + bc.x) / 2 - (dy / len) * bend, y: (ac.y + bc.y) / 2 + (dx / len) * bend };
    const onEdge = (r: Rect, from: Point, toward: Point) => { // where the line from the centre towards `toward` leaves the box
      const ux = toward.x - from.x, uy = toward.y - from.y;
      const t = Math.min(ux ? r.width / 2 / Math.abs(ux) : Infinity, uy ? r.height / 2 / Math.abs(uy) : Infinity);
      return { x: round(from.x + ux * t), y: round(from.y + uy * t) };
    };
    return {
      kind: KINDS.find((k) => p.kinds.has(k))!, resolution: p.resolution, from: p.from, to: p.to,
      name: `${nameOf.get(p.from)} → ${nameOf.get(p.to)}`, count: p.count, ends: [p.from, p.to],
      points: [onEdge(a, ac, ctrl), { x: round(ctrl.x), y: round(ctrl.y) }, onEdge(b, bc, ctrl)],
    };
  });
  const tests = testDirs.length ? { tests: { modules: testDirs.reduce((n, d) => n + groups.get(d)!.length, 0), folders: testDirs.length, pairs: touchingTests.size, open: openTests } } : {};
  return { rects, counts, routes, pairs: { total: pairs.size, shown: routes.length }, ...tests };
}

// The detailed layout of one module: its classes, methods and functions. What leaves the module is a stub, a resolved
// relationship to another module labelled with that module's name (resolved ones only). Null when the id is not a module.
export function layoutModuleDetail(nodes: CoreNode[], relationships: Relationship[], moduleId: string): ComponentsLayout | null {
  const moduleOf = moduleIndex(nodes);
  if (moduleOf.get(moduleId) !== moduleId) return null;
  const mine = nodes.filter((n) => moduleOf.get(n.id) === moduleId);
  const ids = new Set(mine.map((n) => n.id));
  const modules = new Map(nodes.filter((n) => n.kind === "module").map((m) => [m.id, m]));
  const nameOf = new Map([...modules].map(([id, m]) => [id, short(m.name)]));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rels: Relationship[] = [];
  // Imports are a list on the module (an "Imports" box), not arrows into the air: one row per imported module, whatever the number of import statements.
  const lines = new Map<string, ImportLine>();
  for (const rel of relationships) {
    if (!ids.has(rel.from)) continue;
    if (rel.kind === "imports") {
      const target = rel.to ? moduleOf.get(rel.to) : undefined, m = target ? modules.get(target) : undefined;
      if (m && target !== moduleId) lines.set(target!, { label: m.name, target: target!, folder: folderOf(m.file), resolution: rel.resolution });
      else if (!m) { // one that cannot be followed (import(name) decided at run time): marked, with the reason
        const owner = byId.get(rel.from)!, where = owner.kind === "module" ? "the top of the module" : `${short(owner.name)}()`;
        lines.set(`?${rel.from}`, { label: `dynamic import in ${where}`, target: null, folder: "", resolution: "unresolved", why: "Unresolved: the module is decided at run time (a dynamic import), so aidea cannot say which one it is" });
      }
      continue;
    }
    if (rel.to === null || ids.has(rel.to)) rels.push(rel);
    // Only the certain ones: a call matched by name only can point at dozens of modules and would bury the module under stubs.
    else if (rel.resolution === "resolved") rels.push({ ...rel, to: null, name: nameOf.get(moduleOf.get(rel.to) ?? "") ?? rel.name });
  }
  const sorted = [...lines.values()].sort((a, b) => byText(a.label, b.label));
  return layoutComponentsDiagram(mine, rels, sorted.length ? { [moduleId]: sorted } : {});
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
      const cB = channel(p.gapB), lane = LANE_TOP - 16 * lanes++;
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
