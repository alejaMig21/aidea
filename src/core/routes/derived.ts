import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EDITORS, editorCommand, parseTemplate } from "../editors.ts";
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

  // The editor the person picked for this Project, with the choices on offer. The template is typed by the person
  // (never by the model), checked here before it is stored, and later run without a shell.
  if (url.pathname === "/editor-setting") {
    if (req.method === "GET") {
      const project = url.searchParams.get("project") ?? "";
      if (!core.projects.has(project)) return core.send(res, 400, { error: "project must be a Project that is already open" }), true;
      const { editor = "vscode", editorTemplate = "" } = core.preferences.get(project);
      core.send(res, 200, { editor, template: editorTemplate, editors: [...EDITORS.map(({ id, label }) => ({ id, label })), { id: "custom", label: "Other (type a command)" }] });
      return true;
    }
    if (req.method === "POST") {
      const body = (await core.readJson(req, res)) as { project?: unknown; editor?: unknown; template?: unknown } | null | undefined;
      if (body === undefined) return true;
      const bad = (error: string) => (core.send(res, 400, { error }), true);
      if (typeof body?.project !== "string" || !core.projects.has(body.project)) return bad("project must be a Project that is already open");
      if (body.editor !== "custom" && !EDITORS.some((e) => e.id === body.editor)) return bad("editor is not one of the listed editors");
      if (body.editor === "custom") {
        const why = parseTemplate(body.template);
        if (why) return bad(why);
        core.preferences.set(body.project, { editor: "custom", editorTemplate: body.template as string });
      } else core.preferences.set(body.project, { editor: body.editor as string });
      core.send(res, 200, { editor: body.editor });
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/open-in-editor") {
    const input = (await core.readJson(req, res)) as { project?: unknown; node?: unknown } | null | undefined;
    if (input === undefined) return true; // readJson already answered
    const found = locate(core, res, input?.project, input?.node);
    if (!found) return true;
    // Array arguments and no shell: file names cannot inject commands.
    // AIDEA_EDITOR (+ AIDEA_EDITOR_ARGS, a JSON array, for wrappers such as `node script.js`) overrides the person's
    // choice; it is for tests and unusual installs and is set outside the app.
    let editor: string;
    let lead: unknown;
    try {
      lead = JSON.parse(process.env.AIDEA_EDITOR_ARGS ?? "[]");
    } catch {
      lead = null;
    }
    let tail: string[];
    if (process.env.AIDEA_EDITOR) {
      editor = process.env.AIDEA_EDITOR;
      tail = ["--goto", `${found.file}:${found.node.line}`];
    } else {
      const { editor: id = "vscode", editorTemplate } = core.preferences.get(found.project.id);
      try {
        const built = editorCommand(id, editorTemplate, found.file, found.node.line);
        editor = id === "vscode" ? defaultEditor() : built.command;
        tail = built.args;      } catch (e) {
        core.send(res, 400, { error: e instanceof Error ? e.message : String(e) });
        return true;
      }
    }
    if (!Array.isArray(lead) || !lead.every((a) => typeof a === "string")) {
      core.send(res, 500, { error: "AIDEA_EDITOR_ARGS must be a JSON array of strings" });
      return true;
    }
    // spawn reports some failures by throwing (EINVAL for a .cmd on Windows) and others as an event (ENOENT).
    let child: ReturnType<typeof spawn> | undefined;
    const launched = await new Promise<string | null>((done) => {
      try {
        child = spawn(editor, [...(process.env.AIDEA_EDITOR ? lead : []), ...tail], { // wrapper arguments belong to the AIDEA_EDITOR override only
 stdio: "ignore", detached: true });
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
