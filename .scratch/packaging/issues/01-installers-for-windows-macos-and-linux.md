# 01: Installers for Windows, macOS and Linux

**What to build:** aidea runs today with `electron .`. Package it: one installer per system and processor (Windows x64 and arm64, macOS x64 and arm64, Linux x64 and arm64), each built with the variants of the built-in plugins for that system (the TypeScript native program, for example). On macOS the app and every native program inside are signed and notarized. A test fails the build when a variant is missing.

**Blocked by:** language-plugins 03.

**Status:** needs-info: a spec first (signing accounts, the CI, how updates arrive)

- [ ] The spec says how each installer is built and signed and how updates reach the person.
- [ ] A CI builds the six installers; each starts and opens a fixture Project (a smoke test per system).
- [ ] A missing variant of a built-in plugin fails the build.
- [ ] The macOS build is signed and notarized.
- [ ] The installer size is reported.

Source: `.scratch/language-plugins/spec.md`, the VS Code model.
