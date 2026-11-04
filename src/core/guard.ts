// Guards the authored files (`.aidea/`) against a builder turn that changes them without a Proposal.
// No tool rule is a wall (a shell command can write anywhere), so the core also looks: it keeps what `.aidea/` held when the turn
// began, and when the turn ends anything that differs, and was not written by the core itself (an accepted Proposal), is reported
// with a way back. Only the turn's own start is compared with, so the person's edits between turns are never flagged.
import { randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

type Files = Map<string, Buffer>; // path relative to the Project folder, "/" separators -> content
export type Change = { file: string; change: "changed" | "created" | "removed" };
type Revert = { dir: string; before: Files; after: Files; changes: Change[] };

// The run recipe lives in `.aidea/` but is not an authored layer: the person's consent (the hash Play checks) protects it, and a change to it asks again. Watching it here would
// report the recipe the person just accepted as a change without a Proposal, and "Restore" would delete it.
const RUN_RECIPE = "run.json";
function readAll(dir: string): Files {
  const files: Files = new Map();
  const root = join(dir, ".aidea");
  const walk = (folder: string) => {
    let entries;
    try { entries = readdirSync(folder, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const path = join(folder, e.name);
      if (e.isDirectory()) walk(path);
      else if (e.isFile() && !(folder === root && e.name === RUN_RECIPE)) {
        try { files.set(relative(dir, path).replaceAll("\\", "/"), readFileSync(path)); } catch { /* vanished while reading */ }
      }
    }
  };
  try { if (!lstatSync(root).isSymbolicLink()) walk(root); } catch { /* no .aidea folder yet */ }
  return files;
}

const turns = new Set<{ dir: string; before: Files }>(); // turns running now
const reverts = new Map<string, Revert>(); // a way back is kept until it is used, the Project's next turn begins, or it is the oldest of MAX_REVERTS
const MAX_REVERTS = 20;

// Called as a turn begins; give the result to `finish` when it ends.
export function begin(dir: string) {
  for (const [id, r] of reverts) if (r.dir === dir) reverts.delete(id); // the person has moved on: the last turn's way back expires
  const turn = { dir, before: readAll(dir) };
  turns.add(turn);
  return turn;
}

// Called by the core after it wrote or removed these files itself: they are no longer "what the turn began with".
export function coreWrote(dir: string, paths: string[]) {
  for (const turn of turns) {
    if (turn.dir !== dir) continue;
    for (const path of paths) {
      const rel = relative(dir, path).replaceAll("\\", "/");
      try { turn.before.set(rel, readFileSync(path)); } catch { turn.before.delete(rel); }
    }
  }
}

// Called as a turn ends: what changed on its own, with an id to restore it by. Null when nothing did.
export function finish(turn: ReturnType<typeof begin>): { id: string; files: Change[] } | null {
  turns.delete(turn);
  const after = readAll(turn.dir);
  const files: Change[] = [];
  for (const [file, content] of after) {
    const was = turn.before.get(file);
    if (!was) files.push({ file, change: "created" });
    else if (!was.equals(content)) files.push({ file, change: "changed" });
  }
  for (const file of turn.before.keys()) if (!after.has(file)) files.push({ file, change: "removed" });
  if (!files.length) return null;
  const id = randomBytes(16).toString("hex");
  reverts.set(id, { dir: turn.dir, before: turn.before, after, changes: files });
  while (reverts.size > MAX_REVERTS) reverts.delete(reverts.keys().next().value!);
  return { id, files };
}

// Puts back what the turn changed, file by file, byte for byte. A file the person edited since is left alone and named.
export function restore(id: string): { restored: string[]; skipped: string[] } | null {
  const r = reverts.get(id);
  if (!r) return null;
  reverts.delete(id);
  const current = readAll(r.dir);
  const restored: string[] = [];
  const skipped: string[] = [];
  for (const { file } of r.changes) {
    const now = current.get(file);
    const left = r.after.get(file);
    if ((now && !left) || (!now && left) || (now && left && !now.equals(left))) { skipped.push(file); continue; }
    const path = join(r.dir, file);
    try { if (lstatSync(path).isSymbolicLink()) { skipped.push(file); continue; } } catch { /* nothing there yet */ }
    const was = r.before.get(file);
    if (was) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, was); } else rmSync(path, { force: true });
    restored.push(file);
  }
  return { restored, skipped };
}
