// The difference between the plugin the person accepted and a new version waiting in the quarantine: what the update changes, and what the scan of the new version found.
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Finding, Report } from "./scan.ts";

function hashes(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (folder: string, rel: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name), name = rel ? `${rel}/${entry.name}` : entry.name;
      const stat = lstatSync(path);
      if (stat.isDirectory()) walk(path, name);
      else if (stat.isFile()) {
        const bytes = readFileSync(path);
        if (name === "package.json" && bytes.toString() === '{"type":"module"}') continue; // written by the kernel when the plugin loads (host.ts), not part of the plugin
        files.set(name, createHash("sha256").update(bytes).digest("hex"));
      }
    }
  };
  walk(dir, "");
  return files;
}

export type Difference = {
  version: { from: string; to: string };
  files: { added: string[]; removed: string[]; changed: string[] };
  capabilities: { added: string[]; removed: string[] };
  newFindings: Finding[];
  // The plugin changed and its lesson did not (plugin-lessons 03): the lesson may no longer say what the plugin does.
  lessonStale: boolean;
};

// Some file other than the lesson changed, and the lesson file itself did not.
function lessonStale(was: Map<string, string>, now: Map<string, string>, lessons: (string | undefined)[]): boolean {
  const names = new Set(lessons.filter((f): f is string => !!f));
  if (!names.size) return false;
  const touched = [...new Set([...was.keys(), ...now.keys()])].filter((f) => was.get(f) !== now.get(f));
  return touched.some((f) => !names.has(f)) && !touched.some((f) => names.has(f));
}

export function difference(installedDir: string, installed: Report, next: Report, nextDir: string): Difference {
  const was = hashes(installedDir), now = hashes(nextDir);
  const old = new Set(installed.manifest?.capabilities ?? []), fresh = new Set(next.manifest?.capabilities ?? []);
  const known = new Set(installed.findings.map((f) => f.key));
  return {
    version: { from: installed.manifest?.version ?? "", to: next.manifest?.version ?? "" },
    files: {
      added: [...now.keys()].filter((f) => !was.has(f)).sort(),
      removed: [...was.keys()].filter((f) => !now.has(f)).sort(),
      changed: [...now.keys()].filter((f) => was.has(f) && was.get(f) !== now.get(f)).sort(),
    },
    capabilities: { added: [...fresh].filter((c) => !old.has(c)).sort(), removed: [...old].filter((c) => !fresh.has(c)).sort() },
    newFindings: next.findings.filter((f) => !known.has(f.key)),
    lessonStale: lessonStale(was, now, [installed.manifest?.lesson, next.manifest?.lesson]),
  };
}

// Whether `next` is a newer version than `current` (MAJOR.MINOR.PATCH).
export const isNewer = (next: string, current: string) => {
  const a = next.split(".").map(Number), b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};
