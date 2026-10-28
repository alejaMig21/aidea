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

export type FlowEdge = { from: string; to: string; label?: string; back?: boolean };

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
