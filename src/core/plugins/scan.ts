// The scan of a plugin in the quarantine (ADR 0008): no model and no execution. It reads the manifest and the files and compares what the manifest declares
// with what the code does. A finding either blocks (installing needs a confirmation that names it) or only warns. A scan lowers the risk; it proves nothing.
import { lstatSync, openSync, closeSync, readFileSync, readSync, readdirSync, realpathSync } from "node:fs";
import { extname, join, sep } from "node:path";
import { lessonFindings } from "./lesson-refs.ts";
import { readManifest } from "./manifest.ts";
import type { Manifest } from "./manifest.ts";

// `key` identifies a finding so the person can confirm it by name when installing.
export type Finding = { id: string; severity: "block" | "warn"; message: string; file?: string; key: string };
export const keyOf = (f: Omit<Finding, "key">) => `${f.id}|${f.file ?? ""}|${f.message}`;
export type Report = { manifest: Manifest | null; findings: Finding[]; blocking: number; warnings: number };

const BINARY_EXTENSIONS = new Set([".exe", ".dll", ".so", ".dylib", ".node", ".bin", ".msi", ".jar", ".bat", ".cmd", ".ps1", ".sh", ".com", ".scr", ".wasm"]);
const CODE_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall", "prepare", "prepublish", "prepack"];
const MAX_CODE_BYTES = 2 * 1024 * 1024;
const MAX_FINDINGS = 200;

// What the code of a plugin can do beyond its own area, and the text that shows it. `from "x"`, `require("x")` and `import("x")` all count.
const mod = (names: string) => new RegExp(`(?:from\\s+|require\\s*\\(\\s*|import\\s*\\(\\s*)["'](?:node:)?(?:${names})["']`);
const USES: Record<string, RegExp[]> = {
  network: [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bnew\s+WebSocket\b/, /\bnew\s+EventSource\b/, /\bsendBeacon\b/, mod("https?|net|tls|dgram|http2")],
  files: [mod("fs|fs/promises")],
  processes: [mod("child_process|worker_threads|cluster"), /\bprocess\.binding\b/],
  window: [/\bdocument\.(?:body|documentElement|head)\b/, /\bwindow\.(?:parent|top|opener)\b/, /\bdocument\.write\b/],
  secrets: [/\b(?:safeStorage|keytar)\b/],
};

function isBinary(file: string, head: Buffer) {
  if (BINARY_EXTENSIONS.has(extname(file).toLowerCase())) return true;
  const hex = head.subarray(0, 4).toString("hex");
  return head.subarray(0, 2).toString("latin1") === "MZ" || hex === "7f454c46" || hex === "504b0304" || ["feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe"].includes(hex);
}

export function scanPlugin(dir: string): Report {
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "key">) => { if (findings.length < MAX_FINDINGS) findings.push({ ...f, key: keyOf(f) }); };
  const read = readManifest(dir);
  const manifest = "manifest" in read ? read.manifest : null;
  if ("problems" in read) add({ id: "invalid-manifest", severity: "block", message: read.problems.join("; "), file: "aidea-plugin.json" });
  const declared = new Set(manifest?.capabilities ?? []);
  const used = new Map<string, string>(); // capability -> the first file that uses it
  let root = dir;
  try { root = realpathSync(dir); } catch { /* a missing folder has nothing to walk */ }

  const walk = (folder: string) => {
    let entries;
    try { entries = readdirSync(folder, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const path = join(folder, entry.name);
      const rel = path.slice(dir.length + 1).split(sep).join("/");
      let stat;
      try { stat = lstatSync(path); } catch { continue; }
      if (stat.isSymbolicLink()) {
        let target = "";
        try { target = realpathSync(path); } catch { /* a link to nowhere leaves nothing to follow */ }
        if (!target || (target !== root && !target.startsWith(root + sep))) add({ id: "link-leaves-folder", severity: "block", message: `${rel} is a link that points outside the plugin folder`, file: rel });
        continue;
      }
      if (stat.isDirectory()) { if (entry.name === "node_modules") add({ id: "node-modules", severity: "warn", message: "a node_modules folder: libraries should be bundled into the plugin", file: rel }); walk(path); continue; }
      if (!stat.isFile()) continue;
      let head = Buffer.alloc(0);
      try { const fd = openSync(path, "r"); head = Buffer.alloc(8); head = head.subarray(0, readSync(fd, head, 0, 8, 0)); closeSync(fd); } catch { /* unreadable: nothing to say */ }
      if (isBinary(path, head)) { add({ id: "binary", severity: "block", message: `${rel} is a compiled program or an archive`, file: rel }); continue; }
      if (entry.name === "package.json") {
        try {
          const scripts = JSON.parse(readFileSync(path, "utf8"))?.scripts ?? {};
          for (const name of INSTALL_SCRIPTS) if (typeof scripts[name] === "string") add({ id: "install-script", severity: "block", message: `${rel} runs a "${name}" script when installed`, file: rel });
        } catch { /* a package.json that is not JSON has no scripts */ }
        continue;
      }
      if (!CODE_EXTENSIONS.has(extname(path).toLowerCase()) || stat.size > MAX_CODE_BYTES) continue;
      const text = readFileSync(path, "utf8");
      scanCode(text, rel);
    }
  };

  const scanCode = (text: string, rel: string) => {
    const hex = (text.match(/\\x[0-9a-fA-F]{2}/g) ?? []).length;
    const names = (text.match(/\b_0x[0-9a-f]{3,6}\b/g) ?? []).length;
    const decodeAndRun = /\b(?:eval|Function)\s*\(\s*(?:atob|Buffer\.from|unescape|decodeURIComponent|String\.fromCharCode)/.test(text);
    if (names >= 5 || hex > 40 || decodeAndRun) add({ id: "obfuscated", severity: "block", message: `${rel} looks obfuscated (${decodeAndRun ? "it decodes text and runs it" : "names and escapes made to be unreadable"})`, file: rel });
    else if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(text)) add({ id: "dynamic-code", severity: "warn", message: `${rel} builds code at run time (eval or Function)`, file: rel });
    if (text.split("\n").some((line) => line.length > 5000)) add({ id: "long-lines", severity: "warn", message: `${rel} has very long lines (minified or bundled code is hard to read)`, file: rel });
    for (const [capability, patterns] of Object.entries(USES)) if (!used.has(capability) && patterns.some((p) => p.test(text))) used.set(capability, rel);
    if (rel === manifest?.ui && (/#[0-9a-fA-F]{3,8}\b/.test(text) || /\brgba?\(/.test(text) || /\b\d+(?:\.\d+)?px\b/.test(text))) add({ id: "literal-style", severity: "warn", message: `${rel} uses literal colours or sizes; use the style tokens of the API`, file: rel });
  };

  walk(dir);
  if (manifest) {
    // The lesson (plugin-lessons 03): what it names must still exist; no lesson is only a warning.
    if (manifest.lesson) for (const message of lessonFindings(dir, manifest)) add({ id: "lesson-stale", severity: "warn", message, file: manifest.lesson });
    else add({ id: "no-lesson", severity: "warn", message: "this plugin ships no lesson, so the Tutor cannot teach it", file: "aidea-plugin.json" });
    for (const [capability, file] of used) {
      if (declared.has(capability as never)) add({ id: "capability-used", severity: "warn", message: `uses ${capability} (declared)`, file });
      else add({ id: "undeclared-capability", severity: "block", message: `uses ${capability} without declaring it in "capabilities"`, file });
    }
  }
  return { manifest, findings, blocking: findings.filter((f) => f.severity === "block").length, warnings: findings.filter((f) => f.severity === "warn").length };
}
