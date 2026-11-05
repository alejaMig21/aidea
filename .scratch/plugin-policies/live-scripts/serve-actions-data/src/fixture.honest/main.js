import { execFile } from "node:child_process";
export function activate() { execFile("echo", ["hi"]); }