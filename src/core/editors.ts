// How to open a file at a line in each editor the person can choose. Builds a command and an argument array only;
// nothing here starts a process and nothing goes through a shell.
//
// UNVERIFIED: the documentation sites could not be fetched from this environment, so every go-to-line syntax below
// is from memory of each editor's CLI docs (VS Code `--goto file:line`, JetBrains `--line N file`, Sublime `file:line`,
// vim `+N file`, Notepad++ `-nN file`). Check each against the editor's own docs before relying on it.
export type Editor = { id: string; label: string; command: string; args: (file: string, line: number) => string[] };

const vscodeLike = (file: string, line: number) => ["--goto", `${file}:${line}`];
const jetbrains = (file: string, line: number) => ["--line", String(line), file];

export const EDITORS: Editor[] = [
  { id: "vscode", label: "VS Code", command: "code", args: vscodeLike },
  { id: "cursor", label: "Cursor", command: "cursor", args: vscodeLike },
  { id: "idea", label: "IntelliJ IDEA", command: "idea", args: jetbrains },
  { id: "pycharm", label: "PyCharm", command: "pycharm", args: jetbrains },
  { id: "webstorm", label: "WebStorm", command: "webstorm", args: jetbrains },
  { id: "sublime", label: "Sublime Text", command: "subl", args: (f, l) => [`${f}:${l}`] },
  // gvim, not vim: the core starts the editor without a terminal, and plain vim needs one.
  { id: "vim", label: "Vim (gvim window)", command: "gvim", args: (f, l) => [`+${l}`, f] },
  { id: "notepadpp", label: "Notepad++", command: "notepad++", args: (f, l) => [`-n${l}`, f] },
];

const MAX_TEMPLATE = 500;
const tokens = (template: string) => template.match(/"[^"]*"|\S+/g)?.map((t) => (t.startsWith('"') ? t.slice(1, -1) : t)) ?? [];

// null when the template is acceptable, otherwise the reason in words. Quotes keep a path with spaces together;
// there is no escaping, no variables and no pipes, because the result is never given to a shell.
export function parseTemplate(template: unknown): string | null {
  if (typeof template !== "string" || !template.trim()) return "The command template is empty.";
  if (template.length > MAX_TEMPLATE) return `The command template is too long (more than ${MAX_TEMPLATE} characters).`;
  if ((template.match(/"/g)?.length ?? 0) % 2) return "The command template has an unclosed quote.";
  const [program = "", ...rest] = tokens(template);
  if (!program || /\{.*\}/.test(program)) return "The first word of the template must be the program, with no {file} or {line} in it.";
  const unknown = template.match(/\{[^}]*\}/g)?.find((p) => p !== "{file}" && p !== "{line}");
  if (unknown) return `The template uses ${unknown}; only {file} and {line} are available.`;
  if (!rest.some((a) => a.includes("{file}"))) return "The template must contain {file}, where the file path goes.";
  return null;
}

// The command and arguments for an editor id ("custom" uses the template). Throws with a message fit to show.
export function editorCommand(id: string, template: string | undefined, file: string, line: number): { command: string; args: string[] } {
  if (id === "custom") {
    const bad = parseTemplate(template);
    if (bad) throw new Error(bad);
    const [command, ...rest] = tokens(template!);
    // A function replacer, so "$&" in a file name is not read as a pattern.
    return { command: command!, args: rest.map((a) => a.replace(/\{file\}/g, () => file).replace(/\{line\}/g, String(line))) };
  }
  const editor = EDITORS.find((e) => e.id === id);
  if (!editor) throw new Error(`Unknown editor "${id}".`);
  return { command: editor.command, args: editor.args(file, line) };
}
