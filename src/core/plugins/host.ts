// The plugin host of the kernel: reads the plugin store, activates the host half of each plugin, and undoes everything a plugin added when it is deactivated.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readManifest } from "./manifest.ts";
import type { Manifest } from "./manifest.ts";

export type PluginState = "active" | "inactive" | "failed";
export type PluginInfo = { id: string; title: string; version: string; state: PluginState; reason?: string };
type Undo = () => unknown;
type Entry = { id: string; folder: string; manifest?: Manifest; state: PluginState; reason?: string; undo: Undo[]; returned?: Undo }; // `returned`: what `activate` returned, run after every other undo

export type PluginContext = {
  plugin: { id: string; title: string; version: string };
  services: { provide: (key: string, value: unknown) => void; get: (key: string) => unknown };
  effect: (undo: Undo) => void;
  log: (message: string) => void;
};

export function createPluginHost(dir?: string) {
  const entries = new Map<string, Entry>();
  const services = new Map<string, { owner: string; value: unknown }>();
  const logs: { plugin: string; message: string }[] = [];

  const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

  async function undoAll(entry: Entry) {
    const all = [...entry.undo.splice(0).reverse(), ...(entry.returned ? [entry.returned] : [])];
    entry.returned = undefined;
    for (const undo of all) {
      try { await undo(); } catch (e) { logs.push({ plugin: entry.id, message: `undo failed: ${reason(e)}` }); }
    }
  }

  function contextFor(entry: Entry): PluginContext {
    const manifest = entry.manifest!;
    return {
      plugin: { id: manifest.id, title: manifest.title, version: manifest.version },
      services: {
        provide: (key, value) => {
          if (services.has(key)) throw new Error(`the service "${key}" is already provided by ${services.get(key)!.owner}`);
          services.set(key, { owner: entry.id, value });
          entry.undo.push(() => services.delete(key));
        },
        get: (key) => services.get(key)?.value,
      },
      effect: (undo) => void entry.undo.push(undo),
      log: (message) => void logs.push({ plugin: entry.id, message }),
    };
  }

  async function activate(id: string): Promise<Entry | undefined> {
    const entry = entries.get(id);
    if (!entry || !entry.manifest || entry.state === "active") return entry;
    const { main } = entry.manifest;
    try {
      if (main) {
        const file = join(entry.folder, main);
        if (!existsSync(file)) throw new Error(`the host half "${main}" does not exist`);
        const mod = await import(pathToFileURL(file).href);
        if (typeof mod.activate !== "function") throw new Error('the host half must export an "activate" function');
        const returned = await mod.activate(contextFor(entry));
        if (typeof returned === "function") entry.returned = returned;
      }
      entry.state = "active";
      delete entry.reason;
    } catch (e) {
      await undoAll(entry);
      entry.state = "failed";
      entry.reason = reason(e);
    }
    return entry;
  }

  async function deactivate(id: string): Promise<Entry | undefined> {
    const entry = entries.get(id);
    if (!entry || entry.state !== "active") return entry;
    await undoAll(entry);
    entry.state = "inactive";
    return entry;
  }

  async function loadAll() {
    if (!dir || !existsSync(dir)) return;
    const folders = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name).sort();
    for (const name of folders) {
      const folder = join(dir, name);
      const read = readManifest(folder);
      if ("problems" in read) {
        entries.set(name, { id: name, folder, state: "failed", reason: read.problems.join("; "), undo: [] });
        continue;
      }
      const { manifest } = read;
      if (entries.has(manifest.id)) {
        entries.set(`${name}#duplicate`, { id: name, folder, state: "failed", reason: `the plugin id "${manifest.id}" is already used by another folder`, undo: [] });
        continue;
      }
      entries.set(manifest.id, { id: manifest.id, folder, manifest, state: "inactive", undo: [] });
    }
    for (const id of [...entries.keys()]) await activate(id);
  }

  return {
    loadAll,
    activate,
    deactivate,
    has: (id: string) => entries.has(id) && !id.includes("#"),
    list: (): PluginInfo[] => [...entries.values()].map((e) => ({ id: e.id, title: e.manifest?.title ?? e.id, version: e.manifest?.version ?? "", state: e.state, ...(e.reason ? { reason: e.reason } : {}) })),
    services: () => [...services].map(([key, s]) => ({ key, owner: s.owner })),
    logs: () => logs.slice(),
  };
}

export type PluginHost = ReturnType<typeof createPluginHost>;
