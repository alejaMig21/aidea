// Tells which languages a Project folder holds, by file extension, and how many files of each.
// Dependency and build folders hold copies of code, not the Project's own, so they are not counted (same set as analyze.py).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { hasAdapter } from "./adapters.ts";

const LANGUAGES: Record<string, { label: string; extensions: string[] }> = {
  python: { label: "Python", extensions: [".py"] },
  typescript: { label: "TypeScript", extensions: [".ts", ".tsx", ".mts", ".cts"] },
  javascript: { label: "JavaScript", extensions: [".js", ".jsx", ".mjs", ".cjs"] },
};
const byExtension = new Map(Object.entries(LANGUAGES).flatMap(([language, { extensions }]) => extensions.map((e) => [e, language] as const)));
const SKIP_DIRS = new Set(["__pycache__", "venv", "env", "node_modules", "dist", "build", "site-packages"]);

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
