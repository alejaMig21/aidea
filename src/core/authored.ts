// Authored layers: plain JSON files in the Project's `.aidea/` folder, one file per Layer, hand-editable.
//
//   .aidea/business.json      { "nodes": [ { id, title, block, rationale } ] }
//   .aidea/requirements.json  { "nodes": [ { id, title, as, want, so, rationale } ] }
//   .aidea/architecture.json  { "nodes": [ { id, title, technology, parent?, kind?, description?, relations?, rationale } ] }
//
// Every Node has a unique non-empty string `id` and `title`, and a Rationale:
//   "rationale": { "why": "...", "rejected": [ { "option": "...", "reason": "..." } ] }
// `block` is one of the nine Business Model Canvas blocks (BLOCKS below); `parent` is an optional string.
// Architecture only: `parent` means "is inside"; `kind` is one of KINDS; `description` is one short sentence;
// `relations` is a list of { to, label, technology? } naming other Nodes of the layer. A bad relation is dropped alone.
// Extra fields are kept as they are. A bad Node is dropped with an error; a bad file never stops other files.
import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AuthoredLayer, AuthoredNode } from "./types.ts";

const BLOCKS = [
  "customer segments", "value propositions", "channels", "customer relationships", "revenue streams",
  "key resources", "key activities", "key partnerships", "cost structure",
];
const KINDS = ["person", "system", "container", "component"];
const MAX_FILE_BYTES = 1024 * 1024;

type Fields = Record<string, unknown>;
const isObject = (v: unknown): v is Fields => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown) => typeof v === "string" && v.trim() !== "";

// Layer-specific required fields; each check returns the problem or null.
const layerChecks: Record<string, (n: Fields) => string | null> = {
  business: (n) => (BLOCKS.includes(n.block as string) ? null : `"block" must be one of: ${BLOCKS.join(", ")}`),
  requirements: (n) => ["as", "want", "so"].map((f) => (isNonEmptyString(n[f]) ? null : `"${f}" must be a non-empty string`)).find(Boolean) ?? null,
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
  if (n.relations === undefined) return null;
  if (!Array.isArray(n.relations)) return '"relations" must be an array when present';
  for (const [i, r] of n.relations.entries()) {
    const problem = relationProblem(r, i);
    if (problem) return problem;
  }
  return null;
}

function rationaleProblem(r: unknown): string | null {
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

// What is wrong with one Node of a layer, or null when it is fine. `seen` holds the ids already taken on that layer.
// The same rules apply to a file edited by hand and to what the builder proposes.
export function nodeProblem(layer: string, n: unknown, seen: Set<string>): string | null {
  return !isObject(n) ? "must be an object"
    : !isNonEmptyString(n.id) ? '"id" must be a non-empty string'
    : seen.has(n.id as string) ? `duplicate id "${n.id}"`
    : !isNonEmptyString(n.title) ? '"title" must be a non-empty string'
    : n.traces !== undefined && !(Array.isArray(n.traces) && n.traces.every(isNonEmptyString)) ? '"traces" must be an array of non-empty strings'
    : layerChecks[layer](n) ?? rationaleProblem(n.rationale);
}

function parseLayer(layer: string, source: string, file: string): AuthoredLayer {
  const out: AuthoredLayer = { nodes: [], errors: [] };
  const fail = (message: string) => out.errors.push({ file, message });
  let doc: unknown;
  try {
    doc = JSON.parse(source);
  } catch (e) {
    fail(`not valid JSON (${e instanceof Error ? e.message : e})`);
    return out;
  }
  if (!isObject(doc) || !Array.isArray(doc.nodes)) {
    fail('the file must be an object with a "nodes" array');
    return out;
  }
  const seen = new Set<string>();
  const relations = new Map<string, { r: Fields; i: number }[]>(); // architecture: the well-formed relations of each Node, with their place in the file
  for (const [i, n0] of doc.nodes.entries()) {
    let n = n0;
    if (layer === "architecture" && isObject(n) && Array.isArray(n.relations)) {
      const kept: { r: Fields; i: number }[] = [];
      n.relations.forEach((r: unknown, j: number) => {
        const bad = relationProblem(r, j);
        if (bad) fail(`nodes[${i}]: ${bad}`);
        else kept.push({ r: r as Fields, i: j });
      });
      relations.set(n.id as string, kept);
      n = { ...n, relations: kept.map((k) => k.r) };
    }
    const problem = nodeProblem(layer, n, seen);
    if (problem) {
      fail(`nodes[${i}]: ${problem}`);
      continue;
    }
    seen.add((n as Fields).id as string);
    out.nodes.push(n as AuthoredNode);
  }
  if (layer === "architecture") {
    out.nodes = out.nodes.filter((n) => {
      if (n.parent === undefined || seen.has(n.parent as string)) return true;
      fail(`node "${n.id}": "parent" refers to unknown id "${n.parent}"`);
      return false;
    });
    for (const n of out.nodes.filter((n) => n.relations !== undefined)) {
      n.relations = relations.get(n.id)!.filter(({ r, i }) => {
        if (seen.has(r.to as string)) return true;
        fail(`node "${n.id}": "relations[${i}].to" refers to unknown id "${r.to}"`);
        return false;
      }).map((k) => k.r);
    }
  }
  return out;
}

// Reads the files fresh on every call. Only regular files directly inside `<project>/.aidea/` are read.
export function loadAuthored(projectPath: string) {
  const layers: Record<string, AuthoredLayer> = {};
  const errors: { file: string; message: string }[] = [];
  for (const name of Object.keys(layerChecks)) layers[name] = { nodes: [], errors: [] };

  const dir = join(projectPath, ".aidea");
  let entries;
  try {
    if (lstatSync(dir).isSymbolicLink()) return { layers, errors }; // a link could point outside the Project
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { layers, errors }; // no .aidea folder: nothing authored yet
  }
  for (const entry of entries.filter((e) => e.isFile() && e.name.endsWith(".json")).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = `.aidea/${entry.name}`;
    const layer = entry.name.slice(0, -".json".length);
    if (!Object.hasOwn(layerChecks, layer)) {
      errors.push({ file, message: "unknown layer file (expected business, requirements or architecture)" });
      continue;
    }
    const path = join(dir, entry.name);
    if (statSync(path).size > MAX_FILE_BYTES) {
      layers[layer].errors.push({ file, message: "file is larger than 1 MB" });
      continue;
    }
    layers[layer] = parseLayer(layer, readFileSync(path, "utf8"), file);
  }
  return { layers, errors };
}
