import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Adapter, Core, Handler, Project } from "./types.ts";
import { createClaudeAdapter } from "./adapter/claude.ts";
import { createBroker } from "./permissions.ts";
import { createRecents } from "./recents.ts";
import { createPreferences } from "./preferences.ts";
import { createLearner } from "./learner-pipeline.ts";
import { createProbes } from "./probe.ts";
import { createPlans } from "./plan.ts";

const MAX_BODY_BYTES = 64 * 1024;
const ROLES = ["builder", "tutor", "prober", "extractor", "auditor", "grader", "definer"];
const routesDir = fileURLToPath(new URL("./routes/", import.meta.url));

// Every file in routes/ is a route module; adding a feature means adding a file there.
async function loadRoutes(): Promise<Handler[]> {
  const files = readdirSync(routesDir).filter((f) => f.endsWith(".ts")).sort();
  return Promise.all(files.map(async (f) => (await import(pathToFileURL(routesDir + f).href)).default as Handler));
}

// `recentsFile` is where the recent Projects are kept between runs; without it they stay in memory.
// `preferencesFile` does the same for the mode and model chosen for each Project.
// `learnerDir` is the per-user folder of the Learner's evidence and graph (memory only without it); `learnerModel` is the model of its Extractor and Auditor.
// `adapters` are extra agent products by name and `roleAdapters` says which one serves a role (default: `adapter`, named "default"); the builder's adapter also declares the modes and models.
export async function startCore({ port, adapter: defaultAdapter = createClaudeAdapter(), adapters = {}, roleAdapters = {}, recentsFile, preferencesFile, learnerDir, learnerModel }: { port: number; adapter?: Adapter; adapters?: Record<string, Adapter>; roleAdapters?: Record<string, string>; recentsFile?: string; preferencesFile?: string; learnerDir?: string; learnerModel?: string }) {
  const named: Record<string, Adapter> = { ...adapters, default: defaultAdapter };
  for (const [role, name] of Object.entries(roleAdapters)) {
    if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}". Roles: ${ROLES.join(", ")}`);
    if (!named[name]) throw new Error(`Unknown agent "${name}" for the ${role}. Available: ${Object.keys(named).join(", ")}`);
  }
  const pick = (role: string) => named[roleAdapters[role]] ?? defaultAdapter;
  const adapter: Adapter = { options: pick("builder").options, run: (opts) => pick(opts.role ?? "builder").run(opts) };
  const routes = await loadRoutes();
  // Only the core's own address may talk to it: stops web pages from reaching it (CSRF, DNS rebinding).
  let allowedHosts = new Set<string>();

  const learner = createLearner(learnerDir, adapter, learnerModel);
  const core: Core = {
    adapter,
    learner,
    projects: new Map<string, Project>(),
    recordings: new Map<string, unknown>(),
    lessons: new Map(),
    probes: createProbes(learnerDir),
    plans: createPlans(learnerDir),
    permissions: createBroker(),
    proposals: new Map(),
    recents: createRecents(recentsFile),
    preferences: createPreferences(preferencesFile),
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

  // Ports that fetch refuses to connect to ("bad port"): when the system picks one, a browser or test could never reach the core.
  const blocked = (p: number) => [1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6679, 6697, 10080].includes(p) || (p >= 6665 && p <= 6669);
  const listen = () => new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  await listen();
  while (port === 0 && blocked((server.address() as AddressInfo).port)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await listen();
  }
  const actualPort = (server.address() as AddressInfo).port;
  allowedHosts = new Set([`127.0.0.1:${actualPort}`, `localhost:${actualPort}`]);
  return {
    url: `http://127.0.0.1:${actualPort}`,
    adapter,
    close: () => server.close(),
  };
}
