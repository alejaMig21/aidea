// The quarantine: where a plugin waits after it was added from a folder or a Git link. Nothing of it runs there. It lives in `.quarantine` inside the plugin store
// (a folder that starts with a dot is never loaded as a plugin).
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, sep } from "node:path";
import { promisify } from "node:util";
import { scanPlugin } from "./scan.ts";
import type { Finding } from "./scan.ts";

const MAX_FILES = 2000;
const MAX_BYTES = 20 * 1024 * 1024;
const ID = /^[0-9a-f]{8}$/;
const GIT_LINK = /^(?:https:\/\/|ssh:\/\/|git@[\w.-]+:|file:\/\/\/)[^\s\u0000-\u001f]+$/;

export class QuarantineError extends Error {}

export function createQuarantine(store?: string) {
  const root = store ? join(store, ".quarantine") : undefined;
  const need = () => { if (!root) throw new QuarantineError("This core has no plugin store"); return root; };

  // How many files and bytes a folder holds, without following links; refuses what is too large.
  function measure(dir: string) {
    let files = 0, bytes = 0;
    const walk = (folder: string) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (entry.name === ".git") continue;
        const path = join(folder, entry.name);
        const stat = lstatSync(path);
        if (stat.isDirectory()) walk(path);
        else { files++; bytes += stat.size; }
        if (files > MAX_FILES || bytes > MAX_BYTES) throw new QuarantineError("That plugin is too large (more than 2000 files or 20 MB)");
      }
    };
    walk(dir);
  }

  // Copies a folder without following links: a link is not copied, and one that points outside the folder is kept as a blocking finding of the entry.
  function copyTree(from: string, to: string, root: string, links: Finding[], rel = "") {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const source = join(from, entry.name), target = join(to, entry.name), name = rel ? `${rel}/${entry.name}` : entry.name;
      const stat = lstatSync(source);
      if (stat.isSymbolicLink()) {
        let real = "";
        try { real = realpathSync(source); } catch { /* a link to nowhere */ }
        if (!real || (real !== root && !real.startsWith(root + sep))) links.push({ id: "link-leaves-folder", severity: "block", message: `${name} is a link that points outside the plugin folder (it was not copied)`, file: name });
        else links.push({ id: "link-skipped", severity: "warn", message: `${name} is a link (it was not copied)`, file: name });
      } else if (stat.isDirectory()) copyTree(source, target, root, links, name);
      else copyFileSync(source, target);
    }
  }

  const entryOf = (id: string) => {
    const dir = join(need(), id);
    let source = "", extra: Finding[] = [];
    try { const record = JSON.parse(readFileSync(join(need(), `${id}.json`), "utf8")); source = record.source ?? ""; extra = Array.isArray(record.findings) ? record.findings : []; } catch { /* no record */ }
    const report = scanPlugin(dir);
    report.findings.push(...extra);
    report.blocking = report.findings.filter((f) => f.severity === "block").length;
    report.warnings = report.findings.filter((f) => f.severity === "warn").length;
    return { id, source, report };
  };

  return {
    // Adds a plugin to the quarantine from an absolute folder path or a Git link, and returns its entry.
    async add(source: unknown) {
      const base = need();
      if (typeof source !== "string" || !source.trim() || source !== source.trim()) throw new QuarantineError("Send a folder path or a Git link");
      const id = randomBytes(4).toString("hex");
      const dest = join(base, id);
      const links: Finding[] = [];
      mkdirSync(base, { recursive: true });
      try {
        if (isAbsolute(source) && existsSync(source) && statSync(source).isDirectory()) {
          measure(source);
          copyTree(source, dest, realpathSync(source), links);
        } else if (GIT_LINK.test(source)) {
          const incoming = join(base, `.incoming-${id}`);
          try {
            await promisify(execFile)("git", ["-c", "core.hooksPath=", "-c", "protocol.ext.allow=never", "clone", "--depth", "1", "--single-branch", "--no-tags", "--quiet", "--", source, incoming], {
              timeout: 60_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, windowsHide: true,
            });
            rmSync(join(incoming, ".git"), { recursive: true, force: true });
            measure(incoming);
            renameSync(incoming, dest);
          } catch (e) {
            if (e instanceof QuarantineError) throw e;
            throw new QuarantineError("The Git link could not be fetched");
          } finally { rmSync(incoming, { recursive: true, force: true }); }
        } else throw new QuarantineError("Send the absolute path of a folder, or a Git link (https, ssh or file)");
      } catch (e) {
        rmSync(dest, { recursive: true, force: true });
        if (e instanceof QuarantineError) throw e;
        throw new QuarantineError("That plugin could not be copied");
      }
      writeFileSync(join(base, `${id}.json`), JSON.stringify({ source, addedAt: new Date().toISOString(), findings: links }));
      return entryOf(id);
    },
    list() {
      if (!root || !existsSync(root)) return [];
      return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && ID.test(d.name)).map((d) => entryOf(d.name));
    },
    get(id: string) {
      if (!ID.test(id) || !existsSync(join(need(), id))) return undefined;
      return entryOf(id);
    },
    discard(id: unknown) {
      if (typeof id !== "string" || !ID.test(id)) throw new QuarantineError("That is not a quarantine id");
      rmSync(join(need(), id), { recursive: true, force: true });
      rmSync(join(need(), `${id}.json`), { force: true });
    },
    // Where the entry's files are, for the installer (ticket 06).
    folder: (id: string) => (ID.test(id) && root ? join(root, id) : undefined),
  };
}

export type Quarantine = ReturnType<typeof createQuarantine>;
