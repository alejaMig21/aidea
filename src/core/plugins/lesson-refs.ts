// What a lesson part may name in `refs` (plugin-lessons 03), and how each is looked up in what the plugin declares:
// the plugin's own id; `view`; `panel:<id>` (the interface file adds a Panel with that id); `setting:<key>`; `service:<key>` (provides); `event:<name>`; `check:<name>`; `capability:<name>`.
// The check proves only that the names still exist, never that the prose is right.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readLesson } from "./lesson.ts";
import type { Manifest } from "./manifest.ts";

export function lessonFindings(dir: string, manifest: Manifest): string[] {
  if (!manifest.lesson) return [];
  const read = readLesson(dir, manifest.lesson);
  if (!("lesson" in read)) return []; // a lesson with the wrong shape already refuses the plugin
  let ui = "";
  try { ui = manifest.ui ? readFileSync(join(dir, manifest.ui), "utf8") : ""; } catch { /* no interface file: no Panel */ }
  const has: Record<string, (name: string) => boolean> = {
    setting: (k) => k in manifest.settings,
    service: (k) => manifest.provides.includes(k),
    event: (k) => k in manifest.events,
    check: (k) => !!manifest.teach?.checks.some((c) => c.name === k),
    capability: (k) => manifest.capabilities.includes(k),
    panel: (k) => [`id: "${k}"`, `id:"${k}"`, `id: '${k}'`, `id:'${k}'`].some((s) => ui.includes(s)), // as the interface file writes the entry of layout.panel
  };
  const problems: string[] = [];
  for (const ref of new Set(read.lesson.parts.flatMap((p) => p.refs))) {
    if (ref === manifest.id || (ref === "view" && manifest.teach)) continue;
    const m = /^(setting|service|event|check|capability|panel):(.+)$/.exec(ref);
    if (!m) problems.push(`the lesson names "${ref}", which aidea does not know how to check (use the plugin id, "view", or setting:, service:, event:, check:, capability:, panel: and a name)`);
    else if (!has[m[1]](m[2])) problems.push(`the lesson names "${ref}", the plugin no longer has it`);
  }
  return problems;
}
