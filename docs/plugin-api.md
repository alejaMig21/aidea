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

Where plugins live: the ones that ship with aidea are in the application's own `src/plugins` folder (listed as built-in); the person's plugin store is the folder named by `AIDEA_PLUGINS_DIR`, by default `.aidea/plugins` in the home folder.

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

`ctx` offers (version 0.1): `ctx.plugin` (its id, title and version), `ctx.services.provide(key, value)` and `ctx.services.get(key)`, `ctx.on(fullName, listener)` to listen to any event by its full name, `ctx.emit(name, data)` to announce an event the manifest declares as `announce`, `ctx.ask(name, data)` to ask with one declared as `ask` (it returns `{ decision: "allow" }` when nobody objected, else the combined deny or ask), `ctx.guards.add(rule)`, `ctx.effect(dispose)` to register anything that must be undone, and `ctx.log(message)`. Listeners get a copy of the data; a listener that throws does not stop the others. Everything registered through `ctx` is undone when the plugin deactivates, in reverse order; the function returned by `activate` runs last. An error while activating switches that plugin off and is reported; nothing else is affected.

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
- Version 0.1 declares one slot: **`layout.panel`** (`list`). Entry: `{ id, title, render(container) -> dispose, side?: "left" | "right" | "bottom", startsHidden?: boolean, min?: number, icon?: string }` (`icon` is the inner shapes of a 16 by 16 SVG, as the menu draws them). It becomes a row in the Panels menu and a Panel in the Layout. The Panel's id is `<plugin id>.<entry id>`, except that an entry whose id equals the plugin's id (the usual plugin with one Panel) takes the plugin's id as its Panel id.
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

## Testing a plugin

`checkPlugin(folder)` (`src/core/plugins/testkit.ts`) is the test tool for plugin authors, the "testkit". It activates the plugin in a real host, deactivates it twice over, and returns `{ ok, id, kinds, problems }`. A problem is a registry or a running handle (timer, server) that is not back to its baseline after deactivate, a host half that does not activate, a Panel whose interface half lacks an `activate` export, or a guard rule that throws on an ordinary action. Everything you register through `ctx` is undone for you; a leak means you started something outside `ctx` and did not return or register an undo for it (`ctx.effect`).

## Settings, data and secrets

- **Data folder.** `ctx.data.dir` is a private folder for the plugin, `<store>/.data/<plugin id>`. The context gives no way to reach another plugin's folder. Removing a plugin with "also delete its data" deletes it.
- **Settings.** The manifest's `settings` maps each key to `{ "type": "string" | "number" | "boolean" | "choice" | "secret", "label": "...", "default": ..., "options": [...] }` (`options` only for `choice`). The plugin manager draws a form from it and saves valid values only: one bad value saves nothing and the answer names each bad field. `ctx.settings.get(key)` returns the saved value or the default. Values are kept in `<data folder>/settings.json`. `GET /plugins/<id>/settings` and `POST /plugins/<id>/settings` (`{ "values": { ... } }`) are the routes the form uses.
- **Secrets.** A setting of type `secret` goes to the secret store, never to a file, a log or an answer (the routes say only whether it is set). A plugin reads it with `ctx.secrets.get(name)` and only when its manifest declares the `secrets` capability. An empty value clears it. The default secret store keeps secrets in memory, so they last until aidea closes; an embedder passes `secretStore` to `startCore` (`get`, `set`, `delete` by plugin and name) to use the operating system's store. Known gap: the window's own bridge to that store is not built yet.

## The channel between the two halves, and the top bar

- **Channel.** The host half answers named calls with `ctx.api.handle(name, fn)`; `fn(body)` returns any JSON (or a promise). The interface half makes them with `await ui.call(name, body)`, which resolves with the answer or rejects with the handler's message. Handlers are undone when the plugin is deactivated. Over HTTP: `POST /plugins/<id>/call/<name>`.
- **Slot `layout.topbar`** (interface half): `ui.slots.add("layout.topbar", { id, render(container) -> dispose })` puts a control in the top bar, before the Plugins button.

- **Dialog.** `await ui.confirm({ title, message?, lines?, accept?, cancel? })` (interface half) asks a yes or a no in aidea's own dialog and resolves `true` or `false`; `lines` are shown in monospace (the commands a plugin is about to run, for example). Never use the browser's `window.confirm`: it does not look like aidea and the page tests refuse it.
- **Projects.** `ctx.projects.path(id)` gives the folder of an open Project by the id the window uses (`ui.project()` returns the id of the one open now). `ui.call(name, body, plugin)` may name another plugin's channel.
