// Files panel: GET /files?project= answers with the folder hierarchy of an open Project, read-only and for any folder.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { hasAdapter } from "../adapters.ts";
import { languageOfFile } from "../languages.ts";
import { SKIP_DIRS } from "../typescript-adapter.ts";
import type { Handler } from "../types.ts";

type Entry = { name: string; path: string; kind: "folder" | "file"; ignored?: true; truncated?: number; language?: string; analysed?: boolean; children?: Entry[] };

// Listed but never opened: dependencies, caches, build output and version-control data hold copies of code or tooling, not the Project's own work.
// Other hidden folders (.github, .claude) are the person's work and are opened.
const IGNORED = new Set([...SKIP_DIRS, ".git", ".hg", ".svn", ".venv", ".tox", ".cache", ".pytest_cache", ".mypy_cache", ".ruff_cache"]);
const PER_FOLDER = 1500; // ponytail: no limit on the whole tree; add one if a Project with hundreds of folders this big shows up

// Folders first, then files, each group in alphabetical order without regard to case. `rel` is the folder's path inside the Project, with "/".
function list(abs: string, rel: string): { children: Entry[]; truncated?: number } {
  let found;
  try { found = readdirSync(abs, { withFileTypes: true }); } catch { return { children: [] }; } // an unreadable folder is shown empty
  const all = found.map((e) => ({ name: e.name, folder: e.isDirectory() })) // a link to a folder is not followed: it is listed as a file
    .sort((a, b) => Number(b.folder) - Number(a.folder) || (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
  const children = all.slice(0, PER_FOLDER).map(({ name, folder }): Entry => {
    const path = rel ? `${rel}/${name}` : name;
    if (folder) return IGNORED.has(name) ? { name, path, kind: "folder", ignored: true } : { name, path, kind: "folder", ...list(join(abs, name), path) };
    const language = languageOfFile(name);
    return { name, path, kind: "file", ...(language && { language: language.label }), analysed: !!language && hasAdapter(language.language) };
  });
  return { children, ...(all.length > children.length && { truncated: all.length - children.length }) };
}

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (req.method !== "GET" || url.pathname !== "/files") return false;
  const id = url.searchParams.get("project");
  if (!id) return core.send(res, 400, { error: "project is required" }), true;
  const project = core.projects.get(id);
  if (!project) return core.send(res, 404, { error: "Project is not open" }), true;
  const { children, truncated } = list(project.path, "");
  core.send(res, 200, { project: project.id, root: children, ...(truncated && { truncated }) });
  return true;
};

export default handler;
