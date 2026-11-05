# 02: The Tutor can read a plugin's view and run its checks

**What to build:** Two Tutor-only tools (next to `read_quarantined_plugin`, in `PLUGIN_READ_TOOLS`): `read_plugin_view` and `run_plugin_check`. They work only for installed, enabled plugins. They run with no way to write, start a process or reach the network, with a time limit and a limit on the size of the answer. What they return reaches the Tutor marked as untrusted data, like a lesson, so the Tutor never follows instructions found in it. The Tutor has no tool that changes anything inside a plugin.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live in Electron on the main monitor)

- [x] The Tutor can read the view of an enabled plugin and run one of its checks; a disabled or removed plugin answers in plain words that it is not there.
- [x] A view that tries to write a file, start a process or call the network is stopped (a fixture proves each).
- [x] A view or check that takes too long, or returns too much, is cut off with a plain message.
- [x] Text in a result that looks like an instruction is treated as data (a fake Tutor proves it).
- [x] The pinned list of Tutor tools in the tests is updated; core API tests pass.

Source: `.scratch/plugin-teaching/spec.md`.

## What was built (2026-11-05)

- `src/core/plugins/teach.ts`: the Tutor tools `read_plugin_view` and `check_plugin` (Tutor only, in `PLUGIN_READ_TOOLS`, called from `routes/mcp.ts`). They work for installed, enabled plugins; arguments are checked against the shapes the manifest declares; answers are marked untrusted.
- The plugin gives a snapshot of its state with `ctx.teach.state(fn)` (host half); `teach.module` (new optional manifest field) holds `view(snapshot)` and `checks`. They run in a process started with `--permission` (read the plugin folder only), the network cut before the module loads (`teach-runner.mjs`), 3 seconds and 20,000 characters.
- The check tool is named `check_plugin`, not `run_...`: two guard tests forbid a Tutor tool whose name says run, and the principle is kept (it changes nothing).
- Live: `.scratch/plugin-teaching/live-scripts/teach-tools.mjs`, on the main monitor: in Electron's own runtime a view and a check are read and run, a module that writes, starts a program or reaches the network is stopped (no file written, no request received), and the real window starts with the plugin active.
- `docs/plugin-api.md`: "The teaching surface".
