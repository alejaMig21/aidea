import { request } from "node:http";
import { fileURLToPath } from "node:url";
import { startCore } from "../src/core/server.ts";

export const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// Starts a core on a free port. Each test file calls this once and closes it afterwards.
export async function startTestCore() {
  const core = await startCore({ port: 0 });

  const post = (path: string, body: unknown) =>
    fetch(core.url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  const get = (path: string) => fetch(core.url + path);

  // Raw request, so tests can set headers such as Host and Origin that fetch controls itself.
  const raw = (method: string, path: string, headers: Record<string, string>, body?: string) =>
    new Promise<{ status: number; text: string }>((resolve, reject) => {
      const { port } = new URL(core.url);
      const req = request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
      });
      req.on("error", reject);
      req.end(body);
    });

  return { core, post, get, raw };
}
