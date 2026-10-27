import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { statSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { Handler, Project } from "../types.ts";

const execFileAsync = promisify(execFile);
const analyzer = fileURLToPath(new URL("../analyze.py", import.meta.url));
const python = process.env.AIDEA_PYTHON ?? "python";
const ANALYSIS_TIMEOUT_MS = 60_000;

async function openProject(path: string): Promise<Project> {
  const { stdout } = await execFileAsync(python, [analyzer, path], {
    maxBuffer: 64 * 1024 * 1024,
    timeout: ANALYSIS_TIMEOUT_MS,
  });
  const { nodes, errors } = JSON.parse(stdout) as Pick<Project, "nodes" | "errors">;
  // The full path is the id: two folders can share a name.
  return { id: path, name: basename(path), path, nodes, errors };
}

const isDirectory = (path: string) => statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;

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
    const project = await openProject(path);
    core.projects.set(project.id, project);
    core.send(res, 201, project);
    return true;
  }
  return false;
};

export default handler;
