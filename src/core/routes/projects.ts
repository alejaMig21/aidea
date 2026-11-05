import { mkdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { adapterFor } from "../adapters.ts";
import { cachedAnalysis } from "../analysis-cache.ts";
import { detectLanguages } from "../languages.ts";
import type { ServerResponse } from "node:http";
import type { Core, Handler, Project } from "../types.ts";


async function openProject(path: string, cacheDir?: string): Promise<Project> {
  const languages = detectLanguages(path);
  // Nothing to analyse: no adapter is run, the Components layer is just empty.
  const { nodes, errors, relationships, unresolved } = languages.some((l) => l.analysed)
    ? await cachedAnalysis(cacheDir, path, adapterFor(path))
    : { nodes: [], errors: [], relationships: [], unresolved: 0 };
  // The full path is the id: two folders can share a name.
  return { id: path, name: basename(path), path, nodes, errors, relationships, unresolved, languages };
}

const isDirectory = (path: string) => statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;

// Why a name cannot be a single folder name on any platform (Windows rules are the strictest), or undefined if it can.
function folderNameProblem(name: unknown): string | undefined {
  if (typeof name !== "string" || name.trim() === "") return "Enter a name for the project.";
  if (/[\\/]/.test(name) || name === "." || name === "..") return "The name must be a single folder name, without slashes or '..'.";
  if (/[<>:"|?*\x00-\x1f]/.test(name)) return 'The name cannot contain any of < > : " | ? *';
  if (/[. ]$/.test(name)) return "The name cannot end with a dot or a space.";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name)) return `"${name}" is a reserved name on Windows.`;
  return undefined;
}

// Analyzes the folder, registers it as a Project, remembers it in recents and answers 201.
async function openAndRecord(core: Core, res: ServerResponse, path: string): Promise<true> {
  let project: Project;
  try {
    project = await openProject(path, core.cacheDir);
  } catch (e) {
    const slow = (e as { killed?: boolean }).killed;
    core.send(res, 500, { error: slow
      ? "Reading this project took longer than a minute, so it was stopped. Try opening a smaller folder, or the folder that holds the code itself."
      : "Could not read this project. Try opening the folder again, or check that Python is installed and the folder holds Python code." });
    return true;
  }
  core.projects.set(project.id, project);
  core.recents.add(path);
  core.send(res, 201, project);
  return true;
}

const handler: Handler = async (req, res, core) => {
  if (req.method === "GET" && req.url === "/projects") {
    core.send(res, 200, [...core.projects.values()].map(({ id, name, path }) => ({ id, name, path })));
    return true;
  }
  if (req.method === "POST" && req.url === "/projects") {
    const body = (await core.readJson(req, res)) as { path?: unknown } | null | undefined;
    if (body === undefined) return true; // readJson already answered
    const path = body?.path;
    if (typeof path !== "string" || !isDirectory(path)) {
      core.send(res, 400, { error: "That is not an existing folder. Try pasting the full path of a folder on this computer." });
      return true;
    }
    return openAndRecord(core, res, path);
  }
  // Re-reads an open Project from disk (the person edited code by hand). Unlike opening, it leaves the recents alone,
  // and on any failure the Project already held stays as it was.
  if (req.method === "POST" && req.url === "/projects/refresh") {
    const body = (await core.readJson(req, res)) as { project?: unknown } | null | undefined;
    if (body === undefined) return true;
    const old = typeof body?.project === "string" ? core.projects.get(body.project) : undefined;
    if (!old) return (core.send(res, 404, { error: "That project is not open." }), true);
    if (!isDirectory(old.path)) return (core.send(res, 400, { error: "The folder of this project is no longer there, so what is drawn is the last version aidea read." }), true);
    try {
      const project = await openProject(old.path);
      core.projects.set(project.id, project);
      core.send(res, 200, project);
    } catch {
      core.send(res, 500, { error: "Could not read the project again, so what is drawn is the last version aidea read. Try Refresh again." });
    }
    return true;
  }
  if (req.method === "POST" && req.url === "/projects/new") {
    const body = (await core.readJson(req, res)) as { parent?: unknown; name?: unknown } | null | undefined;
    if (body === undefined) return true;
    const { parent, name } = body ?? {};
    const refuse = (error: string) => (core.send(res, 400, { error }), true);
    if (typeof parent !== "string" || !isDirectory(parent)) return refuse("The parent folder must be an existing directory.");
    const problem = folderNameProblem(name);
    if (problem) return refuse(problem);
    const path = join(parent, name as string);
    try {
      mkdirSync(path); // Not recursive: fails with EEXIST rather than touching an existing folder.
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return refuse(`"${name}" already exists in that folder.`);
      return refuse(`Could not create the folder: ${(e as Error).message}`);
    }
    return openAndRecord(core, res, path);
  }
  return false;
};

export default handler;
