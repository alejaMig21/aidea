// The teaching surface of a plugin that has state of its own (plugin-teaching 04): a view and named checks the Tutor can use (manifest field `teach`, docs/plugin-api.md).
// A plugin the Builder writes cannot be proposed without a valid one; for every other plugin a missing or stale surface is a warning, never a block.
// A plugin with no state of its own (a theme, a guard rule) owes none: its lesson is enough.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Manifest } from "./manifest.ts";

// State of its own: it adds a Panel (an interface half), offers a service or announces events.
export const hasOwnState = (m: Manifest) => !!m.ui || m.provides.length > 0 || Object.keys(m.events).length > 0;

export type SurfaceProblem = { id: "no-surface" | "surface-stale"; message: string };

export function surfaceProblems(dir: string, m: Manifest): SurfaceProblem[] {
  if (!hasOwnState(m)) return [];
  if (!m.teach) return [{ id: "no-surface", message: 'this plugin has state of its own but no teaching surface (a "teach" with a view and named checks), so the Tutor cannot see what the person did in it' }];
  const stale = (message: string): SurfaceProblem[] => [{ id: "surface-stale", message }];
  if (!m.teach.checks.length) return stale('its teaching surface has no checks: add at least one named check the Tutor can run');
  if (!m.teach.module) return stale('its "teach" names no module, so there is no code for the view and the checks');
  const file = join(dir, m.teach.module);
  if (!existsSync(file)) return stale(`its teach module "${m.teach.module}" is missing`);
  const text = readFileSync(file, "utf8");
  const out: SurfaceProblem[] = [];
  if (!/\bview\b/.test(text)) out.push(...stale('the teach module has no "view"'));
  for (const c of m.teach.checks) if (!text.includes(c.name)) out.push(...stale(`the surface names the check "${c.name}", the module no longer has it`));
  return out;
}
