// Tells which languages a Project folder holds, by file extension, and how many files of each.
// Dependency and build folders hold copies of code, not the Project's own, so they are not counted (same set as analyze.py).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { hasAdapter } from "./adapters.ts";
import { SKIP_DIRS } from "./typescript-adapter.ts";

const LANGUAGES: Record<string, { label: string; extensions: string[]; owner: string }> = {
  python: { label: "Python", extensions: [".py"], owner: "aidea" },
  typescript: { label: "TypeScript", extensions: [".ts", ".tsx", ".mts", ".cts"], owner: "aidea" },
  javascript: { label: "JavaScript", extensions: [".js", ".jsx", ".mjs", ".cjs"], owner: "aidea" },
};
const byExtension = new Map(Object.entries(LANGUAGES).flatMap(([language, { extensions }]) => extensions.map((e) => [e, language] as const)));

// A language plugin adds its language (language-plugins 01). An id or an extension that is already read by another language is refused, naming who holds it. Returns what takes it away again.
export function addLanguage(id: string, label: string, extensions: string[], owner: string): () => void {
  const exts = extensions.map((e) => e.toLowerCase());
  if (LANGUAGES[id]) throw new Error(`the language "${id}" is already read by ${LANGUAGES[id].owner}`);
  for (const e of exts) if (byExtension.has(e)) throw new Error(`the extension "${e}" is already read by "${byExtension.get(e)}" (${LANGUAGES[byExtension.get(e)!].owner})`);
  LANGUAGES[id] = { label, extensions: exts, owner };
  for (const e of exts) byExtension.set(e, id);
  return () => { delete LANGUAGES[id]; for (const e of exts) byExtension.delete(e); };
}

export const languageOfFile = (file: string) => {
  const language = byExtension.get(file.slice(file.lastIndexOf(".")).toLowerCase());
  return language ? { language, label: LANGUAGES[language].label } : undefined;
};

export type ProjectLanguage = { language: string; label: string; files: number; analysed: boolean };

// Most files first; ties keep the order of LANGUAGES.
export function detectLanguages(root: string): ProjectLanguage[] {
  const counts = new Map<string, number>();
  const walk = (dir: string) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; } // an unreadable folder counts as empty
    for (const e of entries) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(join(dir, e.name)); continue; }
      const language = byExtension.get(e.name.slice(e.name.lastIndexOf(".")).toLowerCase());
      if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
    }
  };
  walk(root);
  return Object.keys(LANGUAGES)
    .filter((language) => counts.has(language))
    .map((language) => ({ language, label: LANGUAGES[language].label, files: counts.get(language)!, analysed: hasAdapter(language) }))
    .sort((a, b) => b.files - a.files);
}
