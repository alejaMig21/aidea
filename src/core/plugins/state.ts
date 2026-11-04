// What the person chose about the plugins, kept in the plugin store (`.state.json`): which are switched off and which of the ones that ship with aidea were removed.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function createPluginState(store?: string) {
  const file = store ? join(store, ".state.json") : undefined;
  const disabled = new Set<string>(), removed = new Set<string>();
  try {
    if (file) {
      const saved = JSON.parse(readFileSync(file, "utf8"));
      for (const id of Array.isArray(saved?.disabled) ? saved.disabled : []) if (typeof id === "string") disabled.add(id);
      for (const id of Array.isArray(saved?.removed) ? saved.removed : []) if (typeof id === "string") removed.add(id);
    }
  } catch { /* no file yet, or one we cannot read: start empty; the next change rewrites it */ }
  return {
    disabled,
    removed,
    save() {
      if (!file) return;
      try {
        mkdirSync(store!, { recursive: true });
        writeFileSync(file + ".tmp", JSON.stringify({ disabled: [...disabled], removed: [...removed] }));
        renameSync(file + ".tmp", file);
      } catch (e) { console.error(e); } // a choice that cannot be saved must not break aidea
    },
  };
}

export type PluginState = ReturnType<typeof createPluginState>;
