import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Handler } from "../types.ts";

const ui = fileURLToPath(new URL("../../ui/", import.meta.url));

// Serves the page with every file in ui/features/ inlined as a script, in filename order,
// so each feature adds its own file instead of editing a shared one.
const handler: Handler = async (req, res) => {
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
