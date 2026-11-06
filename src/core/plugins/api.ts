// The facts of the public plugin API that the core can state without running anything, for the live inspection (docs/plugin-api.md is the source; a test keeps them in step).
import { API_VERSION, CAPABILITIES } from "./manifest.ts";
import type { PluginHost } from "./host.ts";

export const SLOTS = [
  {
    name: "layout.panel",
    kind: "list",
    entry: {
      id: "text, required: the Panel's id is <plugin id>.<id>, or just the plugin id when the two are equal",
      title: "text, required: the tab and the Panels menu row",
      render: "function(container) -> dispose, required: draws the Panel in plain DOM",
      side: '"left", "right" or "bottom"; default "right"',
      startsHidden: "true to wait in the Panels menu until the person shows it",
      min: "the least width in pixels",
      icon: "inner shapes of a 16 by 16 SVG for the menu row",
    },
  },
  {
    name: "language",
    kind: "declared in the manifest (\"language\": { id, label, extensions }), filled from the host half with ctx.languages.provide(adapter)",
    entry: {
      analyze: "async function(projectPath) -> { nodes, errors, relationships, unresolved }, required",
      flow: "async function(file, qualifiedName) -> { steps, edges }, optional: without it the Flow of that language answers a plain-words 422",
      run: "async function(request) -> { outcome, interpreter }, optional: without it Playback answers a plain-words 422",
      signature: "function(projectPath) -> text that changes whenever the analysis could, optional: lets aidea keep the analysis between openings",
    },
  },
  {
    name: "layer.marks",
    kind: "list",
    entry: {
      legend: "list of { layers: [\"business\" | \"requirements\" | \"architecture\"], mark: \"differs\" | \"waiting\", text }, optional: the lines that explain the marks in the legend of those layers",
      attach: "function(api) -> dispose, required: api.set([{ layer, node, mark }]) replaces the marks of this entry",
    },
  },
  { name: "layout.topbar", kind: "list", entry: { id: "text, required", render: "function(container) -> dispose, required: draws the control in the top bar" } },
];
export const STYLE_TOKENS = ["--bg", "--bar", "--canvas", "--panel", "--raised", "--selected", "--line", "--control", "--text", "--muted", "--label", "--accent", "--accent-soft", "--on-accent", "--proposal", "--authored", "--derived", "--danger", "--unresolved", "--sans", "--mono"];
export const EVENT_MODES = ["announce", "ask"];
export const MANIFEST_FIELDS = [
  { name: "id", required: true }, { name: "version", required: true }, { name: "title", required: true }, { name: "description", required: true }, { name: "publisher", required: true }, { name: "api", required: true },
  { name: "main", required: false }, { name: "ui", required: false }, { name: "icon", required: false }, { name: "capabilities", required: false }, { name: "requires", required: false },
  { name: "variants", required: false }, { name: "programs", required: false }, { name: "downloads", required: false }, { name: "provides", required: false }, { name: "events", required: false }, { name: "settings", required: false }, { name: "lesson", required: false }, { name: "teach", required: false }, { name: "language", required: false }, { name: "required", required: false },
];

// What an agent needs to know before it writes a plugin: the fixed facts plus what the active plugins registered now. It changes nothing.
export function inspect(host: PluginHost) {
  return {
    api: API_VERSION,
    slots: SLOTS,
    capabilities: [...CAPABILITIES],
    eventModes: EVENT_MODES,
    manifestFields: MANIFEST_FIELDS,
    styleTokens: STYLE_TOKENS,
    services: host.services(),
    events: host.eventList(),
    plugins: host.details(),
    agentTools: host.agentTools(),
  };
}
