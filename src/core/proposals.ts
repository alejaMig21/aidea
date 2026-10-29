// Proposals: changes the builder suggests to the authored layers. Nothing is written until the person accepts.
// The builder never touches the files: it only calls tools that create a pending Proposal here.
import { randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

// A refusal the person should hear about (not a mistake in the shape of the call): the id is taken by a waiting Proposal or by a Node.
export type Refusal = { reason: "pending" | "exists"; layer: AuthoredLayerKey; nodeId: string; proposalId?: string };
export type Refused = { error: string; refusal?: Refusal };
// What the interface streams for it; the caller adds who tried (the Tutor or the builder).
export const refusedEvent = (refusal: Refusal, source: "tutor" | "builder") => ({ type: "proposal_refused", ...refusal, source });

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
): { proposal: StoredProposal } | Refused {
  const { layer } = request;
  if (!AUTHORED_LAYERS.includes(layer as AuthoredLayerKey)) return { error: `layer must be one of: ${AUTHORED_LAYERS.join(", ")}` };
  const key = layer as AuthoredLayerKey;
  if ([...store.values()].filter((p) => p.project === project.id && p.status === "pending").length >= MAX_PENDING_PER_PROJECT) {
    return { error: "Too many proposals are waiting for the person: wait for them to decide" };
  }
  const existing = nodesOf(project, key);
  const pending = pendingOf(store, project.id, key);
  const adds = pending.filter((p) => p.kind === "add");
  const ids = new Set<unknown>([...existing.map((n) => n.id), ...adds.map((p) => p.nodeId)]); // what a parent may point at

  let nodeId: string;
  let node: Fields | undefined;
  let changes: Fields | undefined;

  if (kind === "add") {
    if (!isObject(request.node)) return { error: "node must be an object with an id, a title, the fields of the layer and a rationale" };
    if (JSON.stringify(request.node).length > MAX_NODE_JSON_CHARS) return { error: "node is too large" };
    nodeId = String(request.node.id);
    if (existing.some((n) => n.id === nodeId)) return { error: `A Node with id "${nodeId}" already exists on the ${key} layer`, refusal: { reason: "exists", layer: key, nodeId } };
    const waiting = pending.find((p) => p.kind === "add" && p.nodeId === nodeId);
    if (waiting) return { error: `A proposal to add "${nodeId}" is already pending`, refusal: { reason: "pending", layer: key, nodeId, proposalId: waiting.id } };
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
    const waiting = pending.find((p) => p.nodeId === nodeId);
    if (waiting) return { error: `A proposal for "${nodeId}" is already pending`, refusal: { reason: "pending", layer: key, nodeId, proposalId: waiting.id } };
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
export function proposePattern(store: ProposalStore, project: Project, secret: string, group: unknown): { proposal: StoredProposal } | Refused {
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
  const waiting = pending.find((p) => p.nodeId === nodeId);
  const exists = arch.patterns?.some((p) => p.id === g.id);
  if (exists || waiting) return { error: `A Pattern group "${g.id}" already exists or is already proposed`, refusal: { reason: exists ? "exists" : "pending", layer: "architecture", nodeId, proposalId: exists ? undefined : waiting?.id } };
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

// A Node or Pattern group being written, and the file that holds it when the layer is stored one file per Node (ADR 0005).
type Entry = { value: Fields; path?: string };
type Op = { kind: "put"; path: string; data: string; fresh: boolean } | { kind: "del"; path: string };
const SINGLE_KEYS = ["nodes", "patterns"];
const slug = (id: unknown) => String(id).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60);

// The `.json` files directly inside `<layer folder>/<sub>`, parsed. A message when something there cannot be read as part of a layer.
function readStored(root: string, sub: string): { entries: Entry[]; names: string[] } | string {
  const dir = join(root, sub);
  const unreadable = `The ${dir.slice(dir.lastIndexOf(".aidea"))} folder cannot be read as an authored layer: fix it, then accept again`;
  try {
    if (lstatSync(dir).isSymbolicLink()) return "A layer folder is a link that leaves the Project: nothing was written";
    const names = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => e.name).sort((a, b) => a.localeCompare(b, "en"));
    const entries = names.map((name) => {
      const value: unknown = JSON.parse(readFileSync(join(dir, name), "utf8"));
      if (!isObject(value) || typeof value.id !== "string") throw new Error("not an item");
      return { value, path: join(dir, name) };
    });
    return { entries, names };
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "ENOENT" ? { entries: [], names: [] } : unreadable;
  }
}

// Writes an accepted Proposal. A layer stored one file per Node changes only the file of that Node; a layer still in its single file is
// converted first: every Node gets its own file, and only when all of them are on disk is the old file removed.
// A file is named `<number>-<id>.json`: the number keeps the order the layer is drawn in. Returns a message when nothing could be written.
export function apply(project: Project, p: Proposal): string | null {
  const dir = join(project.path, ".aidea");
  const file = join(dir, `${p.layer}.json`);
  try {
    if (lstatSync(dir).isSymbolicLink()) return "The .aidea folder is a link that leaves the Project: nothing was written";
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") return "The .aidea folder cannot be read: nothing was written"; // no folder yet is fine: it is created below
  }
  const unfit = "The layer file cannot be read as an authored layer: fix it, then accept again";
  let doc: Fields | undefined; // the single layer file, when there is one
  try {
    if (lstatSync(file).isSymbolicLink()) return "The layer file is a link that leaves the Project: nothing was written";
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!isObject(parsed) || !Array.isArray(parsed.nodes)) return unfit;
    if (Object.keys(parsed).some((k) => !SINGLE_KEYS.includes(k)) || (parsed.patterns !== undefined && !Array.isArray(parsed.patterns))) return `${unfit} (it holds fields other than "nodes" and "patterns")`;
    if ([...parsed.nodes, ...((parsed.patterns as unknown[]) ?? [])].some((x) => !isObject(x) || typeof x.id !== "string")) return `${unfit} (an entry has no id)`;
    doc = parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") return unfit;
  }
  const root = join(dir, p.layer);
  const stored = readStored(root, "");
  const storedGroups = p.layer === "architecture" ? readStored(root, "patterns") : { entries: [], names: [] };
  if (typeof stored === "string") return stored;
  if (typeof storedGroups === "string") return storedGroups;
  // An id kept in both forms: the per-Node file wins, as when reading.
  const merge = (single: unknown, folder: Entry[]): Entry[] => [
    ...((single as Fields[] | undefined) ?? []).filter((x) => !folder.some((f) => f.value.id === x.id)).map((value) => ({ value })),
    ...folder,
  ];
  const nodes = merge(doc?.nodes, stored.entries);
  const groups = merge(doc?.patterns, storedGroups.entries);
  const vals = () => nodes.map((n) => n.value);
  const at = nodes.findIndex((n) => n.value.id === p.nodeId);
  const ops: Op[] = [];
  let changed: Entry | undefined;

  if (p.nodeId.startsWith(PATTERN_PREFIX)) {
    const g = p.node!;
    const problem = groupProblem(g) ?? ((g.roles as unknown[]).map((r) => roleProblem(g.kind as string, r, new Set(vals().map((n) => n.id)))).find(Boolean)?.message ?? null);
    if (problem) return `The Pattern group no longer fits the file: ${problem}`;
    if (groups.some((x) => x.value.id === g.id)) return `A Pattern group "${g.id}" already exists (the file changed since the proposal)`;
    groups.push((changed = { value: g }));
  } else if (p.kind === "add") {
    if (at !== -1) return `A Node with id "${p.nodeId}" already exists on the ${p.layer} layer (the file changed since the proposal)`;
    const ids = new Set(vals().map((n) => n.id));
    const problem = nodeProblem(p.layer, p.node, new Set(ids as Set<string>)) ?? parentProblem(p.layer, p.node!, ids) ?? relationTargetProblem(p.layer, p.node!, new Set([...ids, p.nodeId]));
    if (problem) return `The Node no longer fits the file: ${problem}`;
    nodes.push((changed = { value: p.node! }));
  } else if (at === -1) {
    return `Node "${p.nodeId}" is no longer on the ${p.layer} layer (the file changed since the proposal)`;
  } else if (p.kind === "update") {
    const merged = { ...nodes[at].value, ...p.changes };
    const others = vals().filter((_, i) => i !== at);
    const problem = nodeProblem(p.layer, merged, new Set(others.map((n) => n.id as string))) ?? parentProblem(p.layer, merged, new Set(others.map((n) => n.id))) ?? relationTargetProblem(p.layer, merged, new Set(vals().map((n) => n.id)));
    if (problem) return `The change no longer fits the file: ${problem}`;
    nodes[at] = changed = { value: merged, path: nodes[at].path };
  } else {
    const child = childOf(vals(), p.nodeId);
    if (child) return `Node "${p.nodeId}" is now the parent of "${child}" (the file changed since the proposal)`;
    const [gone] = nodes.splice(at, 1);
    if (gone.path) ops.push({ kind: "del", path: gone.path });
  }

  // Which files to write: the changed item, and (when converting) every item that has no file yet.
  const stage = (entries: Entry[], sub: string, names: string[]) => {
    let next = Math.max(0, ...names.map((n) => parseInt(n, 10) || 0)) + 1;
    for (const e of entries) {
      const fresh = !e.path;
      if (!fresh && e !== changed) continue;
      e.path ??= join(root, sub, `${String(next++).padStart(3, "0")}-${slug(e.value.id)}.json`);
      ops.push({ kind: "put", path: e.path, data: JSON.stringify(e.value, null, 2) + "\n", fresh });
    }
  };
  stage(nodes, "", stored.names);
  stage(groups, "patterns", storedGroups.names);

  const made: string[] = []; // files created by this write: removed again when it fails
  let temporary: string | undefined;
  try {
    for (const op of ops) {
      if (op.kind === "del") continue;
      mkdirSync(dirname(op.path), { recursive: true });
      temporary = `${op.path}.${randomBytes(4).toString("hex")}.tmp`;
      writeFileSync(temporary, op.data, { flag: "wx" });
      renameSync(temporary, op.path);
      temporary = undefined;
      if (op.fresh) made.push(op.path);
    }
    for (const op of ops) if (op.kind === "put" && readFileSync(op.path, "utf8") !== op.data) throw new Error("a file did not read back as written");
    for (const op of ops) if (op.kind === "del") unlinkSync(op.path);
    if (doc) unlinkSync(file); // last: the old single file goes only once every Node is on disk
  } catch {
    if (temporary) rmSync(temporary, { force: true });
    for (const path of made) rmSync(path, { force: true });
    return `The layer could not be written (is the folder read-only?): nothing was changed`;
  }
  return null;
}


// The Architecture layer as it would be drawn with every pending Proposal applied (absent when none is pending).
export function previewsOf(store: ProposalStore, project: Project) {
  const pending = pendingOf(store, project.id, "architecture");
  return pending.length ? { architecture: architecturePreview(nodesOf(project, "architecture"), pending) } : {};
}
