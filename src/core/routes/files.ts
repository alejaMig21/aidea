// Files panel: GET /files?project= answers with the folder hierarchy of an open Project, read-only and for any folder.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { hasAdapter } from "../adapters.ts";
import { languageOfFile } from "../languages.ts";
import { SKIP_DIRS } from "../typescript-adapter.ts";
import type { Handler } from "../types.ts";

type Entry = { name: string; path: string; kind: "folder" | "file"; ignored?: true; unread?: true; truncated?: number; language?: string; analysed?: boolean; children?: Entry[] };

// Listed but never opened: dependencies, caches, build output and version-control data hold copies of code or tooling, not the Project's own work.
// Other hidden folders (.github, .claude) are the person's work and are opened. Compared without regard to case (Windows folders are).
const IGNORED = new Set([...SKIP_DIRS, ".git", ".hg", ".svn", ".venv", ".tox", ".cache", ".pytest_cache", ".mypy_cache", ".ruff_cache"].map((n) => n.toLowerCase()));
const PER_FOLDER = 1500; // most entries listed for one folder
const WHOLE_TREE = 5000; // most entries listed for the whole Project: a Unity Library or a vendored tree must not stall the core or fill the panel

// Folders first, then files, each group in alphabetical order without regard to case. `rel` is the folder's path inside the Project, with "/".
// The answer is read with the asynchronous readdir so the core keeps serving other requests, and `budget.left` counts the entries still allowed:
// a folder that crosses it says how many it left out, and the folders met after it are marked unread.
async function list(abs: string, rel: string, budget: { left: number }): Promise<{ children: Entry[]; truncated?: number }> {
  let found;
  try { found = await readdir(abs, { withFileTypes: true }); } catch { return { children: [] }; } // an unreadable folder is shown empty
  const all = found.map((e) => ({ name: e.name, folder: e.isDirectory() })) // a link to a folder is not followed: it is listed as a file
    .sort((a, b) => {
      const [x, y] = [a.name.toLowerCase(), b.name.toLowerCase()];
      return Number(b.folder) - Number(a.folder) || (x < y ? -1 : x > y ? 1 : 0);
    });
  const take = Math.min(all.length, PER_FOLDER, budget.left);
  budget.left -= take;
  const children: Entry[] = [];
  for (const { name, folder } of all.slice(0, take)) {
    const path = rel ? `${rel}/${name}` : name;
    if (!folder) {
      const language = languageOfFile(name);
      children.push({ name, path, kind: "file", ...(language && { language: language.label }), analysed: !!language && hasAdapter(language.language) });
    } else if (IGNORED.has(name.toLowerCase())) children.push({ name, path, kind: "folder", ignored: true });
    else if (budget.left <= 0) children.push({ name, path, kind: "folder", unread: true });
    else children.push({ name, path, kind: "folder", ...(await list(join(abs, name), path, budget)) });
  }
  return { children, ...(all.length > take && { truncated: all.length - take }) };
}

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (req.method !== "GET" || url.pathname !== "/files") return false;
  const id = url.searchParams.get("project");
  if (!id) return core.send(res, 400, { error: "project is required" }), true;
  const project = core.projects.get(id);
  if (!project) return core.send(res, 404, { error: "Project is not open" }), true;
  const { children, truncated } = await list(project.path, "", { left: WHOLE_TREE });
  core.send(res, 200, { project: project.id, root: children, ...(truncated && { truncated }) });
  return true;
};

export default handler;
