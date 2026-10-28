import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// What the person picked for the builder of one Project. Ids are the adapter's own.
export type Choice = { mode: string; model: string; tutorModel: string };
export type Preferences = {
  // The stored choice for a Project (any field may be missing, or no longer offered by the adapter).
  get: (project: string) => Partial<Choice>;
  set: (project: string, choice: Partial<Choice>) => void;
};

// Remembers the choice per Project, outside any Project. Without a file it lives in memory only.
export function createPreferences(file?: string): Preferences {
  let saved: Record<string, Partial<Choice>> = {};
  try {
    if (file) {
      const read = JSON.parse(readFileSync(file, "utf8"));
      if (read && typeof read === "object" && !Array.isArray(read)) saved = read;
    }
  } catch {
    // Missing or unreadable file: start empty; the next change rewrites it.
  }
  return {
    get: (project) => saved[project] ?? {},
    set: (project, choice) => {
      saved[project] = { ...saved[project], ...choice };
      if (!file) return;
      try {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file + ".tmp", JSON.stringify(saved));
        renameSync(file + ".tmp", file);
      } catch (e) {
        console.error(e); // A choice that cannot be saved must not break the conversation.
      }
    },
  };
}
