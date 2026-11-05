# 08: A project-kind plugin for Unity (scenes, prefabs, ScriptableObjects)

**What to build:** A plugin that understands a kind of project and not a language: for Unity it reads the YAML of scenes, prefabs and ScriptableObjects, assembly definitions and the package manifest, and gives the Tutor the real components of a game (which scripts sit on which objects, which prefabs a scene uses). It plugs into the same family of slots as language plugins (language-plugins 01) and teaches itself (plugin-teaching). The first project-kind plugin proves that kinds of project are plugins. (Not to be confused with a Lens in GLOSSARY.md, which is an overlay of information on a layer.)

**Blocked by:** language-plugins 01.

**Status:** needs-info: the project-kind slot (what such a plugin may return and how the Tutor asks for it)

- [ ] The slot for project-kind plugins is described in `docs/plugin-api.md`.
- [ ] On the person's ShipsProject the plugin lists scenes, prefabs and the scripts attached, in well under 10 s.
- [ ] A Project that is not Unity does not load the plugin.
- [ ] The plugin ships a lesson and a teaching surface.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.
