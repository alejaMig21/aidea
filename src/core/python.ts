import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const python = process.env.AIDEA_PYTHON ?? "python";

// Runs one of the analysis scripts that live next to this file and returns what it printed.
// No shell is involved, so arguments such as folder names cannot be read as commands.
export async function runPython(script: string, args: string[], timeoutMs = 60_000): Promise<string> {
  const { stdout } = await execFileAsync(python, [fileURLToPath(new URL(`./${script}`, import.meta.url)), ...args], {
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
  });
  return stdout;
}
