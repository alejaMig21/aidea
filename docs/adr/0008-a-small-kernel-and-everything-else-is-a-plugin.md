# aidea is a small kernel; everything else is a plugin

**Accepted by the person (2026-11-04).** aidea's philosophy does not change (layers, the Contract, the Tutor, learning while building). What changes is how it is built: every feature is a plugin, so aidea can keep growing, even in a packaged build, by plugins that the person or the Builder adds. The sixteen decisions behind this are in `.scratch/plugins/interview.md`; the study of the DeepSeek Harness that inspired it is in `.scratch/plugins/research/01-deepseek-plugin-philosophy.md` and `.scratch/harness/research/02-deepseek-harness.md`.

Until now a new Panel had to be written into the repository's code. The person found aidea closed ("a box too sealed") next to harnesses where the agent loop itself, and any Panel, is a plugin. This decision takes the shape of that idea (a small plugin framework, a ladder of mechanisms from weakest to strongest, plugins in two halves, named slots, inspection before installing, an agent that writes plugins) and not its weaknesses (an API that breaks every few days, a React-bound interface, installing with a package manager, plugin code with no review).

## Decision

1. **A small real kernel is not a plugin:** the plugin loader and the registry of what plugins offer; the plugin manager (quarantine, install, remove, enable, disable, safe mode that starts with every third-party plugin off); the window with the Layout and the named slots; the point that decides on guards; configuration, credentials and the core server; a minimal emergency screen to see and switch off plugins.
2. **Everything else is a plugin on the same API:** Panels, layers, language adapters, the Tutor, agent adapters, tools, guard rules, Playback, the terminal, the run recipe. Those that ship with aidea can be removed like any other, except a few marked required (such as the agent adapter and the emergency screen). A plugin whose dependency is missing stays inactive and says why.
3. **One public API with one version** for the core and the interface together. While the major number holds, a plugin keeps working; the previous major is kept for a fixed time (for example 12 months). A plugin asking for a version aidea does not offer is shown as incompatible and does not activate. Before aidea 1.0 the API may change with notice.
4. **A plugin is a folder of finished plain JavaScript and a manifest** (static metadata readable without running code, including the API version it needs and the capabilities it declares). Libraries are bundled in beforehand; nothing is installed at activation; no install scripts; no native binaries unless declared, and then flagged. Its interface is drawn in aidea's own window with the shared style tokens, never in an isolated frame.
5. **Trust:** a third-party plugin comes from a local folder or a Git link into a quarantine folder where nothing runs. A scan without a model compares what the manifest declares with what the code does; blocking findings (obfuscated code, install scripts, hidden binaries, undeclared capabilities) can be overridden only by a confirmation that names each one; declared capabilities only warn. The Tutor may give an opinion, never a decision. After install a plugin runs with the person's own permissions, as in VS Code; the screen says a scan lowers risk and proves nothing. Every update returns to quarantine and is shown as a difference from the accepted version. A marketplace may come later and changes none of this.
6. **Guard rules from plugins can only tighten** (say no or ask the person), never loosen; the kernel decides. Plugins may define their own events, namespaced, versioned and part of their public contract.
7. **Roles have instances.** The Tutor and the Builder are roles; the person can create several instances of each (at least one), each connected to its own provider plugin (an adapter for Claude Code, DeepSeek, Codex, Kimi and so on). This is a stated goal, not for version 1.
8. **Only the person installs, enables and removes plugins.** The Builder and the Tutor can write a plugin into the quarantine and propose installing it. The direction is that agents can do everything in the app: each operation is implemented once as a service that the interface and the agents both call; actions that grant authority stay with the person unless they decide otherwise.
9. **Creator Mode from day one:** the first version ships the skill that tells an agent how to write a plugin and a read-only live inspection of the running app (services, slots, settings, style tokens).
10. **Changes apply live** (install, enable, disable, remove something that never ran); updating or removing code that already ran asks for a restart, with the same status words everywhere (applied, failed, restart required).
11. **Plugin data** lives in a private folder per plugin outside any Project; settings are a schema in the manifest drawn as a form; secrets go to the operating system's secure store; removing a plugin asks whether to delete its data, keeping it by default.
12. **Migration is step by step, after version 1:** first the kernel and the API, then the existing features as built-in plugins one at a time (the Panels Terminal, Files and Code first), with aidea usable after each step and the existing tests kept.

## Considered Options

- **No kernel, as the DeepSeek Harness has it.** A broken plugin could leave the person unable to switch it off. Rejected.
- **A bigger kernel that holds the basic Panels.** Less work now, and it drifts away from "everything is a plugin". Rejected.
- **Build aidea inside the DeepSeek Harness or on a fork of it.** Its UI plugins are React components in the host's own slots, its API changes between release candidates and is unaudited, its Claude Code backend is one-shot and uses the Agent SDK (the grey area ADR 0001 avoids), and a fork of about 55 packages is heavy to keep. Rejected for now; it can be one more agent adapter later. See `.scratch/future/ideas.md`.
- **Rewrite everything as plugins at once.** Weeks without a working app and the loss of the existing tests. Rejected.

## Consequences

- The Panel registry of `src/ui/features/07-layout.js` is the seed of the slot system; a Panel stays one declaration, now also possible from outside the repository.
- ADR 0001 stands: aidea owns no agent loop; an agent adapter is a plugin that drives an agent as a child process. ADR 0003 stands for the interface, now including plugin interfaces: plain JavaScript and CSS, no framework. The grey area of the Agent SDK stays avoided.
- The glossary term **Agent adapter** says "avoid: plugin"; that is reversed, and the glossary needs Kernel, Plugin, Quarantine, Role, Instance and Provider.
- The decisions of the plugins interview of topic 2 (quarantine, scan, Tutor opinion, updates through quarantine, full permissions after install) are kept; "Panels only first" is replaced by this ADR.
- The run recipe and the terminal (`.scratch/run-and-terminal`) wait for the plugin design so they are not built as a monolith; tickets 01 to 03 of that spec are done and move into plugins in the migration.
- Open for the spec: which services stay single-instance; how parallel Builders on separate git branches are coordinated; the exact manifest fields; the list of named slots; the list of required plugins; the exact scan rules and the numbers behind "a fixed time" of support.
- An optional behaviour scan in a Docker container, and building a plugin from source in a container, are left for later and compatible with this format.

## When this changes

Revisit if the cost of the API promise (decision 3) proves too high for a small team, if plugin review cannot be kept cheap enough that the person actually reads it, or if the DeepSeek Harness reaches a stable release with isolated plugins and a long-lived Claude Code backend.
