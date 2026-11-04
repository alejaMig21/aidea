# DeepSeek Harness plugin philosophy, digest for aidea

Researched 2026-11-04. Primary source: clone of `deepseek-ai/deepseek-harness`, commit `8bd0733`, version `0.2.2-alpha.3` (scratchpad `dsh/`; every path below is relative to that clone). Earlier note: `.scratch/harness/research/02-deepseek-harness.md`. Nothing was executed, only read. "unverified" = not found in the files read.

## 0. Headline

DeepSeek's bet: one small plugin framework (Cordis), everything else (even the agent loop) is a plugin, plugins are trusted code, and the API may break between alpha releases. aidea can copy the shape (composition rows, ladder of mechanisms, two-halves package, slots, manager) but must NOT copy three things that make it fragile for a packaged product: an unstable API, a React-bound UI, and "install by running pnpm".

## 1. Everything is a plugin, including the agent loop

1. Principle: "Every part of the product is a plugin, including the model adapter, the tool registry, the session log, and the agent loop itself, so each is replaceable from configuration. There is no privileged core to patch" (`docs/architecture.md`, "Cordis"). Core packages each own one `ctx` key: `ctx.sessions`, `ctx.tools`, `ctx.agents`, `ctx.agentLoop`, `ctx.llm` (same file, "Core packages").
2. Solves: no hidden core only the vendor can change; one provider swap changes the whole product (`docs/architecture.md`, "Capability seams").
3. For aidea: adopt the rule, not the extremity. ADR 0001 says aidea never writes an agent loop, so "the loop is a plugin" becomes "the agent adapter is a plugin". Panels, layers, language adapters, Tutor, guard rules, Playback, terminal all register into named registries.
4. Do not copy: DeepSeek has no kernel because the whole process is a Cordis tree booted from YAML. aidea needs a real kernel (section 16) that works when every plugin is disabled, so a bad plugin cannot brick the app.

## 2. Cordis model: context, service, plugin, injection

1. Principle: "A plugin is a object that implements Service", "A context is a repository of services", services claim a stable key `ctx.<key>`, a plugin declares `inject` so "load order is expressed through service requirements rather than manual boot sequencing"; registrations are "reversible effects" via `ctx.effect()` / `ctx.on()` (`docs/cordis-primer.md`, "Cordis In Five Ideas").
2. Solves: ordering without a boot script; clean unload; optional features stay inactive when a service is missing (`packages/preset/agent-preset/skills/cordis-plugin-development/references/practices.md`: "Put optional services in `inject`... so the plugin stays inactive in profiles without them instead of throwing").
3. For aidea: copy three ideas, not the library: (a) a plugin is `activate(ctx)` that registers things and returns disposers; (b) services are named capabilities found by key, with `requires` in the manifest; (c) unload is total. About 200 lines of plain JS, no Cordis dependency.
4. Do not copy: Cordis itself (vendored, `vendor/README.md`; event types via TypeScript declaration merging). aidea's interface is plain JavaScript (ADR 0003); type safety must come from a versioned, documented contract, not declaration merging.

## 3. Events with dispatch modes (emit, waterfall, serial, parallel, bail)

1. Principle: five modes; "`ctx.waterfall` is around-middleware": a listener gets `(...args, next)`, calls `next()` to delegate or returns to short-circuit; the mode "is part of the event's public contract" and is documented with `@mode` (`docs/cordis-primer.md`, "Dispatch Modes", "Cordis Waterfall Semantics"). Three event domains: session events (durable), `agent/*` (live), capability events `fs/*`, `tools/*`, `telemetry/*` (`docs/architecture.md`, "Events").
2. Solves: many plugins observe or intercept one flow without importing each other.
3. For aidea: keep only `emit` (observe, e.g. Playback recorder) and `bail`/deny-style decisions (guard, Tutor). Each event's mode is declared by the owner and tested.
4. Do not copy: order dependence. `practices.md` admits waterfall listeners "depend on registration order" and a listener that does not own the decision "must return `next()`" or it breaks others. In aidea rewriting is rare and kernel-only; plugins get deny-only guards (section 4).

## 4. "Weakest mechanism that suffices" ladder

1. Principle: "From weakest to strongest: `ctx.tools.restrict()` can only remove tools; `ctx.tools.guard()` can only deny; waterfall listeners can rewrite and depend on registration order; `system-prompt/assemble` replaces the whole assembly. The stronger the mechanism, the more of other plugins' contributions you must preserve" (`references/practices.md`, Principles 4). A guard is synchronous; a decision that must wait for the person "returns `ask` from `tools/pre-execute`" (same file, "Stability"). Order: pre-execute, monotonic guards, `ctx.approval`, execute, post-execute, `tools/result` (`docs/tool-execution-pipeline.md`; "owner policy that must not be reordered remains a registered guard").
2. Solves: safety rules compose; a stronger plugin cannot silently undo a weaker one.
3. For aidea: the best idea to import. Guard-rule plugins get only `deny` or `ask` (any deny wins, order irrelevant); Tutor interventions are `ask`; only the kernel combines the final decision. Map the existing Contract/guard layer onto the same four rungs.
4. Do not copy: letting a plugin replace prompt assembly. In aidea prompt additions are additive sections only (analogue of `ctx.systemPrompt.section()`).

## 5. Profiles, bundles and `cordis.patch.yml`

1. Principle: "A running `dsh` is a plugin tree composed at boot from ordered layers." A bundle declares `dsh.bundle.patch` in its `package.json`; a profile lists bundles plus the user's own `cordis.patch.yml`. Layers: bundles in order, profile patch, home patch, `--patch` overlays; "A patch targets a row by id and replaces its whole config, or inserts new rows" (`docs/architecture.md`, "Profiles and bundles"; `packages/bundle/base/cordis.patch.yml` header: "last write winning per row", a patch "replaces the targeted row's whole `config` rather than merging"). `dsh --profile web --dump-config` prints the composed tree.
2. Solves: shipping variants (web, headless, sdk, acp) from the same plugins; the person's overrides survive upgrades (`practices.md`: "the user's patch layer survives upgrades").
3. For aidea: one file of rows `{id, name, config, disabled}`. Layers: built-in plugins, installed plugins, the person's override file. A `--dump-config` equivalent ("show composed plugins") is cheap and valuable. Keep "override by row id, replace whole config".
4. Do not copy: four-plus layers (YAGNI for one desktop app); `!!js` expressions inside YAML config (`docs/cordis-primer.md`, "Loader Configuration"), which is code execution inside configuration.

## 6. Plugin template: two halves, host and client

1. Principle: a plugin is a package: `package.json` (with `dsh.bundle.patch` and `dsh.client` having `platform`, `immediately`, `inject`), `cordis.patch.yml`, `index.js` (Host half, `export function apply(ctx, config)`), `client.js` (browser half, `window.__ModuleLoader__.load({ id, factory })`), `locale/*.json`, `icon.svg` (`.../cordis-plugin-development/templates/decoration/*`, `references/host-plugin.md`). "Keep factories free of side effects. Register styles, timers, listeners and other resources inside `apply` with `ctx.effect`/`ctx.on`" (`references/ui-plugin.md`). Display metadata (`meta.title`, `meta.description`, icon up to 256 KiB, inside the package, no symlink out) is read "without activating plugins" (`references/host-plugin.md`).
2. Solves: one folder is one feature; metadata is readable before any code runs, which is exactly what a quarantine scan needs.
3. For aidea: copy the two halves: `main.js` (core server, Node) and `ui.js` (Electron renderer, plain JS, no JSX) plus an `aidea-plugin.json` manifest. Require static metadata (title, description, icon, declared capabilities, `engines.aidea`) readable without executing code. Reuse the icon limits in the scanner.
4. Do not copy: required `exports` maps and seven locale files on day one; `dsh.client.inject` ordering by names of internal client packages.

## 7. Slot system for UI

1. Principle: UI is composed by named, typed extension points. "The four kinds ... `single` (one occupant), `list` (ordered entries), `keyed` (dispatch by a key), and `chain` (entries elect themselves)"; "Declaring a slot is claiming it: the registering entry becomes the only entry allowed to render that key, and registering into an undeclared slot ... throws at load"; an entry's disposer collapses its declared child slots (`packages/client/ui-slots/README.md`). Plugins call `ctx.slots.inject(owner, () => ctx.slots.register({ name, id, order }, Component))` (`templates/decoration/client.js`). About 70 `ui-*` packages are themselves plugins (`packages/client/README.md`).
2. Solves: many plugins add UI without owning the page; unload removes UI cleanly.
3. For aidea: generalize the Panel registry into slots: `layout.panel` (list), `statusbar.item`, `panel.toolbar`, `message.renderer` (keyed). The owner declares each slot and its props shape; registering into an undeclared slot fails at activation. Content is `(container, props) => dispose` in plain DOM or web components.
4. Do not copy: React as the component model, and the frozen module table (`packages/client/web/README.md`, `PLATFORM_MODULES`: React, Cordis, Zod, TanStack Virtual shared with all plugins; "the module table does not negotiate versions per plugin"; `packages/client/modules/README.md`). It ties every plugin author to the host's React. Also not "never import host client packages" as the only guard (`practices.md`, "UI"): aidea should hand plugins a stable `ui` helper object instead of telling them to copy host code.

## 8. Plugin UI must look native; no iframes

1. Principle: "Plugin UI is part of the Harness UI"; style with theme tokens `--dsw-alias-*` only; "Do not serve an HTML page from the Host and embed it in an iframe" because it loses theme, light/dark and locale; "a renamed token degrades appearance but never breaks rendering" (`references/practices.md`, Principle 6 and "UI").
2. Solves: one coherent application.
3. For aidea: same rule, tied to `docs/agents/ui-style.md`: plugins use only the shared CSS variables of the scale, never literal sizes or colours. Publish the token list as part of the versioned API.
4. Do not copy: assuming same-DOM rendering is safe. It is a trust decision (section 11), not a style decision.

## 9. Hot reload versus restart-required

1. Principle: `@deepseek-ai/dsh-hmr` coordinates "module replacements, Include refreshes and profile configuration changes" in "one queue"; base enables it (`root: []`) and headless, SDK and ACP disable it; without HMR "the running composition remains until restart" (`packages/boot/hmr/README.md`; `docs/architecture.md`). Each change returns a status `applied`, `failed`, `overridden` or `restart-required`; "Installing a new bundle can activate through HMR; replacing an installed package requires restart to load a fresh JavaScript module generation" (`references/host-plugin.md`, "Install, enable, and observe"). In the browser, enabling adds the entry live and disabling "waits for its asynchronous effects before evicting unused modules and styles" (`packages/client/modules/README.md`, "Live plugin composition").
2. Solves: adding features without restart; honest reporting when restart is unavoidable.
3. For aidea: live enable, disable and install of NEW plugins (dynamic `import()` of a file URL in the core, script load in the renderer, disposers on unload). Updates and removals of code that already ran report `restart-required` with a "restart aidea" button. Same status vocabulary everywhere.
4. Do not copy: source-watching as default (a dev feature, `packages/boot/hmr/README.md` `root`); promising in-place code replacement, since Node's ESM cache cannot unload modules (DeepSeek's own text concedes a restart for "a fresh JavaScript module generation").

## 10. Plugin manager and approval

1. Principle: `@deepseek-ai/dsh-plugin-manager` lists plugins and bundles, toggles rows (`set_plugin`, `set_bundle`), installs and removes bundles; the same operations are a Web page and the agent tool `plugin_manager`, and "Every `plugin_manager` action ... needs approval without Full access" (`.../cordis-plugin-development/SKILL.md`; `packages/boot/plugin-manager/README.md`). A toggle records only the departure from bundle defaults in the user's patch. `inspect(spec)` reads what a spec names BEFORE anything installs (registry metadata, a local `package.json`, the git host); a failed install "restores the manifest and lockfile snapshotted before pnpm ran"; pnpm build scripts stay blocked until approved (`pendingBuilds`, `approvedBuilds`); GitHub and self-hosted Git are probed with `git ls-remote` first (`packages/boot/plugin-manager/README.md`).
2. Solves: one audited path for every install; rollback; the person sees what will happen.
3. For aidea: copy the shape: `inspect` (pure read, no plugin code runs), then `install`, then a status. aidea's quarantine is `inspect` made stronger: fetch into quarantine, scan, optional Tutor review, then move. Copy snapshot-and-restore, a write lock on the plugin store, and a `requestId` with streamed install-log events. Expose the same operation to UI and to the Tutor/agent (`references/user-actions.md`: "Implement the operation once as a Host service method"; "An action that grants or confirms authority ... stays user-only").
4. Do not copy: pnpm as installer (`pnpmCommand`; pnpm must be on PATH). aidea's packaged build installs from a folder or Git link with no package manager: plugins ship pre-built, with no install scripts and no native dependencies by default. Also not Creator mode's "agent installs with one approval" (`SKILL.md`): in aidea the agent writes a folder, the person installs it, and a plugin cannot install a plugin.

## 11. Trust model, marketplace, and the quarantine contrast

1. Principle: plugins are trusted code with full user rights. `SAFETY.md` (quoted in the earlier note, section 4): the project loads third-party plugins and "has not undergone a security audit"; I found no worker, VM or permission manifest for plugin code. `packages/boot/plugin-market/README.md`: no index is configured by default; the earlier note quotes "Unsigned indexes - index content ... is the index's claim". `packages/sandbox/` confines agent actions, not plugin code.
2. Solves: simplicity (no permission system).
3. For aidea: the decision already made (run with the person's rights, as in VS Code) matches DeepSeek, and aidea adds what DeepSeek lacks: quarantine, a no-model scan, optional Tutor review, re-quarantine on update. Scan: manifest fields, declared capabilities versus real imports of `child_process`, `fs`, `net`, `electron`, obfuscation, install scripts, hidden binaries. The UI must say a scan lowers risk and does not prove safety.
4. Do not copy: unsigned remote indexes as discovery. Defer any marketplace.

## 12. Config and credentials

1. Principle: tunables live in the plugin's `Config` schema, changed in the user's patch; a plugin saving its own settings must use `ctx.get('configEditor')` and "never" rewrite the user's `cordis.patch.yml` ("That file is not your bundle's patch: it belongs to the user"); an ordinary field edit restarts the plugin, a `.volatile()` field updates in place; "Store secrets ... as `ctx.credentials.modifyRecord()` records, not configuration" (`references/host-plugin.md`, "Persist your own configuration"). The manager keeps `compatibility.json` beside `package.json` (plugin-manager README).
2. Solves: user overrides never clobbered; secrets stay out of config files.
3. For aidea: each plugin declares a JSON Schema for config in its manifest (validated at activation, rendered as a form); secrets go to the OS credential store (see section 18 on `safeStorage`), never to the rows file; each plugin gets a private data folder by id.
4. Do not copy: Zod as the schema language shared through the host module table.

## 13. Versioning and compatibility

1. Principle: `engines.dsh` (SemVer range) and DSH peers are checked "before pnpm runs ... An unmet DSH requirement rejects the operation before pnpm runs"; refusal code `incompatible-version`; escape hatch: an exact `package@version` mapped to exact runtime versions in `compatibility.json`, with `acceptRisk: true`, and "Neither plugin upgrades nor DSH upgrades inherit permission" (`packages/boot/plugin-manager/README.md`, "Version compatibility and exemptions"). `updateBundle` refuses older versions and checks the target before changing anything. The docs disagree: `packages/util/package-manifest/README.md` line 96 says "Current installers and loaders do not enforce `dsh.manifestVersion` or `engines.dsh`" (unverified which is current). Stability reality: README warns "THERE WILL BE COMPATIBILITY-BREAKING CHANGES"; `docs/upgrade-guide/` has one page per release candidate; `practices.md` says client packages "change without notice".
2. Solves: refusing known-incompatible plugins before they run.
3. For aidea: the selling point is the OPPOSITE of DeepSeek: a small, versioned, documented API (`apiVersion`) with a deprecation policy. `engines.aidea` is enforced at install AND at load (a mismatch shows "incompatible" and does not activate, never crashes). Keep the per-exact-version risk acknowledgement.
4. Do not copy: plugins reaching internal packages or events that "change without notice". Everything callable is listed in the public API and covered by contract tests; the rest is private.

## 14. Creator-mode skill procedure (the agent writes plugins)

1. Principle (`.../cordis-plugin-development/SKILL.md`): ship "a small first version"; discover only needed APIs with `cordis_inspect_list` and `cordis_inspect_query` (live Services, Events, Config schemas, Slots, Theme); copy templates into a workspace folder and complete the display checklist; `plugin_manager install_bundle`; read `application` and `warnings` ("not logs"); exercise the capability; fix defects, stop, no speculative variants. Knowledge order: live inspection, package README, then source. "Do not write the profile's `package.json` ... `install_bundle` performs those steps."
2. Solves: an LLM writes against the REAL installed API, not a remembered one.
3. For aidea: ship an `aidea-plugin-development` skill and an inspect API that lists services, events, slots, tokens and config schemas of the live app. It fits ADR 0001: the external agent writes the plugin in the workspace and the person installs it through the same quarantine path (self-written plugins get no shortcut). This is what makes "keeps growing in a packaged build" real.
4. Do not copy: the agent calling the installer.

## 15. How a plugin is tested

1. Principle (`docs/testing.md`): "Every registry gets an HMR-safety test (dispose the contributing fiber, assert cleanup)"; "Product-visible plugins require a non-unit REAL-composition test. Hand-built `ctx.plugin(...)` suites are insufficient: boot test-only `cordis.yml` through Loader"; "Prefer the real implementation over a mock"; "Verify the world, not the self-report"; per-file 100% coverage gate on `packages/*/*/src`. For outside authors `references/verification.md` asks only: JS syntax, manifest validation, no slot crash in the console, light and dark check.
2. Solves: leaks on unload and wiring errors.
3. For aidea: a tiny `aidea-plugin-test` harness that boots the real kernel with the plugin, activates, deactivates, and asserts every registry is back to baseline. Contract tests per plugin kind (Panel, adapter, guard).
4. Do not copy: the 100% coverage gate for third parties.

## 16. Proposed minimal KERNEL for aidea (cannot be a plugin)

What must work with every plugin disabled or broken:
1. Plugin host: manifest reader, `apiVersion` and `engines.aidea` check, activate/deactivate with total disposal, service registry with `requires`, event bus with declared modes, per-plugin error isolation (a throwing plugin is disabled and reported, not fatal).
2. Plugin store and manager: quarantine folder, scanner call, install/update/remove/enable/disable, snapshot-and-restore, write lock, safe mode (start with all third-party plugins off).
3. Layout shell: window, docking engine, slot declarations. The Panels inside are plugins.
4. Decision point for guards: combines plugin deny/ask rules and shows the approval prompt; plugins only contribute rules.
5. Config and credentials services, and the core HTTP server with its authentication.
6. A minimal fallback UI (plugin list plus safe-mode view) so the person can always disable a plugin.
7. The public API surface and its version number.
Everything else (Panels, layers, language adapters, Tutor, agent adapters, tools, guard rules, Playback, terminal) is a plugin, shipped as built-in plugins on the same API, removable like any other except the few marked required.

## 17. Open design decisions for the interview (short questions)

1. Are built-in plugins removable, or are a few "required" (terminal? agent adapter?) so the app is always usable?
2. One plugin API version for core and UI together? How long is an old version supported?
3. Do plugins ship as plain JavaScript, or pre-built bundles from any tool?
4. May a plugin carry npm dependencies (bundled into its folder, no install step)?
5. Native binaries inside plugins: forbidden by default?
6. Does a plugin UI run in the same renderer as aidea, or in an isolated frame when untrusted?
7. What does the scan check, and which findings block versus only warn?
8. Does the Tutor review run before or after the scan, and can the person install despite a bad verdict?
9. Does every update, even a patch version, go through full quarantine?
10. Where do plugin settings and data live, and can the person export them?
11. Can a plugin replace another plugin's service (a second Tutor)? Who wins on conflict?
12. May guard-rule plugins loosen policy, or only tighten (DeepSeek's `guard` can only deny)?
13. Who may call the plugin manager: only the person, or also the agent/Tutor with approval?
14. May plugins define their own events, namespaced and versioned?
15. On uninstall, is plugin data deleted or kept?
16. Is a marketplace wanted later, and would it change the trust decision?
17. Do we ship the `aidea-plugin-development` skill and the inspect API in version 1?

## 18. What I could not verify

- Whether `engines.dsh` is enforced today: `packages/boot/plugin-manager/README.md` says yes, `packages/util/package-manifest/README.md` line 96 says no. `src/` of both was not read.
- Exact event and service signatures and any permission model inside plugin code: only READMEs and docs were read, not the TypeScript sources of `packages/core/tools` or `vendor/`.
- Whether a throwing plugin can crash the host process (no isolation mechanism found in the docs).
- The full list of Web UI slot names and how a sidebar panel plugin registers (only `conversation.composer.dock` seen in the template; `packages/client/ui-sidebar-right` exposes `ctx.sidebarRightTabs` per `packages/client/README.md`, API not read).
- Desktop installs: `docs/architecture.md` ("Desktop application") says shell-owned UI runs plugin transactions "through bundled pnpm" in a profile directory; how that behaves in a packaged Windows build was not tested.
- `dsh.manifestVersion` semantics, the plugin-market index schema (`packages/util/plugin-market-index/`), the full `SAFETY.md` text (taken from the earlier note), `docs/cookbook/adding-a-package.md`, `docs/defensive-patterns/`.
- Using Electron `safeStorage` for credentials is my suggestion, not from the DeepSeek source.
- All stability statements describe an alpha (`0.2.2-alpha.3`); later releases may change them.
