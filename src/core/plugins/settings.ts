// Settings, data folder and secrets of plugins (ticket plugin-system/13).
// - A plugin's settings follow a schema in its manifest; non-secret values live in `<store>/.data/<id>/settings.json`.
// - A secret goes to the secret store, never to a file, a log or an answer. The default store lives in memory (the core runs as a child process of the window and cannot reach the operating
//   system's store); an embedder passes a `secretStore` that does (docs/plugin-api.md). A secret then lasts until aidea closes.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type SettingField = { type: "string" | "number" | "boolean" | "choice" | "secret"; label: string; options?: string[]; default?: string | number | boolean };
export type SecretStore = { get(plugin: string, name: string): string | undefined; set(plugin: string, name: string, value: string): void; delete(plugin: string, name: string): void };
export const SETTING_TYPES = ["string", "number", "boolean", "choice", "secret"];

export function createMemorySecretStore(): SecretStore {
  const secrets = new Map<string, string>();
  return {
    get: (plugin, name) => secrets.get(`${plugin}\0${name}`),
    set: (plugin, name, value) => void secrets.set(`${plugin}\0${name}`, value),
    delete: (plugin, name) => void secrets.delete(`${plugin}\0${name}`),
  };
}

// The problems with a schema as written in a manifest (empty when it is fine).
export function schemaProblems(schema: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const [key, f] of Object.entries(schema)) {
    const field = f as Partial<SettingField> | null;
    if (!field || typeof field !== "object" || Array.isArray(field)) { problems.push(`"settings.${key}" must be an object`); continue; }
    if (!SETTING_TYPES.includes(field.type as string)) problems.push(`"settings.${key}" needs a "type" of: ${SETTING_TYPES.join(", ")}`);
    if (typeof field.label !== "string" || !field.label) problems.push(`"settings.${key}" needs a "label" (the text of its field)`);
    if (field.type === "choice" && (!Array.isArray(field.options) || !field.options.length || field.options.some((o) => typeof o !== "string"))) problems.push(`"settings.${key}" is a choice and needs "options": a list of text`);
    if (field.default !== undefined && checkValue(field as SettingField, field.default)) problems.push(`"settings.${key}" has a "default" that does not fit its type`);
  }
  return problems;
}

// Why `value` does not fit `field`, or undefined when it does.
function checkValue(field: SettingField, value: unknown): string | undefined {
  switch (field.type) {
    case "string": return typeof value === "string" && value.length <= 10_000 ? undefined : "must be text (at most 10000 characters)";
    case "secret": return typeof value === "string" && value.length <= 10_000 ? undefined : "must be text (at most 10000 characters)";
    case "number": return typeof value === "number" && Number.isFinite(value) ? undefined : "must be a number";
    case "boolean": return typeof value === "boolean" ? undefined : "must be true or false";
    case "choice": return typeof value === "string" && field.options?.includes(value) ? undefined : `must be one of: ${field.options?.join(", ")}`;
  }
}

export function createSettings(store: string | undefined, secrets: SecretStore) {
  const dataDir = (id: string) => {
    if (!store) throw new Error("this aidea has no plugin store, so plugins have no data folder");
    const dir = join(store, ".data", id);
    mkdirSync(dir, { recursive: true });
    return dir;
  };
  const saved = (id: string): Record<string, unknown> => {
    if (!store) return {};
    try { return JSON.parse(readFileSync(join(store, ".data", id, "settings.json"), "utf8")) ?? {}; } catch { return {}; }
  };
  return {
    dataDir,
    secrets,
    // The value of one non-secret setting: what was saved, else the default of the schema.
    get(id: string, schema: Record<string, SettingField>, key: string) {
      const field = schema[key];
      if (!field || field.type === "secret") return undefined;
      const value = saved(id)[key];
      return value !== undefined && !checkValue(field, value) ? value : field.default;
    },
    // Everything a form needs: the values with their defaults, a secret only as set or not.
    values(id: string, schema: Record<string, SettingField>) {
      const out: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(schema)) out[key] = field.type === "secret" ? { set: secrets.get(id, key) !== undefined } : this.get(id, schema, key);
      return out;
    },
    // Saves the given values, or none: every value is checked first. A secret is passed to the secret store; an empty one clears it.
    save(id: string, schema: Record<string, SettingField>, given: Record<string, unknown>): { errors: Record<string, string> } | { saved: true } {
      const errors: Record<string, string> = {};
      for (const [key, value] of Object.entries(given)) {
        const field = schema[key];
        if (!field) errors[key] = "this plugin has no such setting";
        else { const why = checkValue(field, value); if (why) errors[key] = why; }
      }
      if (Object.keys(errors).length) return { errors };
      if (!store) return { errors: { "": "this aidea has no plugin store to keep settings in" } };
      const plain = saved(id);
      for (const [key, value] of Object.entries(given)) {
        if (schema[key].type === "secret") { if (value === "") secrets.delete(id, key); else secrets.set(id, key, value as string); } else plain[key] = value;
      }
      const dir = dataDir(id);
      writeFileSync(join(dir, "settings.json.tmp"), JSON.stringify(plain));
      renameSync(join(dir, "settings.json.tmp"), join(dir, "settings.json"));
      return { saved: true };
    },
  };
}
export type Settings = ReturnType<typeof createSettings>;
