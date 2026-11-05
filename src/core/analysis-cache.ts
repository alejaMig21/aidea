// The analysis of a Project, kept between openings (big-projects 01). An adapter that can say what its analysis depends on (`signature`: the
// files it reads and the analyzer's own code) lets the core skip the analysis when nothing changed. The entries live in the person's own folder
// (`cacheDir`), never inside the Project, one per Project path. A missing, damaged or unwritable cache is never an error: the analysis just runs.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Analysis, LanguageAdapter } from "./adapters.ts";

export async function cachedAnalysis(cacheDir: string | undefined, projectPath: string, adapter: LanguageAdapter): Promise<Analysis> {
  if (!cacheDir || !adapter.signature) return adapter.analyze(projectPath);
  let signature: string;
  try {
    signature = adapter.signature(projectPath);
  } catch {
    return adapter.analyze(projectPath);
  }
  const file = join(cacheDir, "analysis", `${createHash("sha1").update(projectPath).digest("hex").slice(0, 20)}.json`);
  try {
    const kept = JSON.parse(readFileSync(file, "utf8")) as { signature?: string; analysis?: Analysis };
    if (kept.signature === signature && kept.analysis) return kept.analysis;
  } catch { /* no entry, or a damaged one: analyse */ }
  const analysis = await adapter.analyze(projectPath);
  try {
    mkdirSync(join(cacheDir, "analysis"), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ signature, analysis }));
    renameSync(tmp, file); // an entry is whole or absent, never half written
  } catch { /* the cache cannot be written: the Project still opens */ }
  return analysis;
}
