// The core owns where every Node sits on its Layer, so it can also say where the camera should look.
// The interface only draws the rectangles it is given and applies the framings it is sent.
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

// Authored layers: cards in a grid, four to a row.
export function layoutAuthored(nodes: { id: string }[]): Rect[] {
  return nodes.map((n, i) => ({ id: n.id, x: (i % 4) * COLUMN, y: Math.floor(i / 4) * 80, width: 240, height: 64 }));
}

export type FlowEdge = { from: string; to: string; label?: string; back?: boolean };

// An Algorithm graph runs top to bottom: a step sits one row below the lowest step that leads to it.
// Steps are numbered in program order, so every edge that is not a way back goes from an earlier step to a later one.
// Steps on the same row sit side by side, in that order (the "true" side first).
export function layoutFlow(steps: { id: string }[], edges: FlowEdge[]): Rect[] {
  const row = new Map<string, number>();
  const placed = new Map<number, number>();
  return steps.map((step) => {
    const above = edges.filter((e) => e.to === step.id && !e.back).map((e) => (row.get(e.from) ?? -1) + 1);
    const y = Math.max(0, ...above);
    row.set(step.id, y);
    const column = placed.get(y) ?? 0;
    placed.set(y, column + 1);
    return { id: step.id, x: column * COLUMN, y: y * 84, width: 240, height: 44 };
  });
}

// The smallest rectangle that holds all the given ones, with a margin on every side.
export function frameOf(rects: Rect[], margin = 24) {
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left - margin, y: top - margin, width: right - left + 2 * margin, height: bottom - top + 2 * margin };
}
