# Everything is a plugin: interview decisions

Started 2026-11-04. Source of the questions: `.scratch/plugins/research/01-deepseek-plugin-philosophy.md` (section 17). The person answers one question at a time; each decision is recorded here. Background: `.scratch/future/interviews-pending.md` (REVISED section) and ADR 0001.

## 1. The kernel
DECIDED 2026-11-04: aidea has a small real kernel that is NOT a plugin (option A, as the agent recommended). The kernel is: the plugin loader and the registry of what plugins offer; the plugin manager (quarantine, install, remove, enable, disable, and a safe mode that starts with every third-party plugin off); the window with the Layout and the named slots where plugins put things; the point that decides on guards (plugins contribute rules, the kernel decides); configuration, credentials and the core server; a minimal emergency screen to see and switch off plugins. Everything else (Panels, layers, language adapters, the Tutor, agent adapters, tools, guard rules, Playback, the terminal) is a plugin shipped with aidea on the same API as an installed one. Not chosen: no kernel at all, as DeepSeek does (a broken plugin could leave no way to switch it off), and a larger kernel with the basic Panels in it.

## 2. Built-in plugins
DECIDED 2026-11-04: the plugins that ship with aidea can be removed like any installed one, except a few marked required (for example the agent adapter and the emergency screen). Removing one that another plugin needs leaves that other plugin inactive and aidea says why instead of breaking (option A, as the agent recommended). Not chosen: removable without exception, and shipped plugins that can only be switched off.

## 3. The API version and the promise
DECIDED 2026-11-04: one version of the public API for the core and the interface together. While the major number does not change, a plugin keeps working; when a new major version appears the previous one is kept for a fixed time (for example 12 months). A plugin that asks for a version aidea does not offer is shown as "incompatible" and does not activate, without breaking anything. Before aidea version 1 the API may change with notice (option A, as the agent recommended). Not chosen: two separate versions, and no promise as DeepSeek has.

## 4. The format of a plugin
DECIDED 2026-11-04 (by the agent; the person had no preference and said they did not know what is more comfortable for the people who write plugins): a plugin is delivered as plain, finished JavaScript in a folder with a manifest. Any library it uses is bundled into its folder beforehand. Nothing is installed at activation, there are no install scripts, and native binaries are not allowed unless the manifest declares them, in which case the scanner flags them. Reason: the main author will be the Builder writing small plugins from a description (as in Creator Mode of the DeepSeek Harness), which needs no build tool; and the quarantine can read exactly what will run. Left open and compatible with this choice: later, building from source inside a Docker container (only when Docker exists) can produce this same folder, and a container can serve as an optional behaviour scan. Not chosen now: an install step on the person's machine, and compiling TypeScript inside aidea.

## 5. Where the interface of a plugin is drawn
DECIDED 2026-11-04: in the same window as aidea, with aidea's look (the shared scale of sizes and colours), not in an isolated frame (option A, as the agent recommended). Reason: an installed plugin already runs with the person's permissions in the core, so isolating only its drawing would protect nothing real; the protection is the quarantine before installing. Not chosen: an isolated frame.

## 6. What the scanner does with a finding
DECIDED 2026-11-04: some findings block and others only warn (option A, as the agent recommended). Blocking findings: obfuscated code, install scripts, hidden binaries, and doing something the manifest does not declare (for example using the network without saying so). The person can install anyway, only after a confirmation that names each blocking finding. Warnings: capabilities the plugin declared and uses (network, files). The screen must say that a scan lowers the risk and does not prove a plugin is safe. Not chosen: nothing blocks, and every finding blocks with no way past it.

## 7. Updates
DECIDED 2026-11-04: every update, even a small one, goes through the quarantine, but it is compared with the version the person accepted, and the scanner shows only what changed (new files, new capabilities, new findings). If nothing serious changed it is one click (option A, as the agent recommended). Not chosen: skipping the review for small updates, and a full scan from zero for every update.
