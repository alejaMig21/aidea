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
| `lesson` | no | Relative path of a lesson file: `{ "parts": [...] }`, each part with `name`, `hint`, `what`, `question`, `example`, `narration`, `tryIt` and optional `refs`. The Tutor teaches from it; its text is untrusted data. `refs` names what the part talks about: the plugin id, `view`, `panel:<id>`, `setting:<key>`, `service:<key>`, `event:<name>`, `check:<name>` or `capability:<name>`; the scan warns when a name is gone (never blocks), and warns when there is no lesson. |
| `teach` | no | The teaching surface: `{ "view": "state", "checks": [{ "name": "has-container", "says": "One plain sentence of what it verifies.", "args": { "node": "string" } }] }`. `view` is the name of a read-only view of the plugin's state; each check has a name (unique), a sentence of up to 160 characters and optional arguments (up to 5, each `string`, `number` or `boolean`). Up to 20 checks. `module` (optional) is the path of the file with the view and the checks, run for the Tutor. The scan shows it among what the plugin declares. |
| `language` | no | The language the plugin reads: `{ "id": "r", "label": "R", "extensions": [".r"] }`. `id` is a short name; `extensions` are 1 to 10 file extensions that start with a dot. See the language slot below. |
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

`ui.panels.show(id)` shows a Panel by its id (any plugin's) when it is hidden, for an offer such as "Open the Terminal"; it does nothing when the Panel is shown or does not exist. `ui.slots.add(slot, entry)` adds to a slot that the owner declared; adding to a slot that does not exist throws and the plugin fails to activate. It returns the function that removes the entry. Content is plain DOM or web components; there is no framework and no iframe. Colours, sizes and fonts come only from the style tokens below, so a plugin looks like the rest of aidea.

## Slots

A slot has an owner, a kind and an entry shape. The owner declares it; the kernel refuses entries for slots nobody declared.

- Kinds: `list` (many entries, in order), `single` (one occupant), `keyed` (one entry per key).
- Version 0.1 declares one slot: **`layout.panel`** (`list`). Entry: `{ id, title, render(container) -> dispose, side?: "left" | "right" | "bottom", startsHidden?: boolean, min?: number, icon?: string }` (`icon` is the inner shapes of a 16 by 16 SVG, as the menu draws them). It becomes a row in the Panels menu and a Panel in the Layout. The Panel's id is `<plugin id>.<entry id>`, except that an entry whose id equals the plugin's id (the usual plugin with one Panel) takes the plugin's id as its Panel id.
- Later candidates (not in 0.1): a status item, a toolbar of a Panel, a renderer of a chat message, buttons of the selection control.

### Tools for the agents (`agent.tools`)

A plugin can offer tools to the agents from its host half: `ctx.agents.tools.add({ name, description, inputSchema, readOnly?, run })`.

- `name`: lowercase letters, digits and `_`. The agents see it with the plugin's id in front (`<plugin id>_<name>`, with `.` and `-` turned into `_`), so two plugins never clash.
- `run(input)` returns plain data (it may be async). What it returns reaches the agent marked as untrusted data, up to 20,000 characters.
- A **Builder** gets every tool of every active plugin. The **Tutor** gets only those declared `readOnly: true`: a tool that is not read-only is not even offered to it.
- A tool that would write in the Project is not offered this way: write through a Proposal. The Tutor and the Builders never talk to each other; the Contract plugin uses this to let a Builder read the Contract.
- A tool goes through the guard rules of the plugins like any other action: the action is `{ kind: "agent-tool", tool, plugin, input }`. A rule that denies stops it and it never runs; a rule that asks stops it too, with the question, until there is a card for it.
- A tool exists while its plugin is active. `GET /plugins/inspect` lists them in `agentTools`.

### The teaching surface

A plugin that can be taught gives the Tutor a read-only view of its state and named checks (manifest field `teach`).

- The host half gives a snapshot of its state: `ctx.teach.state(() => data)`. The function returns plain data (it may be async) and is called when the Tutor asks, with `{ project }`: the id of the Project of the Tutor's session.
- `teach.module` is an ES module with `export function view(snapshot)` (returns plain data) and `export const checks = { "name": (snapshot, args) => ({ ok: true | false, reason: "one short sentence" }) }`.
- The Tutor reads the view with `read_plugin_view` and runs a check with `check_plugin`, only for an installed, enabled plugin. The arguments must match the shapes the manifest declares.
- The module runs in a process of its own started with Node's `--permission`: it can read the plugin's folder and nothing else, so it cannot write a file or start a program; the network is cut before it loads. It has 3 seconds and 20,000 characters of answer; beyond that it is stopped with a plain message. This is a safety net, not a sandbox: the snapshot function runs in the plugin's own half with the plugin's own capabilities.
- What comes back reaches the Tutor marked as untrusted data: it never follows instructions found in it.

### The language slot

A plugin that reads a language declares `language` in its manifest and, in its host half, gives its adapter once: `ctx.languages.provide({ analyze, flow?, run?, examples?, signature? })`.

- `analyze(projectPath)` (required) returns `{ nodes, errors, relationships, unresolved }`: the Nodes and relationships the Components layer draws. A plugin with only `analyze` is complete and useful.
- `flow(file, qualifiedName)` (optional) returns the steps and edges of one function. Without it, asking for a Flow in that language answers a plain-words 422.
- `run(request)` (optional) runs one function with test data for Playback. Without it, Playback answers a plain-words 422.
- `signature(projectPath)` (optional) returns text that changes whenever the analysis could; with it aidea keeps the analysis between openings.
- The language and its adapter come and go with the plugin: when it is deactivated the language is no longer read.
- An extension or an id that another language already reads (the ones that ship with aidea included) makes the plugin fail to activate, with the reason naming who holds it. Extensions are compared without regard to case.
- Running code is the plugin's own responsibility: it declares the `processes` and `files` capabilities it needs, and the scan shows them.
- This is the first of a family of slots filled the same way (project kinds and index providers come later); the registry behind it is `registerLanguage` in `src/core/adapters.ts`.

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
- **Secrets.** A setting of type `secret` goes to the secret store, never to a file, a log or an answer (the routes say only whether it is set). A plugin reads it with `ctx.secrets.get(name)` and only when its manifest declares the `secrets` capability. An empty value clears it. In the desktop app the secrets are kept in `~/.aidea/secrets.enc`, encrypted with AES-256-GCM under a key that Electron seals with the operating system (`safeStorage`, in `~/.aidea/secret.key`) and hands to the core in its environment; if the system cannot seal a key, or the core runs on its own, they last until aidea closes. An embedder may pass its own `secretStore` to `startCore` (`get`, `set`, `delete` by plugin and name). If the sealed key can no longer be opened (the system's own key was lost), a new one is made and the old secrets file is set aside as `secrets.enc.unreadable-<time>`: the person enters the secrets again.

## The channel between the two halves, and the top bar

- **Channel.** The host half answers named calls with `ctx.api.handle(name, fn)`; `fn(body)` returns any JSON (or a promise). The interface half makes them with `await ui.call(name, body)`, which resolves with the answer or rejects with the handler's message. Handlers are undone when the plugin is deactivated. Over HTTP: `POST /plugins/<id>/call/<name>`.
- **Slot `layout.topbar`** (interface half): `ui.slots.add("layout.topbar", { id, render(container) -> dispose })` puts a control in the top bar, before the Plugins button.

- **Dialog.** `await ui.confirm({ title, message?, lines?, accept?, cancel? })` (interface half) asks a yes or a no in aidea's own dialog and resolves `true` or `false`; `lines` are shown in monospace (the commands a plugin is about to run, for example). Never use the browser's `window.confirm`: it does not look like aidea and the page tests refuse it.
- **Projects.** `ctx.projects.path(id)` gives the folder of an open Project by the id the window uses (`ui.project()` returns the id of the one open now). `ui.call(name, body, plugin)` may name another plugin's channel.
