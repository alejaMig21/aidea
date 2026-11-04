// The plugin manager of the kernel: installs a plugin from the quarantine. Only the person's confirmation installs; each blocking finding must be named in it.
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { PluginHost, PluginInfo } from "./host.ts";
import type { Quarantine } from "./quarantine.ts";

// The status words every operation of the manager answers with.
export type Status = "applied" | "failed" | "restart-required";

// An error that the route answers with a status code (and, for a missing confirmation, the findings still to confirm).
export class ManagerError extends Error {
  status: number;
  extra: Record<string, unknown>;
  constructor(status: number, message: string, extra: Record<string, unknown> = {}) { super(message); this.status = status; this.extra = extra; }
}

export function createManager(host: PluginHost, quarantine: Quarantine, store?: string) {
  let busy = false; // one change to the plugin store at a time

  return {
    async install(qid: string, confirm: string[] = []): Promise<{ status: Status; plugin?: PluginInfo; reason?: string }> {
      if (!store) throw new ManagerError(400, "This core has no plugin store");
      const entry = quarantine.get(qid);
      if (!entry) throw new ManagerError(404, "No quarantine entry with that id");
      const manifest = entry.report.manifest;
      if (!manifest) throw new ManagerError(409, "The manifest of this plugin is invalid, so it cannot be installed");
      const missing = entry.report.findings.filter((f) => f.severity === "block" && !confirm.includes(f.key)).map((f) => f.key);
      if (missing.length) throw new ManagerError(409, "Each blocking finding must be confirmed by name", { missing });
      const target = join(store, manifest.id);
      if (host.has(manifest.id) || existsSync(target)) throw new ManagerError(409, `The plugin "${manifest.id}" is already installed`);
      if (busy) throw new ManagerError(409, "Another change to the plugin store is running; try again in a moment");
      busy = true;
      try {
        try {
          cpSync(quarantine.folder(qid)!, target, { recursive: true });
          const info = await host.register(target);
          if (info.state !== "active") {
            await host.unregister(manifest.id);
            rmSync(target, { recursive: true, force: true });
            return { status: "failed", reason: info.reason ?? "the plugin did not activate" };
          }
          quarantine.discard(qid);
          return { status: "applied", plugin: info };
        } catch (e) {
          await host.unregister(manifest.id).catch(() => {});
          rmSync(target, { recursive: true, force: true }); // the store is as it was
          return { status: "failed", reason: e instanceof Error ? e.message : String(e) };
        }
      } finally { busy = false; }
    },
  };
}

export type Manager = ReturnType<typeof createManager>;
