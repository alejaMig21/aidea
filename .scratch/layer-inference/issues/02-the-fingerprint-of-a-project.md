# 02: The fingerprint of a project, and the Tutor can read it

**What to build:** A fast, language-neutral summary of any Project, built without parsing code: file tree with sizes and languages by extension, manifests and what they declare (package names, dependencies, scripts, workspaces), entry points, tests present, documents that exist, and a summary of git history. A Tutor read tool `read_fingerprint` returns it, bounded in size. It is what a class starts from instead of reading many files.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Telegram, hubstaff-automation, a Unity project and a Node monorepo each give a fingerprint in under 1 s (measured).
- [ ] The fingerprint names the manifests and entry points found, and never reads file contents beyond manifests.
- [ ] The tool answer is bounded, says when it cut and how to ask for more, and stays inside the Project folder.
- [ ] Core API tests pass; the pinned list of Tutor tools is updated.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.
