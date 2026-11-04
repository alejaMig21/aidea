// The plugin host of the kernel: reads the plugin store, activates the host half of each plugin, and undoes everything a plugin added when it is deactivated.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readManifest } from "./manifest.ts";
import type { Manifest } from "./manifest.ts";

export type PluginState = "active" | "inactive" | "failed";
export type PluginInfo = { id: string; title: string; version: string; state: PluginState; reason?: string; ui: boolean; builtin: boolean }; // `ui`: it has an interface half; `builtin`: it ships with aidea
type Undo = () => unknown;
type Entry = { id: string; folder: string; builtin: boolean; manifest?: Manifest; state: PluginState; reason?: string; undo: Undo[]; returned?: Undo }; // `returned`: what `activate` returned, run after every other undo

// What an event listener or a guard rule may answer. Only "deny" and "ask" count; anything else, an "allow" included, is ignored (a plugin can only tighten).
export type Verdict = { decision: "allow" } | { decision: "deny"; reason: string } | { decision: "ask"; question: string };

export type PluginContext = {
  plugin: { id: string; title: string; version: string };
  services: { provide: (key: string, value: unknown) => void; get: (key: string) => unknown };
  // Events: a plugin emits the events its manifest declares (short names), asks with the ones declared as "ask", and listens to any event by its full name `<plugin id>/<name>`.
  emit: (name: string, data?: unknown) => void;
  ask: (name: string, data?: unknown) => Verdict;
  on: (fullName: string, listener: (data: any) => unknown) => void;
  guards: { add: (rule: (action: any) => unknown) => void };
  effect: (undo: Undo) => void;
  log: (message: string) => void;
};

// Combines the answers: any deny wins, then any ask, else nobody objected.
function combine(answers: { owner: string; answer: unknown }[]): Verdict {
  const denies: string[] = [], asks: string[] = [];
  for (const { owner, answer } of answers) {
    const a = answer as { decision?: unknown; reason?: unknown; question?: unknown } | null | undefined;
    if (a?.decision === "deny") denies.push(typeof a.reason === "string" ? a.reason : `refused by ${owner}`);
    else if (a?.decision === "ask") asks.push(typeof a.question === "string" ? a.question : `${owner} asks you to confirm`);
  }
  if (denies.length) return { decision: "deny", reason: denies.join("; ") };
  if (asks.length) return { decision: "ask", question: asks.join("; ") };
  return { decision: "allow" };
}

// `roots` are the folders that hold plugins: the ones that ship with aidea first (builtin), then the person's plugin store.
export function createPluginHost(roots: { dir: string; builtin: boolean }[] = []) {
  const entries = new Map<string, Entry>();
  const services = new Map<string, { owner: string; value: unknown }>();
  const logs: { plugin: string; message: string }[] = [];
  const declared = new Map<string, { owner: string; mode: "announce" | "ask"; version: number }>(); // events of active plugins, by full name
  const listeners = new Map<string, { owner: string; fn: (data: any) => unknown }[]>();
  const rules: { owner: string; fn: (action: any) => unknown }[] = [];

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
      emit: (name, data) => {
        const full = ownEvent(entry, name, "announce");
        for (const l of [...(listeners.get(full) ?? [])]) {
          try { l.fn(structuredClone(data)); } catch (e) { logs.push({ plugin: l.owner, message: `listener of ${full} failed: ${reason(e)}` }); }
        }
      },
      ask: (name, data) => {
        const full = ownEvent(entry, name, "ask");
        return combine((listeners.get(full) ?? []).map((l) => {
          try { return { owner: l.owner, answer: l.fn(structuredClone(data)) }; } catch (e) { return { owner: l.owner, answer: { decision: "ask", question: `The plugin ${l.owner} failed answering ${full} (${reason(e)}); go ahead?` } }; }
        }));
      },
      on: (fullName, fn) => {
        const mine = { owner: entry.id, fn };
        listeners.set(fullName, [...(listeners.get(fullName) ?? []), mine]);
        entry.undo.push(() => listeners.set(fullName, (listeners.get(fullName) ?? []).filter((l) => l !== mine)));
      },
      guards: {
        add: (fn) => {
          const rule = { owner: entry.id, fn };
          rules.push(rule);
          entry.undo.push(() => void rules.splice(rules.indexOf(rule), 1));
        },
      },
      effect: (undo) => void entry.undo.push(undo),
      log: (message) => void logs.push({ plugin: entry.id, message }),
    };
  }

  // The full name of an event that `entry` defines, checked: declared in its manifest, in its own namespace, and of the mode the call needs.
  function ownEvent(entry: Entry, name: string, mode: "announce" | "ask") {
    if (name.includes("/")) throw new Error(`"${name}" is in a namespace of its own: a plugin emits only its own events, by their short name`);
    const full = `${entry.id}/${name}`;
    const d = declared.get(full);
    if (!d || d.owner !== entry.id) throw new Error(`the event "${name}" is not declared in the manifest of ${entry.id}`);
    if (d.mode !== mode) throw new Error(mode === "announce" ? `the event "${name}" can ask: use ctx.ask` : `the event "${name}" only announces: use ctx.emit`);
    return full;
  }

  async function activate(id: string): Promise<Entry | undefined> {
    const entry = entries.get(id);
    if (!entry || !entry.manifest || entry.state === "active") return entry;
    const { main } = entry.manifest;
    try {
      for (const [name, d] of Object.entries(entry.manifest.events)) {
        const full = `${entry.id}/${name}`;
        declared.set(full, { owner: entry.id, mode: d.mode, version: d.version });
        entry.undo.push(() => declared.delete(full));
      }
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
    for (const { dir, builtin } of roots) {
      if (!existsSync(dir)) continue;
      const folders = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name).sort();
      for (const name of folders) {
        const folder = join(dir, name);
        const read = readManifest(folder);
        if ("problems" in read) {
          entries.set(`${name}#${entries.size}`, { id: name, folder, builtin, state: "failed", reason: read.problems.join("; "), undo: [] });
          continue;
        }
        const { manifest } = read;
        if (entries.has(manifest.id)) {
          entries.set(`${name}#${entries.size}`, { id: name, folder, builtin, state: "failed", reason: `the plugin id "${manifest.id}" is already used by another folder`, undo: [] });
          continue;
        }
        entries.set(manifest.id, { id: manifest.id, folder, builtin, manifest, state: "inactive", undo: [] });
      }
    }
    for (const [key, entry] of [...entries]) if (!key.includes("#")) await activate(entry.id);
  }

  // Adds a plugin folder that was installed after the start, and activates it.
  async function register(folder: string, builtin = false): Promise<PluginInfo> {
    const read = readManifest(folder);
    if ("problems" in read) throw new Error(read.problems.join("; "));
    const { manifest } = read;
    if (entries.has(manifest.id)) throw new Error(`the plugin "${manifest.id}" is already installed`);
    entries.set(manifest.id, { id: manifest.id, folder, builtin, manifest, state: "inactive", undo: [] });
    await activate(manifest.id);
    return info(entries.get(manifest.id)!);
  }

  // Takes a plugin out: deactivates it and forgets it. Its folder is not touched here.
  async function unregister(id: string) {
    await deactivate(id);
    entries.delete(id);
  }

  const info = (e: Entry): PluginInfo => ({ id: e.id, title: e.manifest?.title ?? e.id, version: e.manifest?.version ?? "", state: e.state, ...(e.reason ? { reason: e.reason } : {}), ui: !!e.manifest?.ui, builtin: e.builtin });

  return {
    loadAll,
    activate,
    deactivate,
    register,
    unregister,
    has: (id: string) => entries.has(id) && !id.includes("#"),
    list: (): PluginInfo[] => [...entries.values()].map(info),
    // The file of the interface half of an ACTIVE plugin, or undefined.
    uiFile: (id: string) => {
      const e = entries.get(id);
      const file = e?.state === "active" && e.manifest?.ui ? join(e.folder, e.manifest.ui) : undefined;
      return file && existsSync(file) ? file : undefined;
    },
    // The window could not activate the interface half: the plugin is switched off and reported.
    markFailed: async (id: string, why: string) => {
      const e = entries.get(id);
      if (!e) return;
      await deactivate(id);
      e.state = "failed";
      e.reason = why;
    },
    services: () => [...services].map(([key, s]) => ({ key, owner: s.owner })),
    eventList: () => [...declared].map(([name, d]) => ({ name, owner: d.owner, mode: d.mode, version: d.version })).sort((a, b) => a.name.localeCompare(b.name)),
    // Calls a function that a plugin provided as a service (the way tests and the kernel reach plugin code).
    callService: (key: string, ...args: unknown[]) => {
      const value = services.get(key)?.value;
      if (typeof value !== "function") throw new Error(`the service "${key}" is not a function`);
      return value(...args);
    },
    // The kernel asks the guard rules of every active plugin about an action. Any deny wins; an ask shows the person the question. A rule that throws makes the person ask.
    guardCheck: (action: unknown): Verdict => combine(rules.map((r) => {
      try { return { owner: r.owner, answer: r.fn(structuredClone(action)) }; } catch (e) { return { owner: r.owner, answer: { decision: "ask", question: `The rule of the plugin ${r.owner} failed (${reason(e)}); allow this action?` } }; }
    })),
    logs: () => logs.slice(),
  };
}

export type PluginHost = ReturnType<typeof createPluginHost>;
