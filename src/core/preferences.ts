import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// What the person picked for the builder of one Project. Ids are the adapter's own.
export type Choice = { mode: string; model: string; tutorModel: string };
// classMode: "class" holds the builder at a Blocking decision until a decision class is answered; absent means "direct".
// reviewQuestion: false turns off the review question at the start of a class; absent means on.
// editor: an id from editors.ts or "custom"; editorTemplate: the command the person typed for "custom". Absent editor means VS Code.
export type Stored = Partial<Choice> & { classMode?: "class" | "direct"; reviewQuestion?: boolean; editor?: string; editorTemplate?: string; layout?: Record<string, unknown> };
export type Preferences = {
  // The stored choice for a Project (any field may be missing, or no longer offered by the adapter).
  get: (project: string) => Stored;
  set: (project: string, choice: Stored) => void;
};

// Remembers the choice per Project, outside any Project. Without a file it lives in memory only.
export function createPreferences(file?: string): Preferences {
  let saved: Record<string, Stored> = {};
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
