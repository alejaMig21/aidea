// The test tool for plugin authors (ticket plugin-system/17): boots the real plugin host with ONE plugin, activates it, deactivates it, activates it again, and reports
// every registry or running handle that is not back to where it started, plus the contract of each kind of plugin it finds (Panel, guard rule).
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createPluginHost } from "./host.ts";
import { readManifest } from "./manifest.ts";

export type PluginCheck = { ok: boolean; id: string; kinds: ("panel" | "guard")[]; problems: string[] };

// Handles a plugin can leave running; the count of each kind may not grow over a deactivate.
const HANDLES = ["Timeout", "Immediate", "TCPServerWrap"];
const handles = () => {
  const count: Record<string, number> = {};
  for (const name of process.getActiveResourcesInfo()) if (HANDLES.includes(name)) count[name] = (count[name] ?? 0) + 1;
  return count;
};
const PROBE = { tool: "Read", input: { file_path: "probe.txt" } }; // an ordinary action, to ask the guard rules about

export async function checkPlugin(folder: string): Promise<PluginCheck> {
  const problems: string[] = [];
  const kinds: PluginCheck["kinds"] = [];
  const read = readManifest(folder);
  if ("problems" in read) return { ok: false, id: basename(folder), kinds, problems: read.problems.map((p) => `invalid manifest: ${p}`) };
  const { manifest } = read;

  // The plugin runs from a copy in a store of its own, so the host loads it and nothing else.
  const store = mkdtempSync(join(tmpdir(), "aidea-testkit-store-"));
  cpSync(folder, join(store, basename(folder)), { recursive: true });
  const host = createPluginHost([{ dir: store, builtin: false }]);
  try {
    const baseline = { registry: JSON.stringify(host.registry()), handles: handles() };
    await host.loadAll();
    if (host.entry(manifest.id)?.state !== "active") return { ok: false, id: manifest.id, kinds, problems: [`did not activate: ${host.entry(manifest.id)?.reason ?? "unknown reason"}`] };

    if (manifest.ui) {
      kinds.push("panel");
      const file = join(folder, manifest.ui);
      if (!existsSync(file)) problems.push(`Panel contract: the interface half "${manifest.ui}" does not exist`);
      else if (!/export\s+(async\s+)?function\s+activate\b|export\s*\{[^}]*\bactivate\b/.test(readFileSync(file, "utf8"))) problems.push(`Panel contract: the interface half "${manifest.ui}" must export an activate function`);
    }
    if (host.registry().rules > 0) {
      kinds.push("guard");
      const verdict = host.guardCheck(PROBE);
      if (verdict.decision === "ask" && /failed \(/.test(verdict.question)) problems.push(`guard rule contract: a rule threw on an ordinary action (${verdict.question})`);
    }

    // Two rounds: a registry that is not undone on the second round shows only there.
    for (const round of [1, 2]) {
      await host.deactivate(manifest.id);
      const now = JSON.stringify(host.registry());
      if (now !== baseline.registry) problems.push(`leak after deactivate (round ${round}): registries ${now}, expected ${baseline.registry}`);
      const after = handles();
      for (const name of HANDLES) if ((after[name] ?? 0) > (baseline.handles[name] ?? 0)) problems.push(`leak after deactivate (round ${round}): ${(after[name] ?? 0) - (baseline.handles[name] ?? 0)} ${name} still running`);
      if (round === 1) {
        await host.activate(manifest.id);
        if (host.entry(manifest.id)?.state !== "active") { problems.push(`did not activate again: ${host.entry(manifest.id)?.reason ?? "unknown reason"}`); break; }
      }
    }
  } catch (e) {
    problems.push(`the check itself failed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    rmSync(store, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  return { ok: problems.length === 0, id: manifest.id, kinds, problems };
}
