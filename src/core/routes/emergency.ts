import type { Handler } from "../types.ts";

// The emergency screen (ADR 0008): a page of the kernel that depends on no plugin and no script of the interface, so the person can always see the plugins and switch one off,
// even when every Panel is broken. It talks only to the routes /plugins and /plugins/disable.
const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>aidea emergency screen</title>
<style>
  body { margin: 0; padding: 24px; background: #0e1014; color: #e6e8ee; font: 14px system-ui, sans-serif; }
  main { max-width: 680px; margin: 0 auto; }
  h1 { font-size: 16px; margin: 0 0 6px; }
  p { color: #9aa3b2; margin: 4px 0 12px; }
  .row { padding: 10px 0; border-top: 1px solid #1d222c; }
  .meta { color: #9aa3b2; }
  .failed, .incompatible { color: #ff8a80; }
  button, a.back { padding: 4px 12px; background: transparent; color: #e6e8ee; border: 1px solid #2c3345; font: inherit; text-decoration: none; cursor: pointer; }
  #message { min-height: 1.2em; color: #b3c4ff; }
</style></head>
<body><main>
<h1>Emergency screen</h1>
<p>This page works even when the rest of aidea does not. It lists the plugins and switches one off. <span id="mode"></span></p>
<p id="message" role="status"></p>
<div id="plugins"></div>
<p><a class="back" href="/">Back to aidea</a></p>
</main>
<script>
const box = document.getElementById("plugins"), message = document.getElementById("message");
const el = (tag, props, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
async function load() {
  const data = await (await fetch("/plugins")).json();
  document.getElementById("mode").textContent = data.safeMode ? "Safe mode is on: plugins that do not ship with aidea are off." : "";
  box.replaceChildren(...data.plugins.map((p) => {
    const row = el("div", { className: "row" }, el("strong", {}, p.title), " ", el("span", { className: "meta " + p.state }, p.id + " " + p.version + " - " + p.state + (p.reason ? ": " + p.reason : "")), " ");
    row.dataset.pluginId = p.id;
    row.dataset.state = p.state;
    if (p.state === "active" && !p.required) {
      const off = el("button", { type: "button" }, "Switch off");
      off.onclick = async () => {
        const res = await fetch("/plugins/disable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id }) });
        message.textContent = res.ok ? p.title + " is switched off." : (await res.json()).error;
        load();
      };
      row.append(off);
    }
    return row;
  }));
}
load();
</script></body></html>`;

const handler: Handler = async (req, res) => {
  if (req.method !== "GET" || req.url !== "/emergency") return false;
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
  res.end(page);
  return true;
};

export default handler;
