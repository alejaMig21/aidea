import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const MAX_RECENTS = 20;

export type Recents = {
  list: () => { path: string; name: string; openedAt: string; available: boolean }[];
  add: (path: string) => void;
  forget: (path: string) => void;
};

type Entry = { path: string; openedAt: string };

// Comparison key: Windows paths ignore letter case, so fold it there only; the stored path keeps its spelling.
const keyOf = (p: string) => (process.platform === "win32" ? p.toLowerCase() : p);

// Remembers the Projects the person opened, newest first. Without a file the list lives in memory only.
export function createRecents(file?: string): Recents {
  let entries: Entry[] = [];
  try {
    if (file) {
      const saved = JSON.parse(readFileSync(file, "utf8"));
      if (Array.isArray(saved)) entries = saved.filter((e) => typeof e?.path === "string" && typeof e?.openedAt === "string").map((e) => ({ path: resolve(e.path), openedAt: e.openedAt }));
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
    add: (raw) => {
      const path = resolve(raw);
      entries = [{ path, openedAt: new Date().toISOString() }, ...entries.filter((e) => keyOf(e.path) !== keyOf(path))].slice(0, MAX_RECENTS);
      save();
    },
    forget: (raw) => {
      const key = keyOf(resolve(raw));
      entries = entries.filter((e) => keyOf(e.path) !== key);
      save();
    },
  };
}
