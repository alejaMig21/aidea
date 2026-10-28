// A small layered layout for directed graphs: pure, deterministic, no dependency.
// Nodes are ordered by id (numbers inside ids count as numbers: n2 before n10), nothing is random, so the same input
// always gives the same output. Rows (ranks) come from the edge direction, a way back (loop edge) is routed around the
// body on a lane to the right, crossings are reduced by a few barycenter sweeps, and routes use only horizontal and
// vertical segments.
//
//   layered(nodes, edges, groups?) -> { rects, routes, groups }
//
// rects: one per input node, in input order. routes: one per input edge, in input order, with `points` (the polyline,
// first point on the source, last on the target) and `label` (where its text goes, baseline start) when the edge has
// one. groups: one box per group (one level), around its children. Edges that name a missing node are skipped.
import type { Rect } from "./layout.ts";

export type LayerNode = { id: string; width: number; height: number };
export type LayerEdge = { from: string; to: string; label?: string; back?: boolean };
export type LayerGroup = { id: string; children: string[] };
export type Point = { x: number; y: number };
export type Route = { from: string; to: string; points: Point[]; label?: { text: string; x: number; y: number } };

const GAP_X = 40; // between two nodes of a row
const GAP_DUMMY = 20; // between a long edge passing through a row and its neighbours
const MARGIN = 20; // between a group box and its children
const LANE = 24; // first lane of a way back, from the nodes it goes around
const LANE_STEP = 14; // between nested ways back
const SWEEPS = 4;

type Item = { id: string; real: boolean; w: number; h: number; rank: number; group?: string; x: number; y: number; pos: number; ups: Item[]; downs: Item[] };

const natural = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
// Math.min/max(...xs) pass every element as an argument, which fails on a very large array: these loop instead.
export const least = (xs: number[]) => xs.reduce((a, b) => (b < a ? b : a), Infinity);
export const most = (xs: number[], floor = -Infinity) => xs.reduce((a, b) => (b > a ? b : a), floor);

export function layered(nodes: LayerNode[], edges: LayerEdge[], groups: LayerGroup[] = []) {
  const known = new Map(nodes.map((n) => [n.id, n]));
  const ids = [...known.keys()].sort(natural);
  const all = edges.map((e, index) => ({ ...e, index })).filter((e) => known.has(e.from) && known.has(e.to));
  const groupOf = new Map(groups.flatMap((g) => g.children.map((c) => [c, g.id] as const)));

  // Ranks: longest path over the edges that are not ways back. An edge that would close a cycle becomes a way back.
  const incoming = new Map<string, string[]>();
  for (const e of all) if (!e.back) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from]);
  const rank = new Map<string, number>();
  const visiting = new Set<string>();
  // Depth-first with an explicit stack, so a chain of thousands of nodes cannot overflow the call stack.
  const rankOf = (start: string) => {
    if (rank.has(start)) return;
    const stack = [{ id: start, from: incoming.get(start) ?? [], next: 0, r: 0 }];
    visiting.add(start);
    while (stack.length) {
      const top = stack[stack.length - 1];
      let descended = false;
      while (top.next < top.from.length) {
        const from = top.from[top.next++];
        if (visiting.has(from)) continue; // closing a cycle: that edge is a way back
        if (rank.has(from)) { top.r = Math.max(top.r, rank.get(from)! + 1); continue; }
        visiting.add(from);
        stack.push({ id: from, from: incoming.get(from) ?? [], next: 0, r: 0 });
        descended = true;
        break;
      }
      if (descended) continue;
      stack.pop();
      visiting.delete(top.id);
      rank.set(top.id, top.r);
      const parent = stack[stack.length - 1];
      if (parent) parent.r = Math.max(parent.r, top.r + 1);
    }
  };
  ids.forEach(rankOf);
  const isBack = (e: (typeof all)[number]) => e.back || e.from === e.to || rank.get(e.to)! <= rank.get(e.from)!;

  // Items: the nodes, plus one slim dummy per row crossed by an edge that spans more than one row, so a long edge
  // takes a slot in each row it crosses and cannot run through a node.
  const items = new Map(ids.map((id) => {
    const n = known.get(id)!;
    return [id, { id, real: true, w: n.width, h: n.height, rank: rank.get(id)!, group: groupOf.get(id), x: 0, y: 0, pos: 0, ups: [], downs: [] } as Item] as const;
  }));
  const layers: Item[][] = [];
  for (const it of items.values()) (layers[it.rank] ??= []).push(it);
  for (let r = 0; r < layers.length; r++) layers[r] ??= [];
  const chains = new Map<number, Item[]>();
  for (const e of all.filter((e) => !isBack(e))) {
    const chain = [items.get(e.from)!];
    for (let r = rank.get(e.from)! + 1; r < rank.get(e.to)!; r++) {
      const dummy: Item = { id: `~${e.index}.${r}`, real: false, w: 0, h: 0, rank: r, x: 0, y: 0, pos: 0, ups: [], downs: [] };
      layers[r].push(dummy);
      chain.push(dummy);
    }
    chain.push(items.get(e.to)!);
    chain.slice(1).forEach((b, i) => { chain[i].downs.push(b); b.ups.push(chain[i]); });
    chains.set(e.index, chain);
  }

  // Order inside each row: ids first, then barycenter sweeps down and up; keep the best ordering seen.
  // A group's members stay side by side in their row so its box does not swallow other nodes of the row.
  const settle = (l: Item[]) => {
    const seen = new Set<string>();
    const out: Item[] = [];
    for (const it of l) {
      if (!it.group) out.push(it);
      else if (!seen.has(it.group)) { seen.add(it.group); out.push(...l.filter((o) => o.group === it.group)); }
    }
    out.forEach((it, k) => (it.pos = k));
    return out;
  };
  const reorder = (r: number, side: "ups" | "downs") => {
    const key = new Map(layers[r].map((it, k) => [it, it[side].length ? mean(it[side].map((n) => n.pos)) : k]));
    layers[r] = settle([...layers[r]].sort((a, b) => key.get(a)! - key.get(b)!));
  };
  const crossings = () => {
    let total = 0;
    for (const l of layers) {
      const links = l.flatMap((a) => a.downs.map((b) => [a.pos, b.pos]));
      for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) if ((links[i][0] - links[j][0]) * (links[i][1] - links[j][1]) < 0) total++;
    }
    return total;
  };
  layers.forEach((l, r) => (layers[r] = settle(l)));
  // ponytail: O(links^2) crossing count and 4 sweeps are plenty for a few hundred nodes; use a sorted-insertion count past a few thousand.
  let best = layers.map((l) => [...l]);
  let bestCrossings = crossings();
  for (let sweep = 0; sweep < SWEEPS && bestCrossings > 0; sweep++) {
    for (let r = 1; r < layers.length; r++) reorder(r, "ups");
    for (let r = layers.length - 2; r >= 0; r--) reorder(r, "downs");
    const c = crossings();
    if (c < bestCrossings) { bestCrossings = c; best = layers.map((l) => [...l]); }
  }
  best.forEach((l, r) => (layers[r] = settle(l)));

  // Columns: pack each row to the left, then pull every node towards the mean of its neighbours in alternating
  // sweeps, never closer than the gap. Straight chains stay in one column, a rejoin lands between its branches.
  // ponytail: not a full compaction (Brandes-Kopf); long rows can end up a little wider than needed.
  const sep = (a: Item, b: Item) =>
    (a.w + b.w) / 2 + (a.real && b.real ? GAP_X : GAP_DUMMY) + (a.group !== b.group && (a.group || b.group) ? 2 * MARGIN : 0);
  for (const l of layers) l.forEach((it, k) => (it.x = k ? l[k - 1].x + sep(l[k - 1], it) : it.w / 2));
  const pull = (r: number, side: "ups" | "downs") => {
    const l = layers[r];
    l.forEach((it, k) => {
      const wanted = it[side].length ? mean(it[side].map((n) => n.x)) : it.x;
      it.x = k ? Math.max(wanted, l[k - 1].x + sep(l[k - 1], it)) : wanted;
    });
  };
  for (let pass = 0; pass < 3; pass++) {
    for (let r = 1; r < layers.length; r++) pull(r, "ups");
    for (let r = layers.length - 2; r >= 0; r--) pull(r, "downs");
  }
  for (let r = 1; r < layers.length; r++) pull(r, "ups");
  // A group's box spans every row of its members, so it can reach over a node of another row that sits beside it:
  // push such a node (and the rest of its row on that side) clear of the box.
  // ponytail: one pass per group, in order; crowded diagrams with several overlapping groups may still need a second look.
  for (const g of groups) {
    for (let guard = 0; guard < 8; guard++) {
      const members = [...items.values()].filter((it) => it.group === g.id);
      if (!members.length) break;
      const x1 = least(members.map((m) => m.x - m.w / 2)) - MARGIN, x2 = most(members.map((m) => m.x + m.w / 2)) + MARGIN;
      const rows = members.map((m) => m.rank);
      const hit = layers.slice(least(rows), most(rows) + 1).flat().find((it) => it.group !== g.id && it.x + it.w / 2 > x1 && it.x - it.w / 2 < x2);
      if (!hit) break;
      const row = layers[hit.rank];
      const mine = row.find((o) => o.group === g.id);
      const right = mine ? hit.pos > mine.pos : hit.x >= (x1 + x2) / 2;
      const [from, to, d] = right ? [hit.pos, row.length, x2 - (hit.x - hit.w / 2)] : [0, hit.pos + 1, -(hit.x + hit.w / 2 - x1)];
      for (const o of row.slice(from, to)) o.x += d;
    }
  }
  const left = least([...items.values()].map((it) => it.x - it.w / 2)); // the leftmost node starts at x = 0
  for (const l of layers) for (const it of l) it.x -= left;

  // Rows: top-aligned; the gap between rows holds the elbows and the labels (wider when groups need their margins).
  const gapY = groups.length ? 2 * MARGIN + 24 : 40;
  const top: number[] = [];
  const bottom: number[] = [];
  layers.forEach((l, r) => {
    top[r] = r ? bottom[r - 1] + gapY : 0;
    bottom[r] = top[r] + most(l.map((it) => it.h), 0);
    for (const it of l) it.y = top[r];
  });
  const midGap = (r: number) => bottom[r] + gapY / 2; // y of the horizontal run between row r and row r + 1

  // Ports: an edge leaves the bottom of its source and enters the top of its target, spread along the side in the
  // order of the next column so edges of one node do not cross at the node.
  const spread = (chainSide: "out" | "in") => {
    const x = new Map<number, number>();
    const by = new Map<Item, { index: number; near: number }[]>();
    for (const [index, chain] of chains) {
      const node = chainSide === "out" ? chain[0] : chain[chain.length - 1];
      const near = chainSide === "out" ? chain[1] : chain[chain.length - 2];
      by.set(node, [...(by.get(node) ?? []), { index, near: near.x }]);
    }
    for (const [node, list] of by) {
      list.sort((a, b) => a.near - b.near || a.index - b.index);
      list.forEach((p, k) => x.set(p.index, node.x - node.w / 2 + (node.w * (k + 1)) / (list.length + 1)));
    }
    return x;
  };
  const out = spread("out");
  const into = spread("in");

  const routes = new Map<number, Route>();
  for (const [index, chain] of chains) {
    const e = edges[index];
    const first = chain[0];
    let cur: Point = { x: out.get(index)!, y: first.y + first.h };
    const points: Point[] = [cur];
    chain.slice(1).forEach((b, i) => {
      const a = chain[i];
      const bx = b.real ? into.get(index)! : b.x;
      if (cur.x !== bx) points.push({ x: cur.x, y: midGap(a.rank) }, { x: bx, y: midGap(a.rank) });
      points.push({ x: bx, y: b.y });
      if (!b.real) points.push({ x: bx, y: bottom[b.rank] });
      cur = points[points.length - 1];
    });
    routes.set(index, { from: e.from, to: e.to, points: straighten(points), ...(e.label ? { label: { text: e.label, x: points[0].x + 6, y: points[0].y + 14 } } : {}) });
  }

  // Ways back: out of the right side of the source (or from below it when a node sits to its right), up a lane to
  // the right of everything in the rows it spans, into the right side of the target (or from above it). Inner loops
  // take the inner lanes. Several ways into one target enter a little apart.
  const rightOf = (it: Item) => it.x + it.w / 2;
  const hasNodeToRight = (it: Item) => layers[it.rank].some((o) => o.real && o.x > it.x);
  const backs = all.filter(isBack).sort((a, b) => {
    const span = (e: typeof a) => Math.abs(rank.get(e.from)! - rank.get(e.to)!);
    return span(a) - span(b) || natural(a.from, b.from) || natural(a.to, b.to) || a.index - b.index;
  });
  const lanes: { lo: number; hi: number; x: number }[] = [];
  const entered = new Map<string, number>();
  const enters = (to: string) => backs.filter((e) => e.to === to && e.from !== e.to).length;
  for (const e of backs) {
    const f = items.get(e.from)!, t = items.get(e.to)!;
    const sy = f.y + f.h / 2;
    if (e.from === e.to) {
      const r = rightOf(f);
      const points = [{ x: r, y: sy - 8 }, { x: r + LANE, y: sy - 8 }, { x: r + LANE, y: sy + 8 }, { x: r, y: sy + 8 }];
      routes.set(e.index, { from: e.from, to: e.to, points, ...(e.label ? { label: { text: e.label, x: r + LANE + 6, y: sy } } : {}) });
      continue;
    }
    const [lo, hi] = [Math.min(f.rank, t.rank), Math.max(f.rank, t.rank)];
    const k = entered.get(e.to) ?? 0;
    entered.set(e.to, k + 1);
    const ty = t.y + t.h / 2 + (k - (enters(e.to) - 1) / 2) * 8;
    const near = lanes.filter((l) => l.lo <= hi && lo <= l.hi).map((l) => l.x + LANE_STEP);
    const lane = Math.max(LANE + most(layers.slice(lo, hi + 1).flat().map(rightOf)), most(near));
    lanes.push({ lo, hi, x: lane });
    const points: Point[] = [];
    const below = f.x - f.w / 2 + f.w * 0.85, above = t.x - t.w / 2 + t.w * 0.85;
    if (!hasNodeToRight(f)) points.push({ x: rightOf(f), y: sy }, { x: lane, y: sy });
    else points.push({ x: below, y: f.y + f.h }, { x: below, y: midGap(f.rank) }, { x: lane, y: midGap(f.rank) });
    if (!hasNodeToRight(t)) points.push({ x: lane, y: ty }, { x: rightOf(t), y: ty });
    else points.push({ x: lane, y: t.y - gapY / 2 }, { x: above, y: t.y - gapY / 2 }, { x: above, y: t.y });
    const onLane = points.filter((p) => p.x === lane);
    routes.set(e.index, { from: e.from, to: e.to, points: straighten(points), ...(e.label ? { label: { text: e.label, x: lane + 6, y: (onLane[0].y + onLane[onLane.length - 1].y) / 2 } } : {}) });
  }

  const rects: Rect[] = nodes.map((n) => {
    const it = items.get(n.id)!;
    return { id: n.id, x: it.x - it.w / 2, y: it.y, width: it.w, height: it.h };
  });
  const boxes: Rect[] = [];
  for (const g of groups) {
    const inside = rects.filter((r) => g.children.includes(r.id));
    if (!inside.length) continue;
    const x = least(inside.map((r) => r.x)) - MARGIN, y = least(inside.map((r) => r.y)) - MARGIN;
    boxes.push({ id: g.id, x, y, width: most(inside.map((r) => r.x + r.width)) + MARGIN - x, height: most(inside.map((r) => r.y + r.height)) + MARGIN - y });
  }
  return { rects, routes: all.map((e) => routes.get(e.index)!), groups: boxes };
}

// Drops repeated points and the middle point of three in a line.
function straighten(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && prev.x === p.x && prev.y === p.y) continue;
    const before = out[out.length - 2];
    if (before && prev && ((before.x === prev.x && prev.x === p.x) || (before.y === prev.y && prev.y === p.y))) out.pop();
    out.push(p);
  }
  return out;
}
