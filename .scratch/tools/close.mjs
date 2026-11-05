// Usage: node close.mjs <id> <notes-file> <status text>: resolves the ticket of an item (status, boxes ticked, "What was built" notes appended), removes the item, regenerates the backlog.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const SP = new URL("./", import.meta.url).pathname.slice(1);
const [id, notesFile, ...status] = process.argv.slice(2);
const { items } = await import("file:///" + SP + "items.mjs");
const item = items.find((i) => i.id === id);
if (!item) throw new Error("unknown id " + id);
if (item.file) {
  const [folder, nn] = item.file.split("/");
  const dir = `${new URL("..", import.meta.url).pathname.slice(1)}${folder}/issues/`;
  const f = dir + readdirSync(dir).find((n) => n.startsWith(nn + "-"));
  let t = readFileSync(f, "utf8");
  t = t.replace(/^\*\*Status:\*\*.*$/m, `**Status:** resolved ${new Date().toISOString().slice(0, 10)} (${status.join(" ")})`);
  t = t.replace(/- \[ \]/g, "- [x]");
  t += `\n## What was built (${new Date().toISOString().slice(0, 10)})\n\n${readFileSync(notesFile, "utf8").trim()}\n`;
  writeFileSync(f, t);
}
execFileSync("node", [SP + "closeitem.mjs", id], { stdio: "inherit" });
