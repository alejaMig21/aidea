import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const defaultPython = process.env.AIDEA_PYTHON ?? "python";

// The Python of the Project itself, when it keeps a virtual environment in the usual places.
export function projectPython(projectPath: string): string | undefined {
  for (const folder of [".venv", "venv", "env"]) {
    for (const exe of ["Scripts/python.exe", "bin/python"]) {
      const candidate = join(projectPath, folder, exe);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

type Options = { timeoutMs?: number; input?: string; python?: string; cwd?: string };

// Stops a process and everything it started: a plain kill would leave grandchildren running.
function killTree(pid: number) {
  if (process.platform === "win32") execFile("taskkill", ["/PID", String(pid), "/T", "/F"], () => {});
  else process.kill(pid, "SIGKILL");
}

// Runs one of the analysis scripts that live next to this file and returns what it printed.
// No shell is involved, so arguments such as folder names cannot be read as commands.
// `input` is written to the script's standard input.
export async function runPython(script: string, args: string[], { timeoutMs = 60_000, input, python = defaultPython, cwd }: Options = {}): Promise<string> {
  const run = execFileAsync(python, [fileURLToPath(new URL(`./${script}`, import.meta.url)), ...args], {
    maxBuffer: 64 * 1024 * 1024,
    cwd,
  });
  if (input !== undefined) run.child.stdin?.end(input);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (run.child.pid) killTree(run.child.pid);
  }, timeoutMs);
  try {
    return (await run).stdout;
  } catch (e) {
    // Callers treat `killed` as "took too long".
    throw timedOut ? Object.assign(e as Error, { killed: true }) : e;
  } finally {
    clearTimeout(timer);
  }
}
