# 02: Python becomes a built-in plugin, on by default

**What to build:** `python-adapter.ts`, `python.ts` and the Python-side scripts (`analyze.py`, `playback.py`) move into a plugin that ships with aidea and is on by default. It can be turned off or removed like any shipped plugin. Behaviour does not change: every existing test passes untouched. Python is the default language, not a required one.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The plugin loads at startup, on by default, and appears in the plugin manager with the capabilities it declares.
- [ ] Every existing test passes without being edited.
- [ ] Turning it off makes Python files show as not analysed (ticket 04 gives the message).
- [ ] The plugin ships a lesson once plugin-lessons 01 exists.
