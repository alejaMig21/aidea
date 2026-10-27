import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { ServerResponse } from "node:http";
import type { Core, CoreNode, Project } from "./types.ts";

export type Located = { project: Project; node: CoreNode; file: string };

// Finds the Node in an opened Project and resolves its file, refusing anything outside the Project folder.
// Sends the error response and returns null when the request is not acceptable.
export function locate(core: Core, res: ServerResponse, projectId: unknown, nodeId: unknown): Located | null {
  if (typeof projectId !== "string" || typeof nodeId !== "string") {
    core.send(res, 400, { error: "project and node are required strings" });
    return null;
  }
  const project = core.projects.get(projectId);
  if (!project) {
    core.send(res, 404, { error: "Project is not open" });
    return null;
  }
  const node = project.nodes.find((n) => n.id === nodeId);
  if (!node) {
    core.send(res, 404, { error: "Node not found" });
    return null;
  }
  try {
    const file = realpathSync(resolve(project.path, node.file));
    const rel = relative(realpathSync(project.path), file);
    if (rel === "" || rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) throw new Error("outside");
    return { project, node, file };
  } catch {
    core.send(res, 403, { error: "File is not inside the Project folder" });
    return null;
  }
}
