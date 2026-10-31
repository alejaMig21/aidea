import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Handler } from "../types.ts";

const ui = fileURLToPath(new URL("../../ui/", import.meta.url));

// Serves the page with every file in ui/features/ inlined as a script, in filename order,
// so each feature adds its own file instead of editing a shared one.
const handler: Handler = async (req, res) => {
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
    res.writeHead(200, { "content-type": vendor.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/plain; charset=utf-8", "cache-control": "no-cache" });
    res.end(readFileSync(ui + "vendor/dockview/" + vendor));
    return true;
  }
  if (req.method !== "GET" || req.url !== "/") return false;
  const scripts = readdirSync(ui + "features")
    .sort()
    .map((file) => `<script>\n${readFileSync(ui + "features/" + file, "utf8")}\n</script>`)
    .join("\n");
  const html = readFileSync(ui + "index.html", "utf8").replace("<!--features-->", () => scripts);
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
  return true;
};

export default handler;
