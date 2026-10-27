import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";

const MAX_RECENTS = 20;

export type Recents = {
  list: () => { path: string; name: string; openedAt: string; available: boolean }[];
  add: (path: string) => void;
  forget: (path: string) => void;
};

type Entry = { path: string; openedAt: string };

// Remembers the Projects the person opened, newest first. Without a file the list lives in memory only.
export function createRecents(file?: string): Recents {
  let entries: Entry[] = [];
  try {
    if (file) {
      const saved = JSON.parse(readFileSync(file, "utf8"));
      if (Array.isArray(saved)) entries = saved.filter((e) => typeof e?.path === "string" && typeof e?.openedAt === "string");
    }
  } catch {
    // Missing or unreadable file: start empty; the next change rewrites it.
  }

  const save = () => {
    if (!file) return;
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file + ".tmp", JSON.stringify(entries));
      renameSync(file + ".tmp", file);
    } catch (e) {
      console.error(e); // A list that cannot be saved must not break opening a Project.
    }
  };

  return {
    list: () =>
      entries.map((e) => ({
        ...e,
        name: basename(e.path),
        available: statSync(e.path, { throwIfNoEntry: false })?.isDirectory() === true,
      })),
    add: (path) => {
      entries = [{ path, openedAt: new Date().toISOString() }, ...entries.filter((e) => e.path !== path)].slice(0, MAX_RECENTS);
      save();
    },
    forget: (path) => {
      entries = entries.filter((e) => e.path !== path);
      save();
    },
  };
}
