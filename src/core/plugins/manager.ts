// The plugin manager of the kernel: installs a plugin from the quarantine. Only the person's confirmation installs; each blocking finding must be named in it.
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { API_VERSION, compatible } from "./manifest.ts";
import type { PluginHost, PluginInfo } from "./host.ts";
import type { PluginState } from "./state.ts";
import type { Quarantine } from "./quarantine.ts";

// The status words every operation of the manager answers with.
export type Status = "applied" | "failed" | "restart-required";

// An error that the route answers with a status code (and, for a missing confirmation, the findings still to confirm).
export class ManagerError extends Error {
  status: number;
  extra: Record<string, unknown>;
  constructor(status: number, message: string, extra: Record<string, unknown> = {}) { super(message); this.status = status; this.extra = extra; }
}

export function createManager(host: PluginHost, quarantine: Quarantine, store: string | undefined, chosen: PluginState) {
  let busy = false; // one change to the plugin store at a time

  // The plugin must exist; a required one cannot be switched off or removed.
  function known(id: string, changing = false) {
    const plugin = host.entry(id);
    if (!plugin) throw new ManagerError(404, "No plugin with that id");
    if (changing && plugin.required) throw new ManagerError(409, `"${id}" ships with aidea and is required: it cannot be switched off or removed`);
    return plugin;
  }
  const refuseInSafeMode = () => { if (host.safe) throw new ManagerError(409, "Safe mode: third-party plugins stay off. Restart aidea without safe mode to use them."); };
  const exclusive = async <T,>(work: () => Promise<T>) => {
    if (busy) throw new ManagerError(409, "Another change to the plugin store is running; try again in a moment");
    busy = true;
    try { return await work(); } finally { busy = false; }
  };

  return {
    // Switches a plugin on; the choice is kept for the next start.
    enable: (id: string) => exclusive(async (): Promise<{ status: Status; plugin?: PluginInfo; reason?: string }> => {
      if (!known(id).builtin) refuseInSafeMode();
      chosen.disabled.delete(id);
      chosen.save();
      await host.activate(id);
      const plugin = host.entry(id)!;
      return plugin.state === "active" ? { status: "applied", plugin } : { status: "failed", plugin, reason: plugin.reason };
    }),
    // Switches a plugin off at once (its undo is total); the choice is kept for the next start.
    disable: (id: string) => exclusive(async (): Promise<{ status: Status; plugin?: PluginInfo }> => {
      known(id, true);
      await host.deactivate(id);
      host.switchedOff(id);
      chosen.disabled.add(id);
      chosen.save();
      return { status: "applied", plugin: host.entry(id) };
    }),
    // Takes a plugin out. Code that already ran in this session stays in memory (Node cannot unload it), so that asks for a restart. The data is kept unless asked.
    remove: (id: string, deleteData = false) => exclusive(async (): Promise<{ status: Status }> => {
      const plugin = known(id, true);
      const ran = host.ran(id);
      const folder = host.folderOf(id);
      await host.unregister(id);
      if (plugin.builtin) chosen.removed.add(id); // the files ship with aidea: they stay, the plugin is simply not loaded any more
      else if (folder) rmSync(folder, { recursive: true, force: true });
      chosen.disabled.delete(id);
      chosen.save();
      if (deleteData && store) rmSync(join(store, ".data", id), { recursive: true, force: true });
      return { status: ran ? "restart-required" : "applied" };
    }),
    async install(qid: string, confirm: string[] = []): Promise<{ status: Status; plugin?: PluginInfo; reason?: string }> {
      if (!store) throw new ManagerError(400, "This core has no plugin store");
      refuseInSafeMode();
      const entry = quarantine.get(qid);
      if (!entry) throw new ManagerError(404, "No quarantine entry with that id");
      const manifest = entry.report.manifest;
      if (!manifest) throw new ManagerError(409, "The manifest of this plugin is invalid, so it cannot be installed");
      if (!compatible(manifest.api)) throw new ManagerError(409, `This plugin asks for API ${manifest.api}; this aidea offers ${API_VERSION}, so it cannot be installed`);
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
