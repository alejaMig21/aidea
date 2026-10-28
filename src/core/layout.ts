// The core owns where every Node sits on its Layer, so it can also say where the camera should look.
// The interface only draws the rectangles it is given and applies the framings it is sent.
import { layered, least, most } from "./layered.ts";
import { layoutComponentsDiagram } from "./components-layout.ts";
import type { CoreNode } from "./types.ts";

export type Rect = { id: string; x: number; y: number; width: number; height: number };

// Components and data: packages in columns with class boxes stacked inside (see components-layout.ts).
export const layoutComponents = (nodes: CoreNode[]): Rect[] => layoutComponentsDiagram(nodes).rects;

// Business layer: the nine blocks of the canvas in its canonical arrangement on a five-column grid
// (partners | activities over resources | value propositions | relationships over channels | segments),
// with cost structure (three columns) and revenue streams (two) across the bottom.
// Notes fill their block in the order given, one note per grid column the block spans (so 3 and 2 across in the wide bottom blocks);
// the header holds the block's name and a one-line hint; a block is as tall as its notes need, and the rows of the top part stretch to keep the three tall blocks level.
// Each area is [column, row, columns spanned, rows spanned].
const BLOCK_W = 240, BLOCK_GAP = 16, BLOCK_HEAD = 58, BLOCK_PAD = 12, NOTE_H = 44, NOTE_GAP = 8;
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
const REQUIREMENT_RIGHT = REQUIREMENT_CARD + 260; // 24 to the chip, 170 for it (REQ_CHIP_X, REQ_CHIP_W in 46-requirements.js), 66 before the next column
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

// What the Nodes of Business and Requirements are laid out with (Architecture and Components have their own engines).
export const layoutLayer = (layer: string, nodes: { id: string; kind?: unknown; criteria?: unknown; block?: unknown }[]): Rect[] =>
  layer === "requirements" ? layoutRequirements(nodes) : layoutBusiness(nodes).rects;


export type FlowEdge = { from: string; to: string; label?: string; exit?: string; back?: boolean };

// Flowchart boxes: the size of each step's symbol follows its text, so a diamond or a parallelogram always holds its label.
// The text is wrapped into lines (returned for drawing), at fewer characters per line inside a diamond.
export type FlowStep = { id: string; kind: string; label: string; io?: string | null; construct?: string };
const CHAR = 7.6; // width of one character of the 12.5 px monospace label
const LINE = 16;

export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (let word of text.split(" ")) {
    while (word.length > max) { // a word longer than a line is cut
      if (line) { lines.push(line); line = ""; }
      lines.push(word.slice(0, max));
      word = word.slice(max);
    }
    if (line && (line + " " + word).length > max) { lines.push(line); line = word; }
    else line = line ? line + " " + word : word;
  }
  return line ? [...lines, line] : lines.length ? lines : [""];
}

export function flowBox(step: FlowStep) {
  const decision = step.kind === "branch" || step.kind === "loop";
  const slanted = Boolean(step.io) && step.kind === "step" && step.construct !== "with"; // only a plain step is drawn as input/output
  const lines = wrapText(step.label, decision ? 20 : slanted ? 28 : 34);
  const textW = Math.max(...lines.map((l) => l.length)) * CHAR;
  const textH = lines.length * LINE;
  const size = decision ? { width: Math.max(130, Math.ceil(textW * 1.7 + 16)), height: Math.max(64, Math.ceil(textH * 2.8)) }
    : slanted ? { width: Math.max(130, Math.ceil(textW + 60)), height: Math.max(44, textH + 20) }
    : ["start", "end", "return", "raise"].includes(step.kind) ? { width: Math.max(110, Math.ceil(textW + 44)), height: Math.max(40, textH + 20) }
    : { width: Math.max(120, Math.ceil(textW + 28)), height: Math.max(40, textH + 20) };
  return { ...size, lines };
}

// An Algorithm graph runs top to bottom, laid out by the layered engine: a straight run stays in one column,
// the exits of a branch sit side by side and rejoin below, a way back goes around its loop. Returns the routes too.
export function layoutFlow(steps: FlowStep[], edges: FlowEdge[]) {
  // the label that is drawn is the exit's name (Yes, next item, a pattern, an exception type), so the engine makes room for it
  const boxes = steps.map((s) => ({ id: s.id, ...flowBox(s) })); // sized once; the wrapped lines go back to the caller for drawing
  const loops = new Set(steps.filter((s) => s.kind === "loop").map((s) => s.id));
  // the exit of a loop is the edge flow.py names "done" (for) or "no" (while)
  const loopExit = (e: FlowEdge) => !e.back && loops.has(e.from) && (e.exit === "done" || e.exit === "no");
  return { ...layered(boxes, edges.map((e) => ({ ...e, label: e.exit ?? e.label, loopExit: loopExit(e) }))), lines: new Map(boxes.map((b) => [b.id, b.lines])) };
}

// The smallest rectangle that holds all the given ones, with a margin on every side.
export function frameOf(rects: Rect[], margin = 24) {
  const left = least(rects.map((r) => r.x));
  const top = least(rects.map((r) => r.y));
  const right = most(rects.map((r) => r.x + r.width));
  const bottom = most(rects.map((r) => r.y + r.height));
  return { x: left - margin, y: top - margin, width: right - left + 2 * margin, height: bottom - top + 2 * margin };
}
