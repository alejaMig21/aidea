// Runs the teaching module of a plugin for the Tutor (plugin-teaching 02), in a process of its own that aidea starts with `--permission`: it can read the plugin's folder
// and nothing else (no writing, no starting programs). The network is cut here, before the module loads. This is a safety net, not a sandbox (docs/plugin-api.md).
// In: the path of the module as the argument, and on stdin one JSON text {op: "view" | "check", name, args, snapshot}. Out: one JSON text {ok, value | error}.
import dns from "node:dns";
import net from "node:net";
import { pathToFileURL } from "node:url";

const deny = () => { throw new Error("tried to reach the network, which a view and a check may not do"); };
globalThis.fetch = deny;
net.Socket.prototype.connect = deny;
net.connect = net.createConnection = deny;
dns.lookup = deny;
dns.promises.lookup = deny;

const NOT_ALLOWED = { FileSystemWrite: "tried to write a file, which a view and a check may not do (they are read-only)", ChildProcess: "tried to start a program, which a view and a check may not do" };
const say = (e) => (e?.code === "ERR_ACCESS_DENIED" ? NOT_ALLOWED[e.permission] ?? "tried something a view and a check may not do" : String(e?.message ?? e).slice(0, 200));

let text = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) text += chunk;
let out;
try {
  const { op, name, args, snapshot } = JSON.parse(text);
  const mod = await import(pathToFileURL(process.argv[2]).href);
  const fn = op === "view" ? mod.view : mod.checks?.[name];
  if (typeof fn !== "function") throw new Error(op === "view" ? 'the module has no "view" function' : `the module has no check named "${name}"`);
  const value = await (op === "view" ? fn(snapshot) : fn(snapshot, args));
  out = { ok: true, value: value === undefined ? null : value };
} catch (e) {
  out = { ok: false, error: say(e) };
}
process.stdout.write(JSON.stringify(out), () => process.exit(0));
