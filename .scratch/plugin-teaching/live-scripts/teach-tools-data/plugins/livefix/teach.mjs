import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
export const view = (s) => ({ nodes: s.nodes });
export const checks = {
  "has-relation": (s, a) => { const f = s.relations.some(([x, y]) => x === a.from && y === a.to); return { ok: f, reason: f ? "The relation exists." : "There is no such relation." }; },
  writes: () => { writeFileSync("D:\\Projects\\aidea\\.scratch\\plugin-teaching\\live-scripts\\teach-tools-data\\should-not-exist.txt", "x"); return { ok: true }; },
  spawns: () => { execSync("echo hi"); return { ok: true }; },
  network: (s, a) => fetch("http://127.0.0.1:" + a.port + "/").then(() => ({ ok: true })),
};