import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { locate } from "../locate.ts";
import type { Handler } from "../types.ts";

// Node cannot start a `.cmd` shim such as VS Code's `code` without a shell, so on Windows prefer the real executable.
function defaultEditor(): string {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const exe = join(process.env.LOCALAPPDATA, "Programs", "Microsoft VS Code", "Code.exe");
    if (existsSync(exe)) return exe;
  }
  return "code";
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
    const input = (await core.readJson(req, res)) as { project?: unknown; node?: unknown } | null | undefined;
    if (input === undefined) return true; // readJson already answered
    const found = locate(core, res, input?.project, input?.node);
    if (!found) return true;
    // Array arguments and no shell: file names cannot inject commands.
    // AIDEA_EDITOR_ARGS (a JSON array) is for wrappers such as `node script.js`.
    const editor = process.env.AIDEA_EDITOR ?? defaultEditor();
    let lead: unknown;
    try {
      lead = JSON.parse(process.env.AIDEA_EDITOR_ARGS ?? "[]");
    } catch {
      lead = null;
    }
    if (!Array.isArray(lead) || !lead.every((a) => typeof a === "string")) {
      core.send(res, 500, { error: "AIDEA_EDITOR_ARGS must be a JSON array of strings" });
      return true;
    }
    // spawn reports some failures by throwing (EINVAL for a .cmd on Windows) and others as an event (ENOENT).
    let child: ReturnType<typeof spawn> | undefined;
    const launched = await new Promise<string | null>((done) => {
      try {
        child = spawn(editor, [...lead, "--goto", `${found.file}:${found.node.line}`], { stdio: "ignore", detached: true });
      } catch (e) {
        return done(e instanceof Error ? e.message : String(e));
      }
      child.once("error", (e) => done(e.message));
      child.once("spawn", () => done(null));
    });
    if (launched) {
      core.send(res, 502, { error: `Could not start the editor: ${launched}` });
      return true;
    }
    child?.unref();
    core.send(res, 200, { opened: `${found.file}:${found.node.line}` });
    return true;
  }
  return false;
};

export default handler;
