// What a plugin may ask of the machine besides its own code (language-plugins 07), the way VS Code gets a language's program to the person:
//  - a VARIANT per operating system and processor (the plugin folder holds one subfolder for each; aidea picks the one that matches this machine);
//  - a PROGRAM that is already on the machine (aidea looks for it, checks its version and says what is missing);
//  - a DOWNLOAD the plugin wants to make (the core makes it, never the plugin, and only after the person says yes; the size and the hash are checked).
// All three are declared in the manifest and shown by the scan. Nothing here runs while a plugin is in the quarantine: the manifest is only read.
import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, createWriteStream, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { once } from "node:events";

export const OS = ["win32", "darwin", "linux"];
export const CPU = ["x64", "arm64", "ia32"];
export type Variant = { os: string[]; cpu: string[]; folder: string };
export type ProgramDecl = { name: string; command: string; args?: string[]; min?: string; help: string };
export type DownloadDecl = { name: string; os?: string[]; cpu?: string[]; url: string; bytes: number; sha256: string; file: string };
export const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;
const ASK_TIMEOUT_MS = 10 * 60 * 1000;

// A download comes over https; plain http only from this machine itself (the fixture servers of the tests).
export function downloadUrlOk(text: string): boolean {
  try {
    const u = new URL(text);
    return u.protocol === "https:" || (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost"));
  } catch { return false; }
}

// ---- variants ----------------------------------------------------------------------------------------------------
type System = { os: string; cpu: string };
export const here = (): System => ({ os: process.platform, cpu: process.arch });
export const matches = (d: { os?: string[]; cpu?: string[] }, s: System = here()) => (!d.os || d.os.includes(s.os)) && (!d.cpu || d.cpu.includes(s.cpu));
export const variantFor = (variants: Variant[], s: System = here()) => variants.find((v) => matches(v, s));
export const unavailableReason = (variants: Variant[], s: System = here()) =>
  `not available for this system: it has variants for ${variants.map((v) => `${v.os.join("/")} ${v.cpu.join("/")}`).join(", ")}; this machine is ${s.os} ${s.cpu}`;

// ---- programs on the machine -------------------------------------------------------------------------------------
const cmp = (a: string, b: string) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; }
  return 0;
};
// null when the program is there (and new enough); else what is missing, in plain words, with how to get it.
export function checkProgram(p: ProgramDecl): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(p.command, p.args ?? ["--version"], { timeout: 8000, windowsHide: true }, (error, stdout, stderr) => {
      if (error && (error as NodeJS.ErrnoException).code === "ENOENT") return resolve(`"${p.name}" is not on this machine (looked for "${p.command}"). ${p.help}`);
      if (error) return resolve(`"${p.name}" did not run (${p.command}): ${String(error.message).split("\n")[0]}. ${p.help}`);
      if (!p.min) return resolve(null);
      const version = /(\d+(?:\.\d+)+)/.exec(`${stdout}\n${stderr}`)?.[1];
      if (!version) return resolve(`"${p.name}" is there but its version could not be read; this plugin needs ${p.min} or later. ${p.help}`);
      resolve(cmp(version, p.min) >= 0 ? null : `"${p.name}" is version ${version}; this plugin needs ${p.min} or later. ${p.help}`);
    });
  });
}

// ---- what a running plugin gets: ctx.programs --------------------------------------------------------------------
type Who = { id: string; title: string; capabilities: string[]; programs?: ProgramDecl[]; downloads?: DownloadDecl[] };
type Waiting = { id: string; key: string; plugin: string; title: string; name: string; url: string; host: string; bytes: number; decl: DownloadDecl; file: string; promise: Promise<string>; resolve: (path: string) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

const sha256File = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

export function createPrograms(dataDir: (id: string) => string) {
  const waiting = new Map<string, Waiting>();
  let counter = 0;
  const downloadFor = (who: Who, name: string) => (who.downloads ?? []).find((d) => d.name === name && matches(d));
  const fileOf = (who: Who, d: DownloadDecl) => join(dataDir(who.id), "downloads", d.file);
  const held = (file: string, d: DownloadDecl) => { try { return statSync(file).size === d.bytes && sha256File(file) === d.sha256; } catch { return false; } };

  // Runs a program the plugin declared, by its name: one found on the machine, or one it downloaded. Never a path.
  async function run(who: Who, name: string, args: string[]) {
    if (!who.capabilities.includes("processes")) throw new Error('to run a program the plugin must declare the capability "processes"');
    if (!Array.isArray(args) || args.length > 50 || args.some((a) => typeof a !== "string" || a.length > 4000)) throw new Error("args must be a list of up to 50 short texts");
    let command = (who.programs ?? []).find((p) => p.name === name)?.command;
    if (!command) {
      const d = downloadFor(who, name);
      if (!d) throw new Error(`the program "${name}" is not declared by this plugin (neither in "programs" nor in "downloads")`);
      const file = fileOf(who, d);
      if (!held(file, d)) throw new Error(`"${name}" is not downloaded yet: call ctx.programs.download("${name}") first`);
      command = file;
    }
    mkdirSync(dataDir(who.id), { recursive: true });
    return new Promise<{ code: number | null; stdout: string; stderr: string; error?: string }>((resolve) => {
      execFile(command!, args, { timeout: 60_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, cwd: dataDir(who.id) }, (error, stdout, stderr) => {
        const code = !error ? 0 : typeof (error as { code?: unknown }).code === "number" ? (error as { code: number }).code : null;
        resolve({ code, stdout, stderr, ...(error && code === null ? { error: String(error.message).split("\n")[0] } : {}) });
      });
    });
  }

  // Asks the person, and only after a yes downloads the file the plugin declared (the core does it: size and hash are checked, a redirect is not followed). Resolves with the path.
  function download(who: Who, name: string): Promise<string> {
    if (!who.capabilities.includes("network")) return Promise.reject(new Error('to download a program the plugin must declare the capability "network"'));
    const decl = downloadFor(who, name);
    if (!decl) return Promise.reject(new Error(`no download called "${name}" is declared for this system`));
    const file = fileOf(who, decl);
    if (held(file, decl)) return Promise.resolve(file);
    const key = `${who.id}/${name}`;
    const same = [...waiting.values()].find((w) => w.key === key);
    if (same) return same.promise;
    let resolve!: (path: string) => void, reject!: (e: Error) => void;
    const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
    const id = `dl-${++counter}`;
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error("nobody answered the download request")); }, ASK_TIMEOUT_MS);
    timer.unref();
    waiting.set(id, { id, key, plugin: who.id, title: who.title, name, url: decl.url, host: new URL(decl.url).host, bytes: decl.bytes, decl, file, promise, resolve, reject, timer });
    return promise;
  }

  async function fetchTo(w: Waiting) {
    const res = await fetch(w.url, { redirect: "error" });
    if (!res.ok || !res.body) throw new Error(`the server answered ${res.status}`);
    if (Number(res.headers.get("content-length")) > w.bytes) throw new Error(`the file is bigger than the ${w.bytes} bytes the plugin declared`);
    mkdirSync(dirname(w.file), { recursive: true });
    const tmp = `${w.file}.${randomBytes(4).toString("hex")}.part`;
    const out = createWriteStream(tmp);
    const hash = createHash("sha256");
    let total = 0;
    try {
      for await (const chunk of res.body as unknown as AsyncIterable<Buffer>) {
        total += chunk.length;
        if (total > w.bytes) throw new Error(`the file is bigger than the ${w.bytes} bytes the plugin declared`);
        hash.update(chunk);
        if (!out.write(chunk)) await once(out, "drain");
      }
      await new Promise<void>((r, j) => out.end((e?: Error | null) => (e ? j(e) : r())));
      if (total !== w.bytes) throw new Error(`the file has ${total} bytes, not the ${w.bytes} the plugin declared`);
      if (hash.digest("hex") !== w.decl.sha256) throw new Error("the file does not have the hash the plugin declared, so it was not kept");
      renameSync(tmp, w.file);
      if (process.platform !== "win32") chmodSync(w.file, 0o755);
    } catch (e) {
      out.destroy();
      rmSync(tmp, { force: true });
      throw e;
    }
    return w.file;
  }

  return {
    run, download,
    // What the person is asked: what, from where, how big. The plugin's own words are not part of it.
    pending: () => [...waiting.values()].map(({ id, plugin, title, name, url, host, bytes }) => ({ id, plugin, title, name, url, host, bytes })),
    answer(id: string, decision: "accept" | "decline"): boolean {
      const w = waiting.get(id);
      if (!w) return false;
      waiting.delete(id);
      clearTimeout(w.timer);
      if (decision === "decline") w.reject(new Error("the person declined the download"));
      else fetchTo(w).then(w.resolve, (e) => w.reject(e instanceof Error ? e : new Error(String(e))));
      return true;
    },
    // The plugin went away: what it was waiting for is withdrawn.
    cancel(pluginId: string) {
      for (const [id, w] of [...waiting]) if (w.plugin === pluginId) { waiting.delete(id); clearTimeout(w.timer); w.reject(new Error("the plugin was switched off")); }
    },
  };
}
