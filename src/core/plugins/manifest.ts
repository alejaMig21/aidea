// The manifest of a plugin, `aidea-plugin.json`: static metadata read without running any code. The rules are those of docs/plugin-api.md.
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import { readLesson } from "./lesson.ts";
import { schemaProblems } from "./settings.ts";
import type { SettingField } from "./settings.ts";

export const API_VERSION = "0.1";
// Whether this aidea can run a plugin that asks for `api` (docs/plugin-api.md): before 1.0 only the exact version; from 1.0 the same major and a minor that is not newer.
export function compatible(api: string): boolean {
  const [pm, pn] = api.split(".").map(Number), [km, kn] = API_VERSION.split(".").map(Number);
  return km === 0 ? pm === km && pn === kn : pm === km && pn <= kn;
}
export const CAPABILITIES = ["network", "files", "processes", "window", "secrets"] as const;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_ICON_BYTES = 256 * 1024;

export type EventDeclaration = { mode: "announce" | "ask"; version: number };
// The teaching surface (plugin-teaching 01): the name of a read-only view of the plugin's state and named checks the Tutor can run, each with one plain sentence and optional arguments.
export type TeachCheck = { name: string; says: string; args?: Record<string, "string" | "number" | "boolean"> };
export type Teach = { view: string; checks: TeachCheck[] };
export type Manifest = {
  id: string; version: string; title: string; description: string; publisher: string; api: string;
  main?: string; ui?: string; icon?: string; lesson?: string; teach?: Teach;
  capabilities: string[]; requires: string[]; provides: string[];
  events: Record<string, EventDeclaration>;
  settings: Record<string, SettingField>;
  required: boolean;
};

const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);

// A path inside the plugin folder: relative, no `..`, and (when the file exists) no link that leaves the folder.
function inside(dir: string, rel: unknown): string | null {
  if (typeof rel !== "string" || !rel || isAbsolute(rel) || /^[a-zA-Z]:/.test(rel) || rel.split(/[\\/]/).includes("..")) return null;
  const target = resolve(dir, rel);
  if (target !== dir && !target.startsWith(dir + sep)) return null;
  try {
    lstatSync(target);
    const real = realpathSync(target), root = realpathSync(dir);
    if (real !== root && !real.startsWith(root + sep)) return null;
  } catch { /* a file that does not exist is reported where it is used */ }
  return rel;
}

const NAME = /^[a-z][a-z0-9-]{0,39}$/;
// The problems of a `teach` field, each naming the field.
function teachProblems(t: unknown): string[] {
  if (!t || typeof t !== "object" || Array.isArray(t)) return ['"teach" must be an object with a "view" and a list of "checks"'];
  const { view, checks } = t as Record<string, unknown>;
  const out: string[] = [];
  if (typeof view !== "string" || !NAME.test(view)) out.push('"teach" "view" must be a short name of lowercase letters, digits and "-"');
  if (!Array.isArray(checks) || checks.length > 20) return [...out, '"teach" "checks" must be a list of at most 20 checks'];
  const seen = new Set<string>();
  for (const c of checks as Record<string, unknown>[]) {
    const name = c && typeof c.name === "string" ? c.name : "";
    if (!NAME.test(name)) { out.push('"teach" "checks": every check needs a "name" of lowercase letters, digits and "-"'); continue; }
    if (seen.has(name)) out.push(`"teach" check "${name}" is listed twice`);
    seen.add(name);
    if (!isText(c.says, 160)) out.push(`"teach" check "${name}": "says" must be one plain sentence of up to 160 characters`);
    const args = c.args;
    if (args === undefined) continue;
    const entries = args && typeof args === "object" && !Array.isArray(args) ? Object.entries(args) : null;
    if (!entries || entries.length > 5) out.push(`"teach" check "${name}": "args" must be an object of up to 5 arguments`);
    else for (const [a, shape] of entries) if (!NAME.test(a) || !["string", "number", "boolean"].includes(shape as string)) out.push(`"teach" check "${name}": "args" "${a}" must be "string", "number" or "boolean"`);
  }
  return out;
}

export function readManifest(dir: string): { manifest: Manifest } | { problems: string[] } {
  const file = join(dir, "aidea-plugin.json");
  let raw: unknown;
  try {
    if (lstatSync(file).size > MAX_MANIFEST_BYTES) return { problems: ["aidea-plugin.json is larger than 64 KiB"] };
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { problems: [(e as NodeJS.ErrnoException).code === "ENOENT" ? "aidea-plugin.json is missing" : "aidea-plugin.json is not valid JSON"] };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { problems: ["aidea-plugin.json must be a JSON object"] };
  const m = raw as Record<string, unknown>;
  const problems: string[] = [];
  if (typeof m.id !== "string" || !/^[a-z][a-z0-9.-]{2,63}$/.test(m.id)) problems.push('"id" must be 3 to 64 characters of lowercase letters, digits, "-" and ".", starting with a letter');
  if (typeof m.version !== "string" || !/^\d+\.\d+\.\d+$/.test(m.version)) problems.push('"version" must look like 1.2.3');
  if (!isText(m.title, 60)) problems.push('"title" must be text of up to 60 characters');
  if (!isText(m.description, 200)) problems.push('"description" must be text of up to 200 characters');
  if (!isText(m.publisher, 80)) problems.push('"publisher" must be text of up to 80 characters');
  if (typeof m.api !== "string" || !/^\d+\.\d+$/.test(m.api)) problems.push('"api" must be a version like "0.1"');
  for (const field of ["main", "ui", "icon", "lesson"] as const) if (m[field] !== undefined && inside(dir, m[field]) === null) problems.push(`"${field}" must be a path inside the plugin folder`);
  if (m.lesson !== undefined && !problems.some((p) => p.startsWith('"lesson"'))) {
    const read = readLesson(dir, m.lesson as string); // a lesson that does not have the shape refuses the plugin, with the field named
    if ("problems" in read) problems.push(...read.problems);
  }
  if (m.main === undefined && m.ui === undefined) problems.push('the plugin needs a "main" or a "ui" half');
  if (m.capabilities !== undefined && (!isList(m.capabilities) || m.capabilities.some((c) => !(CAPABILITIES as readonly string[]).includes(c)))) problems.push(`"capabilities" must be a list of: ${CAPABILITIES.join(", ")}`);
  for (const field of ["requires", "provides"] as const) if (m[field] !== undefined && !isList(m[field])) problems.push(`"${field}" must be a list of service keys`);
  if (m.events !== undefined) {
    const e = m.events as Record<string, any>;
    if (!e || typeof e !== "object" || Array.isArray(e) || Object.values(e).some((d) => !d || (d.mode !== "announce" && d.mode !== "ask") || !Number.isInteger(d.version))) problems.push('"events" must map each event name to { "mode": "announce" or "ask", "version": a whole number }');
  }
  if (m.settings !== undefined && (!m.settings || typeof m.settings !== "object" || Array.isArray(m.settings))) problems.push('"settings" must be an object');
  else if (m.settings !== undefined) problems.push(...schemaProblems(m.settings as Record<string, unknown>));
  if (m.teach !== undefined) problems.push(...teachProblems(m.teach));
  if (m.required !== undefined && typeof m.required !== "boolean") problems.push('"required" must be true or false');
  if (m.icon !== undefined && !problems.some((p) => p.startsWith('"icon"'))) {
    try { if (lstatSync(join(dir, m.icon as string)).size > MAX_ICON_BYTES) problems.push('"icon" is larger than 256 KiB'); } catch { /* a missing icon is only a missing picture */ }
  }
  if (problems.length) return { problems };
  return {
    manifest: {
      id: m.id as string, version: m.version as string, title: m.title as string, description: m.description as string, publisher: m.publisher as string, api: m.api as string,
      main: m.main as string | undefined, ui: m.ui as string | undefined, icon: m.icon as string | undefined, lesson: m.lesson as string | undefined, teach: m.teach as Teach | undefined,
      capabilities: (m.capabilities as string[]) ?? [], requires: (m.requires as string[]) ?? [], provides: (m.provides as string[]) ?? [],
      events: (m.events as Record<string, EventDeclaration>) ?? {}, settings: (m.settings as Record<string, SettingField>) ?? {}, required: m.required === true,
    },
  };
}
