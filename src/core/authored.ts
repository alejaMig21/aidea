// Authored layers: plain JSON files in the Project's `.aidea/` folder, one file per Layer, hand-editable.
//
//   .aidea/business.json      { "nodes": [ { id, title, block, rationale } ] }
//   .aidea/requirements.json  { "nodes": [ { id, title, as, want, so, rationale } ] }
//   .aidea/architecture.json  { "nodes": [ { id, title, technology, parent?, kind?, description?, relations?, rationale } ] }
//
// A layer may also be stored one Node per file (ADR 0005): `.aidea/<layer>/<node-id>.json` holds one Node, and
// `.aidea/architecture/patterns/<group-id>.json` one Pattern group. Both forms can sit side by side; an id found in both is
// reported and the per-Node file wins. A Node file is the Node's own JSON object, exactly as it would sit inside the layer's "nodes" list; a group file is
// the group's JSON object. Files are read in file-name order, which is the order the layer is drawn in; accepted Proposals write them as
// `<number>-<id>.json` (`001-web-app.json`) so the order of the old single file is kept, but any file name works when written by hand.
// Accepting a Proposal on a layer still in its single file first writes every Node to its own file, then removes the single file.
// Every Node has a unique non-empty string `id` and `title`, and a Rationale:
//   "rationale": { "why": "...", "rejected": [ { "option": "...", "reason": "..." } ] }
// `block` is one of the nine Business Model Canvas blocks (BLOCKS below); `parent` is an optional string.
// Architecture only: `parent` means "is inside"; `kind` is one of KINDS; `description` is one short sentence; `external` is a boolean (true: outside the system being drawn);
// `relations` is a list of { to, label, technology? } naming other Nodes of the layer. A bad relation is dropped alone.
// Architecture only: an optional top-level `patterns` list of Pattern groups, { id, name, kind, roles: [ { node, role } ] }; kind and role come from PATTERN_ROLES.
// A bad role is dropped alone, a bad group is dropped with its problem, and the Nodes are never affected.
// Extra fields are kept as they are. A bad Node is dropped with an error (except an unknown Architecture `kind`: the Node stays, the kind is ignored); a bad file never stops other files.
import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AuthoredLayer, AuthoredNode } from "./types.ts";

const BLOCKS = [
  "customer segments", "value propositions", "channels", "customer relationships", "revenue streams",
  "key resources", "key activities", "key partnerships", "cost structure",
];
const KINDS = ["person", "system", "container", "component"];
// The roles a Node can play in a Pattern group, by kind of pattern. Layered roles are listed from the top layer to the bottom one.
export const PATTERN_ROLES: Record<string, string[]> = {
  hexagonal: ["domain", "port", "adapter", "infrastructure"],
  layered: ["presentation", "application", "domain", "data"],
};
const MAX_FILE_BYTES = 1024 * 1024;

type Fields = Record<string, unknown>;
const isObject = (v: unknown): v is Fields => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown) => typeof v === "string" && v.trim() !== "";

// Requirements: `kind` is "functional" (default) or "non-functional".
//   functional:     as, want, so; optional criteria (Given/When/Then lines)
//   non-functional: statement, quality (one of QUALITIES), measure
export const QUALITIES = ["performance", "security", "usability", "reliability", "maintainability", "compatibility", "portability", "safety"];
const required = (n: Fields, fields: string[]) => fields.map((f) => (isNonEmptyString(n[f]) ? null : `"${f}" must be a non-empty string`)).find(Boolean) ?? null;
function requirementProblem(n: Fields): string | null {
  if (n.kind === "non-functional") {
    return required(n, ["statement"]) ?? (QUALITIES.includes(n.quality as string) ? null : `"quality" must be one of: ${QUALITIES.join(", ")}`) ?? required(n, ["measure"]);
  }
  if (n.kind !== undefined && n.kind !== "functional") return '"kind" must be "functional" or "non-functional"';
  if (n.criteria !== undefined && !(Array.isArray(n.criteria) && n.criteria.every(isNonEmptyString))) return '"criteria" must be an array of non-empty strings';
  return required(n, ["as", "want", "so"]);
}

// Layer-specific required fields; each check returns the problem or null.
const layerChecks: Record<string, (n: Fields) => string | null> = {
  business: (n) => (BLOCKS.includes(n.block as string) ? null : `"block" must be one of: ${BLOCKS.join(", ")}`),
  requirements: requirementProblem,
  architecture: (n) =>
    !isNonEmptyString(n.technology) ? '"technology" must be a non-empty string'
    : n.parent !== undefined && !isNonEmptyString(n.parent) ? '"parent" must be a non-empty string when present'
    : architectureDetailProblem(n),
};

// One relation of an Architecture Node: the problem naming its field, or null.
const relationProblem = (r: unknown, i: number) =>
  !isObject(r) ? `"relations[${i}]" must be an object`
  : !isNonEmptyString(r.to) ? `"relations[${i}].to" must be a non-empty string`
  : !isNonEmptyString(r.label) ? `"relations[${i}].label" must be a non-empty string`
  : r.technology !== undefined && typeof r.technology !== "string" ? `"relations[${i}].technology" must be a string when present`
  : null;

function architectureDetailProblem(n: Fields): string | null {
  if (n.kind !== undefined && !KINDS.includes(n.kind as string)) return `"kind" must be one of: ${KINDS.join(", ")}`;
  if (n.description !== undefined && !isNonEmptyString(n.description)) return '"description" must be a non-empty string when present';
  if (n.external !== undefined && typeof n.external !== "boolean") return '"external" must be a boolean when present';
  if (n.relations === undefined) return null;
  if (!Array.isArray(n.relations)) return '"relations" must be an array when present';
  for (const [i, r] of n.relations.entries()) {
    const problem = relationProblem(r, i);
    if (problem) return problem;
  }
  return null;
}

// What is wrong with a Pattern group itself (not the contents of its roles), or null.
export const groupProblem = (g: unknown): string | null =>
  !isObject(g) ? "must be an object"
  : !isNonEmptyString(g.id) ? '"id" must be a non-empty string'
  : !isNonEmptyString(g.name) ? '"name" must be a non-empty string'
  : !Object.hasOwn(PATTERN_ROLES, g.kind as string) ? `"kind" must be one of: ${Object.keys(PATTERN_ROLES).join(", ")}`
  : !Array.isArray(g.roles) ? '"roles" must be an array'
  : null;
// What is wrong with one role of a group of `kind`; `ids` are the Nodes it may point at.
export const roleProblem = (kind: string, r: unknown, ids: Set<unknown>): { field: string; message: string } | null =>
  !isObject(r) ? { field: "", message: "must be an object" }
  : !isNonEmptyString(r.node) ? { field: "node", message: '"node" must be a non-empty string' }
  : !PATTERN_ROLES[kind].includes(r.role as string) ? { field: "role", message: `"role" must be one of: ${PATTERN_ROLES[kind].join(", ")}` }
  : !ids.has(r.node) ? { field: "node", message: `"node" refers to unknown id "${r.node}"` }
  : null;

export function rationaleProblem(r: unknown): string | null {
  if (!isObject(r)) return '"rationale" must be an object';
  if (!isNonEmptyString(r.why)) return '"rationale.why" must be a non-empty string';
  if (!Array.isArray(r.rejected)) return '"rationale.rejected" must be an array';
  for (const [i, alt] of r.rejected.entries()) {
    if (!isObject(alt)) return `"rationale.rejected[${i}]" must be an object`;
    for (const f of ["option", "reason"]) {
      if (!isNonEmptyString(alt[f])) return `"rationale.rejected[${i}].${f}" must be a non-empty string`;
    }
  }
  return null;
}

// The evidence a Node may carry (layer-inference 03): { status: "observed" | "inferred" | "unknown", cites?: [{ file, from, to }], why? }. Observed and inferred need at least one citation;
// unknown needs the reason. Only the shape is checked here (it also reads files edited by hand); that the cited files and lines exist is checked when a Proposal is made (proposals.ts).
export const EVIDENCE_STATUSES = ["observed", "inferred", "unknown"];
export const MAX_CITES = 20;
export function evidenceProblem(e: unknown): string | null {
  if (!isObject(e)) return '"evidence" must be an object';
  if (!EVIDENCE_STATUSES.includes(e.status as string)) return `"evidence.status" must be one of: ${EVIDENCE_STATUSES.join(", ")}`;
  const cites = e.cites;
  if (cites !== undefined && (!Array.isArray(cites) || cites.length > MAX_CITES)) return `"evidence.cites" must be a list of at most ${MAX_CITES} citations`;
  if (e.status !== "unknown" && !(Array.isArray(cites) && cites.length > 0)) return `"evidence.cites" must hold at least one citation when the status is ${e.status as string}`;
  for (const [i, c] of (cites ?? []).entries()) {
    if (!isObject(c) || !isNonEmptyString(c.file) || !Number.isInteger(c.from) || !Number.isInteger(c.to) || (c.from as number) < 1 || (c.to as number) < (c.from as number)) {
      return `"evidence.cites[${i}]" must be { file, from, to } with 1 <= from <= to`;
    }
  }
  if (e.status === "unknown" && !isNonEmptyString(e.why)) return '"evidence.why" must say why it is not known';
  if (e.why !== undefined && !isNonEmptyString(e.why)) return '"evidence.why" must be a non-empty string';
  return null;
}

// What is wrong with one Node of a layer, or null when it is fine. `seen` holds the ids already taken on that layer.
// The same rules apply to a file edited by hand and to what the builder proposes.
export function nodeProblem(layer: string, n: unknown, seen: Set<string>): string | null {
  return !isObject(n) ? "must be an object"
    : !isNonEmptyString(n.id) ? '"id" must be a non-empty string'
    : seen.has(n.id as string) ? `duplicate id "${n.id}"`
    : !isNonEmptyString(n.title) ? '"title" must be a non-empty string'
    : n.traces !== undefined && !(Array.isArray(n.traces) && n.traces.every(isNonEmptyString)) ? '"traces" must be an array of non-empty strings'
    : layerChecks[layer](n) ?? rationaleProblem(n.rationale) ?? (n.evidence === undefined ? null : evidenceProblem(n.evidence));
}

// A problem in plain words for the interface: which layer and file, which item (its id, else its position), which field, and what was ignored.
// `errors` keeps the raw text for other consumers.
export type AuthoredProblem = { layer?: string; file: string; id?: string; index?: number; field?: string; message: string };

// '"x" must be a non-empty string' -> 'It needs a non-empty "x"'; the other messages keep their words.
function plainReason(raw: string): string {
  const empty = raw.match(/^"([^"]+)" must be a non-empty string/);
  if (empty) return `It needs a non-empty "${empty[1]}"`;
  const field = raw.match(/^"([^"]+)" (.*)$/);
  if (field) return `The field "${field[1]}" ${field[2]}`;
  const dup = raw.match(/^duplicate id "(.*)"$/);
  if (dup) return `The id "${dup[1]}" is already used by an earlier item`;
  return `The item ${raw}`;
}

// One Node or Pattern group to parse, and where it came from. `index` is its place in a layer file; a per-Node file has none.
type Item = { n: unknown; file: string; index?: number };
// The per-Node files of a layer (`.aidea/<layer>/*.json`) and its Pattern group files, already read; a bad file is reported when it is read.
type Folder = { nodes: Item[]; groups: Item[] };
const noFolder = (): Folder => ({ nodes: [], groups: [] });

// `source` is the layer file's text (undefined: there is none); `folder` adds the Nodes stored one per file.
function parseLayer(layer: string, source: string | undefined, file: string, problems: AuthoredProblem[], folder: Folder = noFolder()): AuthoredLayer {
  const out: AuthoredLayer = { nodes: [], errors: [] };
  const fail = (message: string, at = file) => out.errors.push({ file: at, message });
  // Records the same event as a structured problem. `raw` is the error text without its "nodes[i]: " prefix.
  const flag = (raw: string, at?: { index?: number; id?: unknown; file?: string }, tail = "The item was ignored.") => {
    const field = raw.match(/^"([^"]+)"/)?.[1];
    problems.push({
      layer, file: at?.file ?? file,
      ...(at?.index !== undefined && { index: at.index }),
      ...(typeof at?.id === "string" && at.id !== "" && { id: at.id }),
      ...(field && { field }),
      message: at ? `${plainReason(raw)}. ${tail}` : `The file ${raw}. It was ignored.`,
    });
  };
  const items: Item[] = [];
  let doc: unknown;
  if (source !== undefined) {
    try {
      doc = JSON.parse(source);
    } catch (e) {
      const message = `not valid JSON (${e instanceof Error ? e.message : e})`;
      fail(message);
      flag(`is ${message}`);
    }
    if (doc !== undefined && (!isObject(doc) || !Array.isArray(doc.nodes))) {
      fail('the file must be an object with a "nodes" array');
      flag('must be an object with a "nodes" array');
      doc = undefined;
    }
    if (isObject(doc)) {
      // An id kept in both forms: the per-Node file wins and the layer file's copy is reported.
      const perNode = new Map(folder.nodes.filter((it) => isObject(it.n) && isNonEmptyString(it.n.id)).map((it) => [(it.n as Fields).id, it.file] as const));
      for (const [index, n] of (doc.nodes as unknown[]).entries()) {
        const other = isObject(n) ? perNode.get(n.id) : undefined;
        if (other === undefined) { items.push({ n, file, index }); continue; }
        const id = (n as Fields).id as string;
        fail(`nodes[${index}]: duplicate id "${id}": the Node is stored in both ${file} and ${other}; ${other} wins`);
        flag(`duplicate id "${id}"`, { index, id }, `The same id is stored in both ${file} and ${other}; ${other} wins. This copy was ignored.`);
      }
    }
  }
  items.push(...folder.nodes);
  const seen = new Set<string>();
  const where = new Map<string, Item>(); // where each surviving Node sits
  const relations = new Map<string, { r: Fields; i: number }[]>(); // architecture: the well-formed relations of each Node, with their place in the file
  for (const it of items) {
    let n = it.n;
    const at = (id?: unknown) => ({ index: it.index, id, file: it.file });
    const here = (m: string) => fail(it.index === undefined ? m : `nodes[${it.index}]: ${m}`, it.file);
    let keptHere: { r: Fields; i: number }[] | undefined;
    if (layer === "architecture" && isObject(n) && Array.isArray(n.relations)) {
      const kept: { r: Fields; i: number }[] = [];
      n.relations.forEach((r: unknown, j: number) => {
        const bad = relationProblem(r, j);
        if (bad) {
          here(bad);
          flag(`"relations[${j}]" is wrong: ${bad}`, at((n as Fields).id), "The relation was ignored.");
        } else kept.push({ r: r as Fields, i: j });
      });
      n = { ...n, relations: kept.map((k) => k.r) };
      keptHere = kept;
    }
    if (layer === "architecture" && isObject(n) && n.kind !== undefined && !KINDS.includes(n.kind as string)) {
      // A file with an unknown kind keeps its Node: the kind is reported and ignored, so the Node is drawn as a generic box.
      // (A Proposal with a bad kind is still refused, by nodeProblem.)
      here(`"kind" must be one of: ${KINDS.join(", ")} (ignored: drawn as a generic box)`);
      flag(`"kind" must be one of: ${KINDS.join(", ")}`, at(n.id), "The kind was ignored and the item is drawn as a generic box.");
      const { kind: _ignored, ...rest } = n;
      n = rest;
    }
    const problem = nodeProblem(layer, n, seen);
    if (problem) {
      here(problem);
      flag(problem, at(isObject(n) ? n.id : undefined));
      continue;
    }
    if (keptHere) relations.set((n as Fields).id as string, keptHere); // only a Node that survives owns its relations
    seen.add((n as Fields).id as string);
    where.set((n as Fields).id as string, it);
    out.nodes.push(n as AuthoredNode);
  }
  if (layer === "architecture") {
    const place = (id: string) => ({ ...(where.get(id)!.index !== undefined && { index: where.get(id)!.index }), file: where.get(id)!.file });
    out.nodes = out.nodes.filter((n) => {
      if (n.parent === undefined || seen.has(n.parent as string)) return true;
      const p = place(n.id);
      fail(`node "${n.id}": "parent" refers to unknown id "${n.parent}"`, p.file);
      problems.push({ layer, ...p, id: n.id, field: "parent", message: `It sits inside "${n.parent}", which does not exist. The item was ignored.` });
      return false;
    });
    for (const n of out.nodes.filter((n) => n.relations !== undefined)) {
      n.relations = relations.get(n.id)!.filter(({ r, i }) => {
        if (seen.has(r.to as string)) return true;
        const p = place(n.id);
        fail(`node "${n.id}": "relations[${i}].to" refers to unknown id "${r.to}"`, p.file);
        problems.push({ layer, ...p, id: n.id, field: `relations[${i}].to`, message: `It points to "${r.to}", which does not exist. The relation was ignored.` });
        return false;
      }).map((k) => k.r);
    }
    const groups: Item[] = [];
    if (isObject(doc) && doc.patterns !== undefined) {
      if (Array.isArray(doc.patterns)) groups.push(...doc.patterns.map((g, index) => ({ n: g, file, index })));
      else { fail('patterns: The field "patterns" must be an array. It was ignored.'); problems.push({ layer, file, field: "patterns", message: 'The field "patterns" must be an array. It was ignored.' }); }
    }
    groups.push(...folder.groups);
    if ((isObject(doc) && doc.patterns !== undefined) || groups.length) out.patterns = parsePatterns(groups, new Set(out.nodes.map((n) => n.id)), fail, problems);
  }
  return out;
}

// The valid Pattern groups of an Architecture layer. `ids` are its surviving Nodes.
function parsePatterns(items: Item[], ids: Set<unknown>, fail: (m: string, file: string) => void, problems: AuthoredProblem[]): Fields[] {
  const groups: Fields[] = [];
  for (const { n: g, file, index } of items) {
    const path = (...rest: string[]) => [index === undefined ? "" : `patterns[${index}]`, ...rest].filter(Boolean).join(".") || "group";
    const flag = (field: string, message: string) => { fail(`${field}: ${message}`, file); problems.push({ layer: "architecture", file, field, message }); };
    const bad = groupProblem(g) ?? (groups.some((k) => k.id === (g as Fields).id) ? `duplicate id "${(g as Fields).id}"` : null);
    if (bad) {
      const field = bad.match(/^"([^"]+)"/)?.[1];
      flag(field ? path(field) : path(), `${plainReason(bad)}. The Pattern group was ignored.`);
      continue;
    }
    const roles = (g as Fields).roles as unknown[];
    const kept = roles.filter((r, j) => {
      const p = roleProblem((g as Fields).kind as string, r, ids);
      if (p) flag(path(`roles[${j}]`, p.field), p.message.includes("unknown id") ? `It points to "${(r as Fields).node}", which does not exist. The role was ignored.` : `${plainReason(p.message)}. The role was ignored.`);
      return !p;
    });
    groups.push({ ...(g as Fields), roles: kept });
  }
  return groups;
}

// Reads `.aidea/<layer>/*.json` (one Node each) and, for Architecture, `.aidea/architecture/patterns/*.json` (one Pattern group each).
// Only regular files are read; a folder that is a link is skipped. A bad file is reported on its own and the others still load.
function readFolder(dir: string, layer: string, errors: AuthoredLayer["errors"], problems: AuthoredProblem[]): Folder {
  const folder = noFolder();
  const read = (sub: string, into: Item[]) => {
    let names: string[];
    try {
      names = readdirSync(join(dir, layer, sub), { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => e.name).sort((a, b) => a.localeCompare(b, "en"));
    } catch {
      return; // no such folder
    }
    for (const name of names) {
      const file = `.aidea/${layer}/${sub}${name}`;
      const path = join(dir, layer, sub, name);
      const ignore = (message: string) => { errors.push({ file, message }); problems.push({ layer, file, message: `The file ${message}. It was ignored.` }); };
      if (statSync(path).size > MAX_FILE_BYTES) { ignore("is larger than 1 MB"); continue; }
      try {
        into.push({ n: JSON.parse(readFileSync(path, "utf8")), file });
      } catch (e) {
        ignore(`is not valid JSON (${e instanceof Error ? e.message : e})`);
      }
    }
  };
  read("", folder.nodes);
  if (layer === "architecture") read("patterns/", folder.groups);
  return folder;
}

// Reads the files fresh on every call. Only regular files directly inside `<project>/.aidea/` are read.
export function loadAuthored(projectPath: string) {
  const layers: Record<string, AuthoredLayer> = {};
  const errors: { file: string; message: string }[] = [];
  const problems: AuthoredProblem[] = [];
  for (const name of Object.keys(layerChecks)) layers[name] = { nodes: [], errors: [] };

  const dir = join(projectPath, ".aidea");
  let entries;
  try {
    if (lstatSync(dir).isSymbolicLink()) return { layers, errors, problems }; // a link could point outside the Project
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { layers, errors, problems }; // no .aidea folder: nothing authored yet
  }
  const files = new Map<string, string>(); // layer -> its single file's text, when there is a usable one
  for (const entry of entries.filter((e) => e.isFile() && e.name.endsWith(".json")).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const file = `.aidea/${entry.name}`;
    const layer = entry.name.slice(0, -".json".length);
    if (!Object.hasOwn(layerChecks, layer)) {
      errors.push({ file, message: "unknown layer file (expected business, requirements or architecture)" });
      problems.push({ file, message: "This file is not a layer (expected business, requirements or architecture). It was ignored." });
      continue;
    }
    const path = join(dir, entry.name);
    if (statSync(path).size > MAX_FILE_BYTES) {
      layers[layer].errors.push({ file, message: "file is larger than 1 MB" });
      problems.push({ layer, file, message: "The file is larger than 1 MB. It was ignored." });
      continue;
    }
    files.set(layer, readFileSync(path, "utf8"));
  }
  for (const layer of Object.keys(layerChecks)) {
    const tooBig = layers[layer].errors; // the "larger than 1 MB" error of its single file, kept next to the rest
    const folderErrors: AuthoredLayer["errors"] = [];
    const folder = readFolder(dir, layer, folderErrors, problems);
    if (!files.has(layer) && !folder.nodes.length && !folder.groups.length && !folderErrors.length) continue;
    layers[layer] = parseLayer(layer, files.get(layer), `.aidea/${layer}.json`, problems, folder);
    layers[layer].errors.unshift(...tooBig);
    layers[layer].errors.push(...folderErrors);
  }
  return { layers, errors, problems };
}
