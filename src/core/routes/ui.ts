import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Handler } from "../types.ts";

const ui = fileURLToPath(new URL("../../ui/", import.meta.url));

// Serves the page with every file in ui/features/ inlined as a script, in filename order,
// so each feature adds its own file instead of editing a shared one.
const handler: Handler = async (req, res, core) => {
  // Fonts shipped with the application (no network needed). Only plain *.woff2 names that exist in ui/fonts/ are served.
  const font = req.method === "GET" ? /^\/fonts\/([\w-]+\.woff2)$/.exec(req.url ?? "")?.[1] : undefined;
  if (font && readdirSync(ui + "fonts").includes(font)) {
    res.writeHead(200, { "content-type": "font/woff2", "cache-control": "public, max-age=31536000, immutable" });
    res.end(readFileSync(ui + "fonts/" + font));
    return true;
  }
  // The docking library, copied into the application (src/ui/vendor/dockview/, see its NOTICE.md). Only plain names that exist in that folder are served.
  const vendor = req.method === "GET" ? /^\/vendor\/dockview\/([\w.-]+)$/.exec(req.url ?? "")?.[1] : undefined;
  if (vendor && readdirSync(ui + "vendor/dockview").includes(vendor)) {
    try {
      const body = readFileSync(ui + "vendor/dockview/" + vendor); // read first: a file that vanished after the listing is a 404, not an uncaught error
      res.writeHead(200, { "content-type": vendor.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/plain; charset=utf-8", "cache-control": "no-cache", "x-content-type-options": "nosniff" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
    return true;
  }
  // The window Layout the person left, kept in the preferences file under the key "~ui" (not a path, so no Project can have it). It is not in the page's localStorage:
  // the desktop app's address changes at every launch, and localStorage belongs to one address.
  if (req.method === "PUT" && req.url === "/ui/layout") {
    const body = await core.readJson(req, res);
    if (body === undefined) return true; // readJson already answered
    if (!body || typeof body !== "object" || Array.isArray(body)) core.send(res, 400, { error: "The Layout must be a JSON object" });
    else { core.preferences.set("~ui", { layout: body as Record<string, unknown> }); core.send(res, 200, { ok: true }); }
    return true;
  }
  if (req.method !== "GET" || req.url !== "/") return false;
  const scripts = readdirSync(ui + "features")
    .sort()
    .map((file) => `<script>\n${readFileSync(ui + "features/" + file, "utf8")}\n</script>`)
    .join("\n");
  // The saved state travels in a <meta> as URI-encoded JSON: no character of it can close a tag.
  const layout = core.preferences.get("~ui").layout;
  const saved = `<meta name="aidea-saved" content="${encodeURIComponent(JSON.stringify(layout ? { layout } : {}))}">`;
  const html = readFileSync(ui + "index.html", "utf8").replace("<!--features-->", () => saved + scripts);
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
  return true;
};

export default handler;
