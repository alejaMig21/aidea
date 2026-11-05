// Tells which languages a Project folder holds, by file extension, and how many files of each.
// Dependency and build folders hold copies of code, not the Project's own, so they are not counted (same set as analyze.py).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { hasAdapter } from "./adapters.ts";
import { SKIP_DIRS } from "./typescript-adapter.ts";

const LANGUAGES: Record<string, { label: string; extensions: string[]; owner: string }> = {
  python: { label: "Python", extensions: [".py"], owner: "aidea" }, // see builtInPython
  typescript: { label: "TypeScript", extensions: [".ts", ".tsx", ".mts", ".cts"], owner: "aidea" },
  javascript: { label: "JavaScript", extensions: [".js", ".jsx", ".mjs", ".cjs"], owner: "aidea" },
};
const SHIPPED = ["python", "typescript", "javascript"];
const byExtension = new Map(Object.entries(LANGUAGES).flatMap(([language, { extensions }]) => extensions.map((e) => [e, language] as const)));

// Languages that aidea knows by name and no plugin reads (language-plugins 04): a Project in one of them says so instead of looking empty. A language plugin that claims the same id or
// extensions replaces the name; the names never block a plugin.
const NAMED: Record<string, { label: string; extensions: string[] }> = {
  python: { label: "Python", extensions: [".py"] }, // read by the Python plugin; named here for when it is switched off
  r: { label: "R", extensions: [".r"] },
  rust: { label: "Rust", extensions: [".rs"] },
  go: { label: "Go", extensions: [".go"] },
  java: { label: "Java", extensions: [".java"] },
  csharp: { label: "C#", extensions: [".cs"] },
  c: { label: "C", extensions: [".c", ".h"] },
  cpp: { label: "C++", extensions: [".cpp", ".cc", ".hpp"] },
  ruby: { label: "Ruby", extensions: [".rb"] },
  php: { label: "PHP", extensions: [".php"] },
  swift: { label: "Swift", extensions: [".swift"] },
  kotlin: { label: "Kotlin", extensions: [".kt"] },
};
const namedByExtension = new Map(Object.entries(NAMED).flatMap(([language, { extensions }]) => extensions.map((e) => [e, language] as const)));
const idOf = (ext: string) => byExtension.get(ext) ?? namedByExtension.get(ext);
const labelOf = (id: string) => LANGUAGES[id]?.label ?? NAMED[id].label;

// A language plugin adds its language (language-plugins 01). An id or an extension that is already read by another language is refused, naming who holds it. Returns what takes it away again.
export function addLanguage(id: string, label: string, extensions: string[], owner: string): () => void {
  const exts = extensions.map((e) => e.toLowerCase());
  if (LANGUAGES[id]) throw new Error(`the language "${id}" is already read by ${LANGUAGES[id].owner}`);
  for (const e of exts) if (byExtension.has(e)) throw new Error(`the extension "${e}" is already read by "${byExtension.get(e)}" (${LANGUAGES[byExtension.get(e)!].owner})`);
  LANGUAGES[id] = { label, extensions: exts, owner };
  for (const e of exts) byExtension.set(e, id);
  return () => { delete LANGUAGES[id]; for (const e of exts) byExtension.delete(e); };
}

// Python ships as a plugin (src/plugins/python); builtInPython (adapters.ts) uses these two to hand the language to the plugin or take it back.
export const languageOwner = (id: string) => LANGUAGES[id]?.owner;
export function giveUpLanguage(id: string) {
  const held = LANGUAGES[id];
  if (!held) return;
  delete LANGUAGES[id];
  for (const e of held.extensions) byExtension.delete(e);
}

export const languageOfFile = (file: string) => {
  const language = idOf(file.slice(file.lastIndexOf(".")).toLowerCase());
  return language ? { language, label: labelOf(language) } : undefined;
};

export type ProjectLanguage = { language: string; label: string; files: number; analysed: boolean };

// Most files first; ties keep the order of the languages that ship with aidea, then of the plugins' (a plugin owns Python now, so LANGUAGES alone would put it after them).
export function detectLanguages(root: string): ProjectLanguage[] {
  const counts = new Map<string, number>();
  const walk = (dir: string) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; } // an unreadable folder counts as empty
    for (const e of entries) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(join(dir, e.name)); continue; }
      const language = idOf(e.name.slice(e.name.lastIndexOf(".")).toLowerCase());
      if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
    }
  };
  walk(root);
  return [...new Set([...SHIPPED, ...Object.keys(LANGUAGES), ...Object.keys(NAMED)])]
    .filter((language) => counts.has(language))
    .map((language) => ({ language, label: labelOf(language), files: counts.get(language)!, analysed: hasAdapter(language) }))
    .sort((a, b) => b.files - a.files);
}
