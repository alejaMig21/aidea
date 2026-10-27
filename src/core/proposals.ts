// Proposals: changes the builder suggests to the authored layers. Nothing is written until the person accepts.
// The builder never touches the files: it only calls tools that create a pending Proposal here.
import { randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadAuthored, nodeProblem } from "./authored.ts";
import { frameOf, layoutAuthored } from "./layout.ts";
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
  status: "pending" | "accepted" | "rejected";
};
// The answer secret is the conversation's: only the interface that received the Proposal in its chat stream knows it.
export type StoredProposal = Proposal & { secret: string };
export type ProposalStore = Map<string, StoredProposal>;

export type ProposalRequest = { layer: unknown; id?: unknown; node?: unknown; changes?: unknown };

// Architecture only: "parent" must be another Node of the layer, and a Node that is somebody's parent cannot go away.
const parentProblem = (layer: string, node: Fields, otherIds: Set<unknown>) =>
  layer === "architecture" && node.parent !== undefined && !otherIds.has(node.parent) ? `"parent" refers to unknown id "${node.parent}"` : null;
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
    const parent = parentProblem(key, request.node, ids);
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
      const problem = nodeProblem(key, node, new Set()) ?? parentProblem(key, node, new Set([...ids].filter((i) => i !== nodeId)));
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

// What the interface and the builder may see: everything except the secret.
export const publicView = ({ secret: _secret, ...proposal }: StoredProposal): Proposal => proposal;

// Where each pending Proposal is drawn: a new Node goes after the ones that exist, in the order it was proposed;
// a change or a removal points at the Node that already exists.
export function withPlaces(store: ProposalStore, project: Project) {
  return [...store.values()]
    .filter((p) => p.project === project.id && p.status === "pending")
    .map((p) => {
      const existing = nodesOf(project, p.layer);
      const adds = pendingOf(store, project.id, p.layer).filter((q) => q.kind === "add");
      const places = layoutAuthored([...existing.map((n) => ({ id: String(n.id), parent: n.parent })), ...adds.map((q) => ({ id: q.nodeId, parent: q.node?.parent }))]);
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

  if (p.kind === "add") {
    if (at !== -1) return `A Node with id "${p.nodeId}" already exists on the ${p.layer} layer (the file changed since the proposal)`;
    const problem = nodeProblem(p.layer, p.node, new Set(nodes.map((n) => n.id as string))) ?? parentProblem(p.layer, p.node!, new Set(nodes.map((n) => n.id)));
    if (problem) return `The Node no longer fits the file: ${problem}`;
    nodes.push(p.node!);
  } else if (at === -1) {
    return `Node "${p.nodeId}" is no longer on the ${p.layer} layer (the file changed since the proposal)`;
  } else if (p.kind === "update") {
    const merged = { ...nodes[at], ...p.changes };
    const others = nodes.filter((_, i) => i !== at);
    const problem = nodeProblem(p.layer, merged, new Set(others.map((n) => n.id as string))) ?? parentProblem(p.layer, merged, new Set(others.map((n) => n.id)));
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
