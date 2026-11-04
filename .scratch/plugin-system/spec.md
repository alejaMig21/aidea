# The plugin system

Status: ready-for-agent

Source: ADR 0008 (`docs/adr/0008-a-small-kernel-and-everything-else-is-a-plugin.md`, approved by the person on 2026-11-04), the sixteen decisions of `.scratch/plugins/interview.md`, and the study of the DeepSeek Harness in `.scratch/plugins/research/01-deepseek-plugin-philosophy.md`. Vocabulary: Kernel, Plugin, Quarantine, Role, Instance, Provider (to be added to GLOSSARY.md by the first ticket).

## Problem Statement

aidea is a sealed box. A new Panel, layer, language or agent connection has to be written into the repository's own code and shipped as a new build. The person cannot add a Panel, the Builder cannot create one for them, and a packaged aidea cannot grow. Other harnesses (the DeepSeek Harness, VS Code) let the person, or an agent, create and install extensions, but their trust is weak: plugin code runs unreviewed, their APIs break every few days, or both.

## Solution

aidea becomes a small kernel plus plugins. Everything the person sees, from the Terminal Panel to the Tutor, is a plugin on one versioned public API. Plugins the person gets from a folder or a Git link first land in a quarantine where nothing runs; a scan without a model compares what each plugin declares with what its code does, and the Tutor can give an opinion. The person installs with one confirmation that names every serious finding. The Builder can write a plugin from a description and propose installing it, so aidea can grow while it is running, even in a packaged build. A broken plugin never leaves the person stuck: a safe mode and an emergency screen can always switch it off. The Terminal Panel becomes the first built-in plugin, to prove the API.

## User Stories

### Installing and trusting
1. As a person, I want to add a plugin from a local folder, so that I can try something someone gave me.
2. As a person, I want to add a plugin from a Git link, so that I can use one that is published in a repository.
3. As a person, I want a plugin I add to land in a quarantine where none of its code runs, so that nothing can hurt me before I have seen it.
4. As a person, I want downloading a plugin never to run its install scripts, so that fetching is safe.
5. As a person, I want to see who published the plugin, what it is for and what it says it needs before anything runs, so that I can decide with facts.
6. As a person, I want the manifest to be readable without running any code, so that the review itself cannot be an attack.
7. As a person, I want a scan without a model to compare what the manifest declares with what the code does, so that a plugin that does more than it says is caught.
8. As a person, I want the scan to block on obfuscated code, install scripts, hidden binaries and undeclared capabilities, so that the serious cases stop at the door.
9. As a person, I want to install a blocked plugin only after a confirmation that names each blocking finding, so that I never click through without reading.
10. As a person, I want the scan to only warn about capabilities the plugin declared and uses (network, files, processes), so that legitimate plugins are not refused.
11. As a person, I want the screen to say that a scan lowers the risk and does not prove a plugin is safe, so that I am not given false comfort.
12. As a person, I want to ask the Tutor whether it is a good idea to install a plugin, so that I get an opinion in plain words.
13. As a person, I want the Tutor to read the plugin as untrusted data and only advise, never decide, so that a plugin cannot talk the Tutor into approving it.
14. As a person, I want a plugin I installed to run with my own permissions after I confirm, so that plugins can do real work, as extensions do in VS Code.
15. As a person, I want no repository ever to install a plugin for me, so that cloning a project cannot change aidea.
16. As a person, I want no plugin to be able to install another plugin, so that one plugin cannot bring in others.

### Updating, enabling, removing
17. As a person, I want an update never to apply by itself, so that a good plugin cannot turn bad unseen.
18. As a person, I want every update to return to the quarantine, so that it is checked like the first install.
19. As a person, I want to see only what an update changed compared with the version I accepted (new files, new capabilities, new findings), so that reviewing is quick.
20. As a person, I want an update with nothing serious changed to be one click, so that safe updates are cheap.
21. As a person, I want to enable and disable a plugin without removing it, so that I can try things.
22. As a person, I want to remove a plugin, and be asked whether to delete its data too with "keep" as the default, so that I do not lose settings by accident.
23. As a person, I want installing, enabling, disabling and removing a plugin that never ran to apply at once, so that I do not restart aidea for it.
24. As a person, I want updating or removing a plugin whose code already ran to tell me a restart is needed, with a "Restart aidea" button, so that I am told the truth instead of promised something Node cannot do.
25. As a person, I want the same status words everywhere (applied, failed, restart required), so that I always read the same thing.
26. As a person, I want a failed install to restore what was there before, so that a half-installed plugin never remains.
27. As a person, I want two installs not to run at the same time, so that the plugin store cannot be corrupted.

### Safe mode and never being stuck
28. As a person, I want aidea to start in a safe mode with every third-party plugin off, so that I can recover from a plugin that breaks the start.
29. As a person, I want a minimal emergency screen that lists plugins and switches them off, so that I can always fix things even if every Panel is broken.
30. As a person, I want a plugin that throws while activating to be switched off and reported, without crashing aidea, so that one bug does not take everything down.
31. As a person, I want a plugin whose dependency is missing to stay inactive and say why, so that removing something does not break aidea.
32. As a person, I want a plugin that asks for an API version aidea does not offer to show as incompatible and not activate, so that nothing runs against the wrong rules.
33. As a person, I want a few plugins marked required (the agent adapter) that cannot be removed, so that aidea always has a Builder.
34. As a person, I want the plugins that come with aidea to be removable like any other (except the required), so that I keep only what I use.

### Using plugin Panels
35. As a person, I want a Panel from a plugin to show in the Panels menu, so that I use it like any Panel.
36. As a person, I want a plugin Panel to look like the rest of aidea (the shared sizes and colours), so that aidea feels like one application.
37. As a person, I want a plugin Panel to appear or disappear the moment its plugin is enabled or disabled, so that it feels alive.
38. As a person, I want my Layout to survive removing a plugin whose Panel was in it, so that nothing is left empty.
39. As a person, I want plugin settings drawn as a form from the plugin's description, so that I do not edit files.
40. As a person, I want a plugin's secrets stored in my operating system's secure store, so that they never sit in a settings file.
41. As a person, I want each plugin to have its own private data folder, so that plugins do not read each other's data.

### Writing plugins with the Builder (Creator Mode)
42. As a person, I want to describe a plugin to the Builder and have it write one, so that I can grow aidea without programming.
43. As a person, I want the Builder to write the plugin into the quarantine and propose installing it, so that the install still goes through the scan and my confirmation.
44. As a person, I want a plugin written by the Builder to get no shortcut, so that my own agent cannot bypass the review.
45. As a Builder, I want a skill that tells me how to write a plugin (start small, look at the live app, copy a template, check it), so that I write good ones.
46. As a Builder, I want a read-only inspection of the running app (services, events, slots, settings, style tokens), so that I write against what is really there and not what I remember.
47. As a Builder, I want a plugin template to copy, so that I do not start from nothing.

### Writing plugins by hand
48. As a plugin author, I want a plugin to be a folder of finished plain JavaScript and a manifest, so that I need no build tool.
49. As a plugin author, I want to bundle my libraries into my folder beforehand, so that nothing is installed on the person's machine.
50. As a plugin author, I want to declare the capabilities my plugin uses (network, files, processes), so that the scan can confirm it.
51. As a plugin author, I want a plugin made of a host half (runs in the core) and an interface half (runs in the window), so that each part runs where it belongs.
52. As a plugin author, I want to register everything I add inside an activation function that returns how to undo it, so that unloading is total.
53. As a plugin author, I want to declare the services my plugin needs, so that aidea loads things in a sound order and keeps my plugin inactive when they are missing.
54. As a plugin author, I want to provide services other plugins can use, so that plugins can build on each other.
55. As a plugin author, I want to define my own events, namespaced and versioned, so that other plugins can react to mine without importing me.
56. As a plugin author, I want to declare an event as announcing only or able to ask for a decision, so that its power is clear.
57. As a plugin author, I want to add an interface part only to a named slot that its owner declared, and to fail on activation if the slot does not exist, so that mistakes show early.
58. As a plugin author, I want a small test tool that boots the real kernel with my plugin, activates and deactivates it, and checks everything is back to the start, so that I find leaks.
59. As a plugin author, I want one public API with one version, a promise that a major version keeps working, and a stated support time for the previous one, so that my plugin does not break every few days.

### Guards and decisions
60. As a person, I want a plugin to be able to add a guard rule that says "no" or "ask the person", so that plugins can make aidea safer.
61. As a person, I want no plugin to be able to loosen another rule, so that a malicious plugin cannot remove a protection.
62. As a person, I want the kernel to combine all rules (any "no" wins) and show the question when one asks, so that the decision is in one place.
63. As a person, I want the protection of the authored layers (changes only through a Proposal) to keep working exactly as it does now, so that the move to plugins loses nothing.

### The first built-in plugin
64. As a person, I want the Terminal Panel to be a plugin that ships with aidea, so that the API is proved by something real.
65. As a person, I want the Terminal to behave exactly as it does today (menu entry, bottom strip, moving, saved Layout), so that nothing I use changes.

## Implementation Decisions

- **Kernel.** The plugin loader and the registry of what plugins offer; the plugin manager; the window with the Layout and the named slots; the decision point for guards; configuration, credentials and the core server; the emergency screen. It works with every plugin disabled. Nothing else is in it.
- **Plugin unit.** A folder with a manifest and finished plain JavaScript, in two halves: a host half that runs in the core (Node) and an interface half that runs in the window (plain DOM and web components, no framework and no JSX, ADR 0003). The manifest is static metadata readable without executing code: id, version, title, description, icon (small, inside the folder, no links out), the API version it needs, the capabilities it declares, the services it requires and provides, the events it defines, a settings schema, and which halves it has. Libraries are bundled in; there are no install scripts and no native binaries unless declared, in which case the scan flags them.
- **Activation.** An activation function receives a context, registers what it adds (tools, services, events, guard rules, slots, routes) and returns how to undo each. Unloading is total. Load order comes from the services each plugin requires; a plugin whose requirement is missing stays inactive and says why. An error while activating switches only that plugin off.
- **Registry and services.** Services are named capabilities found by key. A role such as the Tutor or the Builder is a service type; the person-created Instances and the several Providers per Instance are not built here (see Out of Scope), but the registry must not forbid them.
- **Events.** Each event belongs to the plugin that defines it (a namespace), declares whether it only announces or can also ask for a decision, and is part of that plugin's versioned public contract. The kernel's own events follow the same rule.
- **Guards.** A plugin contributes rules that can only say "no" or "ask the person". Any "no" wins; an "ask" shows the question through the kernel. No plugin can loosen anything. The existing protection of the authored layers becomes the first rule on this mechanism without changing its behaviour.
- **Slots.** The Panel registry generalises into named slots of a declared kind. The owner of a slot declares it and the shape of what goes in; adding to a slot that does not exist fails at activation. The first slot is the Panel (a list). The other slots are listed in Further Notes. Plugin interface parts are drawn in the aidea window with the shared style tokens, never in an isolated frame; the token list is part of the public API.
- **Public API and versions.** One API version for the core and the interface together. While the major number holds, a plugin keeps working. A new major keeps the previous one for a fixed time (the number is set in the first ticket; 12 months is the working figure). Before aidea 1.0 the API may change with notice. A mismatch shows as incompatible and does not activate; this is checked at install and at load. Everything a plugin can call is in the documented API and has a contract test; the rest is private.
- **Plugin store.** A folder in the person's data area, outside every Project, holding the quarantine, the installed plugins, each plugin's private data folder and the record of what was accepted. A write lock guards it; an install snapshots what was there and restores it on failure.
- **Plugin manager.** Operations: list, inspect (read what a folder or Git link names before anything is fetched into the quarantine; a Git link is probed first), add to quarantine, scan, install, update, enable, disable, remove. Each returns a status from one fixed vocabulary: applied, failed, restart required. The same operations serve the interface, the Builder and the Tutor, implemented once as a service. Only the person confirms installing, enabling and removing; the Builder and the Tutor can write into the quarantine and propose, which opens the manager with the scan. A plugin cannot call the manager's install.
- **Scan.** Deterministic, no model. It reads the manifest and the code and compares: capabilities declared against real use of the network, files, processes, the window and the shell; obfuscation; install scripts; hidden binaries; icon limits; symbolic links leaving the folder. Blocking findings: obfuscated code, install scripts, hidden binaries, undeclared capabilities. Warnings: declared capabilities that are used. Installing despite a blocking finding needs a confirmation that names each one. The screen states the limits of a scan.
- **Tutor opinion.** The Tutor gets a read-only means to read a plugin in the quarantine as untrusted data (like its other read-only tools) and the scan result, and gives an opinion in plain words. It never decides and has no means to install.
- **Updates.** Never automatic. A new version goes to the quarantine, is compared with the accepted version, and the scan shows the difference only. Accepting is one click when nothing serious changed. Nothing inherits permission: a plugin update does not inherit the person's earlier confirmation of a blocking finding.
- **Live or restart.** Installing a new plugin, enabling, disabling, and removing one that never ran in this session apply live: the host half is loaded dynamically and the interface half is added to the window. Updating or removing a plugin whose code already ran reports restart required and offers a restart button, because the host cannot unload a loaded module.
- **Data and secrets.** Each plugin has a private data folder named by its id; settings follow a schema in the manifest and are drawn as a form; secrets go to the operating system's secure store and never to a settings file or the plugin store. Removing a plugin asks whether to delete its data; the default is to keep it. A plugin cannot read another plugin's folder through the API.
- **Safe mode and emergency screen.** A start option, available from the interface and from the command line, starts with every third-party plugin off. The emergency screen is part of the kernel and does not depend on any plugin; it lists plugins with their state and reason, and can switch any of them off.
- **Creator Mode.** The first version ships (a) a skill, a short document that tells an agent how to write a plugin: start small, discover the real API through the inspection, copy a template, check, stop; (b) a read-only inspection service that lists the services, events, slots, settings schemas and style tokens of the running app; (c) a plugin template. The agent writes into the quarantine; the person installs.
- **Plugin test tool.** A small tool that boots the real kernel with a plugin, activates and deactivates it, and asserts that every registry is back to its baseline, plus a contract test for each plugin kind (Panel, guard rule).
- **First built-in plugin.** The Terminal Panel is moved from the Layout's own registry into a plugin that ships with aidea and uses the same API as an installed one. It is removable. Its visible behaviour does not change.
- **ADRs.** ADR 0001 (no agent loop of aidea's own) and ADR 0003 (plain JavaScript and CSS) stand. GLOSSARY.md reverses "Agent adapter, avoid: plugin" and gains Kernel, Plugin, Quarantine, Role, Instance and Provider. `docs/agents/ui-style.md` gains the token list as part of the API.

## Testing Decisions

- A good test checks behaviour from outside: what the API answers, what is on the page, which code ran. It does not look at the kernel's internal structures.
- **Seam 1, the core API.** Start the core as the existing tests do (`startCore` on a free port) with a temporary plugin store, and drive the manager over HTTP using tiny REAL plugin folders as fixtures: a good one, one that declares less than it does, an obfuscated one, one with an install script, one with a hidden binary, one that throws on activation, one that asks for an API version that does not exist, one that needs a missing service, one that tries to loosen a guard, one that tries to add to an undeclared slot, one that defines an event, and one that tries to install another plugin. This covers quarantine, scan, install, update as a difference, enable, disable, remove with data choice, safe mode, versions, events, guards, the inspection, the restore after a failed install and the write lock.
- **Seam 2, the page.** Run the real page in headless Chrome through the existing driver. This covers a plugin Panel appearing and disappearing live in the Panels menu, a saved Layout that survives removing a plugin, the incompatible and inactive states, the install confirmation naming each finding, the restart button, the emergency screen, and that the Terminal tests of `.scratch/run-and-terminal` (ticket 03) still pass when the Terminal is a plugin.
- **Live checks.** At the end of each ticket, a live check in the real Electron window on the primary screen (the person now has one screen; if two return, the second), covering what headless Chrome cannot: a real install from a folder and a restart.
- Prior art: `test/ui-state.test.ts` and the recipe tests for the core API with temporary stores; `test/layout-save.test.ts` and `test/terminal-panel.test.ts` for page tests; `test/panel-registry.test.ts` for the Panel registry; the guard tests for the authored layers.

## Out of Scope

- Migrating the other existing features into plugins (Files, Code, Playback, the Tutor, the layers, the language adapters, the agent adapter). Each gets its own specification; this one only proves the API with the Terminal.
- Roles with several Instances and several Providers, and Builders working in parallel on their own branches. The registry must not forbid them.
- A marketplace, and any signing of plugins.
- The behaviour scan and the build-from-source inside a Docker container (compatible with this format, left for later).
- The run recipe, the Play control and the versions plugin; the animation engine.
- Hot replacement of the code of a plugin that already ran (Node cannot).

## Further Notes

- Open for the first tickets: the numbers behind "a fixed support time"; the exact manifest fields; the list of named slots beyond the Panel (candidates: a status item, a toolbar of a Panel, a renderer of a chat message, the selection control's buttons); which plugins are required besides the agent adapter; the exact scan rules and their thresholds; how the secure store is reached from the core when aidea is not running inside the desktop app; which services stay single-instance.
- The DeepSeek Harness documents contradict each other on whether the engine version in a manifest is enforced; aidea enforces it at install and at load.
- Tickets 04 and 05 of `run-and-terminal` (recipe and Play) wait for this system, so they are written as plugins.
