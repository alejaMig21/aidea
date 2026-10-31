import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { EDITORS, editorCommand, parseTemplate } from "../editors.ts";
import { locate, locateFile } from "../locate.ts";
import type { Handler } from "../types.ts";

const SOURCE_LIMIT = 500 * 1024; // the Code panel shows a file whole, so a file past this is refused

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

  // A Node's source (`node`), or a whole file by its path in the Project (`file`, what the Files panel knows): both use the same refusals.
  if (req.method === "GET" && url.pathname === "/source") {
    const refuse = (status: number, error: string) => (core.send(res, status, { error }), true);
    const byPath = url.searchParams.get("node") === null && url.searchParams.get("file") !== null;
    let file: string, name: string, node: { line: number; endLine: number } | null = null;
    if (byPath) {
      const found = locateFile(core, res, url.searchParams.get("project"), url.searchParams.get("file"));
      if (!found) return true;
      ({ file, path: name } = found);
      try {
        const kind = statSync(file);
        if (kind.isDirectory()) return refuse(400, `${name} is a folder, not a file.`);
        if (!kind.isFile()) return refuse(400, `${name} is not a regular file, so there is no code to show.`); // a pipe or a device would hang the read
      } catch { /* read below says so */ }
    } else {
      const found = locate(core, res, url.searchParams.get("project"), url.searchParams.get("node"));
      if (!found) return true;
      ({ file } = found);
      name = found.node.file;
      node = found.node;
    }
    let buffer: Buffer;
    try {
      if (statSync(file).size > SOURCE_LIMIT) return refuse(413, `${name} is too big to show here (over 500 KB). Open it in your editor instead.`);
      buffer = readFileSync(file);
    } catch {
      return refuse(404, `${name} could not be read. It may have been moved or deleted; refresh the Project.`);
    }
    if (buffer.includes(0)) return refuse(415, `${name} is not text, so there is no code to show.`);
    const text = buffer.toString("utf-8");
    // `whole=1` (always, for a file by path) answers with the entire file; the Node's lines (or `from` and `to`, for a step of a Flow) are the ones to highlight.
    if (byPath || url.searchParams.get("whole") === "1") {
      const count = text.split(/\r?\n/).length - (/\r?\n$/.test(text) ? 1 : 0);
      let [line, endLine] = [node?.line, node?.endLine];
      const [from, to] = [url.searchParams.get("from"), url.searchParams.get("to")];
      if (from !== null || to !== null) {
        [line, endLine] = [Number(from ?? NaN), Number(to ?? NaN)];
        if (!Number.isInteger(line) || !Number.isInteger(endLine) || line < 1 || endLine < line || endLine > count) return refuse(400, "from and to must be line numbers inside the file");
      }
      core.send(res, 200, { file: name, line, endLine, text });
      return true;
    }
    core.send(res, 200, { file: name, line: node!.line, endLine: node!.endLine, text: text.split(/\r?\n/).slice(node!.line - 1, node!.endLine).join("\n") });
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
        tail = built.args;
      } catch (e) {
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
        // wrapper arguments belong to the AIDEA_EDITOR override only
        child = spawn(editor, [...(process.env.AIDEA_EDITOR ? lead : []), ...tail], { stdio: "ignore", detached: true });
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
