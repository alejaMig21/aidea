// Prepares the blind exam: for each project a `blind` copy (tracked files minus every documentation file) and a `truth` folder (the documentation that was removed).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
const root = "C:/Users/aleja/AppData/Local/Temp/claude/d3e384973f8a0017/61158aa3-8136-4787-9e67-dfbdcb177bbf/scratchpad/exam";

mkdirSync(root, { recursive: true });
const isDoc = (p) => /(^|\/)(docs?|documentation|\.atl|\.claude|\.references)\//i.test(p) || /\.(md|mdx|rst|adoc)$/i.test(p) || /(^|\/)(README|CLAUDE|AGENTS|ROADMAP|CHANGELOG|LICENSE|CONTRIBUTING|GLOSSARY)[^/]*$/i.test(p) || /Handoff|Project Context/i.test(p);
const projects = { telegram: "D:/Projects/Telegram", hubstaff: "D:/Projects/hubstaff-automation" };


for (const [name, src] of Object.entries(projects)) {
  const files = execFileSync("git", ["-C", src, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
  let blind = 0, truth = 0;
  for (const f of files) {
    const from = join(src, f);
    if (!existsSync(from) || !statSync(from).isFile()) continue;
    const to = join(root, name, isDoc(f) ? "truth" : "blind", f);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
    isDoc(f) ? truth++ : blind++;
  }
  console.log(name, "blind files", blind, "truth files", truth);
}
