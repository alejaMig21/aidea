// Proposals: changes the builder suggests to the authored layers. Nothing is written until the person accepts.
// The builder never touches the files: it only calls tools that create a pending Proposal here.
import { randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { architecturePreview } from "./architecture.ts";
import { groupProblem, loadAuthored, nodeProblem, rationaleProblem, roleProblem } from "./authored.ts";
import { frameOf, layoutLayer } from "./layout.ts";
import { AUTHORED_LAYERS } from "./traces.ts";
import type { AuthoredLayerKey } from "./traces.ts";
import type { Project } from "./types.ts";

type Fields = Record<string, unknown>;
const isObject = (v: unknown): v is Fields => typeof v === "object" && v !== null && !Array.isArray(v);
const MAX_NODE_JSON_CHARS = 100_000;
const MAX_PENDING_PER_PROJECT = 100;

export type Proposal = {
  id: string;
  project: string;
  layer: AuthoredLayerKey;
  kind: "add" | "update" | "remove";
  nodeId: string;
  node?: Fields; // add: the whole Node; update: the Node as it will be once the change is accepted
  changes?: Fields; // update: what the builder asked to change
  status: "pending" | "waiting-for-class" | "accepted" | "rejected"; // waiting-for-class: only in what is shown; stored as pending + held
  source?: { role: "tutor"; classId: string; questionId: string }; // made by a Tutor tool, after the person answered this question
  fromAnswer?: string; // the person's own answer text that the Tutor built it from
  because?: string; // the Tutor's one-sentence reason
  held?: true; // Class mode: a Blocking decision whose decision class is not yet answered or skipped (see decision-class.ts)
  blocking?: true; // a Blocking decision (declaring a Pattern group); only marked here, the Tutor's classes act on it
};
// A Pattern group is proposed as an "add" whose nodeId is the group's id behind this prefix and whose `node` is the group.
export const PATTERN_PREFIX = "pattern:";
// The answer secret is the conversation's: only the interface that received the Proposal in its chat stream knows it.
export type StoredProposal = Proposal & { secret: string };
export type ProposalStore = Map<string, StoredProposal>;

export type ProposalRequest = { layer: unknown; id?: unknown; node?: unknown; changes?: unknown };

// Architecture only: "parent" must be another Node of the layer, and a Node that is somebody's parent cannot go away.
const parentProblem = (layer: string, node: Fields, otherIds: Set<unknown>) =>
  layer === "architecture" && node.parent !== undefined && !otherIds.has(node.parent) ? `"parent" refers to unknown id "${node.parent}"` : null;
// Architecture only: every relation must point at a Node of the layer (itself included).
const relationTargetProblem = (layer: string, node: Fields, ids: Set<unknown>) => {
  if (layer !== "architecture" || !Array.isArray(node.relations)) return null;
  const at = node.relations.findIndex((r) => !ids.has((r as Fields).to));
  return at === -1 ? null : `"relations[${at}].to" refers to unknown id "${(node.relations[at] as Fields).to}"`;
};
const childOf = (nodes: { id?: unknown; parent?: unknown }[], id: string) => nodes.find((n) => n.parent === id)?.id;

let counter = 0;
const nodesOf = (project: Project, layer: AuthoredLayerKey) => loadAuthored(project.path).layers[layer].nodes as Fields[];
const pendingOf = (store: ProposalStore, project: string, layer: AuthoredLayerKey) =>
  [...store.values()].filter((p) => p.project === project && p.layer === layer && p.status === "pending");

// Checks the builder's request and, when it is sound, keeps it as a pending Proposal. Otherwise says what is wrong.
export function propose(
  store: ProposalStore,
  project: Project,
  secret: string,
  kind: Proposal["kind"],
  request: ProposalRequest,
): { proposal: StoredProposal } | { error: string } {
  const { layer } = request;
  if (!AUTHORED_LAYERS.includes(layer as AuthoredLayerKey)) return { error: `layer must be one of: ${AUTHORED_LAYERS.join(", ")}` };
  const key = layer as AuthoredLayerKey;
  if ([...store.values()].filter((p) => p.project === project.id && p.status === "pending").length >= MAX_PENDING_PER_PROJECT) {
    return { error: "Too many proposals are waiting for the person: wait for them to decide" };
  }
  const existing = nodesOf(project, key);
  const pending = pendingOf(store, project.id, key);
  const taken = (id: string) => pending.some((p) => p.nodeId === id);
  const adds = pending.filter((p) => p.kind === "add");
  const ids = new Set<unknown>([...existing.map((n) => n.id), ...adds.map((p) => p.nodeId)]); // what a parent may point at

  let nodeId: string;
  let node: Fields | undefined;
  let changes: Fields | undefined;

  if (kind === "add") {
    if (!isObject(request.node)) return { error: "node must be an object with an id, a title, the fields of the layer and a rationale" };
    if (JSON.stringify(request.node).length > MAX_NODE_JSON_CHARS) return { error: "node is too large" };
    nodeId = String(request.node.id);
    if (existing.some((n) => n.id === nodeId)) return { error: `A Node with id "${nodeId}" already exists on the ${key} layer` };
    if (pending.some((p) => p.kind === "add" && p.nodeId === nodeId)) return { error: `A proposal to add "${nodeId}" is already pending` };
    const problem = nodeProblem(key, request.node, new Set());
    if (problem) return { error: `Invalid node: ${problem}` };
    const parent = parentProblem(key, request.node, ids) ?? relationTargetProblem(key, request.node, new Set([...ids, nodeId]));
    if (parent) return { error: `Invalid node: ${parent}` };
    node = request.node;
  } else {
    if (typeof request.id !== "string" || !request.id) return { error: "id must be the id of an existing Node" };
    nodeId = request.id;
    const current = existing.find((n) => n.id === nodeId);
    if (!current) return { error: `Node "${nodeId}" not found on the ${key} layer` };
    if (taken(nodeId)) return { error: `A proposal for "${nodeId}" is already pending` };
    if (kind === "update") {
      if (!isObject(request.changes) || Object.keys(request.changes).length === 0) return { error: "changes must be an object with the fields to change" };
      if (JSON.stringify(request.changes).length > MAX_NODE_JSON_CHARS) return { error: "changes is too large" };
      if (request.changes.id !== undefined && request.changes.id !== nodeId) return { error: 'The "id" of a Node cannot be changed: remove it and add a new one' };
      changes = request.changes;
      node = { ...current, ...changes };
      const problem = nodeProblem(key, node, new Set()) ?? parentProblem(key, node, new Set([...ids].filter((i) => i !== nodeId))) ?? relationTargetProblem(key, node, ids);
      if (problem) return { error: `Invalid change: ${problem}` };
    } else {
      const child = childOf([...existing, ...adds.map((p) => ({ id: p.nodeId, ...p.node }))], nodeId);
      if (child) return { error: `Node "${nodeId}" is the parent of "${child}": remove or move that Node first` };
    }
  }

  const proposal: StoredProposal = { id: `prop-${++counter}`, project: project.id, layer: key, kind, nodeId, node, changes, status: "pending", secret };
  store.set(proposal.id, proposal);
  return { proposal };
}

// The builder's request to declare a Pattern group (an optional list in the Architecture file). Validated like other data.
export function proposePattern(store: ProposalStore, project: Project, secret: string, group: unknown): { proposal: StoredProposal } | { error: string } {
  const arch = loadAuthored(project.path).layers.architecture;
  const pending = pendingOf(store, project.id, "architecture");
  const ids = new Set<unknown>([...arch.nodes.map((n) => n.id), ...pending.filter((p) => p.kind === "add" && !p.nodeId.startsWith(PATTERN_PREFIX)).map((p) => p.nodeId)]);
  const problem = groupProblem(group) ?? rationaleProblem((group as Fields).rationale);
  if (problem) return { error: `Invalid group: ${problem}` };
  const g = group as Fields;
  for (const r of g.roles as unknown[]) {
    const bad = roleProblem(g.kind as string, r, ids);
    if (bad) return { error: `Invalid group: roles ${bad.message}` };
  }
  if (JSON.stringify(g).length > MAX_NODE_JSON_CHARS) return { error: "group is too large" };
  const nodeId = PATTERN_PREFIX + String(g.id);
  if (arch.patterns?.some((p) => p.id === g.id) || pending.some((p) => p.nodeId === nodeId)) return { error: `A Pattern group "${g.id}" already exists or is already proposed` };
  const proposal: StoredProposal = { id: `prop-${++counter}`, project: project.id, layer: "architecture", kind: "add", nodeId, node: g, status: "pending", blocking: true, secret };
  store.set(proposal.id, proposal);
  return { proposal };
}

// What the interface and the builder may see: everything except the secret.
export const publicView = ({ secret: _secret, held, ...proposal }: StoredProposal): Proposal => (held && proposal.status === "pending" ? { ...proposal, status: "waiting-for-class" } : proposal);

// Where each pending Proposal is drawn: a new Node goes after the ones that exist, in the order it was proposed;
// a change or a removal points at the Node that already exists.
export function withPlaces(store: ProposalStore, project: Project) {
  return [...store.values()]
    .filter((p) => p.project === project.id && p.status === "pending")
    .map((p) => {
      const existing = nodesOf(project, p.layer);
      const adds = pendingOf(store, project.id, p.layer).filter((q) => q.kind === "add");
      const places = p.layer === "architecture" ? architecturePreview(existing, pendingOf(store, project.id, p.layer)).rects
        : layoutLayer(p.layer, [...existing.map((n) => ({ ...n, id: String(n.id) })), ...adds.map((q) => ({ ...q.node, id: q.nodeId }))]);
      const rect = places.find((r) => r.id === p.nodeId) ?? null;
      return { ...publicView(p), rect, frame: rect && frameOf([rect]) };
    });
}

// Writes an accepted Proposal into the layer's file. Returns a message when the file no longer fits the Proposal.
export function apply(project: Project, p: Proposal): string | null {
  const dir = join(project.path, ".aidea");
  const file = join(dir, `${p.layer}.json`);
  try {
    if (lstatSync(dir).isSymbolicLink()) return "The .aidea folder is a link that leaves the Project: nothing was written";
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") return "The .aidea folder cannot be read: nothing was written"; // no folder yet is fine: it is created below
  }
  let doc: Fields = { nodes: [] };
  try {
    if (lstatSync(file).isSymbolicLink()) return "The layer file is a link that leaves the Project: nothing was written";
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!isObject(parsed) || !Array.isArray(parsed.nodes)) return "The layer file cannot be read as an authored layer: fix it, then accept again";
    doc = parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") return "The layer file cannot be read as an authored layer: fix it, then accept again";
  }
  const nodes = doc.nodes as Fields[];
  const at = nodes.findIndex((n) => n.id === p.nodeId);

  if (p.nodeId.startsWith(PATTERN_PREFIX)) {
    const g = p.node!;
    const patterns = (Array.isArray(doc.patterns) ? doc.patterns : (doc.patterns = [])) as Fields[];
    const ids = new Set(nodes.map((n) => n.id));
    const problem = groupProblem(g) ?? ((g.roles as unknown[]).map((r) => roleProblem(g.kind as string, r, ids)).find(Boolean)?.message ?? null);
    if (problem) return `The Pattern group no longer fits the file: ${problem}`;
    if (patterns.some((x) => x.id === g.id)) return `A Pattern group "${g.id}" already exists (the file changed since the proposal)`;
    patterns.push(g);
  } else if (p.kind === "add") {
    if (at !== -1) return `A Node with id "${p.nodeId}" already exists on the ${p.layer} layer (the file changed since the proposal)`;
    const problem = nodeProblem(p.layer, p.node, new Set(nodes.map((n) => n.id as string))) ?? parentProblem(p.layer, p.node!, new Set(nodes.map((n) => n.id))) ?? relationTargetProblem(p.layer, p.node!, new Set([...nodes.map((n) => n.id), p.nodeId]));
    if (problem) return `The Node no longer fits the file: ${problem}`;
    nodes.push(p.node!);
  } else if (at === -1) {
    return `Node "${p.nodeId}" is no longer on the ${p.layer} layer (the file changed since the proposal)`;
  } else if (p.kind === "update") {
    const merged = { ...nodes[at], ...p.changes };
    const others = nodes.filter((_, i) => i !== at);
    const problem = nodeProblem(p.layer, merged, new Set(others.map((n) => n.id as string))) ?? parentProblem(p.layer, merged, new Set(others.map((n) => n.id))) ?? relationTargetProblem(p.layer, merged, new Set(nodes.map((n) => n.id)));
    if (problem) return `The change no longer fits the file: ${problem}`;
    nodes[at] = merged;
  } else {
    const child = childOf(nodes, p.nodeId);
    if (child) return `Node "${p.nodeId}" is now the parent of "${child}" (the file changed since the proposal)`;
    nodes.splice(at, 1);
  }

  mkdirSync(dir, { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(doc, null, 2) + "\n");
  renameSync(temporary, file);
  return null;
}

// The Architecture layer as it would be drawn with every pending Proposal applied (absent when none is pending).
export function previewsOf(store: ProposalStore, project: Project) {
  const pending = pendingOf(store, project.id, "architecture");
  return pending.length ? { architecture: architecturePreview(nodesOf(project, "architecture"), pending) } : {};
}
