// The core owns where every Node sits on its Layer, so it can also say where the camera should look.
// The interface only draws the rectangles it is given and applies the framings it is sent.
import { layered } from "./layered.ts";
import type { CoreNode } from "./types.ts";

export type Rect = { id: string; x: number; y: number; width: number; height: number };

const COLUMN = 280;
const ROW = 36;
const INDENT = 18;

// Components and data: one column per module, members stacked below it, indented by depth.
// A class lists its attributes first (as slim rows with the id `<class>#<name>`), then its methods.
export function layoutComponents(nodes: CoreNode[]): Rect[] {
  const rects: Rect[] = [];
  const childrenOf = (id: string) => nodes.filter((n) => n.parent === id);
  nodes.filter((n) => n.kind === "module").forEach((module, column) => {
    let row = 0;
    const place = (n: CoreNode, depth: number) => {
      const x = column * COLUMN + depth * INDENT;
      const width = 240 - depth * INDENT;
      rects.push({ id: n.id, x, y: row++ * ROW, width, height: 28 });
      for (const attribute of n.attributes ?? []) {
        rects.push({ id: `${n.id}#${attribute.name}`, x: x + INDENT, y: row++ * ROW, width: width - INDENT, height: 24 });
      }
      childrenOf(n.id).forEach((child) => place(child, depth + 1));
    };
    place(module, 0);
  });
  return rects;
}

// Authored layers: root cards in a grid, four to a row. A Node with a `parent` on the layer sits one row below it,
// siblings side by side and centred under it. A missing parent, or a parent chain that loops, makes a root.
// Each root takes the width of its whole subtree and each grid row the height of its deepest one, so nothing overlaps.
const CARD = 240;
const GAP = COLUMN - CARD;
const CHILD_ROW = 64 + 100;
export function layoutAuthored(nodes: { id: string; parent?: unknown }[]): Rect[] {
  const ids = new Set(nodes.map((n) => n.id));
  const parentOf = new Map(nodes.map((n) => [n.id, ids.has(n.parent as string) ? (n.parent as string) : undefined]));
  const inLoop = (id: string) => {
    let at = parentOf.get(id);
    for (let i = 0; at !== undefined && i < nodes.length; i++, at = parentOf.get(at)) if (at === id) return true;
    return false;
  };
  const kids = new Map<string, string[]>();
  const roots: string[] = [];
  for (const { id } of nodes) {
    const parent = parentOf.get(id);
    if (parent === undefined || inLoop(id)) roots.push(id);
    else kids.set(parent, [...(kids.get(parent) ?? []), id]);
  }
  const widthOf = (id: string): number => Math.max(CARD, (kids.get(id) ?? []).reduce((sum, k) => sum + widthOf(k) + GAP, -GAP));
  const depthOf = (id: string): number => Math.max(-1, ...(kids.get(id) ?? []).map(depthOf)) + 1;
  const at = new Map<string, Rect>();
  const place = (id: string, left: number, y: number) => {
    const width = widthOf(id);
    at.set(id, { id, x: left + (width - CARD) / 2, y, width: CARD, height: 64 });
    let x = left;
    for (const k of kids.get(id) ?? []) { place(k, x, y + CHILD_ROW); x += widthOf(k) + GAP; }
  };
  for (let row = 0, y = 0; row < roots.length; row += 4) {
    const inRow = roots.slice(row, row + 4);
    let x = 0;
    for (const id of inRow) { place(id, x, y); x += widthOf(id) + GAP; }
    y += Math.max(...inRow.map(depthOf)) * CHILD_ROW + 80;
  }
  return nodes.map((n) => at.get(n.id)!);
}

// Business layer: the nine blocks of the canvas in its canonical arrangement on a five-column grid
// (partners | activities over resources | value propositions | relationships over channels | segments),
// with cost structure (three columns) and revenue streams (two) across the bottom.
// Notes fill their block in the order given, one note per grid column the block spans (so 3 and 2 across in the wide bottom blocks);
// a block is as tall as its notes need, and the rows of the top part stretch to keep the three tall blocks level.
// Each area is [column, row, columns spanned, rows spanned].
const BLOCK_W = 240, BLOCK_GAP = 16, BLOCK_HEAD = 40, BLOCK_PAD = 12, NOTE_H = 44, NOTE_GAP = 8;
const BLOCK_AREAS: Record<string, [number, number, number, number]> = {
  "key partnerships": [0, 0, 1, 2], "key activities": [1, 0, 1, 1], "key resources": [1, 1, 1, 1],
  "value propositions": [2, 0, 1, 2], "customer relationships": [3, 0, 1, 1], channels: [3, 1, 1, 1],
  "customer segments": [4, 0, 1, 2], "cost structure": [0, 2, 3, 1], "revenue streams": [3, 2, 2, 1],
};
export function layoutBusiness(nodes: { id: string; block?: unknown }[]) {
  const names = Object.keys(BLOCK_AREAS);
  const widthOf = (span: number) => span * BLOCK_W + (span - 1) * BLOCK_GAP;
  const held = new Map(names.map((name) => [name, nodes.filter((n) => n.block === name)]));
  const need = (name: string) => {
    const rows = Math.ceil(held.get(name)!.length / BLOCK_AREAS[name][2]);
    return BLOCK_HEAD + Math.max(rows, 2) * (NOTE_H + NOTE_GAP) + BLOCK_PAD - NOTE_GAP;
  };
  const upper = Math.max(need("key activities"), need("customer relationships"));
  let lower = Math.max(need("key resources"), need("channels"));
  const tall = Math.max(need("key partnerships"), need("value propositions"), need("customer segments"));
  lower = Math.max(lower, tall - upper - BLOCK_GAP);
  const top = [0, upper + BLOCK_GAP, upper + BLOCK_GAP + lower + BLOCK_GAP];
  const heights = [upper, lower, Math.max(need("cost structure"), need("revenue streams"))];
  const blocks: Rect[] = [];
  const rects: Rect[] = [];
  for (const name of names) {
    const [column, row, columns, rowsSpanned] = BLOCK_AREAS[name];
    const height = rowsSpanned === 2 ? upper + BLOCK_GAP + lower : heights[row];
    const block = { id: name, x: column * (BLOCK_W + BLOCK_GAP), y: top[row], width: widthOf(columns), height };
    blocks.push(block);
    const across = columns;
    const width = Math.floor((block.width - 2 * BLOCK_PAD - (across - 1) * NOTE_GAP) / across);
    held.get(name)!.forEach((n, i) => rects.push({
      id: n.id,
      x: block.x + BLOCK_PAD + (i % across) * (width + NOTE_GAP),
      y: block.y + BLOCK_HEAD + Math.floor(i / across) * (NOTE_H + NOTE_GAP),
      width,
      height: NOTE_H,
    }));
  }
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  return { blocks, rects: rects.sort((a, b) => order.get(a.id)! - order.get(b.id)!) };
}

// Requirements: two columns, functional on the left and non-functional on the right, each stacked in file order.
// A functional card grows by one row per acceptance criterion. The room between the columns holds the trace chips.
const REQUIREMENT_CARD = 300;
const REQUIREMENT_RIGHT = 620;
export function layoutRequirements(nodes: { id: string; kind?: unknown; criteria?: unknown }[]): Rect[] {
  const bottom = { left: 0, right: 0 };
  const at = new Map<string, Rect>();
  for (const n of nodes) {
    const right = n.kind === "non-functional";
    const side = right ? "right" : "left";
    const criteria = Array.isArray(n.criteria) ? n.criteria.length : 0;
    const height = right ? 120 : criteria ? 114 + 22 * criteria : 100;
    at.set(n.id, { id: n.id, x: right ? REQUIREMENT_RIGHT : 0, y: bottom[side], width: REQUIREMENT_CARD, height });
    bottom[side] += height + 28;
  }
  return nodes.map((n) => at.get(n.id)!);
}

// What a layer's Nodes are laid out with: Requirements has its own two columns, the other authored layers the grid.
export const layoutLayer = (layer: string, nodes: { id: string; parent?: unknown }[]): Rect[] =>
  layer === "requirements" ? layoutRequirements(nodes) : layoutAuthored(nodes);


export type FlowEdge ={ from: string; to: string; label?: string; back?: boolean };

// An Algorithm graph runs top to bottom, laid out by the layered engine: a straight run stays in one column,
// the exits of a branch sit side by side and rejoin below, a way back goes around its loop. Returns the routes too.
export function layoutFlow(steps: { id: string }[], edges: FlowEdge[]) {
  return layered(steps.map((s) => ({ id: s.id, width: 240, height: 44 })), edges);
}

// The smallest rectangle that holds all the given ones, with a margin on every side.
export function frameOf(rects: Rect[], margin = 24) {
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left - margin, y: top - margin, width: right - left + 2 * margin, height: bottom - top + 2 * margin };
}
