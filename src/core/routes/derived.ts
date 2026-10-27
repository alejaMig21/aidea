import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { Core, CoreNode, Handler } from "../types.ts";
import type { ServerResponse } from "node:http";

type Located = { node: CoreNode; file: string };

// Finds the Node in an opened Project and resolves its file, refusing anything outside the Project folder.
// Sends the error response and returns null when the request is not acceptable.
function locate(core: Core, res: ServerResponse, projectId: unknown, nodeId: unknown): Located | null {
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
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw new Error("outside");
    return { node, file };
  } catch {
    core.send(res, 403, { error: "File is not inside the Project folder" });
    return null;
  }
}

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");

  if (req.method === "GET" && url.pathname === "/source") {
    const found = locate(core, res, url.searchParams.get("project"), url.searchParams.get("node"));
    if (!found) return true;
    const { node, file } = found;
    const lines = readFileSync(file, "utf-8").split(/\r?\n/);
    core.send(res, 200, { file: node.file, line: node.line, endLine: node.endLine, text: lines.slice(node.line - 1, node.endLine).join("\n") });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/open-in-editor") {
    const body = await core.readBody(req);
    if (body === null) {
      core.send(res, 413, { error: "Body too large" }, { connection: "close" });
      return true;
    }
    let input: { project?: unknown; node?: unknown };
    try {
      input = JSON.parse(body);
    } catch {
      core.send(res, 400, { error: "Body must be JSON" });
      return true;
    }
    const found = locate(core, res, input?.project, input?.node);
    if (!found) return true;
    // Array arguments and no shell: file names cannot inject commands.
    // AIDEA_EDITOR_ARGS (a JSON array) is for wrappers such as `node script.js`.
    const editor = process.env.AIDEA_EDITOR ?? "code";
    const lead: string[] = JSON.parse(process.env.AIDEA_EDITOR_ARGS ?? "[]");
    const child = spawn(editor, [...lead, "--goto", `${found.file}:${found.node.line}`], { stdio: "ignore", detached: true });
    const launched = await new Promise<string | null>((done) => {
      child.once("error", (e) => done(e.message));
      child.once("spawn", () => done(null));
    });
    if (launched) {
      core.send(res, 502, { error: `Could not start the editor: ${launched}` });
      return true;
    }
    child.unref();
    core.send(res, 200, { opened: `${found.file}:${found.node.line}` });
    return true;
  }
  return false;
};

export default handler;
