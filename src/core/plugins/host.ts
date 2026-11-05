// The plugin host of the kernel: reads the plugin store, activates the host half of each plugin, and undoes everything a plugin added when it is deactivated.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { registerLanguage } from "../adapters.ts";
import type { LanguageAdapter } from "../adapters.ts";
import { readLesson } from "./lesson.ts";
import type { Lesson } from "./lesson.ts";
import type { Teach } from "./manifest.ts";
import { API_VERSION, compatible, readManifest } from "./manifest.ts";
import type { Manifest } from "./manifest.ts";
import { createPluginState } from "./state.ts";
import type { PluginState as Chosen } from "./state.ts";
import { createMemorySecretStore, createSettings } from "./settings.ts";
import type { Settings } from "./settings.ts";

export type PluginState = "active" | "inactive" | "failed" | "incompatible";
export type PluginInfo = { id: string; title: string; version: string; state: PluginState; reason?: string; ui: boolean; builtin: boolean; required: boolean; settings: boolean; description: string; publisher: string; capabilities: string[] }; // `ui`: it has an interface half; `builtin`: it ships with aidea; `required`: it ships with aidea and cannot be removed or switched off
type Undo = () => unknown;
type Entry = { id: string; folder: string; builtin: boolean; manifest?: Manifest; state: PluginState; reason?: string; undo: Undo[]; returned?: Undo; ran?: boolean; waiting?: boolean }; // `ran`: its code was activated in this session; `returned`: what `activate` returned, run after every other undo

// What an event listener or a guard rule may answer. Only "deny" and "ask" count; anything else, an "allow" included, is ignored (a plugin can only tighten).
export type Verdict = { decision: "allow" } | { decision: "deny"; reason: string } | { decision: "ask"; question: string };

export type AgentToolDeclaration = { name: string; description: string; inputSchema: object; readOnly?: boolean; run: (input: any) => unknown };
export type AgentTool = { plugin: string; name: string; description: string; inputSchema: object; readOnly: boolean };
export type PluginContext = {
  plugin: { id: string; title: string; version: string };
  services: { provide: (key: string, value: unknown) => void; get: (key: string) => unknown };
  // Events: a plugin emits the events its manifest declares (short names), asks with the ones declared as "ask", and listens to any event by its full name `<plugin id>/<name>`.
  emit: (name: string, data?: unknown) => void;
  ask: (name: string, data?: unknown) => Verdict;
  on: (fullName: string, listener: (data: any) => unknown) => void;
  guards: { add: (rule: (action: any) => unknown) => void };
  // Tools for the agents (roles-and-contract 10). Builders get every tool a plugin offers; the Tutor only those declared `readOnly`. A tool that would write in the Project is not offered this way: it makes a Proposal.
  agents: { tools: { add: (tool: AgentToolDeclaration) => void } };
  // The teaching surface: the plugin gives a snapshot of its state, which the view and the checks of its `teach.module` read (plugin-teaching 02).
  teach: { state: (provide: () => unknown) => void };
  // The language slot: a plugin whose manifest declares `language` provides its adapter once (`analyze`, and `flow`, `run` if it has them).
  languages: { provide: (adapter: LanguageAdapter) => void };
  data: { readonly dir: string };
  settings: { get: (key: string) => unknown };
  secrets: { get: (name: string) => string | undefined };
  projects: { path: (id: string) => string | undefined };
  api: { handle: (name: string, fn: (body: any) => unknown) => void };
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

// A plugin is a folder of ES modules, but Node decides how to read a .js file from the nearest package.json, which may be one above the plugin store. The plugin gets its own:
// one is written when it has none; one of its own must already say "type": "module".
function asModule(folder: string) {
  const file = join(folder, "package.json");
  if (!existsSync(file)) { writeFileSync(file, JSON.stringify({ type: "module" })); return; }
  let type: unknown;
  try { type = JSON.parse(readFileSync(file, "utf8")).type; } catch { /* not JSON: treated as not a module */ }
  if (type !== "module") throw new Error('the package.json of the plugin must say "type": "module" (plugins are ES modules)');
}

// `roots` are the folders that hold plugins: the ones that ship with aidea first (builtin), then the person's plugin store.
// `safe`: safe mode, in which no plugin that does not ship with aidea is activated (the person's way back from a plugin that breaks the start).
export function createPluginHost(roots: { dir: string; builtin: boolean }[] = [], chosen: Chosen = createPluginState(), safe = false, access: Settings = createSettings(undefined, createMemorySecretStore())) {
  const entries = new Map<string, Entry>();
  const services = new Map<string, { owner: string; value: unknown }>();
  const logs: { plugin: string; message: string }[] = [];
  const agentTools = new Map<string, AgentTool & { run: (input: any) => unknown }>(); // by the name the agents see: <plugin id>_<name>
  const teachStates = new Map<string, () => unknown>(); // plugin id -> its snapshot of state for the Tutor
  const declared = new Map<string, { owner: string; mode: "announce" | "ask"; version: number }>(); // events of active plugins, by full name
  const listeners = new Map<string, { owner: string; fn: (data: any) => unknown }[]>();
  const rules: { owner: string; fn: (action: any) => unknown }[] = [];
  let projectPath: (id: string) => string | undefined = () => undefined; // set by the core once it holds the open Projects
  const handlers = new Map<string, (body: any) => unknown>(); // "<plugin id>\0<call name>" -> the handler

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
    let provided = false;
    return {
      agents: {
        tools: {
          add: (tool) => {
            if (!tool || typeof tool.name !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(tool.name)) throw new Error('the "name" of an agent tool must be lowercase letters, digits and "_", starting with a letter');
            if (typeof tool.description !== "string" || !tool.description.trim() || tool.description.length > 600) throw new Error(`the agent tool "${tool.name}" needs a description of up to 600 characters`);
            if (!tool.inputSchema || typeof tool.inputSchema !== "object") throw new Error(`the agent tool "${tool.name}" needs an "inputSchema"`);
            if (typeof tool.run !== "function") throw new Error(`the agent tool "${tool.name}" needs a "run" function`);
            const full = `${entry.id.replace(/[^a-z0-9]/g, "_")}_${tool.name}`;
            if (agentTools.has(full)) throw new Error(`the agent tool "${tool.name}" is already offered`);
            agentTools.set(full, { plugin: entry.id, name: full, description: tool.description, inputSchema: tool.inputSchema, readOnly: tool.readOnly === true, run: tool.run });
            entry.undo.push(() => agentTools.delete(full));
          },
        },
      },
      teach: {
        state: (provide) => {
          teachStates.set(entry.id, provide);
          entry.undo.push(() => teachStates.delete(entry.id));
        },
      },
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
      languages: {
        provide: (adapter) => {
          if (!manifest.language) throw new Error('declare "language" in the manifest to provide a language');
          if (provided) throw new Error("the language was already provided");
          provided = true;
          entry.undo.push(registerLanguage(manifest.language, entry.id, adapter));
        },
      },
      // Its own folder for data, its settings (the schema is in its manifest) and, when it declared the "secrets" capability, its secrets. Nothing here leads to another plugin.
      data: { get dir() { return access.dataDir(manifest.id); } },
      settings: { get: (key) => access.get(manifest.id, manifest.settings, key) },
      secrets: {
        get: (name) => {
          if (!manifest.capabilities.includes("secrets")) throw new Error('declare the "secrets" capability in the manifest to read secrets');
          return access.secrets.get(manifest.id, name);
        },
      },
      // The folder of an open Project, by the id the window uses (undefined when it is not open).
      projects: { path: (id) => projectPath(id) },
      // Named calls the interface half (or a test) can make to this plugin: POST /plugins/<id>/call/<name>.
      api: {
        handle: (name, fn) => {
          const key = `${entry.id}\0${name}`;
          if (handlers.has(key)) throw new Error(`the call "${name}" is already handled`);
          handlers.set(key, fn);
          entry.undo.push(() => handlers.delete(key));
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

  async function activateOne(id: string): Promise<Entry | undefined> {
    const entry = entries.get(id);
    if (!entry || !entry.manifest || entry.state === "active") return entry;
    const { main } = entry.manifest;
    if (!compatible(entry.manifest.api)) {
      entry.state = "incompatible";
      entry.reason = `asks for API ${entry.manifest.api}; this aidea offers ${API_VERSION}`;
      return entry;
    }
    const missing = entry.manifest.requires.find((k) => !services.has(k));
    if (missing) { // it waits: it starts by itself when what it needs is there
      entry.state = "inactive";
      entry.waiting = true;
      entry.reason = `needs the service "${missing}"`;
      return entry;
    }
    entry.waiting = false;
    entry.ran = true;
    try {
      for (const [name, d] of Object.entries(entry.manifest.events)) {
        const full = `${entry.id}/${name}`;
        declared.set(full, { owner: entry.id, mode: d.mode, version: d.version });
        entry.undo.push(() => declared.delete(full));
      }
      if (main) {
        const file = join(entry.folder, main);
        if (!existsSync(file)) throw new Error(`the host half "${main}" does not exist`);
        if (!entry.builtin) asModule(entry.folder);
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

  async function deactivateOne(id: string): Promise<Entry | undefined> {
    const entry = entries.get(id);
    if (!entry || entry.state !== "active") return entry;
    await undoAll(entry);
    entry.state = "inactive";
    return entry;
  }

  // Keeps the plugins in step with the services: an active plugin whose requirement went away is switched off (and waits); a waiting plugin whose requirement is back starts.
  async function settle() {
    for (let round = 0; round < 20; round++) {
      let changed = false;
      for (const e of [...entries.values()]) {
        if (!e.manifest) continue;
        const missing = e.manifest.requires.find((k) => !services.has(k));
        if (e.state === "active" && missing) {
          await undoAll(e);
          e.state = "inactive";
          e.waiting = true;
          e.reason = `needs the service "${missing}"`;
          changed = true;
        } else if (e.waiting && e.state === "inactive" && !missing) {
          await activateOne(e.id);
          changed = true;
        }
      }
      if (!changed) break;
    }
  }
  const activate = async (id: string) => { const e = await activateOne(id); await settle(); return e; };
  const deactivate = async (id: string) => { const e = await deactivateOne(id); await settle(); return e; };

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
        if (chosen.removed.has(manifest.id)) continue; // a plugin that ships with aidea and was removed by the person
        if (entries.has(manifest.id)) {
          entries.set(`${name}#${entries.size}`, { id: name, folder, builtin, state: "failed", reason: `the plugin id "${manifest.id}" is already used by another folder`, undo: [] });
          continue;
        }
        entries.set(manifest.id, { id: manifest.id, folder, builtin, manifest, state: "inactive", undo: [] });
      }
    }
    for (const [key, entry] of [...entries]) {
      if (key.includes("#")) continue;
      if (safe && !entry.builtin) { entry.reason = SAFE_MODE; continue; }
      if (chosen.disabled.has(entry.id) && !entry.manifest?.required) { entry.reason = SWITCHED_OFF; continue; }
      await activateOne(entry.id);
    }
    await settle();
  }

  // Adds a plugin folder that was installed after the start, and activates it.
  async function register(folder: string, builtin = false, start = true): Promise<PluginInfo> {
    const read = readManifest(folder);
    if ("problems" in read) throw new Error(read.problems.join("; "));
    const { manifest } = read;
    if (entries.has(manifest.id)) throw new Error(`the plugin "${manifest.id}" is already installed`);
    entries.set(manifest.id, { id: manifest.id, folder, builtin, manifest, state: "inactive", undo: [] });
    if (start) await activate(manifest.id);
    return info(entries.get(manifest.id)!);
  }

  // Takes a plugin out: deactivates it and forgets it. Its folder is not touched here.
  async function unregister(id: string) {
    await deactivate(id);
    entries.delete(id);
  }

  const info = (e: Entry): PluginInfo => ({ required: !!e.manifest?.required && e.builtin, id: e.id, title: e.manifest?.title ?? e.id, version: e.manifest?.version ?? "", state: e.state, ...(e.reason ? { reason: e.reason } : {}), ui: !!e.manifest?.ui, builtin: e.builtin, settings: Object.keys(e.manifest?.settings ?? {}).length > 0, description: e.manifest?.description ?? "", publisher: e.manifest?.publisher ?? "", capabilities: e.manifest?.capabilities ?? [] });

  return {
    loadAll,
    safe,
    // The person switched it off: its reason says so.
    switchedOff: (id: string) => { const e = entries.get(id); if (e) e.reason = SWITCHED_OFF; },
    // An update replaced the files of a plugin whose code already ran: it stays off until aidea restarts.
    markUpdated: (id: string, why: string) => { const e = entries.get(id); if (e) { e.state = "inactive"; e.waiting = false; e.reason = why; } },
    ran: (id: string) => entries.get(id)?.ran === true,
    entry: (id: string) => { const e = entries.get(id); return e && !id.includes("#") ? info(e) : undefined; },
    folderOf: (id: string) => entries.get(id)?.folder,
    activate,
    deactivate,
    register,
    unregister,
    // The settings schema of an installed plugin (for the settings routes).
    schemaOf: (id: string) => (id.includes("#") ? undefined : entries.get(id)?.manifest?.settings),
    has: (id: string) => entries.has(id) && !id.includes("#"),
    list: (): PluginInfo[] => [...entries.values()].map(info),
    // The lessons of the ACTIVE plugins that ship one (plugin-lessons 01), read from their files each time so an update shows. A plugin that is off, removed or has none is absent.
    lessons: (): { id: string; title: string; parts: Lesson["parts"] }[] => [...entries.values()].flatMap((e) => {
      if (e.state !== "active" || !e.manifest?.lesson) return [];
      const read = readLesson(e.folder, e.manifest.lesson);
      return "lesson" in read ? [{ id: e.id, title: e.manifest.title, parts: read.lesson.parts }] : [];
    }),
    // The tools active plugins offer to the agents, as the agents see them (the Tutor asks for `readOnly` ones only).
    agentTools: (readOnly = false): AgentTool[] => [...agentTools.values()].filter((t) => !readOnly || t.readOnly).map(({ run: _run, ...tool }) => tool),
    // Runs one of them. A guard rule of any plugin can refuse it first, as it can refuse any action; a rule that asks refuses too (there is no card for it yet).
    callAgentTool: async (name: string, input: unknown): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> => {
      const tool = agentTools.get(name);
      if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
      const verdict = combine(rules.map((r) => {
        try { return { owner: r.owner, answer: r.fn(structuredClone({ kind: "agent-tool", tool: name, plugin: tool.plugin, input })) }; } catch (e) { return { owner: r.owner, answer: { decision: "ask", question: `The rule of ${r.owner} failed (${reason(e)})` } }; }
      }));
      if (verdict.decision === "deny") return { ok: false, error: `A plugin rule refused this action: ${verdict.reason}` };
      if (verdict.decision === "ask") return { ok: false, error: `A plugin rule needs the person to confirm this action first: ${verdict.question}` };
      try { return { ok: true, value: await tool.run(structuredClone(input)) }; } catch (e) { return { ok: false, error: reason(e) }; }
    },
    // What the Tutor needs to read the view of an ACTIVE plugin or run a check of it (plugin-teaching 02), or the plain reason it cannot.
    teachOf: (id: string): { folder: string; teach: Teach; snapshot: () => unknown } | { problem: string } => {
      const e = entries.get(id);
      if (!e || id.includes("#") || e.state !== "active" || !e.manifest) return { problem: "No installed, enabled plugin has that id." };
      const { teach } = e.manifest;
      if (!teach) return { problem: 'This plugin declares no teaching surface (there is no "teach" in its manifest).' };
      if (!teach.module) return { problem: 'This plugin declares a view but ships no code for it (there is no "module" in its "teach").' };
      return { folder: e.folder, teach, snapshot: () => teachStates.get(id)?.() ?? null };
    },
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
    // What each active plugin declares (for the live inspection).
    details: () => [...entries.values()].filter((e) => e.manifest && e.state === "active").map((e) => ({ id: e.id, title: e.manifest!.title, version: e.manifest!.version, requires: e.manifest!.requires, provides: e.manifest!.provides, capabilities: e.manifest!.capabilities, settings: e.manifest!.settings })),
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
    // Answers a named call to a plugin; undefined when it has no such handler.
    callApi: (id: string, name: string, body: unknown): Promise<unknown> | undefined => {
      const fn = handlers.get(`${id}\0${name}`);
      return fn ? (async () => fn(body))() : undefined;
    },
    useProjects: (fn: (id: string) => string | undefined) => { projectPath = fn; },
    logs: () => logs.slice(),
    // What the plugins registered, to compare before and after (the test tool for plugin authors).
    registry: () => ({ services: [...services.keys()].sort(), events: [...declared.keys()].sort(), listeners: [...listeners.values()].reduce((n, l) => n + l.length, 0), rules: rules.length }),
  };
}

export const SWITCHED_OFF = "switched off by you";
export const SAFE_MODE = "safe mode: third-party plugins are off";
export type PluginHost = ReturnType<typeof createPluginHost>;
