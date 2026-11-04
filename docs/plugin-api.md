# Plugin API, version 0.1

The public surface that plugins may use (ADR 0008). Everything a plugin may call is listed here; anything else is private and may change without notice. Decisions behind it: `.scratch/plugins/interview.md`; spec: `.scratch/plugin-system/spec.md`.

## Version

- The API version is `MAJOR.MINOR`, written as a string (`"0.1"`). It covers the core side and the interface side together.
- Before aidea 1.0 the major number is `0` and **every minor number may break**: a plugin that asks for `"0.1"` loads only on an aidea that offers exactly `0.1`. From major 1 on, a plugin that asks for `MAJOR.MINOR` loads on any aidea that offers the same major and a minor that is equal or higher.
- When a new major appears, the previous major is kept working for **12 months**.
- A plugin that asks for a version aidea does not offer shows as **incompatible** and does not activate. The check runs at install and at load.

## A plugin is a folder

```
my-plugin/
  aidea-plugin.json   the manifest (required)
  main.js             the host half, runs in the core (Node), optional
  ui.js               the interface half, runs in the window, optional
  icon.svg            optional
```

Finished plain JavaScript (ES modules). Libraries are bundled into the folder beforehand. No install step, no install scripts, no native binaries (unless declared, and then the scan flags them). A plugin has at least one half.

## The manifest, `aidea-plugin.json`

Static metadata, read without running any code. A text file of at most 64 KiB.

| Field | Required | Rule |
|---|---|---|
| `id` | yes | 3 to 64 characters of lowercase letters, digits, `-` and `.`; starts with a letter. The folder name does not matter. |
| `version` | yes | The plugin's own version, `MAJOR.MINOR.PATCH`. |
| `title` | yes | Up to 60 characters; what the person sees. |
| `description` | yes | Up to 200 characters. |
| `publisher` | yes | Who publishes it, up to 80 characters. |
| `api` | yes | The API version it needs, `"0.1"`. |
| `main` | no | Relative path of the host half. |
| `ui` | no | Relative path of the interface half. |
| `icon` | no | Relative path of an `.svg` or `.png` of at most 256 KiB, inside the folder; a link leaving the folder is refused. |
| `capabilities` | no | A list of the things it does beyond its own area: `network`, `files` (outside its private folder), `processes`, `window` (touches the page outside its own slots), `secrets`. The scan compares this list with what the code does. |
| `requires` | no | Service keys it needs. A plugin whose requirement is missing stays inactive and says why. |
| `provides` | no | Service keys it offers to others. |
| `events` | no | An object: event name (without the plugin id, which is its namespace) to `{ "mode": "announce" \| "ask", "version": 1 }`. |
| `settings` | no | A schema of its settings: an object of field name to `{ "type": "string" \| "number" \| "boolean" \| "choice", "label", "default", "choices"? }`. |
| `required` | no | Honoured only for plugins that ship with aidea: the plugin cannot be removed or disabled. |

A manifest with a missing required field, an unknown `api`, a bad `id` or a `main` or `ui` path that leaves the folder is invalid: the problem names the field, and nothing of that plugin runs.

## The host half (`main.js`)

```js
export function activate(ctx) {
  // register what the plugin adds with ctx, then return how to undo it
  return () => { /* dispose */ };
}
```

`ctx` offers (version 0.1): `ctx.plugin` (its manifest and private data folder), `ctx.services.provide(key, value)` and `ctx.services.get(key)`, `ctx.on(event, listener)` and `ctx.emit(event, data)`, `ctx.effect(dispose)` to register anything that must be undone, and `ctx.log(message)`. Everything registered through `ctx` is undone when the plugin deactivates, in reverse order; the function returned by `activate` runs last. An error while activating switches that plugin off and is reported; nothing else is affected.

## The interface half (`ui.js`)

```js
export function activate(ui) {
  return ui.slots.add("layout.panel", { id: "my-panel", title: "My panel", render(container) { /* plain DOM */ return () => {}; } });
}
```

`ui.slots.add(slot, entry)` adds to a slot that the owner declared; adding to a slot that does not exist throws and the plugin fails to activate. It returns the function that removes the entry. Content is plain DOM or web components; there is no framework and no iframe. Colours, sizes and fonts come only from the style tokens below, so a plugin looks like the rest of aidea.

## Slots

A slot has an owner, a kind and an entry shape. The owner declares it; the kernel refuses entries for slots nobody declared.

- Kinds: `list` (many entries, in order), `single` (one occupant), `keyed` (one entry per key).
- Version 0.1 declares one slot: **`layout.panel`** (`list`). Entry: `{ id, title, render(container) -> dispose, side?: "left" | "right" | "bottom", startsHidden?: boolean, min?: number }`. It becomes a row in the Panels menu and a Panel in the Layout.
- Later candidates (not in 0.1): a status item, a toolbar of a Panel, a renderer of a chat message, buttons of the selection control.

## Events

An event belongs to the plugin that defines it (`<plugin id>/<name>`), declares a mode and a version, and is part of that plugin's public contract.

- `announce`: tells that something happened; a listener cannot change anything.
- `ask`: a listener may answer `{ decision: "deny", reason }` or `{ decision: "ask", question }`, never allow; any `deny` wins.
- A plugin cannot define an event in another plugin's namespace.

## Guard rules

A plugin may add a guard rule: a function that returns nothing, `{ decision: "deny", reason }` or `{ decision: "ask", question }`. It can only tighten. The kernel combines all rules (any `deny` wins) and shows the question when one asks.

## Capabilities

`network`, `files`, `processes`, `window`, `secrets`. Using one without declaring it is a **blocking** finding of the scan; declaring and using it is a **warning**.

## Required plugins

Plugins that ship with aidea and cannot be removed or disabled: the agent adapter (when it becomes a plugin). The emergency screen and the plugin manager are part of the kernel, not plugins.

## Style tokens

A plugin interface uses only these CSS variables (the shared scale of `docs/agents/ui-style.md`); literal colours and sizes are a warning in the scan. Colours: `--bg`, `--bar`, `--canvas`, `--panel`, `--raised`, `--selected`, `--line`, `--control`, `--text`, `--muted`, `--label`, `--accent`, `--accent-soft`, `--on-accent`, `--proposal`, `--authored`, `--derived`, `--danger`, `--unresolved`. Fonts: `--sans`, `--mono`.

## Status words

Every operation of the plugin manager answers with one of: `applied`, `failed`, `restart-required`.
