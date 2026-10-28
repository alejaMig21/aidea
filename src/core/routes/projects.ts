import { mkdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { runPython } from "../python.ts";
import type { ServerResponse } from "node:http";
import type { Core, Handler, Project } from "../types.ts";


async function openProject(path: string): Promise<Project> {
  const { nodes, errors, relationships, unresolved } = JSON.parse(await runPython("analyze.py", [path])) as Pick<Project, "nodes" | "errors" | "relationships" | "unresolved">;
  // The full path is the id: two folders can share a name.
  return { id: path, name: basename(path), path, nodes, errors, relationships, unresolved };
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
  const project = await openProject(path);
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
      core.send(res, 400, { error: "path must be an existing directory" });
      return true;
    }
    return openAndRecord(core, res, path);
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
