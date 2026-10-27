import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Adapter, Core, Handler, Project } from "./types.ts";
import { createClaudeAdapter } from "./adapter/claude.ts";
import { createBroker } from "./permissions.ts";
import { createRecents } from "./recents.ts";

const MAX_BODY_BYTES = 64 * 1024;
const routesDir = fileURLToPath(new URL("./routes/", import.meta.url));

// Every file in routes/ is a route module; adding a feature means adding a file there.
async function loadRoutes(): Promise<Handler[]> {
  const files = readdirSync(routesDir).filter((f) => f.endsWith(".ts")).sort();
  return Promise.all(files.map(async (f) => (await import(pathToFileURL(routesDir + f).href)).default as Handler));
}

// `recentsFile` is where the recent Projects are kept between runs; without it they stay in memory.
export async function startCore({ port, adapter = createClaudeAdapter(), recentsFile }: { port: number; adapter?: Adapter; recentsFile?: string }) {
  const routes = await loadRoutes();
  // Only the core's own address may talk to it: stops web pages from reaching it (CSRF, DNS rebinding).
  let allowedHosts = new Set<string>();

  const core: Core = {
    adapter,
    projects: new Map<string, Project>(),
    recordings: new Map<string, unknown>(),
    permissions: createBroker(),
    proposals: new Map(),
    recents: createRecents(recentsFile),
    send: (res, status, body, headers = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    },
    readJson: async (req, res, maxBytes) => {
      const raw = await core.readBody(req, maxBytes);
      if (raw === null) {
        core.send(res, 413, { error: "Body too large" }, { connection: "close" });
        return undefined;
      }
      try {
        return JSON.parse(raw);
      } catch {
        core.send(res, 400, { error: "Body must be JSON" });
        return undefined;
      }
    },
    readBody: async (req, maxBytes = MAX_BODY_BYTES) => {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes) return null;
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString();
    },
  };

  const server = createServer(async (req, res) => {
    try {
      const { host, origin } = req.headers;
      if (!host || !allowedHosts.has(host) || (origin && origin !== `http://${host}`)) {
        return core.send(res, 403, { error: "Forbidden" });
      }
      for (const route of routes) {
        if (await route(req, res, core)) return;
      }
      core.send(res, 404, { error: "Not found" });
    } catch (e) {
      // The detail stays in the core's log: messages can contain local paths.
      console.error(e);
      if (res.headersSent) return void res.end();
      core.send(res, 500, { error: "Internal error" });
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
