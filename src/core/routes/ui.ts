import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BUILT_IN_PRESETS, DEFAULT_PRESET, validLayoutScope, validPresets, validProjectLayouts } from "../presets.ts";
import type { Handler } from "../types.ts";

const ui = fileURLToPath(new URL("../../ui/", import.meta.url));

// Serves the page with every file in ui/features/ inlined as a script, in filename order,
// so each feature adds its own file instead of editing a shared one.
const object = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
// What each name takes. Anything else is refused: the page reads these back as they are.
const valid: Record<string, (v: unknown) => boolean> = {
  layout: object,
  presets: validPresets, // the person's own Layout presets, the whole set at each change
  layoutScope: validLayoutScope, // "shared" or "project": whether a Layout is remembered for each Project
  projectLayouts: validProjectLayouts,
  sections: object,
  notation: (v) => v === "on" || v === "off",
  speed: (v) => typeof v === "number" && v > 0 && v <= 60000, // milliseconds per step
};

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
  // What the person left in the window (the Layout, the notation switch, the playback speed, the Tutor sections), kept in the preferences file under the key "~ui"
  // (not a path, so no Project can have it). It is not in the page's localStorage: the desktop app's address changes at every launch, and localStorage belongs to one address.
  const name = req.method === "PUT" ? /^\/ui\/(\w+)$/.exec(req.url ?? "")?.[1] : undefined;
  if (name && Object.hasOwn(valid, name)) {
    const body = await core.readJson(req, res);
    if (body === undefined) return true; // readJson already answered
    if (!valid[name](body)) core.send(res, 400, { error: `That is not a valid ${name}` });
    else { core.preferences.set("~ui", { [name]: body }); core.send(res, 200, { ok: true }); }
    return true;
  }
  if (req.method !== "GET" || req.url !== "/") return false;
  const scripts = readdirSync(ui + "features")
    .sort()
    .map((file) => `<script>\n${readFileSync(ui + "features/" + file, "utf8")}\n</script>`)
    .join("\n");
  // The saved state travels in a <meta> as URI-encoded JSON: no character of it can close a tag.
  const saved = `<meta name="aidea-saved" content="${encodeURIComponent(JSON.stringify(core.preferences.get("~ui")))}">`;
  // The plugins whose interface half the page must load before it builds the Layout, so a saved arrangement that holds their Panels can be restored.
  const plugins = `<meta name="aidea-plugins" content="${encodeURIComponent(JSON.stringify(core.plugins.list().filter((p) => p.state === "active" && p.ui).map((p) => ({ id: p.id }))))}">`;
  // The names of the built-in presets, which the page builds itself and the core never lets be overwritten.
  const presets = `<meta name="aidea-presets" content="${encodeURIComponent(JSON.stringify({ names: BUILT_IN_PRESETS, default: DEFAULT_PRESET }))}">`;
  const html = readFileSync(ui + "index.html", "utf8").replace("<!--features-->", () => saved + presets + plugins + scripts);
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
  return true;
};

export default handler;
