# 02: The Tutor can read a plugin's view and run its checks

**What to build:** Two Tutor-only tools (next to `read_quarantined_plugin`, in `PLUGIN_READ_TOOLS`): `read_plugin_view` and `run_plugin_check`. They work only for installed, enabled plugins. They run with no way to write, start a process or reach the network, with a time limit and a limit on the size of the answer. What they return reaches the Tutor marked as untrusted data, like a lesson, so the Tutor never follows instructions found in it. The Tutor has no tool that changes anything inside a plugin.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The Tutor can read the view of an enabled plugin and run one of its checks; a disabled or removed plugin answers in plain words that it is not there.
- [ ] A view that tries to write a file, start a process or call the network is stopped (a fixture proves each).
- [ ] A view or check that takes too long, or returns too much, is cut off with a plain message.
- [ ] Text in a result that looks like an instruction is treated as data (a fake Tutor proves it).
- [ ] The pinned list of Tutor tools in the tests is updated; core API tests pass.

Source: `.scratch/plugin-teaching/spec.md`.
