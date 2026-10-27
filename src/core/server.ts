import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { IncomingMessage } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const analyzer = fileURLToPath(new URL("./analyze.py", import.meta.url));
const ui = fileURLToPath(new URL("../ui/index.html", import.meta.url));
const python = process.env.AIDEA_PYTHON ?? "python";
const MAX_BODY_BYTES = 64 * 1024;
const ANALYSIS_TIMEOUT_MS = 60_000;

export type CoreNode = { id: string; kind: "module" | "class" | "function"; name: string; parent: string | null };
type Project = { id: string; name: string; path: string; nodes: CoreNode[]; errors: { file: string; message: string }[] };

async function openProject(path: string): Promise<Project> {
  const { stdout } = await execFileAsync(python, [analyzer, path], {
    maxBuffer: 64 * 1024 * 1024,
    timeout: ANALYSIS_TIMEOUT_MS,
  });
  const { nodes, errors } = JSON.parse(stdout) as Pick<Project, "nodes" | "errors">;
  // The full path is the id: two folders can share a name.
  return { id: path, name: basename(path), path, nodes, errors };
}

const isDirectory = (path: string) => statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;

// Returns null when the body exceeds the limit.
async function readBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

export async function startCore({ port }: { port: number }) {
  const projects = new Map<string, Project>();
  // Only the core's own address may talk to it: stops web pages from reaching it (CSRF, DNS rebinding).
  let allowedHosts = new Set<string>();

  const server = createServer(async (req, res) => {
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    };
    try {
      const { host, origin } = req.headers;
      if (!host || !allowedHosts.has(host) || (origin && origin !== `http://${host}`)) {
        return send(403, { error: "Forbidden" });
      }
      if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(readFileSync(ui));
      }
      if (req.method === "GET" && req.url === "/projects") {
        return send(200, [...projects.values()].map(({ id, name, path }) => ({ id, name, path })));
      }
      if (req.method === "POST" && req.url === "/projects") {
        const body = await readBody(req);
        if (body === null) return send(413, { error: "Body too large" }, { connection: "close" });
        let path: unknown;
        try {
          path = JSON.parse(body).path;
        } catch {
          return send(400, { error: "Body must be JSON" });
        }
        if (typeof path !== "string" || !isDirectory(path)) {
          return send(400, { error: "path must be an existing directory" });
        }
        const project = await openProject(path);
        projects.set(project.id, project);
        return send(201, project);
      }
      send(404, { error: "Not found" });
    } catch (e) {
      send(500, { error: e instanceof Error ? e.message : String(e) });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const actualPort = (server.address() as AddressInfo).port;
  allowedHosts = new Set([`127.0.0.1:${actualPort}`, `localhost:${actualPort}`]);
  return {
    url: `http://127.0.0.1:${actualPort}`,
    close: () => server.close(),
  };
}
