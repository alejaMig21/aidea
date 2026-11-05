# 08: A lens for Unity projects (scenes, prefabs, ScriptableObjects)

**What to build:** A plugin that understands a kind of project and not a language: for Unity it reads the YAML of scenes, prefabs and ScriptableObjects, assembly definitions and the package manifest, and gives the Tutor the real components of a game (which scripts sit on which objects, which prefabs a scene uses). It plugs into the same slot as language plugins and teaches itself (plugin-teaching). The first lens proves that lenses are plugins.

**Blocked by:** language-plugins 01

**Status:** needs-info: the lens slot (what a lens may return and how the Tutor asks for it)

- [ ] The slot for lenses is described in `docs/plugin-api.md`.
- [ ] On the person's ShipsProject the lens lists scenes, prefabs and the scripts attached, in well under 10 s.
- [ ] A Project that is not Unity does not load the lens.
- [ ] The lens ships a lesson and a teaching surface.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.
