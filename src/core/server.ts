import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const analyzer = fileURLToPath(new URL("./analyze.py", import.meta.url));
const ui = fileURLToPath(new URL("../ui/index.html", import.meta.url));
const python = process.env.AIDEA_PYTHON ?? "python";

export type CoreNode = { id: string; kind: "module" | "class" | "function"; name: string; parent: string | null };
type Project = { id: string; name: string; path: string; nodes: CoreNode[]; errors: { file: string; message: string }[] };

async function openProject(path: string): Promise<Project> {
  const { stdout } = await run(python, [analyzer, path], { maxBuffer: 64 * 1024 * 1024 });
  const name = basename(path);
  return { id: name, name, path, ...JSON.parse(stdout) };
}

const isDirectory = (path: string) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

export async function startCore({ port }: { port: number }) {
  const projects = new Map<string, Project>();

  const server = createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(readFileSync(ui));
      }
      if (req.url === "/favicon.ico") return res.writeHead(204).end();
      if (req.method === "GET" && req.url === "/projects") {
        return send(200, [...projects.values()].map(({ id, name, path }) => ({ id, name, path })));
      }
      if (req.method === "POST" && req.url === "/projects") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk);
        let path: unknown;
        try {
          path = JSON.parse(Buffer.concat(chunks).toString()).path;
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
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    url: `http://127.0.0.1:${actualPort}`,
    close: () => server.close(),
  };
}
